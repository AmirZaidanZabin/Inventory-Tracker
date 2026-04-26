export const tzOffsetsCache = {};

export function getServerOffsetMinutes(dateStr, serverTz) {
    if (!serverTz) serverTz = 'UTC';
    if (!dateStr || dateStr === 'undefined' || dateStr === 'null') return 0;
    const key = `${dateStr}_${serverTz}`;
    if (tzOffsetsCache[key] !== undefined) return tzOffsetsCache[key];

    const d = new Date(`${dateStr}T12:00:00`);
    if (isNaN(d.getTime())) return 0; // Fallback for invalid dates
    
    const parts = new Intl.DateTimeFormat('en-GB', { 
        timeZone: serverTz, 
        timeZoneName: 'longOffset'
    }).formatToParts(d);
    
    const tzPart = parts.find(p => p.type === 'timeZoneName')?.value;
    if (!tzPart) return 0;
    
    let offsetMinutes = 0;
    if (tzPart.includes('+')) {
        const [h, m] = tzPart.split('+')[1].split(':').map(Number);
        offsetMinutes = (h * 60) + (m || 0);
    } else if (tzPart.includes('-')) {
        const [h, m] = tzPart.split('-')[1].split(':').map(Number);
        offsetMinutes = -( (h * 60) + (m || 0) );
    }
    
    tzOffsetsCache[key] = offsetMinutes;
    return offsetMinutes;
}

export function formatServerToLocalTime(serverDateStr, serverTimeStr, serverTz) {
    if (!serverTimeStr || !serverDateStr || serverDateStr === 'undefined' || serverDateStr === 'null') return serverTimeStr || '';
    const serverOffset = getServerOffsetMinutes(serverDateStr, serverTz);
    
    // Create Date representing that local time in the browser (ignoring what literal moment it is)
    // Then shift it by the diff.
    const [hr, min] = serverTimeStr.split(':').map(Number);
    let totalMins = (hr * 60) + min;
    
    // We want to translate "Server Time totalMins" to "Browser Time totalMins".
    // Server is at +serverOffset. Browser is at +browserOffset.
    // e.g. Server is +180 (KSA), totalMins = 480 (8 AM).
    // Browser is -240 (NY).
    // Browser time = 480 + (-240) - 180 = 480 - 420 = 60 (1 AM).
    
    // Wait! Let's just use exact timestamps.
    // serverDateStr is YYYY-MM-DD.
    // The exact UTC milliseconds is: Date.UTC(year, month-1, day, hr, min) - (serverOffset * 60000)
    const [y, m, d] = serverDateStr.split('-').map(Number);
    const exactUtcMs = Date.UTC(y, m - 1, d, hr, min) - (serverOffset * 60000);
    
    // Now create a 'new Date(exactUtcMs)' and ask it to format its local time
    const browserDate = new Date(exactUtcMs);
    
    // Return HH:MM format
    let outH = browserDate.getHours();
    let outM = browserDate.getMinutes();
    let ampm = outH >= 12 ? 'PM' : 'AM';
    return `${outH % 12 || 12}:${outM.toString().padStart(2, '0')} ${ampm}`;
}

export function convertLocalToServerTime(localDateStr, localTimeStr, serverTz) {
    if (!localTimeStr || !localDateStr || localDateStr === 'undefined' || localDateStr === 'null') return { date: localDateStr || '', time: localTimeStr || '' };
    
    // E.g. local wants 10:00 (which is 10:00 NY time).
    // The exact moment:
    const [y, m, d] = localDateStr.split('-').map(Number);
    const [hr, min] = localTimeStr.split(':').map(Number);
    const localDateObj = new Date(y, m - 1, d, hr, min);
    
    if (isNaN(localDateObj.getTime())) return { date: localDateStr, time: localTimeStr };

    // Now, format this exact moment in the server's timezone.
    const formatter = new Intl.DateTimeFormat('en-CA', { // en-CA yields YYYY-MM-DD
        timeZone: serverTz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
    });
    
    const parts = formatter.formatToParts(localDateObj);
    const vals = {};
    parts.forEach(p => vals[p.type] = p.value);
    
    // Check if hour is 24 format (Intl sometimes gives '24' for midnight when hour12=false)
    let sHr = parseInt(vals.hour);
    if(sHr === 24) sHr = 0;
    
    return {
        date: `${vals.year}-${vals.month}-${vals.day}`,
        time: `${sHr.toString().padStart(2, '0')}:${vals.minute}`
    };
}
