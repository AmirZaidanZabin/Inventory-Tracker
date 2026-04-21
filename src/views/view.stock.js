import { controller } from '../lib/controller.js';
import { firebase } from '../lib/firebase.js';

export function StockView() {
    const view = controller({
        stringComponent: `
            <div class="stock-view">
                <div class="card mb-4 border-0 shadow-sm">
                    <div class="card-header bg-white pt-4 pb-3">
                        <ul class="nav nav-tabs card-header-tabs" id="stock-tabs" role="tablist">
                            <li class="nav-item">
                                <a class="nav-link active fw-bold text-dark" id="nav-morning-tab" data-bs-toggle="tab" href="#nav-morning" role="tab">Morning Load (Stock In)</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link fw-bold text-dark" id="nav-evening-tab" data-bs-toggle="tab" href="#nav-evening" role="tab">Evening Reconcile (Stock Check)</a>
                            </li>
                        </ul>
                    </div>
                    <div class="card-body">
                        <div class="tab-content" id="nav-tabContent">
                            <!-- Morning Tab -->
                            <div class="tab-pane fade show active" id="nav-morning" role="tabpanel">
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <p class="text-muted mb-0">Upload morning stock inventory. This will scan the uploaded item terminal IDs & sim cards, and mark them as <strong>Available</strong>.</p>
                                    <button id="btn-download-morning-template" class="btn btn-sm btn-link text-decoration-none"><i class="bi bi-download"></i> Download Template</button>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label fw-bold">Select CSV File</label>
                                    <input type="file" id="morning-csv" class="form-control" accept=".csv">
                                </div>
                                <button id="btn-process-morning" class="btn-pico btn-pico-primary">Process Morning Load</button>
                            </div>
                            
                            <!-- Evening Tab -->
                            <div class="tab-pane fade" id="nav-evening" role="tabpanel">
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <p class="text-muted mb-0">Upload end-of-day stock. This will compare the uploaded actual inventory against what the system believes is still available and generate a discrepancy report.</p>
                                    <button id="btn-download-evening-template" class="btn btn-sm btn-link text-decoration-none"><i class="bi bi-download"></i> Download Template</button>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label fw-bold">Select CSV File</label>
                                    <input type="file" id="evening-csv" class="form-control" accept=".csv">
                                </div>
                                <button id="btn-process-evening" class="btn-pico btn-pico-warning text-dark">Process Evening Reconcile</button>
                                
                                <div id="reconcile-results" class="mt-4 hidden">
                                    <h5 class="fw-bold">Reconciliation Report</h5>
                                    <div class="row g-3">
                                        <div class="col-md-6">
                                            <div class="card bg-light border-0">
                                                <div class="card-body">
                                                    <h6 class="fw-bold text-danger">Missing Items (System expected them, but not in van)</h6>
                                                    <ul id="missing-list" class="small mb-0 text-muted"></ul>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="card bg-light border-0">
                                                <div class="card-body">
                                                    <h6 class="fw-bold text-success">Extra Items (In van, but system thinks they are deployed)</h6>
                                                    <ul id="extra-list" class="small mb-0 text-muted"></ul>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <button id="btn-save-reconcile" class="btn-pico btn-pico-outline mt-3">Save Report</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card border-0 shadow-sm">
                    <div class="card-header bg-white pt-4 pb-0 border-0">
                        <h5 class="fw-bold">Historical Stock Reports</h5>
                    </div>
                    <div class="card-body p-0">
                        <table class="modern-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>User</th>
                                    <th>Items Scanned</th>
                                    <th>Discrepancies</th>
                                </tr>
                            </thead>
                            <tbody id="history-list"></tbody>
                        </table>
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
        .onboard({ id: 'history-list' })
        .onboard({ id: 'reconcile-results' })
        .onboard({ id: 'missing-list' })
        .onboard({ id: 'extra-list' });

    let pendingReconcileData = null;

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
        const template = `terminal_id,sim_id,item_name,provider
T-001,S-001,Pico Terminal Auth,STC
T-002,S-002,Pico Terminal Auth,Mobily`;
        downloadTemplate('morning_load_template.csv', template);
    });

    view.trigger('click', 'btn-download-evening-template', () => {
        downloadTemplate('evening_reconcile_template.csv', 'terminal_id,sim_id\nT-001,S-001\nT-002,S-002');
    });

    view.trigger('click', 'btn-process-morning', async () => {
        const fileInput = view.$('morning-csv');
        if(!fileInput.files.length) return alert('Please select a CSV file first.');
        
        try {
            const text = await readFile(fileInput.files[0]);
            const data = parseCSV(text);
            // Expected headers: terminal_id, sim_id, status
            
            let itemsProcessed = 0;
            const batchPromises = [];
            let inventoryIds = [];

            // We iterate. For simplicity, we just trigger writes for valid terminal_id and sim_id 
            // In a real huge dataset we'd use Firebase Batches but JS Promise.all acts fine for moderate files
            data.forEach(row => {
                if(row.terminal_id) {
                    batchPromises.push(firebase.db.setDoc(firebase.db.doc(firebase.db.db, 'items', row.terminal_id), {
                        item_id: row.terminal_id,
                        item_type: 'Pico Device',
                        is_available: true,
                        status: 'available',
                        updated_at: firebase.db.serverTimestamp()
                    }, { merge: true }));
                    inventoryIds.push(row.terminal_id);
                    itemsProcessed++;
                }
                if(row.sim_id) {
                    batchPromises.push(firebase.db.setDoc(firebase.db.doc(firebase.db.db, 'items', row.sim_id), {
                        item_id: row.sim_id,
                        item_type: 'Sim Card',
                        is_available: true,
                        status: 'available',
                        updated_at: firebase.db.serverTimestamp()
                    }, { merge: true }));
                    inventoryIds.push(row.sim_id);
                    itemsProcessed++;
                }
            });

            if(batchPromises.length === 0) return alert("No valid hardware IDs found in the CSV. Make sure you use 'terminal_id' and 'sim_id' columns.");

            await Promise.all(batchPromises);

            // Save Stock Take Log
            const logId = 'ST-' + Math.random().toString(36).substr(2, 9).toUpperCase();
            await firebase.db.setDoc(firebase.db.doc(firebase.db.db, 'stock_takes', logId), {
                log_id: logId,
                type: 'morning_load',
                user_id: firebase.auth.currentUser ? firebase.auth.currentUser.uid : 'Unknown',
                user_email: firebase.auth.currentUser ? firebase.auth.currentUser.email : 'Unknown',
                timestamp: firebase.db.serverTimestamp(),
                scanned_items: inventoryIds,
                count: itemsProcessed
            });

            alert(`Successfully processed morning load. ${itemsProcessed} hardware items are now marked Available.`);
            fileInput.value = '';
        } catch(e) {
            console.error(e);
            alert("Error processing CSV: " + e.message);
        }
    });

    view.trigger('click', 'btn-process-evening', async () => {
        const fileInput = view.$('evening-csv');
        if(!fileInput.files.length) return alert('Please select a CSV file first.');
        
        try {
            const text = await readFile(fileInput.files[0]);
            const data = parseCSV(text);
            
            let uploadedIds = new Set();
            data.forEach(row => {
                if(row.terminal_id) uploadedIds.add(row.terminal_id);
                if(row.sim_id) uploadedIds.add(row.sim_id);
            });

            // What does the system think we have?
            const itemsRes = await firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'items'));
            const systemIds = new Set();
            
            itemsRes.docs.forEach(doc => {
                const item = doc.data();
                const isAvail = item.status === 'available' || (!item.status && item.is_available);
                if (isAvail) systemIds.add(item.item_id);
            });

            // Missing: In System, Not In Upload
            const missing = [...systemIds].filter(x => !uploadedIds.has(x));
            // Extra: In Upload, Not In System
            const extra = [...uploadedIds].filter(x => !systemIds.has(x));

            pendingReconcileData = {
                uploaded: [...uploadedIds],
                missing,
                extra,
                count: uploadedIds.size
            };

            const mList = view.$('missing-list');
            const eList = view.$('extra-list');
            
            mList.innerHTML = missing.length > 0 ? missing.map(m => `<li>${m}</li>`).join('') : '<li class="text-success">Perfect match. None missing.</li>';
            eList.innerHTML = extra.length > 0 ? extra.map(e => `<li>${e}</li>`).join('') : '<li class="text-success">Perfect match. None extra.</li>';
            
            view.$('reconcile-results')?.classList.remove('hidden');

        } catch(e) {
            console.error(e);
            alert("Error processing Evening CSV: " + e.message);
        }
    });

    view.trigger('click', 'btn-save-reconcile', async () => {
        if(!pendingReconcileData) return;
        
        try {
            const logId = 'ST-' + Math.random().toString(36).substr(2, 9).toUpperCase();
            await firebase.db.setDoc(firebase.db.doc(firebase.db.db, 'stock_takes', logId), {
                log_id: logId,
                type: 'evening_reconcile',
                user_id: firebase.auth.currentUser ? firebase.auth.currentUser.uid : 'Unknown',
                user_email: firebase.auth.currentUser ? firebase.auth.currentUser.email : 'Unknown',
                timestamp: firebase.db.serverTimestamp(),
                scanned_items: pendingReconcileData.uploaded,
                count: pendingReconcileData.count,
                missing: pendingReconcileData.missing,
                extra: pendingReconcileData.extra
            });
            
            alert("Evening reconciliation saved historically!");
            view.$('reconcile-results')?.classList.add('hidden');
            view.$('evening-csv').value = '';
            pendingReconcileData = null;
        } catch(e) {
            console.error(e);
            alert("Error saving report.");
        }
    });

    view.on('init', () => {
        view.emit('loading:start');
        view.unsub(firebase.db.subscribe(firebase.db.collection(firebase.db.db, 'stock_takes'), (snap) => {
            const histList = view.$('history-list');
            view.emit('loading:end');
            view.emit('rendered');
            if (histList) histList.innerHTML = '';
            const docs = snap.docs.map(t => t.data()).sort((a,b) => {
                if(!a.timestamp || !b.timestamp) return 0;
                return b.timestamp.seconds - a.timestamp.seconds;
            });

            docs.forEach(doc => {
                const tr = document.createElement('tr');
                const dateRaw = doc.timestamp ? new Date(doc.timestamp.seconds * 1000).toLocaleString() : 'N/A';
                const discCount = (doc.missing ? doc.missing.length : 0) + (doc.extra ? doc.extra.length : 0);
                
                tr.innerHTML = `
                    <td><div class="small fw-bold">${dateRaw}</div><div class="text-muted" style="font-size:0.7rem;">${doc.log_id}</div></td>
                    <td><span class="badge ${doc.type === 'morning_load' ? 'bg-primary' : 'bg-warning text-dark'}">${doc.type === 'morning_load' ? 'Morning Load' : 'Evening Check'}</span></td>
                    <td>${doc.user_email || doc.user_id}</td>
                    <td>${doc.count} items</td>
                    <td>${doc.type === 'evening_reconcile' ? (discCount > 0 ? `<span class="text-danger fw-bold">${discCount} mismatch(es)</span>` : `<span class="text-success"><i class="bi bi-check"></i> Perfect</span>`) : '-'}</td>
                `;
                const list = view.$('history-list');
                if (list) {
                    list.appendChild(tr);
                }
            });
        }));
    });

    return view;
}
