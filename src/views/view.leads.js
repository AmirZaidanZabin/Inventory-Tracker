import { auth } from '../lib/auth.js';
import { db } from '../lib/db/index.js';
import { renderTable } from '../lib/table.js';

export function LeadsView() {
    let state = {
        leads: [],
        filters: { status: '', country: '', search: '' },
        loading: true
    };

    const element = document.createElement('div');
    element.className = 'sales-dashboard-container p-4';

    const listeners = {};
    const view = {
        element: () => element,
        on: (event, callback) => { listeners[event] = callback; },
        trigger: (event, data) => { if (listeners[event]) listeners[event](data); },
        message: (msg, data) => {
            if (msg === 'init') {
                loadLeads();
            }
        },
        destroy: () => {}
    };

    async function loadLeads() {
        state.loading = true;
        render();
        try {
            // Using existing abstracted db access. In a true environment,
            // query would pass filters. Assuming findMany abstraction supports this or we filter client-side for now.
            const allLeads = await db.findMany('leads');
            state.leads = allLeads || [];
        } catch (e) {
            console.error(e);
            alert("Error loading leads");
        } finally {
            state.loading = false;
            render();
        }
    }

    function render() {
        element.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h2 class="h4">Sales Leads</h2>
                <button class="btn btn-pico btn-pico-primary" id="btn-new-lead">
                    <i class="lucide-plus"></i> New Lead
                </button>
            </div>
            
            <div class="card mb-4">
                <div class="card-body p-3">
                    <div class="row g-2">
                        <div class="col-md-4">
                            <input type="text" class="form-control" id="filter-search" placeholder="Search CR or Name..." value="${state.filters.search}">
                        </div>
                        <div class="col-md-3">
                            <select class="form-select" id="filter-status">
                                <option value="">All Statuses</option>
                                <option value="draft" ${state.filters.status === 'draft' ? 'selected' : ''}>Draft</option>
                                <option value="pending" ${state.filters.status === 'pending' ? 'selected' : ''}>Pending Approval</option>
                                <option value="approved" ${state.filters.status === 'approved' ? 'selected' : ''}>Approved</option>
                                <option value="rejected" ${state.filters.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <select class="form-select" id="filter-country">
                                <option value="">All Countries</option>
                                <option value="KSA" ${state.filters.country === 'KSA' ? 'selected' : ''}>KSA</option>
                                <option value="UAE" ${state.filters.country === 'UAE' ? 'selected' : ''}>UAE</option>
                                <option value="KW" ${state.filters.country === 'KW' ? 'selected' : ''}>KW</option>
                            </select>
                        </div>
                        <div class="col-md-2">
                            <button class="btn btn-pico w-100" id="btn-apply-filters">Filter</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card border-0 shadow-sm rounded-4">
                ${renderTable({
                    headers: ['CR / Name', 'Country', 'Status', 'Created', { label: 'Actions', className: 'text-end' }],
                    tbodyId: 'sales-dashboard-tbody',
                    emptyMessage: 'No leads found.'
                })}
            </div>
        `;
        updateTableTbody();
    }

    function updateTableTbody() {
        const tbody = element.querySelector('#sales-dashboard-tbody');
        if (tbody) {
            tbody.innerHTML = renderRows();
            attachEvents(); // Attach events AFTER innerHTML is filled
        }
    }

    function renderRows() {
        if (state.loading) return '<tr><td colspan="5" class="text-center py-4">Loading leads...</td></tr>';
        
        const filtered = state.leads.filter(l => {
            if (state.filters.status && l.status !== state.filters.status) return false;
            if (state.filters.country && l.country !== state.filters.country) return false;
            if (state.filters.search) {
                const term = state.filters.search.toLowerCase();
                const cr = (l.cr_number || '').toLowerCase();
                const name = (l.merchant_name || l.business_name || '').toLowerCase();
                if (!cr.includes(term) && !name.includes(term)) return false;
            }
            return true;
        });

        if (filtered.length === 0) return '<tr><td colspan="5" class="text-center py-4 text-muted">No leads found.</td></tr>';

        return filtered.map(l => `
            <tr>
                <td>
                    <div class="fw-medium">${l.merchant_name || l.business_name || l.name || 'Unnamed Merchant'}</div>
                    <div class="text-muted small">CR: ${l.cr_number || 'N/A'}</div>
                </td>
                <td><span class="badge bg-secondary">${l.country || '?'}</span></td>
                <td>${getStatusBadge(l.status)}</td>
                <td>${(l.created_at === '__server_timestamp__' ? new Date() : new Date(l.created_at || Date.now())).toLocaleDateString()}</td>
                <td class="text-end">
                    <button class="btn btn-pico btn-view" data-id="${l.id}">View</button>
                    ${l.status === 'draft' ? `<button class="btn btn-pico btn-pico-primary btn-submit ms-1" data-id="${l.id}">Submit</button>` : ''}
                </td>
            </tr>
        `).join('');
    }

    function getStatusBadge(status) {
        const map = {
            'draft': '<span class="badge bg-light text-dark border">Draft</span>',
            'pending': '<span class="badge bg-warning text-dark">Pending</span>',
            'approved': '<span class="badge bg-success">Approved</span>',
            'rejected': '<span class="badge bg-danger">Rejected</span>'
        };
        return map[status] || `<span class="badge bg-secondary">${status}</span>`;
    }

    function attachEvents() {
        const btnNew = element.querySelector('#btn-new-lead');
        if (btnNew) {
            btnNew.onclick = () => { window.location.hash = 'leads_new'; };
        }

        const btnFilter = element.querySelector('#btn-apply-filters');
        if (btnFilter) {
            btnFilter.onclick = () => {
                state.filters.search = element.querySelector('#filter-search').value;
                state.filters.status = element.querySelector('#filter-status').value;
                state.filters.country = element.querySelector('#filter-country').value;
                render();
            };
        }

        element.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.currentTarget.dataset.id;
                window.location.hash = `lead_detail/${id}`;
            });
        });

        element.querySelectorAll('.btn-submit').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const b = e.currentTarget;
                const id = b.dataset.id;
                if(confirm("Submit this lead to approval queue?")) {
                    const originalHtml = b.innerHTML;
                    b.disabled = true;
                    b.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
                    try {
                        const token = await auth.getToken();
                        const res = await fetch('/api/sales/submit-lead', {
                            method: 'POST',
                            headers: { 
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ lead_id: id })
                        });
                        if (res.ok) {
                            loadLeads();
                        } else {
                            const err = await res.json();
                            alert("Error submitting lead: " + (err.error || err.message));
                            b.disabled = false;
                            b.innerHTML = originalHtml;
                        }
                    } catch (err) {
                        alert("Error submitting lead: " + err.message);
                        b.disabled = false;
                        b.innerHTML = originalHtml;
                    }
                }
            });
        });
    }

    return view;
}
