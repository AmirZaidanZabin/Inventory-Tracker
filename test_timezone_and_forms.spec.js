import { describe, it, expect, vi } from 'vitest';
import { getServerOffsetMinutes, formatServerToLocalTime, convertLocalToServerTime } from './src/lib/timezone.js';

describe('Timezone utilities', () => {
    it('getServerOffsetMinutes should return correct minutes for a known timezone', () => {
        // UTC should always be 0
        expect(getServerOffsetMinutes('2026-05-15', 'UTC')).toBe(0);
        
        // KSA is GMT+03:00 -> 180 minutes
        expect(getServerOffsetMinutes('2026-05-15', 'Asia/Riyadh')).toBe(180);

        // Dubai is GMT+04:00 -> 240 minutes
        expect(getServerOffsetMinutes('2026-05-15', 'Asia/Dubai')).toBe(240);
        
        // New York can be GMT-04:00 (EDT) or GMT-05:00 (EST). Let's just confirm it parses negative numbers
        const nyOffset = getServerOffsetMinutes('2026-05-15', 'America/New_York');
        expect(nyOffset).toBeLessThan(0);
    });

    it('formatServerToLocalTime should output a formatted AM/PM string', () => {
        // This relies on the environment's current local timezone, so we mock the local behavior or just ensure the string formatting logic executes properly.
        const output = formatServerToLocalTime('2026-05-15', '13:00', 'Asia/Riyadh');
        expect(typeof output).toBe('string');
        expect(output).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
    });

    it('convertLocalToServerTime should return valid date and time strings', () => {
        const result = convertLocalToServerTime('2026-05-15', '13:00', 'UTC');
        expect(result).toHaveProperty('date');
        expect(result).toHaveProperty('time');
        expect(result.date).toMatch(/^2026-\d{2}-\d{2}$/);
        expect(result.time).toMatch(/^\d{2}:\d{2}$/);
    });
});
