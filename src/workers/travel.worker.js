// Travel Logic Worker

let TRAVEL_CACHE = new Map();
const DEFAULT_PREP_TIME = 15;

async function fetchOSRMRoute(lat1, lon1, lat2, lon2) {
    const key = `${lat1},${lon1};${lat2},${lon2}`;
    if (TRAVEL_CACHE.has(key)) return TRAVEL_CACHE.get(key);

    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("OSRM API error");
        const data = await res.json();
        
        if (data.routes && data.routes.length > 0) {
            const route = {
                distanceKm: data.routes[0].distance / 1000,
                durationMin: Math.ceil(data.routes[0].duration / 60)
            };
            TRAVEL_CACHE.set(key, route);
            return route;
        }
    } catch (e) {
        // Fallback to Haversine
    }
    return null;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

async function estimateDuration(lat1, lon1, lat2, lon2) {
    const route = await fetchOSRMRoute(lat1, lon1, lat2, lon2);
    if (route) {
        return route.durationMin + DEFAULT_PREP_TIME;
    }
    const dist = calculateDistance(lat1, lon1, lat2, lon2);
    return Math.round((dist / 40) * 60 + DEFAULT_PREP_TIME);
}

function findAdjacentAppointments(techId, dateStr, timeStr, allAppointments, userBase) {
    const dailyAppts = allAppointments
        .filter(a => a.tech_id === techId && a.schedule_date === dateStr && !a.is_deleted)
        .sort((a, b) => (a.appointment_time || '00:00').localeCompare(b.appointment_time || '00:00'));

    const preceding = [...dailyAppts].reverse().find(a => (a.appointment_time || '00:00') < timeStr);
    const following = dailyAppts.find(a => (a.appointment_time || '00:00') > timeStr);

    const formatLoc = (apt, label) => apt?.metadata?.location?.lat ? {
        lat: parseFloat(apt.metadata.location.lat),
        lng: parseFloat(apt.metadata.location.lng),
        source: `${label}: ${apt.appointment_id}`
    } : null;

    const base = userBase?.lat ? { lat: parseFloat(userBase.lat), lng: parseFloat(userBase.lng), source: 'Tech Base' } : null;

    return {
        prev: formatLoc(preceding, 'Job') || base,
        next: formatLoc(following, 'Job') || base
    };
}

self.onmessage = async (e) => {
    const { id, type, payload } = e.data;
    
    if (type === 'CALCULATE_GRID') {
        const { techs, dateStr, lat, lng, dailyApts } = payload;
        
        try {
            const travelMetrics = [];
            await Promise.all(techs.map(async (t) => {
                const adj = findAdjacentAppointments(t.id, dateStr, '12:00', dailyApts, t.metadata?.base_location);
                let prevTravel = 0;
                if (adj.prev) prevTravel = await estimateDuration(parseFloat(lat), parseFloat(lng), adj.prev.lat, adj.prev.lng);
                travelMetrics.push({ 
                    techId: t.id, 
                    prevTravel, 
                    adj 
                });
            }));
            
            self.postMessage({ id, success: true, result: travelMetrics });
        } catch (error) {
            self.postMessage({ id, success: false, error: error.message });
        }
    }
};
