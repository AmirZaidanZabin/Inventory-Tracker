import { apiDb as db } from '../lib/api-client.js';
import { createModal } from '../lib/modal.js';
import { renderTable } from '../lib/table.js';
import { createInsightsPanel } from '../lib/insights-panel.js';

export function LeadDetailView(leadId) {
    let state = {
        lead: null,
        loading: true,
        approvals: []
    };
    let map = null;

    const element = document.createElement('div');
    // Using relative width instead of fixed max-w for split pane to work gracefully
    element.className = 'lead-detail-wrapper w-100 h-100';

    const mainContent = document.createElement('div');
    mainContent.className = 'lead-detail-container p-4 pb-5';

    // Apply Split Pane Pattern
    const insights = createInsightsPanel({
        containerNode: element,
        mainContentNode: mainContent,
        getState: () => state.lead || {},
        targetModule: 'leads',
        templates: [] // Will fetch dynamically
    });

    element.appendChild(mainContent);

    let listeners = {};
    const view = {
        element: () => element,
        on: (event, callback) => { listeners[event] = callback; },
        trigger: (event, data) => { if (listeners[event]) listeners[event](data); },
        message: async (msg, data) => {
            if (msg === 'init') loadData();
        },
        destroy: () => {
            if (map) { map.remove(); map = null; }
        }
    };

    async function loadData() {
        state.loading = true;
        render();
        try {
            state.lead = await db.findOne('leads', leadId);
            if (!state.lead) throw new Error("Lead not found");

            const allApprovals = await db.findMany('approvals') || [];
            state.approvals = allApprovals.filter(a => a.lead_id === leadId);

            // Refetch insights based on newly loaded state if it's open
            if (insights.isOpen()) insights.refresh();

        } catch(e) {
            console.error(e);
            mainContent.innerHTML = `<div class="alert alert-danger">Error loading lead: ${e.message}</div>`;
            return;
        } finally {
            state.loading = false;
            if(state.lead) {
                render();
                initMap();
            }
        }
    }

    function render() {
        if (state.loading) {
            mainContent.innerHTML = '<div class="p-5 text-center"><div class="spinner-border text-primary" role="status"></div></div>';
            return;
        }

        const l = state.lead;
        
        let badgeClass = 'badge-pale-secondary border filter-target';
        if (l.status === 'approved') badgeClass = 'badge-pale-success text-success border border-success';
        else if (l.status === 'pending') badgeClass = 'badge-pale-warning text-warning border border-warning';
        else if (l.status === 'closed_won') badgeClass = 'badge-pale-primary text-primary border border-primary';

        mainContent.innerHTML = `
            <!-- Top Header -->
            <div class="d-flex justify-content-between align-items-center mb-4">
                <div>
                  <h2 class="h4 mb-1 fw-bold">${l.merchant_name || l.business_name || l.name || 'Unnamed Merchant'}</h2>
                  <div class="text-muted d-flex align-items-center gap-2 small">
                      <span><i class="bi bi-hash me-1" style="font-size: 0.85rem;"></i>${l.cr_number || 'N/A'}</span>
                      <span class="text-black-50">&bull;</span>
                      <span><i class="bi bi-globe me-1" style="font-size: 0.85rem;"></i>${l.country || 'N/A'}</span>
                      <span class="text-black-50">&bull;</span>
                      <span><i class="bi bi-clock me-1" style="font-size: 0.85rem;"></i>${l.created_at === '__server_timestamp__' ? new Date().toLocaleDateString() : new Date(l.created_at || Date.now()).toLocaleDateString() || 'Unassigned'}</span>
                      <span class="text-black-50">&bull;</span>
                      ${l.kyc_document ? `<span><i class="bi bi-file-earmark-person me-1" style="font-size: 0.85rem; color:#10b981;"></i>${l.kyc_document} (KYC)</span><span class="text-black-50">&bull;</span>` : ''}
                      <span class="badge ${badgeClass} p-1 px-2">${(l.status || 'draft').toUpperCase()}</span>
                  </div>
                </div>
                <div class="d-flex gap-2">
                    ${l.status === 'approved' ? `<button class="btn btn-pico btn-pico-primary" id="btn-convert"><i class="bi bi-shop me-1"></i> Mark Closed Won</button>` : ''}
                    <button class="btn btn-pico btn-outline-secondary" id="btn-back">Back</button>
                    <button class="btn btn-pico btn-outline-primary" id="btn-insights" title="Toggle Insights"><i class="bi bi-magic me-1"></i>Insights</button>
                </div>
            </div>

            <!-- Middle Split (Grid) -->
            <div class="row g-4 mb-4">
                <div class="col-md-6">
                    <div class="card shadow-sm border-0 h-100 overflow-hidden">
                        <div class="card-header bg-white border-bottom pt-3"><h6 class="mb-0 fw-bold">Branches</h6></div>
                        <div class="card-body p-0">
                            <div id="lead-map-${leadId}" style="height: 350px; width: 100%; background: #f8f9fa;"></div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card shadow-sm border-0 h-100">
                        <div class="card-header bg-white border-bottom-0 pt-3"><h6 class="mb-0 fw-bold">Proposed Card Rates</h6></div>
                        ${renderTable({
                            headers: ['Card', '% Rate', 'Flat', 'Status'],
                            tbodyId: 'rates-tbody',
                            emptyMessage: 'No rates proposed.'
                        })}
                    </div>
                </div>
            </div>

            <!-- Onboarding Section -->
            <div class="card mb-4 border-0 shadow-sm">
                <div class="card-body py-4">
                    <h6 class="text-uppercase text-muted fw-bold small mb-4">Onboarding Timeline <span class="ms-2 fw-normal text-muted">(Penetration rate: 85%)</span></h6>
                    <div class="position-relative px-4" style="min-height: 80px;">
                        <!-- Global Progress Line -->
                        <div class="progress position-absolute w-100" style="height: 4px; z-index: 0; top: 22px; left: 0;">
                            <div class="progress-bar bg-success" role="progressbar" style="width: ${getProgressWidth(l.status)}%"></div>
                        </div>
                        <div class="d-flex justify-content-between position-relative" style="z-index: 1;">
                            ${renderMilestone('Registered', true, 'bi bi-file-earmark-text')}
                            ${renderMilestone('Nafath Verified', ['closed_won'].includes(l.status) || l.kyc_passed, 'bi bi-shield-check')}
                            ${renderMilestone('Terminals Delivered', ['closed_won'].includes(l.status) || l.devices_deployed, 'bi bi-truck')}
                            ${renderMilestone('SIMs Delivered', ['closed_won'].includes(l.status) || l.devices_deployed, 'bi bi-sim')}
                            ${renderMilestone('Pico Delivered', ['closed_won'].includes(l.status) || l.devices_deployed, 'bi bi-pda')}
                            ${renderMilestone('Activated', ['closed_won'].includes(l.status) || l.is_live, 'bi bi-lightning-charge')}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Approval History -->
            <div class="card shadow-sm border-0">
                <div class="card-header bg-white border-bottom pt-3"><h6 class="mb-0 fw-bold">Approval History</h6></div>
                <div class="card-body p-0">
                    <ul class="list-group list-group-flush timeline-list">
                        <li class="list-group-item d-flex px-4 py-3 bg-light">
                            <div class="me-3 mt-1"><i class="bi bi-file-earmark-plus text-primary border rounded-circle p-2 bg-white" style="font-size: 1rem;"></i></div>
                            <div>
                                <div class="fw-medium text-dark">Lead Created</div>
                                <div class="text-muted small">${l.created_at === '__server_timestamp__' ? new Date().toLocaleString() : new Date(l.created_at).toLocaleString()}</div>
                            </div>
                        </li>
                        ${state.approvals.length === 0 ? '<li class="list-group-item p-4 text-center text-muted small">No approvals processed yet.</li>' : ''}
                        ${state.approvals.map(a => `
                            <li class="list-group-item d-flex px-4 py-3">
                                <div class="me-3 mt-1"><i class="bi bi-${a.status==='approved'?'check-circle':'exclamation-circle'} text-${a.status==='approved'?'success':(a.status==='rejected'?'danger':'warning')} border border-${a.status==='approved'?'success':(a.status==='rejected'?'danger':'warning')} rounded-circle p-2" style="font-size: 1rem;"></i></div>
                                <div>
                                    <div class="fw-medium text-dark d-flex align-items-center">
                                        Tier Approval Check
                                        <span class="badge bg-${a.status==='approved'?'success':(a.status==='rejected'?'danger':'warning')} ms-2">${a.status}</span>
                                    </div>
                                    <div class="text-muted small mb-1">Evaluated by: ${a.approver_uid || 'System'}</div>
                                    <div class="text-muted small mb-1 fst-italic">"${a.notes || 'No notes provided'}"</div>
                                    <div class="text-muted" style="font-size: 11px;">${a.created_at === '__server_timestamp__' ? new Date().toLocaleString() : new Date(a.created_at).toLocaleString()}</div>
                                </div>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        `;

        // Fill Rates table
        const ratesTbody = mainContent.querySelector('#rates-tbody');
        if (ratesTbody) {
            const cardKeys = Object.keys(l).filter(k => k.startsWith('rate_') && l[k]);
            if (cardKeys.length === 0) {
                ratesTbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted small">No card rates configured.</td></tr>';
            } else {
                ratesTbody.innerHTML = cardKeys.map(k => `
                    <tr>
                        <td class="fw-bold">${k.replace('rate_', '').toUpperCase()}</td>
                        <td>${parseFloat(l[k]).toFixed(2)}%</td>
                        <td class="text-muted">-</td>
                        <td><span class="badge ${badgeClass} px-2">${(l.status || 'draft').toUpperCase()}</span></td>
                    </tr>
                `).join('');
            }
        }

        attachEvents();
    }

    function initMap() {
        const mapEl = mainContent.querySelector(`#lead-map-${leadId}`);
        if (!mapEl || !window.L) return;

        // If map already exists on this element, remove it to re-init
        if (mapEl._leaflet_id) {
           return; 
        }

        map = L.map(mapEl).setView([24.7136, 46.6753], 5);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        }).addTo(map);

        const branches = state.lead?.branches || state.lead?.custom_data?.branches || [];
        // Extract array from string if it's stringified JSON
        let parsedBranches = [];
        try {
            if (typeof branches === 'string' && branches.trim().startsWith('[')) {
                parsedBranches = JSON.parse(branches);
            } else if (Array.isArray(branches)) {
                parsedBranches = branches;
            }
        } catch(e){}

        if (parsedBranches.length > 0) {
            const group = L.featureGroup();
            parsedBranches.forEach(b => {
                if (b.lat && b.lng) {
                    const mk = L.marker([b.lat, b.lng]).bindPopup(b.address || 'Branch Location');
                    mk.addTo(group);
                }
            });
            group.addTo(map);
            map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 15 });
        }
    }

    function getProgressWidth(status) {
        if(status === 'draft' || status === 'rejected') return 0;
        if(status === 'pending') return 20;
        if(status === 'approved') return 40;
        if(status === 'closed_won') return 100;
        return 0;
    }

    function renderMilestone(label, isComplete, icon) {
        const bg = isComplete ? 'bg-success text-white shadow' : 'bg-white text-muted border border-2';
        return `
            <div class="d-flex flex-column align-items-center position-relative" style="z-index: 1;">
                <div class="rounded-circle ${bg} d-flex align-items-center justify-content-center" style="width: 44px; height: 44px; transition: all 0.3s; box-shadow: 0 0 0 5px #fff;">
                    <i class="${icon}" style="font-size: 1.3rem;"></i>
                </div>
                <div class="mt-2 text-center" style="font-size: 11px; font-weight: 600; width: 80px; line-height: 1.2;">${label}</div>
            </div>
        `;
    }

    function attachEvents() {
        const btnInsights = mainContent.querySelector('#btn-insights');
        if (btnInsights) {
            btnInsights.addEventListener('click', () => insights.toggle());
        }

        const btnBack = mainContent.querySelector('#btn-back');
        if (btnBack) {
            btnBack.addEventListener('click', () => { window.location.hash = 'leads'; });
        }

        const btnConvert = mainContent.querySelector('#btn-convert');
        if (btnConvert) {
            btnConvert.addEventListener('click', () => {
                const modal = createModal({
                    title: 'Convert to Merchant (Closed Won)',
                    body: `
                        <p>You are about to convert <strong>${state.lead.merchant_name}</strong> into an active merchant.</p>
                        <p class="small text-muted">This action will transition the lead lifecycle to 'closed_won' and populate the Merchants module.</p>
                    `,
                    footer: `
                        <button type="button" class="btn btn-pico btn-pico-outline" id="btn-cancel-convert">Cancel</button>
                        <button type="button" class="btn btn-pico btn-pico-primary ms-2" id="btn-confirm-convert">Convert Now</button>
                    `
                });

                modal.element.querySelector('#btn-cancel-convert').onclick = () => modal.hide();
                modal.element.querySelector('#btn-confirm-convert').onclick = async () => {
                    modal.element.querySelector('#btn-confirm-convert').disabled = true;
                    try {
                        await db.update('leads', leadId, {
                            status: 'closed_won',
                            converted_at: db.serverTimestamp(),
                            updated_at: db.serverTimestamp(),
                            contract_signed: true,
                            kyc_passed: true,
                            devices_deployed: true,
                            is_live: true
                        });
                        
                        await db.create('merchants', {
                            lead_id: leadId,
                            merchant_name: state.lead.merchant_name,
                            cr_number: state.lead.cr_number,
                            country: state.lead.country,
                            created_at: db.serverTimestamp()
                        }, `merch_${leadId}`);
                        
                        if (db.logAction) {
                            db.logAction("Lead Converted", `Lead ${leadId} converted to Merchant`);
                        }
                        
                        modal.hide();
                        loadData();
                    } catch (e) {
                        alert("Error converting lead: " + e.message);
                        modal.element.querySelector('#btn-confirm-convert').disabled = false;
                    }
                };
                modal.show();
            });
        }
    }

    return view;
}
