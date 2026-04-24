import { firebase } from '../lib/firebase.js';
import { db } from '../lib/db/index.js';
import { MobileStockView } from '../views/view.mobile_stock.js';
import { MobileAppointmentView } from '../views/view.mobile_appointment.js';

// --- MOCK DEFINITIONS ---
class MockHtml5Qrcode {
    constructor(elementId) {
        this.elementId = elementId;
        this.isScanning = false;
        this.onSuccess = null;
        this.onError = null;
        this.isPaused = false;
        window._activeMockScanner = this;
    }

    start(cameraConfig, config, onSuccess, onError) {
        this.isScanning = true;
        this.onSuccess = onSuccess;
        this.onError = onError;
        return Promise.resolve();
    }

    pause() {
        this.isPaused = true;
    }

    resume() {
        this.isPaused = false;
    }

    stop() {
        this.isScanning = false;
        this.onSuccess = null;
        this.onError = null;
        if (window._activeMockScanner === this) {
            window._activeMockScanner = null;
        }
        return Promise.resolve();
    }

    static simulateScan(barcodeText) {
        if (window._activeMockScanner && window._activeMockScanner.isScanning && !window._activeMockScanner.isPaused && window._activeMockScanner.onSuccess) {
            window._activeMockScanner.onSuccess(barcodeText);
        } else if (!window._activeMockScanner) {
            console.warn("Simulate Scan failed: No active mock scanner.");
        }
    }
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function runScannerTests(t) {
    console.log("Running Barcode Scanner Automation Tests...");
    
    // Inject Mock
    const originalHtml5Qrcode = window.Html5Qrcode;
    window.Html5Qrcode = MockHtml5Qrcode;

    // Test Container
    let container = document.createElement('div');
    container.id = 'scanner-test-container';
    document.body.appendChild(container);

    // Override Alert locally
    let lastAlertMessage = null;
    const originalAlert = window.alert;
    window.alert = (msg) => { lastAlertMessage = msg; };

    try {
        await t.test('MobileStockView: Debouncing & Duplicates', async () => {
            const view = MobileStockView();
            container.innerHTML = '';
            container.appendChild(view.element());
            
            // Allow view to init and setup DOM
            view.trigger('init');
            await wait(100);

            // Open scanner
            view.$('btn-start-scanning').click();
            await wait(50); // wait for mock to initialize

            t.assert(window._activeMockScanner !== null, 'Mock scanner should be instantiated');
            t.assert(window._activeMockScanner.isScanning === true, 'Scanner should be scanning');

            // Simulate consecutive scans of the same ID
            const barcode = 'P-123';
            MockHtml5Qrcode.simulateScan(barcode);
            MockHtml5Qrcode.simulateScan(barcode); // duplicate within 1500ms
            
            await wait(50); // allow handleScan to render list

            const listContainer = view.$('scanned-items-list');
            const itemsRendered = listContainer.querySelectorAll('.scanned-item-card');
            
            t.assert(itemsRendered.length === 1, 'Duplicate barcode scans within debounce window should be ignored.');
            t.assert(itemsRendered[0].innerHTML.includes('P-123'), 'The scanned barcode should be rendered in the DOM.');
        });

        await t.test('MobileStockView: Invalid Hardware Assignment Blocked', async () => {
            const view = MobileStockView();
            container.innerHTML = '';
            container.appendChild(view.element());
            view.trigger('init');
            await wait(100);

            // Set type to Morning Load
            const typeSelect = view.$('stock-type');
            typeSelect.value = 'morning_load';
            typeSelect.dispatchEvent(new Event('change'));

            // Open scanner & inject
            view.$('btn-start-scanning').click();
            await wait(200);
            MockHtml5Qrcode.simulateScan('P-456');
            await wait(500);

            // Submit without choosing DB item via select
            lastAlertMessage = null;
            view.$('btn-submit-stock').click();
            await wait(200);
            
            t.assert(lastAlertMessage && lastAlertMessage.includes('Hardware Type'), 'Submission should be blocked with an alert if hardware type is not selected for Morning Load.');
        });

        await t.test('MobileAppointmentView: Fulfillment & Hardware Mismatch', async () => {
            // Setup DB Records
            const testAptId = 'TEST-APT-' + Date.now();
            const validItemId = 'TEST-VALID-ITEM-' + Date.now();
            const invalidItemId = 'TEST-INVALID-ITEM-' + Date.now();

            await Promise.all([
                db.create('appointments', {
                    status: 'scheduled',
                    metadata: { required_hardware: [{ catalog_id: 'catalog-pico-device', count: 1, item_name: 'Test Device' }] }
                }, testAptId),
                db.create('items', {
                    catalog_id: 'catalog-pico-device',
                    status: 'available'
                }, validItemId),
                db.create('items', {
                    catalog_id: 'catalog-router',
                    status: 'available'
                }, invalidItemId)
            ]);

            const view = MobileAppointmentView(testAptId);
            container.innerHTML = '';
            container.appendChild(view.element());
            
            // Wait for subscription to pull appointment data
            const loaded = new Promise(resolve => {
                view.on('loading:end', resolve);
                setTimeout(resolve, 5000);
            });
            view.trigger('init');
            await loaded;
            await wait(1000);

            const scanBtn = view.$('btn-open-scanner');
            t.assert(scanBtn && !scanBtn.disabled, 'Scanner button should be enabled');

            scanBtn.click();
            await wait(500); // wait for start()

            // 1. D: Hardware Mismatch
            lastAlertMessage = null;
            MockHtml5Qrcode.simulateScan(invalidItemId);
            await wait(1500); // DB getDoc takes a moment
            
            t.assert(lastAlertMessage && lastAlertMessage.includes('No open requirement'), 'Graceful rejection for unmatched hardware ID. Actual alert: ' + lastAlertMessage);
            t.assert(window._activeMockScanner && window._activeMockScanner.isPaused === false, 'Scanner should resume after a failed validation');

            // 2. C: Successful Fulfillment
            MockHtml5Qrcode.simulateScan(validItemId);
            await wait(1500);

            const badge = container.querySelector('.slot-status-badge');
            t.assert(badge && badge.textContent === 'Fulfilled', 'Hardware slot should transition to Fulfilled state');
            t.assert(badge.classList.contains('badge-pale-success'), 'Hardware slot should be colored green for success');

            // Cleanup DB
            await Promise.all([
                db.remove('appointments', testAptId),
                db.remove('items', validItemId),
                db.remove('items', invalidItemId)
            ]);
        });

    } finally {
        // Cleanup DOM and Globals
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        window.alert = originalAlert;
        window.Html5Qrcode = originalHtml5Qrcode;
        window._activeMockScanner = null;
    }
}
