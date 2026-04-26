import { db } from '../lib/db/index.js';
import { renderTable } from '../lib/table.js';

export function SettingsView() {
    let state = {
        activeTab: 'leads',
        loading: true,
        data: {
            leads: [],
            settings: {}
        }
    };

    const element = document.createElement('div');
    element.className = 'admin-settings-container p-4 max-w-6xl mx-auto';

    const listeners = {};
    const view = {
        element: () => element,
        on: (event, callback) => { listeners[event] = callback; },
        trigger: (event, data) => { if (listeners[event]) listeners[event](data); },
        message: async (msg, data) => {
            if (msg === 'init') loadData();
        },
        destroy: () => {}
    };

    async function loadData() {
        state.loading = true;
        render();
        try {
            state.data.leads = await db.findMany('leads') || [];
            state.data.settings = await db.findOne('app_settings', 'global') || { require_registry_verification: true, enforce_kyc: true };
        } catch(e) {
            console.error(e);
        } finally {
            state.loading = false;
            render();
        }
    }

    function render() {
        element.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h2 class="h3 mb-0">System Configuration</h2>
            </div>
            
            <div class="card border-0 shadow-sm">
                <div class="card-header bg-white p-0 border-bottom">
                    <ul class="nav nav-tabs px-3 pt-3" role="tablist">
                        ${renderTabNavItem('leads', 'Global Leads (Audit)', 'bi-file-text')}
                        ${renderTabNavItem('settings', 'System Settings', 'bi-sliders')}
                    </ul>
                </div>
                <div class="card-body p-0">
                    ${state.loading ? '<div class="p-5 text-center"><span class="spinner-border text-primary"></span></div>' : renderActiveTabContext()}
                </div>
            </div>
        `;
        attachEvents();

        if (state.activeTab === 'leads') {
            const tbody = element.querySelector('#leads-audit-tbody');
            if (tbody) {
                if (state.data.leads.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-3 text-muted">No leads in database.</td></tr>';
                } else {
                    tbody.innerHTML = state.data.leads.map(l => `
                        <tr>
                            <td class="text-muted" style="font-size: 10px;">${l.id}</td>
                            <td>${l.merchant_name}</td>
                            <td>${l.status}</td>
                            <td>${l.owner_id}</td>
                            <td>${l.created_at === '__server_timestamp__' ? new Date().toLocaleDateString() : new Date(l.created_at).toLocaleDateString()}</td>
                        </tr>
                    `).join('');
                }
            }
        }
    }

    function renderTabNavItem(id, label, icon) {
        const isActive = state.activeTab === id;
        return `
            <li class="nav-item" role="presentation">
                <button class="nav-link border-0 ${isActive ? 'active fw-bold text-primary border-bottom border-primary border-3 bg-light' : 'text-muted'}" 
                        style="border-radius: 0; background: transparent;"
                        data-tab="${id}" 
                        type="button" role="tab">
                    <i class="${icon} me-1" style="font-size: 14px;"></i> ${label}
                </button>
            </li>
        `;
    }

    function renderActiveTabContext() {
        switch(state.activeTab) {
            case 'leads': return renderLeadsAuditTab();
            case 'settings': return renderSettingsTab();
            default: return '';
        }
    }

    function renderLeadsAuditTab() {
        return `
            <div class="p-4">
                <div class="d-flex justify-content-between mb-3 border-bottom pb-3">
                    <div>
                        <h5 class="mb-0">Global Leads Audit</h5>
                        <p class="text-muted small mb-0">Read-only comprehensive list</p>
                    </div>
                </div>
                ${renderTable({
                    headers: ['ID', 'Merchant', 'Status', 'Owner UID', 'Created'],
                    tbodyId: 'leads-audit-tbody',
                    emptyMessage: 'No leads in database.'
                })}
            </div>
        `;
    }

    function renderSettingsTab() {
        return `
            <div class="p-4">
                <div class="d-flex justify-content-between mb-3 border-bottom pb-3">
                    <div>
                        <h5 class="mb-0">Global System & API Setup</h5>
                        <p class="text-muted small mb-0">Configure application environment constraints and external platform interconnects.</p>
                    </div>
                </div>

                <div class="row">
                    <!-- Column 1: Core System & Verification -->
                    <div class="col-md-6">
                        <div class="card border border-light mb-4 shadow-sm">
                            <div class="card-header bg-light fw-bold"><i class="bi bi-shield-check me-2"></i>Core System Validation</div>
                            <div class="card-body">
                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Server Timezone Configuration</label>
                                    <select class="form-select form-select-sm" id="sel-server-timezone">
                                        <option value="UTC" ${state.data.settings.server_timezone === 'UTC' || !state.data.settings.server_timezone ? 'selected' : ''}>UTC (Default)</option>
                                        <option value="Asia/Riyadh" ${state.data.settings.server_timezone === 'Asia/Riyadh' ? 'selected' : ''}>KSA (Asia/Riyadh)</option>
                                        <option value="Asia/Dubai" ${state.data.settings.server_timezone === 'Asia/Dubai' ? 'selected' : ''}>UAE (Asia/Dubai)</option>
                                        <option value="Europe/London" ${state.data.settings.server_timezone === 'Europe/London' ? 'selected' : ''}>London (Europe/London)</option>
                                        <option value="America/New_York" ${state.data.settings.server_timezone === 'America/New_York' ? 'selected' : ''}>New York (America/New_York)</option>
                                    </select>
                                    <div class="text-muted text-xs mt-1">Schedules are booked relative to this location, and displayed to users based on local time.</div>
                                </div>
                                <div class="form-check form-switch mb-3">
                                    <input class="form-check-input" type="checkbox" id="chk-registry" ${state.data.settings.require_registry_verification ? 'checked' : ''}>
                                    <label class="form-check-label fw-medium" for="chk-registry">Require Commercial Registry (CR) Verification API</label>
                                    <div class="text-muted small">If enabled, leads cannot proceed setup without verified external lookup.</div>
                                </div>
                                <div class="form-check form-switch mb-3">
                                    <input class="form-check-input" type="checkbox" id="chk-kyc" ${state.data.settings.enforce_kyc !== false ? 'checked' : ''}>
                                    <label class="form-check-label fw-medium" for="chk-kyc">Enforce KYC Documents Upload</label>
                                </div>
                                <hr>
                                <div class="mb-3">
                                    <label class="form-label small fw-bold">CR Verification API URL</label>
                                    <input type="text" class="form-control form-control-sm font-monospace" id="txt-cr-api-url" placeholder="https://api.example.com/check-cr/{{cr}}" value="${state.data.settings.cr_api_url || ''}">
                                    <div class="text-muted text-xs mt-1">Use {{cr}} as placeholder for the CR number.</div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label small fw-bold">CR API Headers (JSON)</label>
                                    <textarea class="form-control form-control-sm font-monospace" id="txt-cr-api-headers" rows="2" placeholder='{"Authorization": "Bearer YOUR_KEY"}'>${state.data.settings.cr_api_headers || ''}</textarea>
                                </div>
                            </div>
                        </div>

                        <div class="card border border-light mb-4 shadow-sm">
                            <div class="card-header bg-light fw-bold"><i class="bi bi-robot me-2"></i>AI Subsystem (Gemini)</div>
                            <div class="card-body">
                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Gemini API Key</label>
                                    <input type="password" class="form-control form-control-sm font-monospace" id="txt-gemini-key" placeholder="AIZA..." value="${state.data.settings.gemini_api_key || ''}">
                                    <div class="text-muted text-xs mt-1">Used for smart triggers and page builder AI assistant.</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Column 2: External Data & Auth -->
                    <div class="col-md-6">
                        <div class="card border border-light mb-4 shadow-sm">
                            <div class="card-header bg-light fw-bold"><i class="bi bi-snow2 me-2"></i>Snowflake Connection</div>
                            <div class="card-body">
                                <p class="text-muted small">Power the Insights Side-Panel with live warehouse data.</p>
                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Account Locator</label>
                                    <input type="text" class="form-control form-control-sm font-monospace" id="txt-sf-account" placeholder="xy12345.us-east-1" value="${state.data.settings.sf_account || ''}">
                                </div>
                                <div class="row g-2 mb-3">
                                    <div class="col-6">
                                        <label class="form-label small fw-bold">Username</label>
                                        <input type="text" class="form-control form-control-sm font-monospace" id="txt-sf-user" value="${state.data.settings.sf_user || ''}">
                                    </div>
                                    <div class="col-6">
                                        <label class="form-label small fw-bold">Password / Token</label>
                                        <input type="password" class="form-control form-control-sm font-monospace" id="txt-sf-pass" value="${state.data.settings.sf_password || ''}">
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Database & Warehouse</label>
                                    <div class="input-group input-group-sm">
                                        <span class="input-group-text bg-light text-muted">DB</span>
                                        <input type="text" class="form-control font-monospace" id="txt-sf-db" value="${state.data.settings.sf_db || ''}">
                                        <span class="input-group-text bg-light text-muted">WH</span>
                                        <input type="text" class="form-control font-monospace" id="txt-sf-wh" value="${state.data.settings.sf_wh || ''}">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="card border border-light mb-4 shadow-sm">
                            <div class="card-header bg-light fw-bold"><i class="bi bi-envelope me-2"></i>SMTP & Communications</div>
                            <div class="card-body">
                                <div class="mb-3">
                                    <label class="form-label small fw-bold">SMTP Connection String</label>
                                    <input type="password" class="form-control form-control-sm font-monospace" id="txt-smtp-url" placeholder="smtp://user:pass@smtp.example.com:587" value="${state.data.settings.smtp_url || ''}">
                                    <div class="text-muted text-xs mt-1">Used for sending workflow trigger emails.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="d-flex justify-content-end border-top pt-3 mt-2">
                    <button class="btn btn-primary shadow-sm" id="btn-save-settings"><i class="bi bi-save me-2"></i>Save Configuration</button>
                </div>
            </div>
        `;
    }

    function attachEvents() {
        element.querySelectorAll('.nav-link[data-tab]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                state.activeTab = e.currentTarget.dataset.tab;
                render();
            });
        });

        const btnSave = element.querySelector('#btn-save-settings');
        if (btnSave) {
            btnSave.addEventListener('click', async () => {
                try {
                    btnSave.disabled = true;
                    btnSave.innerText = 'Saving...';
                    const payload = {
                        ...state.data.settings,
                        server_timezone: element.querySelector('#sel-server-timezone').value,
                        require_registry_verification: element.querySelector('#chk-registry').checked,
                        enforce_kyc: element.querySelector('#chk-kyc').checked,
                        cr_api_url: element.querySelector('#txt-cr-api-url').value,
                        cr_api_headers: element.querySelector('#txt-cr-api-headers').value,
                        gemini_api_key: element.querySelector('#txt-gemini-key').value,
                        sf_account: element.querySelector('#txt-sf-account').value,
                        sf_user: element.querySelector('#txt-sf-user').value,
                        sf_password: element.querySelector('#txt-sf-pass').value,
                        sf_db: element.querySelector('#txt-sf-db').value,
                        sf_wh: element.querySelector('#txt-sf-wh').value,
                        smtp_url: element.querySelector('#txt-smtp-url').value,
                        updated_at: db.serverTimestamp()
                    };
                    await db.updateOrCreate('app_settings', 'global', payload);
                    state.data.settings = payload;
                    alert('Global settings saved successfully.');
                } catch(e) {
                    alert('Failed to save settings: ' + e.message);
                } finally {
                    btnSave.disabled = false;
                    btnSave.innerText = 'Save Configuration';
                }
            });
        }
    }

    return view;
}
