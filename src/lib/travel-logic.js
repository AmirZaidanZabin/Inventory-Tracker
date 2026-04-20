/**
 * Distance and Travel Logic Helper
 */

// Average urban speed in km/h
const DEFAULT_AVG_SPEED = 40; 
const DEFAULT_PREP_TIME = 15; // 15 mins buffer/prep

/**
 * Haversine formula for distance in KM
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

/**
 * Returns estimated travel time in minutes
 * @param {number} distanceKm 
 * @param {number} [speed] - Overrides default speed
 * @param {number} [prepTime] - Overrides default prep time
 */
export function estimateDuration(distanceKm, speed = DEFAULT_AVG_SPEED, prepTime = DEFAULT_PREP_TIME) {
    const travelMinutes = (distanceKm / speed) * 60;
    return Math.round(travelMinutes + prepTime);
}

/**
 * Finds the origin (previous location) for a specific van at a given time
 */
export function findPrecedingLocation(vanId, dateStr, timeStr, allAppointments, vanData) {
    // 1. Filter appts for this van on this date
    const dailyAppts = allAppointments
        .filter(a => a.van_id === vanId && a.schedule_date === dateStr && !a.is_deleted)
        .sort((a, b) => (a.appointment_time || '00:00').localeCompare(b.appointment_time || '00:00'));

    // 2. Find the last appt before timeStr
    const preceding = [...dailyAppts].reverse().find(a => (a.appointment_time || '00:00') < timeStr);

    if (preceding && preceding.metadata?.location?.lat) {
        return {
            lat: parseFloat(preceding.metadata.location.lat),
            lng: parseFloat(preceding.metadata.location.lng),
            source: `Job ${preceding.appointment_id}`
        };
    }

    // 3. Fallback to van default location
    if (vanData && vanData.default_lat && vanData.default_lng) {
        return {
            lat: parseFloat(vanData.default_lat),
            lng: parseFloat(vanData.default_lng),
            source: 'Van Base'
        };
    }

    return null;
}
