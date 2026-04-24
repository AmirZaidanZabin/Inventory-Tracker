/**
 * Simple Testing Utility for Vanilla JS
 */
export function tester() {
    const results = [];
    window._isTesting = true;

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
        // --- DOM Testing Utilities ---
        waitForElement: async (container, selector, timeout = 2000) => {
            const start = Date.now();
            while (Date.now() - start < timeout) {
                const el = container.querySelector(selector);
                if (el) return el;
                await new Promise(r => setTimeout(r, 50));
            }
            throw new Error(`Timeout waiting for element: ${selector}`);
        },
        simulateClick: (element) => {
            if (!element) throw new Error('Cannot click null element');
            element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        },
        simulateType: (element, value) => {
            if (!element) throw new Error('Cannot type in null element');
            element.value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
        },
        waitFor: async (predicate, message = 'Condition not met', timeout = 3000) => {
            const start = Date.now();
            while (Date.now() - start < timeout) {
                if (await predicate()) return;
                await new Promise(r => setTimeout(r, 100));
            }
            throw new Error(`Timeout: ${message}`);
        },
        assertDOMContains: (container, text, message) => {
            if (!container.textContent.includes(text)) {
                throw new Error(message || `Expected DOM to contain text: "${text}"`);
            }
        },
        summary: () => {
            const passed = results.filter(r => r.status === 'PASS').length;
            const failed = results.filter(r => r.status === 'FAIL').length;
            console.log(`%c Summary: ${passed} passed, ${failed} failed `, 'font-weight: bold; border-top: 1px solid #ccc; padding-top: 10px;');
            window._isTesting = false;
            return { passed, failed, results };
        }
    };
}
