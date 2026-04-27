import { controller } from '../lib/controller.js';
import { apiDb as genericDb } from '../lib/api-client.js';
import initSqlJs from 'sql.js';

export function ReportingView() {
    const view = controller({
        stringComponent: `
            <div class="reporting-view">
                <div class="container-fluid py-4">
                    <div class="row g-4">
                        <div class="col-md-9">
                        <div class="card border-0 shadow-sm rounded-4 mb-4 overflow-hidden">
                            <div class="card-header bg-white border-bottom-0 pt-4 px-4 d-flex justify-content-between align-items-center">
                                <h5 class="mb-0 fw-bold text-dark"><i class="bi bi-terminal me-2 text-primary"></i>SQL Query Engine</h5>
                                <span id="db-status" class="badge rounded-pill bg-light text-secondary border">Initializing...</span>
                            </div>
                            <div class="card-body">
                                <div class="mb-3">
                                    <label class="form-label small fw-bold">SQLite Query</label>
                                    <div class="sql-editor-container">
                                        <pre id="sql-highlighted" class="sql-highlighted language-sql"><code id="sql-code"></code></pre>
                                        <textarea id="sql-query" class="form-control font-mono sql-textarea" rows="5" spellcheck="false" autocorrect="off" autocapitalize="off">SELECT * FROM appointments LIMIT 10;</textarea>
                                    </div>
                                </div>
                                <div class="d-flex flex-wrap gap-2 mb-3">
                    </div>
                    <div class="col-12 col-md-4">
                        <label class="form-label small fw-bold">Pre-defined Queries</label>
                        <div class="d-flex flex-wrap gap-2 mb-3">
                            <button id="report-utilization" class="btn-pico btn-pico-outline btn-sm">
                                <i class="bi bi-people me-1"></i>Agent Utilization
                            </button>
                            <button id="report-stock" class="btn-pico btn-pico-outline btn-sm">
                                <i class="bi bi-box-seam me-1"></i>Stock Summary
                            </button>
                            <button id="report-variance" class="btn-pico btn-pico-outline btn-sm">
                                <i class="bi bi-shield-exclamation me-1"></i>Stock Variances
                            </button>
                        </div>
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

                        <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
                            <div class="card-header bg-white border-bottom-0 pt-4 px-4 d-flex justify-content-between align-items-center">
                                <h6 class="mb-0 fw-bold"><i class="bi bi-table me-2 text-primary"></i>Results</h6>
                                <button id="export-csv" class="btn btn-sm btn-outline-primary rounded-pill hidden">
                                    <i class="bi bi-download me-1"></i>Export CSV
                                </button>
                            </div>
                            <div class="card-body p-0 overflow-auto" style="max-height: 500px;">
                                <table class="modern-table">
                                    <thead id="results-head"></thead>
                                    <tbody id="results-body">
                                        <tr><td class="text-center py-4 text-muted">Run a query to see results</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Database Schemas -->
                        <div class="card border-0 shadow-sm rounded-4 mt-4 overflow-hidden">
                            <div class="card-header bg-white border-bottom-0 py-3 px-4 fw-bold" data-bs-toggle="collapse" data-bs-target="#schema-container" style="cursor: pointer;">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span><i class="bi bi-diagram-3 me-2 text-primary"></i>Database Schemas</span>
                                    <i class="bi bi-chevron-expand text-muted"></i>
                                </div>
                            </div>
                            <div id="schema-container" class="collapse">
                                <div class="card-body bg-light p-3">
                                    <div class="row g-3" id="schema-list">
                                        <div class="col-12 text-center text-muted">Loading schemas...</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Reporting Folder (Saved Reports) -->
                    <div class="col-md-3">
                        <div class="card border-0 shadow-sm rounded-4 h-100 overflow-hidden">
                            <div class="card-header bg-white border-bottom-0 pt-4 px-4 fw-bold">
                                <i class="bi bi-folder2-open me-2 text-primary"></i>Reporting Folder
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
                        <div class="modal-content border-0 shadow rounded-4">
                            <div class="modal-header border-0 pb-0 pt-4 px-4">
                                <h6 class="modal-title fw-bold">Save Report</h6>
                            </div>
                            <div class="modal-body p-4">
                                <label class="form-label small fw-semibold text-secondary">Report Name</label>
                                <input id="new-report-name" type="text" class="form-control" placeholder="e.g. Monthly Van Load">
                                <div id="save-modal-error" class="text-danger small mt-2 hidden"></div>
                            </div>
                            <div class="modal-footer border-0 pt-0 pb-4 px-4">
                                <button id="cancel-save" class="btn btn-sm btn-light rounded-pill px-3">Cancel</button>
                                <button id="confirm-save" class="btn btn-sm btn-primary rounded-pill px-3">Save Now</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `
    });

    let sqliteDb = null;
    let lastResults = null;

    view.onboard({ id: 'sql-query' })
        .onboard({ id: 'sql-highlighted' })
        .onboard({ id: 'sql-code' })
        .onboard({ id: 'run-query' })
        .onboard({ id: 'db-status' })
        .onboard({ id: 'query-error' })
        .onboard({ id: 'results-head' })
        .onboard({ id: 'results-body' })
        .onboard({ id: 'schema-list' })
        .onboard({ id: 'report-utilization' })
        .onboard({ id: 'report-stock' })
        .onboard({ id: 'report-variance' })
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
        const code = view.$('sql-code');
        if (!highlighted || !code) return;
        
        // Add space at end if query ends with newline to allow scrolling past last line
        code.textContent = query + (query.endsWith('\n') ? ' ' : '');
        if (window.Prism) Prism.highlightElement(code);
        syncScroll();
    };

    const syncScroll = () => {
        const textarea = view.$('sql-query');
        const highlighted = view.$('sql-highlighted');
        if (!textarea || !highlighted) return;
        highlighted.scrollTop = textarea.scrollTop;
        highlighted.scrollLeft = textarea.scrollLeft;
    };

    const SYSTEM_TABLES = ["vans", "items", "item_catalog", "appointments", "stock_take_logs", "roles", "users", "audit_logs", "stock_takes", "triggers", "custom_forms", "forms", "saved_reports", "product_types", "form_submissions", "item_types"];
    let tableSchemas = {};

    const initDb = async () => {
        try {
            const SQL = await initSqlJs({
                locateFile: file => `https://unpkg.com/sql.js@1.14.1/dist/${file}`
            });
            sqliteDb = new SQL.Database();
            
            view.$('db-status').textContent = "Loading schemas...";
            
            // Fetch limit=1 for all tables to get schema
            const snapsData = await Promise.all(SYSTEM_TABLES.map(async (t) => {
                try {
                    return await genericDb.findMany(t, { limit: 1 });
                } catch (e) {
                    console.warn(`Failed to fetch schema for ${t}:`, e.message);
                    return [];
                }
            }));
            
            snapsData.forEach((data, idx) => {
                const tableName = SYSTEM_TABLES[idx];
                let cols = ['id', 'created_at', 'updated_at'];
                if (data && data.length > 0) {
                    const firstDoc = data[0];
                    cols = Object.keys(firstDoc).filter(k => k !== 'timestamp');
                    if(!cols.includes('id')) cols.unshift('id');
                }
                tableSchemas[tableName] = cols;
                
                // Create empty table
                sqliteDb.run(`CREATE TABLE ${tableName} (${cols.map(c => `"${c}" TEXT`).join(', ')});`);
            });

            // Render Schema Dropdown UI
            const schemaList = view.$('schema-list');
            if (schemaList) {
                schemaList.innerHTML = Object.entries(tableSchemas).map(([t, cols]) => `
                    <div class="col-md-3 col-sm-4 col-6">
                        <div class="card border-0 shadow-sm h-100">
                            <div class="card-header bg-white py-1 fw-bold small text-primary border-bottom-0">${t}</div>
                            <div class="card-body p-2 pt-0" style="font-size: 0.75rem; font-family: monospace; max-height: 120px; overflow-y: auto;">
                                ${cols.map(c => `<div class="text-truncate text-secondary" title="${c}">- ${c}</div>`).join('')}
                            </div>
                        </div>
                    </div>
                `).join('');
            }
            
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
    
    const runQuery = async () => {
        const query = view.$('sql-query').value || '';
        view.$('query-error')?.classList.add('hidden');
        view.$('export-csv')?.classList.add('hidden');
        lastResults = null;
        
        const btn = view.$('run-query');
        const origBtnHtml = btn.innerHTML;
        btn.disabled = true;

        try {
            // Identify used tables
            const queryLower = query.toLowerCase();
            const usedTables = SYSTEM_TABLES.filter(t => new RegExp(`\\b${t}\\b`, 'i').test(queryLower));
            
            if (usedTables.length > 0) {
                btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>Fetching...`;
                
                // Fetch all data for used tables
                const tablesData = await Promise.all(usedTables.map(t => 
                    genericDb.findMany(t)
                ));
                
                // Clear existing data and insert new data
                tablesData.forEach((data, idx) => {
                    const t = usedTables[idx];
                    sqliteDb.run(`DELETE FROM ${t};`);
                    
                    const cols = tableSchemas[t];
                    if(data && data.length > 0) {
                        const placeholders = cols.map(() => '?').join(', ');
                        const stmt = sqliteDb.prepare(`INSERT INTO ${t} (${cols.map(c=>`"${c}"`).join(', ')}) VALUES (${placeholders})`);
                        
                        data.forEach(d => {
                            const vals = cols.map(c => {
                                let val = d[c];
                                if (val !== null && val !== undefined && typeof val === 'object') {
                                    if(val.toDate) val = val.toDate().toISOString();
                                    else val = JSON.stringify(val);
                                }
                                return val === undefined ? null : String(val);
                            });
                            stmt.run(vals);
                        });
                        stmt.free();
                    }
                });
            }

            btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>Executing...`;
            const res = sqliteDb.exec(query);
            
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
        } finally {
            btn.disabled = false;
            btn.innerHTML = origBtnHtml;
        }
    };

    view.trigger('input', 'sql-query', updateHighlighting);
    view.trigger('scroll', 'sql-query', syncScroll);

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
            
            await genericDb.create('saved_reports', {
                name,
                query,
                created_at: genericDb.serverTimestamp()
            });
            
            genericDb.logAction("Report Saved", `Saved report: ${name}`);
            
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
                const reportsData = await genericDb.findMany('saved_reports');
                listContainer.innerHTML = '';
                
                if (!reportsData || reportsData.length === 0) {
                    listContainer.innerHTML = '<div class="p-3 text-center text-muted">No saved reports found.</div>';
                    return;
                }

                reportsData.forEach(data => {
                    const reportId = data.id;
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
                            await genericDb.remove('saved_reports', reportId);
                            console.log("Reporting: Delete complete");
                            
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
        const unsubscribe = genericDb.subscribe('saved_reports', {}, () => {
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
    json_extract(metadata, '$.user_email') as User,
    type as Load_Type,
    COUNT(log_id) as Entries,
    SUM(json_extract(metadata, '$.count')) as Total_Items_Handled,
    strftime('%Y-%m-%d', created_at) as Day
FROM stock_takes
GROUP BY User, Load_Type, Day
ORDER BY Day DESC;`;
        updateHighlighting();
        runQuery();
    });

    view.trigger('click', 'report-variance', () => {
         view.$('sql-query').value = `SELECT 
    van_id,
    json_extract(metadata, '$.user_email') as Auditor,
    json_extract(discrepancies, '$.missing') as Missing_Items,
    json_extract(discrepancies, '$.extra') as Extra_Items,
    json_array_length(json_extract(discrepancies, '$.missing')) as Missing_Count,
    json_array_length(json_extract(discrepancies, '$.extra')) as Extra_Count,
    created_at as Audit_Date
FROM stock_take_logs
WHERE log_type = 'evening_reconcile' 
  AND (json_array_length(json_extract(discrepancies, '$.missing')) > 0 
       OR json_array_length(json_extract(discrepancies, '$.extra')) > 0)
ORDER BY created_at DESC;`;
         updateHighlighting();
         runQuery();
    });

    view.on('init', () => {
        view.emit('loading:start');
        initDb().then(() => {
            view.emit('loading:end');
            view.emit('rendered');
        });
        loadSavedReports();
    });

    return view;
}
