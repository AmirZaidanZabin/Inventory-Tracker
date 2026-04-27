import { apiDb as db } from '../lib/api-client.js';
import { createModal } from '../lib/modal.js';

export function InsightsView() {
    let state = {
        configs: []
    };

    let editingId = null;

    const element = document.createElement('div');
    element.className = 'insights-module-container';

    let listeners = {};

    const view = {
        element: () => element,
        on: (event, callback) => { listeners[event] = callback; },
        trigger: (event, data) => { if (listeners[event]) listeners[event](data); },
        message: async (msg, data) => {
            if (msg === 'init') {
                await view.load();
            }
        },
        async load() {
            try {
                // Default target modules could be 'leads' and 'merchants'
                state.configs = await db.findMany('insights_configs') || [];
                render();
                attachEvents();
            } catch(e) {
                console.error(e);
                element.innerHTML = `<div class="alert alert-danger m-4">Error loading insights configs: ${e.message}</div>`;
            }
        },
        destroy() {
            Object.values(listeners).forEach(u => u());
        }
    };

    function renderList() {
        if (state.configs.length === 0) {
            return `
                <div class="text-center p-5 bg-light rounded text-muted mt-3">
                    <i class="bi bi-snow2 fs-1 text-primary shadow-sm rounded-circle p-3 bg-white mb-3 d-inline-block"></i>
                    <h5>No Snowflake Insights configured</h5>
                    <p>Create reusable insight templates to display data dynamically across the app.</p>
                </div>
            `;
        }

        return `
            <div class="table-responsive bg-white rounded shadow-sm border mt-3">
                <table class="table table-hover align-middle mb-0 text-sm">
                    <thead class="bg-light">
                        <tr>
                            <th>Insight Title</th>
                            <th>Target Module</th>
                            <th>Status</th>
                            <th>Last Updated</th>
                            <th class="text-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.configs.map(c => `
                            <tr>
                                <td class="fw-bold">${c.title || 'Untitled Insight'}</td>
                                <td><span class="badge bg-secondary-subtle text-secondary border">${c.target_module === 'leads' ? 'Leads' : 'Merchants'}</span></td>
                                <td>
                                    <span class="badge ${c.active !== false ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} rounded-pill">
                                        ${c.active !== false ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td class="text-muted">${c.updated_at ? (c.updated_at === '__server_timestamp__' ? new Date() : new Date(c.updated_at)).toLocaleDateString() : 'N/A'}</td>
                                <td class="text-end">
                                    <button class="btn btn-pico btn-outline-secondary me-1 btn-edit" data-id="${c.id}"><i class="bi bi-pencil"></i> Edit</button>
                                    <button class="btn btn-pico btn-outline-danger btn-delete" data-id="${c.id}"><i class="bi bi-trash"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    function render() {
        element.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 class="h4 mb-1 fw-bold"><i class="bi bi-snow2 text-primary me-2"></i>Snowflake Insights Configuration</h2>
                    <p class="text-muted mb-0 small">Manage SQL insight panels and associate them with different modules.</p>
                </div>
                <button class="btn btn-primary btn-sm rounded-pill px-3 shadow-sm shadow-hover" id="btn-create-insight">
                    <i class="bi bi-plus-lg me-1"></i> New Insight
                </button>
            </div>
            ${renderList()}
        `;
        view.trigger('rendered');
    }

    function getInsightDialogContent(c = {}) {
        const title = c.title || '';
        const target_module = c.target_module || 'leads';
        const active = c.active !== false;
        const sql_template = c.sql_template || '';

        return `
            <div class="mb-3">
                <label class="form-label fw-bold small text-muted">Insight Title</label>
                <input type="text" class="form-control" id="dia-title" value="${title.replace(/"/g, '&quot;')}" placeholder="e.g. Total GMV This Month">
            </div>
            <div class="mb-3">
                <label class="form-label fw-bold small text-muted">Target Module</label>
                <select class="form-select" id="dia-module">
                    <option value="leads" ${target_module === 'leads' ? 'selected' : ''}>Leads Details</option>
                    <option value="merchants" ${target_module === 'merchants' ? 'selected' : ''}>Merchants Details</option>
                </select>
                <div class="form-text">Where should this insight appear?</div>
            </div>
            <div class="mb-3">
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" role="switch" id="dia-active" ${active ? 'checked' : ''}>
                    <label class="form-check-label" for="dia-active">Enable Insight</label>
                </div>
            </div>
            <div class="mb-3">
                <label class="form-label fw-bold small text-muted">Snowflake SQL Query</label>
                <textarea class="form-control font-monospace text-xs text-muted bg-light" id="dia-sql" rows="8" placeholder="SELECT COUNT(*) as value FROM db WHERE id = '{{id}}';">${sql_template.replace(/</g, '&lt;')}</textarea>
                <div class="form-text">Use <code>{{field_name}}</code> syntax to inherit state dynamically from the module.</div>
            </div>
        `;
    }

    function openInsightDialog(id = null) {
        editingId = id;
        const existingData = state.configs.find(c => c.id === id) || {};

        const footerHtml = `
            <button type="button" class="btn btn-outline-secondary close-modal me-2">Cancel</button>
            <button type="button" class="btn btn-primary" id="btn-save-insight-modal">Save Configuration</button>
        `;

        const modal = createModal({
            title: id ? 'Edit Insight Panel' : 'Create New Insight Panel',
            body: getInsightDialogContent(existingData),
            footer: footerHtml
        });
        
        modal.show();

        modal.element.querySelector('#btn-save-insight-modal').addEventListener('click', async (e) => {
            const btnSave = e.currentTarget;
            const payload = {
                title: modal.element.querySelector('#dia-title').value,
                target_module: modal.element.querySelector('#dia-module').value,
                sql_template: modal.element.querySelector('#dia-sql').value,
                active: modal.element.querySelector('#dia-active').checked,
                updated_at: db.serverTimestamp()
            };

            if (!payload.title || !payload.sql_template) {
                alert('Title and SQL are required');
                return;
            }

            try {
                btnSave.disabled = true;
                btnSave.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';
                
                if (editingId) {
                    await db.update('insights_configs', editingId, payload);
                } else {
                    await db.insert('insights_configs', { ...payload, created_at: db.serverTimestamp() });
                }

                modal.hide();
                await view.load(); // Refresh table
            } catch(e) {
                alert('Error saving configuration: ' + e.message);
                btnSave.disabled = false;
                btnSave.innerHTML = 'Save Configuration';
            }
        });
    }

    function attachEvents() {
        const btnCreate = element.querySelector('#btn-create-insight');
        if (btnCreate) {
            btnCreate.addEventListener('click', () => openInsightDialog(null));
        }

        element.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                openInsightDialog(id);
            });
        });

        element.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                if(confirm('Are you sure you want to delete this insight configuration? This cannot be undone.')) {
                    await db.delete('insights_configs', id);
                    await view.load();
                }
            });
        });
    }

    return view;
}
