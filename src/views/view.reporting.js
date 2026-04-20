import { controller } from '../lib/controller.js';
import { firebase } from '../lib/firebase.js';
import initSqlJs from 'sql.js';

export function ReportingView() {
    const view = controller({
        stringComponent: `
            <div class="reporting-view">
                <div class="container-fluid">
                    <div class="row">
                        <div class="col-md-9">
                        <div class="card mb-4">
                            <div class="card-header bg-light d-flex justify-content-between align-items-center">
                                <h5 class="mb-0">SQL Query Engine</h5>
                                <span id="db-status" class="badge badge-pale-secondary">Initializing...</span>
                            </div>
                            <div class="card-body">
                                <div class="mb-3">
                                    <label class="form-label small fw-bold">SQLite Query</label>
                                    <div class="sql-editor-container">
                                        <pre id="sql-highlighted" class="sql-highlighted language-sql"></pre>
                                        <textarea id="sql-query" class="form-control font-mono sql-textarea" rows="4">SELECT * FROM appointments LIMIT 10;</textarea>
                                    </div>
                                </div>
                                <div class="d-flex flex-wrap gap-2 mb-3">
                                    <button id="report-utilization" class="btn-pico btn-pico-outline btn-sm">
                                        <i class="bi bi-people me-1"></i>Agent Utilization
                                    </button>
                                    <button id="report-stock" class="btn-pico btn-pico-outline btn-sm">
                                        <i class="bi bi-box-seam me-1"></i>Stock Summary
                                    </button>
                                </div>
                                <div class="d-flex justify-content-between align-items-center">
                                    <button id="run-query" class="btn-pico btn-pico-primary" disabled>
                                        <i class="bi bi-play-fill"></i>Run Query
                                    </button>
                                    <button id="save-report" class="btn-pico btn-pico-outline btn-sm auth-reporting:manage hidden" disabled>
                                        <i class="bi bi-bookmark-plus me-1"></i>Save Report
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div id="query-error" class="alert alert-danger hidden"></div>
                        <div id="save-status" class="alert hidden mt-2"></div>

                        <div class="card">
                            <div class="card-header bg-light d-flex justify-content-between align-items-center">
                                <h6 class="mb-0">Results</h6>
                                <button id="export-csv" class="btn-pico btn-pico-outline btn-sm hidden">
                                    <i class="bi bi-download me-1"></i>Export CSV
                                </button>
                            </div>
                            <div class="card-body p-0 overflow-auto" style="max-height: 500px;">
                                <table class="table table-sm table-hover mb-0">
                                    <thead id="results-head" class="table-light"></thead>
                                    <tbody id="results-body">
                                        <tr><td class="text-center py-4 text-muted">Run a query to see results</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Reporting Folder (Saved Reports) -->
                    <div class="col-md-3">
                        <div class="card h-100">
                            <div class="card-header bg-light fw-bold">
                                <i class="bi bi-folder2-open me-2"></i>Reporting Folder
                            </div>
                            <div class="card-body p-0">
                                <div class="d-flex justify-content-between align-items-center mb-2 px-3 pt-2">
                                    <span class="small text-muted text-uppercase fw-bold" style="font-size: 0.65rem;">Saved Assets</span>
                                    <button id="refresh-reports" class="btn btn-sm btn-link p-0 text-decoration-none" title="Refresh list">
                                        <i class="bi bi-arrow-clockwise"></i>
                                    </button>
                                </div>
                                <div id="saved-reports-list" class="list-group list-group-flush small">
                                    <div class="p-3 text-center text-muted">Loading saved reports...</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Save Modal -->
                <div id="save-modal-backdrop" class="modal-backdrop fade show hidden"></div>
                <div id="save-modal" class="modal fade show hidden" tabindex="-1" style="display: block;">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header border-0 pb-0">
                                <h6 class="modal-title fw-bold">Save Report</h6>
                            </div>
                            <div class="modal-body">
                                <label class="form-label small fw-semibold text-secondary">Report Name</label>
                                <input id="new-report-name" type="text" class="form-control" placeholder="e.g. Monthly Van Load">
                                <div id="save-modal-error" class="text-danger small mt-2 hidden"></div>
                            </div>
                            <div class="modal-footer border-0 pt-0">
                                <button id="cancel-save" class="btn btn-sm btn-light">Cancel</button>
                                <button id="confirm-save" class="btn btn-sm btn-primary">Save Now</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `
    });

    let db = null;
    let lastResults = null;

    view.onboard({ id: 'sql-query' })
        .onboard({ id: 'sql-highlighted' })
        .onboard({ id: 'run-query' })
        .onboard({ id: 'db-status' })
        .onboard({ id: 'query-error' })
        .onboard({ id: 'results-head' })
        .onboard({ id: 'results-body' })
        .onboard({ id: 'report-utilization' })
        .onboard({ id: 'report-stock' })
        .onboard({ id: 'save-report' })
        .onboard({ id: 'save-status' })
        .onboard({ id: 'refresh-reports' })
        .onboard({ id: 'saved-reports-list' })
        .onboard({ id: 'save-modal' })
        .onboard({ id: 'save-modal-backdrop' })
        .onboard({ id: 'new-report-name' })
        .onboard({ id: 'confirm-save' })
        .onboard({ id: 'cancel-save' })
        .onboard({ id: 'save-modal-error' })
        .onboard({ id: 'export-csv' });

    const updateHighlighting = () => {
        const query = view.$('sql-query').value;
        const highlighted = view.$('sql-highlighted');
        if (!highlighted) return;
        highlighted.textContent = query + (query.endsWith('\n') ? ' ' : '');
        if (window.Prism) Prism.highlightElement(highlighted);
    };

    const initDb = async () => {
        try {
            const SQL = await initSqlJs({
                locateFile: file => `https://unpkg.com/sql.js@1.14.1/dist/${file}`
            });
            db = new SQL.Database();
            
            // Create tables
            db.run("CREATE TABLE appointments (id TEXT, name TEXT, date TEXT, status TEXT, tech_id TEXT);");
            db.run("CREATE TABLE vans (id TEXT, location TEXT);");
            db.run("CREATE TABLE items (id TEXT, type TEXT, provider TEXT, available BOOLEAN);");
            db.run("CREATE TABLE users (id TEXT, name TEXT, role TEXT);");
            db.run("CREATE TABLE stock_takes (log_id TEXT, type TEXT, user_email TEXT, count INTEGER, timestamp TEXT);");
            db.run("CREATE TABLE audit_logs (log_id TEXT, details TEXT, user_id TEXT, user_name TEXT, timestamp TEXT);");

            // Fetch data
            const [aptSnap, vanSnap, itemSnap, userSnap, stockSnap,logSnap] = await Promise.all([
                firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'appointments')),
                firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'vans')),
                firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'items')),
                firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'users')),
                firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'stock_takes')),
                firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'audit_logs'))
            ]);
     
            
            // Insert data
            aptSnap.forEach(doc => {
                const d = doc.data();
                db.run("INSERT INTO appointments VALUES (?, ?, ?, ?, ?)", [
                    d.appointment_id || doc.id, 
                    d.appointment_name ?? null, 
                    d.schedule_date ?? null, 
                    d.status ?? null, 
                    d.tech_id ?? null
                ]);
            });
            vanSnap.forEach(doc => {
                const d = doc.data();
                db.run("INSERT INTO vans VALUES (?, ?)", [
                    d.van_id || doc.id, 
                    d.location_id ?? null
                ]);
            });
            itemSnap.forEach(doc => {
                const d = doc.data();
                db.run("INSERT INTO items VALUES (?, ?, ?, ?)", [
                    d.item_id || doc.id, 
                    d.item_type ?? null, 
                    d.provider ?? null, 
                    d.is_available ? 1 : 0
                ]);
            });
            userSnap.forEach(doc => {
                const d = doc.data();
                db.run("INSERT INTO users VALUES (?, ?, ?)", [
                    d.user_id || doc.id, 
                    d.user_name ?? null, 
                    d.role_id ?? null
                ]);
            });
            stockSnap.forEach(doc => {
                const d = doc.data();
                const ts = d.timestamp?.toDate?.()?.toISOString() || d.timestamp || '';
                db.run("INSERT INTO stock_takes VALUES (?, ?, ?, ?, ?)", [
                    d.log_id || doc.id, 
                    d.type ?? null, 
                    d.user_email ?? null, 
                    d.count ?? 0, 
                    ts
                ]);
            });

            logSnap.forEach(doc => {
                const d = doc.data();
                const ts = d.timestamp?.toDate?.()?.toISOString() || d.timestamp || '';
                db.run("INSERT INTO audit_logs VALUES (?, ?, ?, ?, ?)", [
                    d.action || doc.id, 
                    d.details ?? null, 
                    d.user_id ?? null, 
                    d.user_name ?? null, 
                    ts
                ]);
            });
            
            view.$('db-status').textContent = "Ready";
            view.$('db-status').className = "badge badge-pale-success";
            view.$('run-query').disabled = false;
            view.$('save-report').disabled = false;
            updateHighlighting();
        } catch (err) {
            console.error(err);
            view.$('db-status').textContent = "Error";
            view.$('db-status').className = "badge badge-pale-danger";
        }
    };

    // I need to add getDocs to firebase.js
    // For now I'll use a more robust data loading in the 'init' message
    
    const runQuery = () => {
        const query = view.$('sql-query').value;
        view.$('query-error')?.classList.add('hidden');
        view.$('export-csv')?.classList.add('hidden');
        lastResults = null;
        
        try {
            const res = db.exec(query);
            if (res.length === 0) {
                view.$('results-head').innerHTML = '';
                view.$('results-body').innerHTML = '<tr><td class="text-center py-4 text-muted">0 rows returned</td></tr>';
                return;
            }

            const { columns, values } = res[0];
            lastResults = { columns, values };
            view.$('export-csv')?.classList.remove('hidden');
            
            // Render Head
            view.$('results-head').innerHTML = `<tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr>`;
            
            // Render Body
            view.$('results-body').innerHTML = values.map(row => `
                <tr>${row.map(cell => `<td>${cell !== null ? cell : '<span class="text-muted">NULL</span>'}</td>`).join('')}</tr>
            `).join('');

        } catch (err) {
            view.$('query-error').textContent = err.message;
            view.$('query-error')?.classList.remove('hidden');
        }
    };

    view.trigger('input', 'sql-query', updateHighlighting);
    view.trigger('scroll', 'sql-query', () => {
        const queryEl = view.$('sql-query');
        const highEl = view.$('sql-highlighted');
        if (queryEl && highEl) {
            highEl.scrollTop = queryEl.scrollTop;
            highEl.scrollLeft = queryEl.scrollLeft;
        }
    });

    view.trigger('click', 'run-query', runQuery);

    view.trigger('click', 'save-report', () => {
        view.$('new-report-name').value = '';
        view.$('save-modal-error')?.classList.add('hidden');
        view.$('save-modal')?.classList.remove('hidden');
        view.$('save-modal-backdrop')?.classList.remove('hidden');
        view.$('new-report-name').focus();
    });

    view.trigger('click', 'cancel-save', () => {
        view.$('save-modal').classList.add('hidden');
        view.$('save-modal-backdrop').classList.add('hidden');
    });

    view.trigger('click', 'confirm-save', async () => {
        const query = view.$('sql-query').value;
        const name = view.$('new-report-name').value.trim();
        
        if (!name) {
            view.$('save-modal-error').textContent = "Please enter a name";
            view.$('save-modal-error').classList.remove('hidden');
            return;
        }

        const btn = view.$('confirm-save');
        const originalHtml = btn.innerHTML;
        
        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';
            
            await firebase.db.setDoc(firebase.db.doc(firebase.db.db, 'saved_reports', `report_${Date.now()}`), {
                name,
                query,
                created_at: firebase.db.serverTimestamp()
            });
            
            firebase.logAction("Report Saved", `Saved report: ${name}`);
            
            // Close modal
            view.$('save-modal').classList.add('hidden');
            view.$('save-modal-backdrop').classList.add('hidden');
            
            // Show feedback
            const status = view.$('save-status');
            status.textContent = `Report "${name}" saved!`;
            status.className = "alert alert-success mt-2";
            status.classList.remove('hidden');
            setTimeout(() => status.classList.add('hidden'), 3000);
            
            if (typeof refreshList === 'function') refreshList();
        } catch (err) { 
            console.error("Save Report Failed:", err);
            view.$('save-modal-error').textContent = "Failed: " + err.message;
            view.$('save-modal-error').classList.remove('hidden');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    });

    let refreshList = null;
    const loadSavedReports = () => {
        const listContainer = view.$('saved-reports-list');
        if (!listContainer) {
            console.error("Reporting: saved-reports-list element not found!");
            return;
        }

        refreshList = async () => {
            console.log("Reporting: Refreshing report list...");
            try {
                const snap = await firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'saved_reports'));
                listContainer.innerHTML = '';
                
                if (!snap || snap.empty) {
                    listContainer.innerHTML = '<div class="p-3 text-center text-muted">No saved reports found.</div>';
                    return;
                }

                snap.forEach(docSnap => {
                    const data = docSnap.data();
                    const reportId = docSnap.id;
                    const reportName = data.name || "Unnamed Report";

                    const item = document.createElement('div');
                    item.className = 'list-group-item d-flex justify-content-between align-items-center py-2 px-3 border-bottom';
                    item.innerHTML = `
                        <div class="text-truncate flex-grow-1 cursor-pointer load-report-trigger" 
                             title="Load: ${reportName}" 
                             style="font-size: 0.85rem; max-width: 180px;">
                            <i class="bi bi-file-earmark-text me-2 text-primary" style="pointer-events: none;"></i>
                            <span class="report-basename" style="pointer-events: none;">${reportName}</span>
                        </div>
                        <div class="ms-2">
                            <button class="btn btn-sm btn-outline-danger border-0 delete-report-trigger" 
                                    title="Delete Report"
                                    style="padding: 2px 6px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
                                <i class="bi bi-trash3" style="pointer-events: none;"></i>
                            </button>
                        </div>
                    `;

                    // Hard Binding
                    const loadBtn = item.querySelector('.load-report-trigger');
                    const delBtn = item.querySelector('.delete-report-trigger');

                    loadBtn.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log(`Reporting: Loading query for "${reportName}"`);
                        view.$('sql-query').value = data.query || "";
                        updateHighlighting();
                        runQuery();
                    };

                    let confirmMode = false;
                    delBtn.onclick = async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        console.log(`Reporting: Delete clicked for ID: ${reportId}, confirmMode: ${confirmMode}`);

                        if (!confirmMode) {
                            confirmMode = true;
                            delBtn.innerHTML = '<i class="bi bi-x-circle-fill" style="pointer-events: none;"></i>';
                            delBtn.classList.replace('btn-outline-danger', 'btn-danger');
                            delBtn.title = "Confirm Delete";
                            
                            // Reset after 3s
                            setTimeout(() => {
                                if (confirmMode && delBtn && !delBtn.disabled) {
                                    confirmMode = false;
                                    delBtn.innerHTML = '<i class="bi bi-trash3" style="pointer-events: none;"></i>';
                                    delBtn.classList.replace('btn-danger', 'btn-outline-danger');
                                    delBtn.title = "Delete Report";
                                }
                            }, 3000);
                            return;
                        }
                        
                        const originalHtml = delBtn.innerHTML;
                        try {
                            delBtn.disabled = true;
                            delBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
                            
                            console.log(`Reporting: Executing DELETE on /api/saved_reports/${reportId}`);
                            const result = await firebase.db.deleteDoc(firebase.db.doc(firebase.db.db, 'saved_reports', reportId));
                            console.log("Reporting: Delete complete", result);
                            
                            const status = view.$('save-status');
                            if (status) {
                                status.textContent = `Deleted "${reportName}"`;
                                status.className = "alert alert-success mt-2 py-1 small animate__animated animate__fadeIn";
                                status.classList.remove('hidden');
                                setTimeout(() => status.classList.add('hidden'), 3000);
                            }
                            
                            await refreshList();
                        } catch (err) { 
                            console.error("Reporting: Delete Exception", err);
                            alert(`Delete failed: ${err.message}`); 
                            confirmMode = false;
                            delBtn.disabled = false;
                            delBtn.innerHTML = originalHtml;
                        }
                    };

                    listContainer.appendChild(item);
                });
            } catch (err) {
                console.error("Reporting: LIST LOAD FAILED!", err);
                listContainer.innerHTML = `<div class="p-3 text-center text-danger small">Error loading assets.</div>`;
            }
        };

        refreshList();
        
        // Polling (10s sync)
        const unsubscribe = firebase.db.subscribe(firebase.db.collection(firebase.db.db, 'saved_reports'), () => {
            console.log("Reporting: Remote update detected, refreshing...");
            refreshList();
        });
        view.unsub(unsubscribe);
    };

    view.trigger('click', 'export-csv', () => {
        if (!lastResults) return;
        const { columns, values } = lastResults;
        const csvContent = [
            columns.join(','),
            ...values.map(row => row.map(v => `"${v !== null ? String(v).replace(/"/g, '""') : ''}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `pico_report_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    view.trigger('click', 'report-utilization', () => {
        view.$('sql-query').value = `SELECT 
    u.name as Agent, 
    COUNT(a.id) as Total_Jobs,
    COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as Completed,
    ROUND(CAST(COUNT(CASE WHEN a.status = 'completed' THEN 1 END) AS FLOAT) / COUNT(a.id) * 100, 1) || '%' as Utilization
FROM users u
LEFT JOIN appointments a ON u.id = a.tech_id
GROUP BY u.id
ORDER BY Total_Jobs DESC;`;
        updateHighlighting();
        runQuery();
    });

    view.trigger('click', 'report-stock', () => {
        view.$('sql-query').value = `SELECT 
    user_email as User,
    type as Load_Type,
    COUNT(log_id) as Entries,
    SUM(count) as Total_Items_Handled,
    strftime('%Y-%m-%d', timestamp) as Day
FROM stock_takes
GROUP BY User, Load_Type, Day
ORDER BY Day DESC;`;
        updateHighlighting();
        runQuery();
    });

    view.on('init', () => {
        view.emit('loading:start');
        initDb().then(() => {
            view.emit('loading:end');
        });
        loadSavedReports();
    });

    return view;
}
