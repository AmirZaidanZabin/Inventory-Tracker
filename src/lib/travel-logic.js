/**
 * Distance and Travel Logic Helper (Geospatial & Proximity Aware)
 */

const TRAVEL_CACHE = new Map();
const DEFAULT_PREP_TIME = 15; // 15 mins buffer/prep

/**
 * Fetch routing data from OSRM
 */
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
        console.warn("OSRM fetch failed, falling back to Haversine:", e.message);
    }
    return null;
}

/**
 * Haversine fallback
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
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

/**
 * Enhanced Duration Estimator (Async OSRM)
 */
export async function estimateDuration(lat1, lon1, lat2, lon2) {
    const route = await fetchOSRMRoute(lat1, lon1, lat2, lon2);
    if (route) {
        return route.durationMin + DEFAULT_PREP_TIME;
    }
    // Fallback to Haversine (40km/h avg)
    const dist = calculateDistance(lat1, lon1, lat2, lon2);
    return Math.round((dist / 40) * 60 + DEFAULT_PREP_TIME);
}

/**
 * Finds the nearest existing locations for buffering
 */
export function findAdjacentAppointments(techId, dateStr, timeStr, allAppointments, userBase) {
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

    // Fallback to base coordinates if first/last of day
    const base = userBase?.lat ? { lat: parseFloat(userBase.lat), lng: parseFloat(userBase.lng), source: 'Tech Base' } : null;

    return {
        prev: formatLoc(preceding, 'Job') || base,
        next: formatLoc(following, 'Job') || base
    };
}

/**
 * Hardened check to see if a technician is on vacation 
 */
export function isUserOnVacation(user, dateStr) {
    if (!user.metadata?.vacation || !Array.isArray(user.metadata.vacation)) return false; 
    
    // Normalize targetDate to midnight for reliable comparison
    const targetDate = new Date(dateStr);
    targetDate.setHours(0, 0, 0, 0);
    const targetTime = targetDate.getTime();
    
    return user.metadata.vacation.some(range => {
        if (!range.start || !range.end) return false;
        
        const start = new Date(range.start);
        start.setHours(0, 0, 0, 0);
        
        const end = new Date(range.end);
        end.setHours(23, 59, 59, 999); // Inclusion check for full day
        
        return targetTime >= start.getTime() && targetTime <= end.getTime();
    });
}

/**
 * TSP Route Optimizer (Greedy Nearest Neighbor)
 * @param {Array} appointments - List of appointments for a tech on a day
 * @param {Object} techBase - Optional tech base {lat, lng} to start the day
 * @param {String} startTime - 'HH:MM' string to start the first job, e.g. '08:00'
 */
export async function optimizeRoute(appointments, techBase = null, startTime = '08:00') {
    if (!appointments || appointments.length === 0) return [];
    if (appointments.length === 1) {
        appointments[0].appointment_time = startTime;
        return appointments;
    }

    let unvisited = [...appointments];
    let optimized = [];
    
    // Find starting point (base, or first job chronologically if no base)
    let currentCoord = techBase;
    
    if (!currentCoord && unvisited[0]?.metadata?.location?.lat) {
        // No base provided? Start from the first appointment currently scheduled
        unvisited.sort((a, b) => (a.appointment_time || '00:00').localeCompare(b.appointment_time || '00:00'));
        currentCoord = {
            lat: parseFloat(unvisited[0].metadata.location.lat),
            lng: parseFloat(unvisited[0].metadata.location.lng)
        };
    } else if (!currentCoord) {
        // Fallback to random job if no coords
        currentCoord = { lat: 0, lng: 0 };
    }

    // Nearest neighbor algorithm
    while (unvisited.length > 0) {
        let nearestIdx = 0;
        let minTime = Infinity;
        
        for (let i = 0; i < unvisited.length; i++) {
            const apt = unvisited[i];
            const loc = apt.metadata?.location;
            if (loc && loc.lat && loc.lng) {
                // Use synchronous haversine for speed in sorting
                const dist = calculateDistance(currentCoord.lat, currentCoord.lng, parseFloat(loc.lat), parseFloat(loc.lng));
                if (dist < minTime) {
                    minTime = dist;
                    nearestIdx = i;
                }
            } else {
                // If it has no location, stick it at the end
                if (minTime === Infinity) nearestIdx = i;
            }
        }
        
        const nextJob = unvisited.splice(nearestIdx, 1)[0];
        optimized.push(nextJob);
        
        if (nextJob.metadata?.location?.lat) {
            currentCoord = {
                lat: parseFloat(nextJob.metadata.location.lat),
                lng: parseFloat(nextJob.metadata.location.lng)
            };
        }
    }
    
    // Reassign times sequentially
    let startMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1] || 0);
    
    for (let i = 0; i < optimized.length; i++) {
        const h = Math.floor(startMinutes / 60).toString().padStart(2, '0');
        const m = Math.floor(startMinutes % 60).toString().padStart(2, '0');
        optimized[i].appointment_time = `${h}:${m}`;
        
        // Add duration + next travel time
        const duration = optimized[i].metadata?.duration_minutes || parseInt(optimized[i].duration || '60', 10);
        
        if (i < optimized.length - 1) {
            const thisLoc = optimized[i].metadata?.location;
            const nextLoc = optimized[i+1].metadata?.location;
            if (thisLoc?.lat && nextLoc?.lat) {
                const travelMin = Math.round(calculateDistance(
                    parseFloat(thisLoc.lat), parseFloat(thisLoc.lng), 
                    parseFloat(nextLoc.lat), parseFloat(nextLoc.lng)
                ) / 40 * 60) + DEFAULT_PREP_TIME; // Approx
                startMinutes += duration + travelMin;
            } else {
                startMinutes += duration + DEFAULT_PREP_TIME;
            }
        }
    }

    return optimized;
}
