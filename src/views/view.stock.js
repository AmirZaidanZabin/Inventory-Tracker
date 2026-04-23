import { controller } from '../lib/controller.js';
import { firebase } from '../lib/firebase.js';

export function StockView() {
    let localVans = [];
    let pendingReconcileData = null;

    const view = controller({
        stringComponent: `
            <div class="stock-view container-fluid px-0 h-100 pb-5">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h5 class="fw-bold mb-0"><i class="bi bi-clipboard2-check text-primary me-2"></i>Stock Inventory & Reconciliation</h5>
                </div>

                <div class="card mb-4 border-0 shadow-sm">
                    <div class="card-header bg-white pt-4 pb-0 border-0">
                        <ul class="nav nav-tabs border-0" id="stock-tabs" role="tablist">
                            <li class="nav-item me-2">
                                <a class="nav-link active fw-bold px-4 py-2 bg-light text-dark rounded-top" id="nav-morning-tab" data-bs-toggle="tab" href="#nav-morning" role="tab" style="border: 1px solid #e2e8f0; border-bottom: none;">
                                    <i class="bi bi-box-arrow-in-right me-2 text-primary"></i>Morning Load
                                </a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link fw-bold px-4 py-2 bg-light text-dark rounded-top" id="nav-evening-tab" data-bs-toggle="tab" href="#nav-evening" role="tab" style="border: 1px solid #e2e8f0; border-bottom: none;">
                                    <i class="bi bi-shield-check me-2 text-warning"></i>Evening Audit
                                </a>
                            </li>
                        </ul>
                    </div>
                    <div class="card-body p-4 border-top">
                        <div class="tab-content" id="nav-tabContent">
                            
                            <div class="tab-pane fade show active" id="nav-morning" role="tabpanel">
                                <div class="row g-4">
                                    <div class="col-lg-5 border-end pe-4">
                                        <h6 class="fw-bold"><i class="bi bi-1-circle text-muted me-2"></i>Select Destination</h6>
                                        <p class="small text-muted mb-3">Which VAN are you loading this stock into?</p>
                                        <select id="morning-van-select" class="form-select mb-4 shadow-sm">
                                            <option value="">Loading Vans...</option>
                                        </select>

                                        <h6 class="fw-bold"><i class="bi bi-2-circle text-muted me-2"></i>Upload Stock List</h6>
                                        <p class="small text-muted mb-3">Upload a CSV containing generic items (item_id, catalog_id, etc).</p>
                                        <input type="file" id="morning-csv" class="form-control mb-3 shadow-sm" accept=".csv">
                                        
                                        <button id="btn-process-morning" class="btn-pico btn-pico-primary w-100">
                                            <i class="bi bi-cloud-arrow-up me-2"></i>Process Bulk Morning Load
                                        </button>
                                    </div>
                                    <div class="col-lg-7 ps-4 d-flex flex-column justify-content-center align-items-center text-center">
                                        <i class="bi bi-truck text-primary opacity-25" style="font-size: 4rem;"></i>
                                        <h6 class="fw-bold mt-3">Transfer from Warehouse to Van</h6>
                                        <p class="small text-muted max-w-md">Processing this load will mark the scanned items as "Available" and update their current location to the selected VAN.</p>
                                        <button id="btn-download-morning-template" class="btn btn-sm btn-link text-decoration-none mt-2">Download CSV Template</button>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="tab-pane fade" id="nav-evening" role="tabpanel">
                                <div class="row g-4">
                                    <div class="col-lg-5 border-end pe-4">
                                        <h6 class="fw-bold"><i class="bi bi-1-circle text-muted me-2"></i>Select Target Van</h6>
                                        <p class="small text-muted mb-3">Which VAN's physical stock are you auditing?</p>
                                        <select id="evening-van-select" class="form-select mb-4">
                                            <option value="">Loading Vans...</option>
                                        </select>

                                        <h6 class="fw-bold"><i class="bi bi-2-circle text-muted me-2"></i>Upload Physical Count</h6>
                                        <p class="small text-muted mb-3">Upload a CSV of what is physically sitting in the van right now.</p>
                                        <input type="file" id="evening-csv" class="form-control mb-3" accept=".csv">
                                        
                                        <button id="btn-process-evening" class="btn-pico btn-pico-outline w-100">
                                            <i class="bi bi-arrow-repeat text-warning me-2"></i>Run Reconciliation Audit
                                        </button>
                                        <div class="text-center mt-2">
                                            <button id="btn-download-evening-template" class="btn btn-sm btn-link text-decoration-none">Download CSV Template</button>
                                        </div>
                                    </div>
                                    
                                    <div class="col-lg-7 ps-4">
                                        <div id="reconcile-placeholder" class="h-100 d-flex flex-column justify-content-center align-items-center text-center text-muted">
                                            <i class="bi bi-shield-check opacity-25" style="font-size: 4rem;"></i>
                                            <h6 class="fw-bold mt-3">Awaiting Audit Data</h6>
                                            <p class="small max-w-md">Run the audit to compare the physical count against the system's expected inventory for the van.</p>
                                        </div>

                                        <div id="reconcile-results" class="hidden h-100 d-flex flex-column">
                                            <div class="d-flex justify-content-between align-items-center mb-3">
                                                <h6 class="fw-bold text-dark m-0">Reconciliation Report</h6>
                                                <span id="recon-van-badge" class="badge badge-pale-primary"></span>
                                            </div>
                                            
                                            <div class="row g-3 flex-grow-1">
                                                <div class="col-md-6 d-flex flex-column">
                                                    <div class="card bg-light border-0 flex-grow-1">
                                                        <div class="card-body d-flex flex-column">
                                                            <div class="d-flex justify-content-between align-items-center mb-2">
                                                                <h6 class="fw-bold text-danger m-0 text-sm">Missing Items</h6>
                                                                <i class="bi bi-exclamation-octagon text-danger"></i>
                                                            </div>
                                                            <p class="text-xs text-muted mb-2 border-bottom pb-2">System expects these in the van, but they weren't scanned.</p>
                                                            <ul id="missing-list" class="small mb-0 text-muted p-0 list-unstyled" style="max-height: 200px; overflow-y: auto;"></ul>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div class="col-md-6 d-flex flex-column">
                                                    <div class="card bg-light border-0 flex-grow-1">
                                                        <div class="card-body d-flex flex-column">
                                                            <div class="d-flex justify-content-between align-items-center mb-2">
                                                                <h6 class="fw-bold text-warning m-0 text-sm">Extra Items</h6>
                                                                <i class="bi bi-question-circle text-warning"></i>
                                                            </div>
                                                            <p class="text-xs text-muted mb-2 border-bottom pb-2">Found in van, but system thinks they are deployed or in warehouse.</p>
                                                            <ul id="extra-list" class="small mb-0 text-muted p-0 list-unstyled" style="max-height: 200px; overflow-y: auto;"></ul>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div class="mt-3 text-end pt-3 border-top">
                                                <button id="btn-save-reconcile" class="btn-pico btn-pico-primary">
                                                    <i class="bi bi-save me-2"></i>Save Audit Report
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card border-0 shadow-sm mt-4">
                    <div class="card-header bg-white pt-4 pb-0 border-0">
                        <h5 class="fw-bold">Historical Audits & Logs</h5>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="modern-table">
                                <thead>
                                    <tr>
                                        <th>Date / ID</th>
                                        <th>Target Van</th>
                                        <th>Type</th>
                                        <th>Auditor</th>
                                        <th>Items Scanned</th>
                                        <th>Discrepancies</th>
                                    </tr>
                                </thead>
                                <tbody id="history-list">
                                    <tr><td colspan="6" class="text-center py-4 text-muted small">Loading history...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `
    });

    view.onboard({ id: 'btn-process-morning' })
        .onboard({ id: 'btn-process-evening' })
        .onboard({ id: 'btn-save-reconcile' })
        .onboard({ id: 'btn-download-morning-template' })
        .onboard({ id: 'btn-download-evening-template' })
        .onboard({ id: 'morning-csv' })
        .onboard({ id: 'evening-csv' })
        .onboard({ id: 'morning-van-select' })
        .onboard({ id: 'evening-van-select' })
        .onboard({ id: 'history-list' })
        .onboard({ id: 'reconcile-placeholder' })
        .onboard({ id: 'reconcile-results' })
        .onboard({ id: 'recon-van-badge' })
        .onboard({ id: 'missing-list' })
        .onboard({ id: 'extra-list' });

    // VERY Basic CSV Parser
    const parseCSV = (text) => {
        const rows = text.split('\n').map(r => r.trim()).filter(r => r);
        if(rows.length === 0) return [];
        const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
        return rows.slice(1).map(row => {
            const values = row.split(',').map(v => v.trim());
            const obj = {};
            headers.forEach((h, i) => obj[h] = values[i] || '');
            return obj;
        });
    };

    const readFile = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = e => reject(e);
        reader.readAsText(file);
    });

    const downloadTemplate = (name, content) => {
        const blob = new Blob([content], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', name);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    view.trigger('click', 'btn-download-morning-template', () => {
        const template = `item_id,catalog_id,status,provider
ITEM-123,catalog-pico-device,available,STC
SIM-456,catalog-sim-card,available,STC
ROUTER-789,catalog-router,available,Zain`;
        downloadTemplate('morning_load_template.csv', template);
    });

    view.trigger('click', 'btn-download-evening-template', () => {
        downloadTemplate('evening_audit_template.csv', `item_id,catalog_id\nITEM-123,catalog-pico-device\nSIM-456,catalog-sim-card`);
    });

    view.trigger('click', 'btn-process-morning', async () => {
        const vanSelect = view.$('morning-van-select');
        const fileInput = view.$('morning-csv');
        const vanId = vanSelect.value;

        if(!vanId) return alert('Please select a destination VAN first.');
        if(!fileInput.files.length) return alert('Please select a CSV file.');
        
        const btn = view.$('btn-process-morning');
        const ogHtml = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Processing Bulk...';
        btn.disabled = true;

        try {
            const text = await readFile(fileInput.files[0]);
            const data = parseCSV(text);
            
            if (data.length === 0) throw new Error("CSV is empty or invalid.");

            // Basic UI validation before sending
            const invalid = data.find(i => !i.item_id);
            if (invalid) throw new Error("Every row must have an item_id.");

            const res = await firebase.bulkStockTake({
                 items: data,
                 van_id: vanId,
                 log_type: 'morning_load'
            });

            alert(`Success! Bulk Load complete. ${res.count} items recorded in ${vanId}.`);
            fileInput.value = '';
        } catch(e) {
            console.error(e);
            alert("Bulk Error: " + e.message);
        } finally {
            btn.innerHTML = ogHtml;
            btn.disabled = false;
        }
    });

    view.trigger('click', 'btn-process-evening', async () => {
        const vanSelect = view.$('evening-van-select');
        const fileInput = view.$('evening-csv');
        const vanId = vanSelect.value;

        if(!vanId) return alert('Please select a target VAN to audit.');
        if(!fileInput.files.length) return alert('Please select a CSV file.');
        
        const btn = view.$('btn-process-evening');
        const ogHtml = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Server Audit...';
        btn.disabled = true;

        try {
            const text = await readFile(fileInput.files[0]);
            const data = parseCSV(text);
            
            if (data.length === 0) throw new Error("CSV is empty.");

            const res = await firebase.bulkStockTake({
                items: data,
                van_id: vanId,
                log_type: 'evening_reconcile'
            });

            const { discrepancies } = res;
            const missing = discrepancies.missing;
            const extra = discrepancies.extra;

            pendingReconcileData = {
                target_van: vanId,
                uploaded_count: res.count,
                missing,
                extra
            };

            const mList = view.$('missing-list');
            const eList = view.$('extra-list');
            
            mList.innerHTML = missing.length > 0 ? missing.map(m => `<li class="py-1 border-bottom border-light"><code class="data-mono text-danger">${m}</code></li>`).join('') : '<li class="text-success fw-bold py-2"><i class="bi bi-check-circle me-1"></i>Perfect match</li>';
            eList.innerHTML = extra.length > 0 ? extra.map(e => `<li class="py-1 border-bottom border-light"><code class="data-mono text-warning">${e}</code></li>`).join('') : '<li class="text-success fw-bold py-2"><i class="bi bi-check-circle me-1"></i>Perfect match</li>';
            
            view.$('recon-van-badge').textContent = vanId;
            view.$('reconcile-placeholder')?.classList.add('hidden');
            view.$('reconcile-results')?.classList.remove('hidden');

            alert("Audit complete. Report has been saved to history.");

        } catch(e) {
            console.error(e);
            alert("Audit Error: " + e.message);
        } finally {
            btn.innerHTML = ogHtml;
            btn.disabled = false;
        }
    });

    view.trigger('click', 'btn-save-reconcile', async () => {
        // Redundant as backend saves automatically, but can clear UI
        view.$('reconcile-results')?.classList.add('hidden');
        view.$('reconcile-placeholder')?.classList.remove('hidden');
        view.$('evening-csv').value = '';
        pendingReconcileData = null;
    });

    view.on('init', () => {
        view.emit('loading:start');

        // Fetch Vans for dropdowns
        firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'vans')).then(snap => {
            const mVan = view.$('morning-van-select');
            const eVan = view.$('evening-van-select');
            let options = '<option value="" disabled selected>Select a VAN...</option>';
            snap.forEach(doc => {
                const v = doc.data();
                options += `<option value="${v.van_id}">${v.van_id} (${v.location_id})</option>`;
            });
            if(mVan) mVan.innerHTML = options;
            if(eVan) eVan.innerHTML = options;
        });

        // Subscribe to logs
        view.unsub(firebase.db.subscribe(firebase.db.collection(firebase.db.db, 'stock_take_logs'), (snap) => {
            const histList = view.$('history-list');
            view.emit('loading:end');
            if (histList) histList.innerHTML = '';
            
            if (snap.empty) {
                histList.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted small">No audit history found.</td></tr>';
                return;
            }

            const docs = snap.docs.map(t => t.data()).sort((a,b) => {
                const aTime = a.timestamp?.seconds || new Date(a.timestamp).getTime()/1000 || 0;
                const bTime = b.timestamp?.seconds || new Date(b.timestamp).getTime()/1000 || 0;
                return bTime - aTime;
            });

            docs.forEach(doc => {
                const tr = document.createElement('tr');
                let dateRaw = 'N/A';
                if (doc.timestamp?.seconds) dateRaw = new Date(doc.timestamp.seconds * 1000).toLocaleString(undefined, {dateStyle: 'medium', timeStyle: 'short'});
                else if (doc.timestamp) dateRaw = new Date(doc.timestamp).toLocaleString();

                const missingCount = doc.discrepancies?.missing?.length || 0;
                const extraCount = doc.discrepancies?.extra?.length || 0;
                const discCount = missingCount + extraCount;
                
                const typeBadge = doc.log_type === 'morning_load' 
                    ? '<span class="badge badge-pale-primary"><i class="bi bi-box-arrow-in-right me-1"></i>Load</span>' 
                    : '<span class="badge badge-pale-warning"><i class="bi bi-shield-check me-1"></i>Audit</span>';

                tr.innerHTML = `
                    <td>
                        <div class="fw-bold text-dark">${dateRaw}</div>
                        <code class="data-mono">${doc.log_id}</code>
                    </td>
                    <td><span class="fw-bold">${doc.target_van || 'Unknown'}</span></td>
                    <td>${typeBadge}</td>
                    <td class="small">${doc.user_email || doc.user_id}</td>
                    <td><span class="badge bg-light text-dark border">${doc.count}</span></td>
                    <td>${doc.log_type === 'evening_reconcile' ? (discCount > 0 ? `<span class="badge badge-pale-danger">${discCount} mismatch</span>` : `<span class="badge badge-pale-success"><i class="bi bi-check-circle me-1"></i>Perfect</span>`) : '-'}</td>
                `;
                if (histList) histList.appendChild(tr);
            });
            
            document.dispatchEvent(new CustomEvent('apply-auth'));
        }));
    });

    return view;
}
