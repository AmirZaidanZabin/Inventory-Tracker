import { apiDb as db } from '../lib/api-client.js';
import { createInsightsPanel } from '../lib/insights-panel.js';

export function MerchantDetailView(merchantId) {
    let state = {
        merchant: null,
        loading: true,
    };

    const element = document.createElement('div');
    element.className = 'merchant-detail-wrapper w-100 h-100';

    const mainContent = document.createElement('div');
    mainContent.className = 'merchant-detail-container p-4 pb-5';

    // Apply Split Pane Pattern
    const insights = createInsightsPanel({
        containerNode: element,
        mainContentNode: mainContent,
        getState: () => state.merchant || {},
        targetModule: 'merchants',
        templates: []
    });

    element.appendChild(mainContent);

    let listeners = {};
    const view = {
        element: () => element,
        on: (ev, cb) => listeners[ev] = cb,
        trigger: (ev, data) => { if (listeners[ev]) listeners[ev](data); },
        message: async (msg) => { if (msg === 'init') await loadData(); },
        destroy: () => {}
    };

    async function loadData() {
        state.loading = true;
        render();
        try {
            state.merchant = await db.findOne('merchants', merchantId);
            if (!state.merchant) throw new Error("Merchant not found");

            if (insights.isOpen()) insights.refresh();
        } catch (e) {
            console.error(e);
            mainContent.innerHTML = `<div class="alert alert-danger">Error loading merchant: ${e.message}</div>`;
            return;
        } finally {
            state.loading = false;
            if (state.merchant) {
                render();
            }
        }
    }

    function render() {
        if (state.loading) {
            mainContent.innerHTML = '<div class="p-5 text-center"><div class="spinner-border text-primary" role="status"></div></div>';
            return;
        }

        const m = state.merchant;
        const status = m.status || 'active'; // Default to active if unset for closed_won leads

        let badgeClass = 'badge-pale-success text-success border border-success';
        if (status === 'churned' || status === 'pulled_out') {
            badgeClass = 'badge-pale-danger text-danger border border-danger';
        }

        let actionBtnHTML = '';
        if (status === 'active') {
            actionBtnHTML = `<button class="btn btn-pico btn-pico-primary" id="btn-expansion"><i class="bi bi-briefcase-fill me-1"></i> Create Expansion Lead</button>`;
        } else if (status === 'churned' || status === 'pulled_out') {
            actionBtnHTML = `<button class="btn btn-pico btn-warning text-white" id="btn-reactivation"><i class="bi bi-arrow-repeat me-1"></i> Create Re-activation Lead</button>`;
        }

        mainContent.innerHTML = `
            <!-- Top Header -->
            <div class="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 class="h4 mb-1 fw-bold">${m.merchant_name || 'Unnamed Merchant'}</h2>
                    <div class="text-muted d-flex align-items-center gap-2 small">
                        <span><i class="lucide-hash me-1" style="width: 14px; height: 14px;"></i>${m.cr_number || 'N/A'}</span>
                        <span class="text-black-50">&bull;</span>
                        <span><i class="lucide-globe me-1" style="width: 14px; height: 14px;"></i>${m.country || 'N/A'}</span>
                        <span class="text-black-50">&bull;</span>
                        <span class="badge ${badgeClass} p-1 px-2">${status.toUpperCase()}</span>
                    </div>
                </div>
                <div class="d-flex gap-2">
                    ${actionBtnHTML}
                    <button class="btn btn-pico btn-outline-primary" id="btn-insights" title="Toggle Insights"><i class="bi bi-magic me-1"></i>Insights</button>
                    <button class="btn btn-pico btn-outline-secondary" onclick="window.history.back()">Back</button>
                </div>
            </div>

            <!-- Merchant Info -->
            <div class="card shadow-sm border-0 mb-4">
                <div class="card-header bg-white border-bottom pt-3"><h6 class="mb-0 fw-bold">Merchant Profile Details</h6></div>
                <div class="card-body">
                    <dl class="row mb-0">
                        <dt class="col-sm-3 small text-muted text-uppercase mb-2">Merchant ID</dt>
                        <dd class="col-sm-9 mb-2 fw-medium">${m.id}</dd>

                        <dt class="col-sm-3 small text-muted text-uppercase mb-2">Origin Lead</dt>
                        <dd class="col-sm-9 mb-2 fw-medium"><a href="#lead/${m.lead_id}">View Origin Lead</a></dd>

                        <dt class="col-sm-3 small text-muted text-uppercase mb-2">Converted On</dt>
                        <dd class="col-sm-9 mb-2 fw-medium">${m.created_at === '__server_timestamp__' ? new Date().toLocaleDateString() : new Date(m.created_at).toLocaleDateString()}</dd>
                    </dl>
                </div>
            </div>
        `;

        attachEvents();
    }

    function attachEvents() {
        const btnInsights = mainContent.querySelector('#btn-insights');
        if (btnInsights) {
            btnInsights.addEventListener('click', () => insights.toggle());
        }

        const btnExp = mainContent.querySelector('#btn-expansion');
        if (btnExp) {
            btnExp.addEventListener('click', () => {
                window.location.hash = '#leads_new?merchant_id=' + merchantId + '&action=expansion';
            });
        }
        
        const btnReac = mainContent.querySelector('#btn-reactivation');
        if (btnReac) {
            btnReac.addEventListener('click', () => {
                window.location.hash = '#leads_new?merchant_id=' + merchantId + '&action=reactivation';
            });
        }
    }

    return view;
}
