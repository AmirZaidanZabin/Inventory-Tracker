import { controller } from '../lib/controller.js';
import { auth } from '../lib/auth.js';
import { db } from '../lib/db/index.js';

export function MobileStockView() {
    const view = controller({
        stringComponent: `
            <div class="mobile-stock-view pb-5">
                <style>
                    .mobile-header { position: sticky; top: 0; z-index: 100; background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); border-bottom: 1px solid var(--border-color); padding: 1rem; }
                    .scanner-overlay { position: fixed; inset: 0; background: #000; z-index: 9999; display: flex; flex-direction: column; }
                    .scanner-header { padding: 1rem; display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.5); color: #fff; }
                    #stock-reader { flex-grow: 1; width: 100%; }
                    .scanned-item-card { background: #fff; border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 0.5rem; }
                </style>
                
                <div class="mobile-header d-flex justify-content-between align-items-center mb-3">
                    <h6 class="fw-bold mb-0"><i class="bi bi-box-seam text-primary me-2"></i>Mobile Stock Take</h6>
                    <span id="scan-count-badge" class="badge bg-light text-dark border">0 Scanned</span>
                </div>

                <div class="px-3">
                    <div class="card border-0 shadow-sm mb-4">
                        <div class="card-body">
                            <div class="mb-3">
                                <label class="form-label fw-bold text-sm">Stock Take Type</label>
                                <select id="stock-type" class="form-select">
                                    <option value="morning_load">Morning Load (Warehouse → Van)</option>
                                    <option value="evening_reconcile">Evening Audit (Verify Van Stock)</option>
                                </select>
                            </div>
                            <div class="mb-2">
                                <label class="form-label fw-bold text-sm">Target Van</label>
                                <select id="stock-van" class="form-select">
                                    <option value="" disabled selected>Loading Vans...</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="d-flex gap-2 mb-3">
                        <button id="btn-start-scanning" class="btn-pico btn-pico-primary flex-grow-1 py-3 fw-bold">
                            <i class="bi bi-camera me-2"></i>Start Scanning
                        </button>
                    </div>

                    <h6 class="fw-bold mb-2">Scanned Items</h6>
                    <div id="scanned-items-list" class="mb-4 d-flex flex-column gap-2">
                        <div class="text-center text-muted small py-4 bg-light rounded border border-dashed">
                            No items scanned yet.
                        </div>
                    </div>

                    <button id="btn-submit-stock" class="btn-pico btn-pico-primary w-100 py-3 fw-bold fs-6">
                        <i class="bi bi-cloud-upload me-2"></i>Submit Stock Take
                    </button>
                </div>

                <div id="stock-scanner-modal" class="scanner-overlay hidden">
                    <div class="scanner-header">
                        <span class="fw-bold"><i class="bi bi-upc-scan me-2"></i>Continuous Scanner</span>
                        <button id="btn-close-scanner" class="btn btn-sm btn-outline-light border-0"><i class="bi bi-x-lg"></i></button>
                    </div>
                    <div id="stock-reader"></div>
                    <div class="p-3 text-center text-white bg-dark">
                        <div class="small mb-2 text-white-50">Scan barcodes consecutively. Device will vibrate on success.</div>
                        <h4 id="live-scan-count" class="m-0 fw-bold text-success">0 Items Scanned</h4>
                    </div>
                </div>
            </div>
        `
    });

    view.onboard({ id: 'stock-type' }).onboard({ id: 'stock-van' })
        .onboard({ id: 'btn-start-scanning' }).onboard({ id: 'scanned-items-list' })
        .onboard({ id: 'btn-submit-stock' }).onboard({ id: 'scan-count-badge' })
        .onboard({ id: 'stock-scanner-modal' }).onboard({ id: 'btn-close-scanner' })
        .onboard({ id: 'live-scan-count' });

    let scannedItems = []; // Array of { item_id, catalog_id }
    let hardwareCatalog = [];
    let html5QrcodeScanner = null;
    // Debounce state to prevent double scanning the same code instantly
    let lastScannedCode = null;
    let lastScanTime = 0;

    const renderScannedList = () => {
        const container = view.$('scanned-items-list');
        view.$('scan-count-badge').textContent = `${scannedItems.length} Scanned`;
        view.$('live-scan-count').textContent = `${scannedItems.length} Items Scanned`;

        if(scannedItems.length === 0) {
            container.innerHTML = '<div class="text-center text-muted small py-4 bg-light rounded border border-dashed">No items scanned yet.</div>';
            return;
        }

        const typeIsMorning = view.$('stock-type').value === 'morning_load';
        const catalogOptions = hardwareCatalog.map(c => `<option value="${c.catalog_id || c.id}">${c.item_name} (${c.item_type})</option>`).join('');

        container.innerHTML = scannedItems.map((item, index) => `
            <div class="scanned-item-card">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <code class="data-mono text-dark fw-bold">${item.item_id}</code>
                    <button class="btn btn-link text-danger p-0 text-decoration-none btn-remove-scan" data-index="${index}"><i class="bi bi-trash"></i></button>
                </div>
                ${typeIsMorning ? `
                    <select class="form-select form-select-sm hw-type-select" data-index="${index}">
                        <option value="" disabled ${!item.catalog_id ? 'selected' : ''}>Select Hardware Type...</option>
                        ${catalogOptions.replace(`value="${item.catalog_id}"`, `value="${item.catalog_id}" selected`)}
                    </select>
                    <div class="text-xs text-muted mt-1">Required for new incoming stock.</div>
                ` : `<div class="text-xs text-muted"><i class="bi bi-info-circle me-1"></i>Type auto-detected during audit phase.</div>`}
            </div>
        `).join('');

        container.querySelectorAll('.btn-remove-scan').forEach(btn => {
            btn.onclick = () => {
                scannedItems.splice(parseInt(btn.dataset.index), 1);
                renderScannedList();
            };
        });

        container.querySelectorAll('.hw-type-select').forEach(sel => {
            sel.onchange = (e) => {
                scannedItems[parseInt(e.target.dataset.index)].catalog_id = e.target.value;
            };
        });
    };

    view.trigger('change', 'stock-type', renderScannedList);

    const handleScan = (decodedText) => {
        const now = Date.now();
        // Prevent duplicate immediate scans (debouncing 1.5 seconds)
        if (decodedText === lastScannedCode && (now - lastScanTime) < 1500) return;
        
        lastScannedCode = decodedText;
        lastScanTime = now;

        if (scannedItems.some(i => i.item_id === decodedText)) {
            // Already exists in list, just vibrate warning
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            return;
        }

        // Add to array
        scannedItems.push({ item_id: decodedText, catalog_id: '' });
        if (navigator.vibrate) navigator.vibrate(150); // Success vibe
        
        // Render in background
        renderScannedList();
    };

    const startScanner = () => {
        view.$('stock-scanner-modal').classList.remove('hidden');
        if (!html5QrcodeScanner) {
            html5QrcodeScanner = new window.Html5Qrcode("stock-reader");
        }
        
        html5QrcodeScanner.start(
            { facingMode: "environment" }, 
            { fps: 10, qrbox: { width: 250, height: 100 } }, // Wider qrbox for barcodes
            (decodedText) => handleScan(decodedText),
            (errorMessage) => { /* ignore */ }
        ).catch(err => {
            alert("Camera initialization failed. Check permissions.");
            stopScanner();
        });
    };

    const stopScanner = () => {
        if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
            html5QrcodeScanner.stop().then(() => {
                view.$('stock-scanner-modal').classList.add('hidden');
            }).catch(e => console.error(e));
        } else {
            view.$('stock-scanner-modal').classList.add('hidden');
        }
    };

    view.trigger('click', 'btn-start-scanning', startScanner);
    view.trigger('click', 'btn-close-scanner', stopScanner);

    view.trigger('click', 'btn-submit-stock', async () => {
        const vanId = view.$('stock-van').value;
        const logType = view.$('stock-type').value;

        if(scannedItems.length === 0) return alert('You must scan at least one item.');

        if (logType === 'morning_load') {
            const incomplete = scannedItems.some(i => !i.catalog_id);
            if (incomplete) return alert('For a Morning Load, you must select the Hardware Type for EVERY scanned item.');
        }

        if(!vanId) return alert('Please select a target VAN.');

        const btn = view.$('btn-submit-stock');
        const ogHtml = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Submitting...';
        btn.disabled = true;

        try {
            if (logType === 'morning_load') {
                // Perform batch creation/updates
                const batchPromises = [];
                const inventoryIds = [];
                scannedItems.forEach(item => {
                    batchPromises.push(db.create('items', {
                        item_id: item.item_id,
                        catalog_id: item.catalog_id,
                        current_location_type: 'VAN',
                        current_location_id: vanId,
                        is_available: true,
                        metadata: { status: 'available' },
                        updated_at: db.serverTimestamp()
                    }, item.item_id));
                    inventoryIds.push(item.item_id);
                });
                await Promise.all(batchPromises);

                const logId = 'ST-' + Math.random().toString(36).substr(2, 9).toUpperCase();
                await db.create('stock_take_logs', {
                    log_id: logId,
                    log_type: 'morning_load',
                    van_id: vanId,
                    user_id: auth.currentUser?.uid || 'Unknown',
                    created_at: db.serverTimestamp(),
                    updated_at: db.serverTimestamp(),
                    scanned_items: inventoryIds,
                    metadata: {
                        user_email: auth.currentUser?.email || 'Unknown',
                        count: inventoryIds.length
                    }
                }, logId);

                alert(`Success! ${inventoryIds.length} items loaded into ${vanId}.`);
                scannedItems = [];
                renderScannedList();

            } else {
                // Evening Reconcile Logic
                const uploadedIds = new Set(scannedItems.map(i => i.item_id));
                const itemsList = await db.findMany('items');
                const systemIds = new Set();
                
                (itemsList || []).forEach(item => {
                    const isAvail = item.status === 'available' || (!item.status && item.is_available);
                    const isInVan = item.current_location_type === 'VAN' && item.current_location_id === vanId;
                    if (isAvail && isInVan) systemIds.add(item.item_id);
                });

                const missing = [...systemIds].filter(x => !uploadedIds.has(x));
                const extra = [...uploadedIds].filter(x => !systemIds.has(x));

                const logId = 'ST-' + Math.random().toString(36).substr(2, 9).toUpperCase();
                await db.create('stock_take_logs', {
                    log_id: logId,
                    log_type: 'evening_reconcile',
                    van_id: vanId,
                    user_id: auth.currentUser?.uid || 'Unknown',
                    created_at: db.serverTimestamp(),
                    updated_at: db.serverTimestamp(),
                    scanned_items: [...uploadedIds],
                    discrepancies: { missing, extra },
                    metadata: {
                        user_email: auth.currentUser?.email || 'Unknown',
                        count: uploadedIds.size
                    }
                }, logId);

                alert(`Audit complete!\nMissing: ${missing.length}\nExtra: ${extra.length}\nReport saved to history.`);
                scannedItems = [];
                renderScannedList();
            }
        } catch (e) {
            console.error(e);
            alert("Error submitting stock take: " + e.message);
        } finally {
            btn.innerHTML = ogHtml;
            btn.disabled = false;
        }
    });

    view.on('init', async () => {
        view.emit('loading:start');
        
        try {
            const [vans, catalog] = await Promise.all([
                db.findMany('vans'),
                db.findMany('item_catalog')
            ]);

            const vanSelect = view.$('stock-van');
            if (vanSelect) {
                let options = '<option value="" disabled selected>Select a VAN...</option>';
                (vans || []).forEach(v => {
                    options += `<option value="${v.van_id}">${v.van_id} (${v.location_id})</option>`;
                });
                vanSelect.innerHTML = options;
            }

            (catalog || []).forEach(item => hardwareCatalog.push(item));

        } catch (e) {
            console.error("Failed to initialize mobile stock view data:", e);
        } finally {
            view.emit('loading:end');
        }
    });

    view.destroy = () => {
        stopScanner();
    };

    return view;
}
