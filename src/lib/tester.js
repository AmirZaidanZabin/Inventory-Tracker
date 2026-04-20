/**
 * Simple Testing Utility for Vanilla JS
 */
export function tester() {
    const results = [];

    return {
        test: async (name, fn) => {
            try {
                await fn();
                results.push({ name, status: 'PASS' });
                console.log(`%c PASS %c ${name}`, 'background: #10b981; color: white; padding: 2px 4px; border-radius: 3px;', '');
            } catch (err) {
                results.push({ name, status: 'FAIL', error: err.message });
                console.error(`%c FAIL %c ${name}`, 'background: #ef4444; color: white; padding: 2px 4px; border-radius: 3px;', '');
                console.error(err);
            }
        },
        assert: (condition, message) => {
            if (!condition) throw new Error(message || 'Assertion failed');
        },
        summary: () => {
            const passed = results.filter(r => r.status === 'PASS').length;
            const failed = results.filter(r => r.status === 'FAIL').length;
            console.log(`%c Summary: ${passed} passed, ${failed} failed `, 'font-weight: bold; border-top: 1px solid #ccc; padding-top: 10px;');
            return { passed, failed, results };
        }
    };
}
