import { apiDb as db } from '../lib/api-client.js';
import { createModal } from '../lib/modal.js';

export function PricingRulesView() {
    let state = {
        activeTab: 'cards',
        loading: true,
        cards: [],
        tiers: []
    };

    const element = document.createElement('div');
    element.className = 'pricing-rules-container p-4 max-w-6xl mx-auto pb-5';

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
            state.cards = await db.findMany('pricing_cards') || [];
            if(state.cards.length === 0) {
                // Seed default
                state.cards = [
                    { id: 'mada', name: 'mada', min_pct: 0.8, max_pct: 1.0, min_flat: 0, max_flat: 0, default_pct: 0.8, mandatory: true, active_countries: ['KSA'], sort_order: 1 },
                    { id: 'visa', name: 'Visa', min_pct: 1.0, max_pct: 3.0, min_flat: 0, max_flat: 0.5, default_pct: 2.5, mandatory: true, active_countries: ['KSA', 'UAE', 'KW'], sort_order: 2 },
                    { id: 'mastercard', name: 'Mastercard', min_pct: 1.0, max_pct: 3.0, min_flat: 0, max_flat: 0.5, default_pct: 2.5, mandatory: true, active_countries: ['KSA', 'UAE', 'KW'], sort_order: 3 },
                    { id: 'amex', name: 'Amex', min_pct: 2.0, max_pct: 4.0, min_flat: 0, max_flat: 0, default_pct: 3.5, mandatory: false, active_countries: ['KSA', 'UAE'], sort_order: 4 }
                ];
                for(let c of state.cards) { await db.create('pricing_cards', c, c.id); }
            }

            state.tiers = await db.findMany('pricing_tiers') || [];
            if(state.tiers.length === 0) {
                // Seed default
                state.tiers = [
                    { id: 'tier3', name: 'VP of Sales', level: 3, approver_email: 'vp@example.com', thresholds: { mada: 0.7, visa: 1.5, mastercard: 1.5, amex: 2.0 } },
                    { id: 'tier2', name: 'Director', level: 2, approver_email: 'director@example.com', thresholds: { mada: 0.75, visa: 2.0, mastercard: 2.0, amex: 3.0 } },
                    { id: 'tier1', name: 'Manager', level: 1, approver_email: 'manager@example.com', thresholds: { mada: 0.78, visa: 2.4, mastercard: 2.4, amex: 3.4 } }
                ];
                for(let t of state.tiers) { await db.create('pricing_tiers', t, t.id); }
            }
            
            // Sort tiers by level desc
            state.tiers.sort((a,b)=>b.level - a.level);
            // Sort cards by order
            state.cards.sort((a,b)=>a.sort_order - b.sort_order);

        } catch (e) {
            console.error(e);
        } finally {
            state.loading = false;
            render();
        }
    }

    function render() {
        let html = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h2 class="h4 fw-bold mb-0"><i class="bi bi-cash-coin text-primary me-2"></i>Pricing & Escalation Rules Engine</h2>
            </div>
            
            <div class="card border-0 shadow-sm">
                <div class="card-header bg-white p-0 border-bottom">
                    <ul class="nav nav-tabs px-3 pt-3" role="tablist">
                        ${renderTabNavItem('cards', 'Card Configurations', 'bi-credit-card')}
                        ${renderTabNavItem('tiers', 'Approval Tiers', 'bi-layers')}
                    </ul>
                </div>
                <div class="card-body p-0 bg-light">
                    ${state.loading ? '<div class="p-5 text-center"><span class="spinner-border text-primary"></span></div>' : renderActiveTab()}
                </div>
            </div>
        `;
        element.innerHTML = html;
        attachEvents();
    }

    function renderTabNavItem(id, label, icon) {
        const isActive = state.activeTab === id;
        return `
            <li class="nav-item" role="presentation">
                <button class="nav-link border-0 ${isActive ? 'active fw-bold text-primary border-bottom border-primary border-3 bg-white' : 'text-muted'}" 
                        style="border-radius: 0; background: transparent;"
                        data-tab="${id}" 
                        type="button" role="tab">
                    <i class="${icon} me-1 fs-6"></i> ${label}
                </button>
            </li>
        `;
    }

    function renderActiveTab() {
        if(state.activeTab === 'cards') return renderCardsTab();
        if(state.activeTab === 'tiers') return renderTiersTab();
        return '';
    }

    // --- CARDS TAB ---
    function renderCardsTab() {
        return `
            <div class="p-4 bg-white m-3 rounded shadow-sm border">
                <div class="d-flex justify-content-between mb-4 pb-2 border-bottom">
                    <div>
                        <h5 class="mb-0 fw-bold">Card Brands Configuration</h5>
                        <p class="text-muted small mb-0">Define available card networks boundaries and regional availability.</p>
                    </div>
                    <button class="btn btn-pico btn-pico-primary px-3" id="btn-add-card"><i class="bi bi-plus-lg me-1"></i> Add Card</button>
                </div>
                
                <div class="row g-3">
                    ${state.cards.map(c => `
                        <div class="col-md-6 col-lg-4">
                            <div class="card border border-light h-100 shadow-sm" style="transition: transform 0.2s;">
                                <div class="card-body position-relative">
                                    <div class="d-flex justify-content-between align-items-start mb-3">
                                        <div class="d-flex align-items-center">
                                            <div class="rounded-circle bg-light d-flex align-items-center justify-content-center text-primary fw-bold mr-2 me-2" style="width: 40px; height: 40px; border: 1px solid #e2e8f0;">
                                                <i class="bi bi-credit-card-2-front"></i>
                                            </div>
                                            <div>
                                                <h6 class="mb-0 fw-bold">${c.name}</h6>
                                                <div class="text-muted" style="font-size: 0.7rem;">${c.mandatory?'Mandatory':'Optional'} &middot; Sort: ${c.sort_order}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="small mb-3">
                                        <div class="d-flex justify-content-between border-bottom pb-1 mb-1"><span class="text-muted">Pct (%) Bound:</span> <strong>${c.min_pct}% - ${c.max_pct}%</strong></div>
                                        <div class="d-flex justify-content-between border-bottom pb-1 mb-1"><span class="text-muted">Flat Fee Bound:</span> <strong>${c.min_flat} - ${c.max_flat}</strong></div>
                                        <div class="d-flex justify-content-between border-bottom pb-1 mb-1"><span class="text-muted">Default Pct:</span> <span class="badge bg-primary rounded-pill">${c.default_pct}%</span></div>
                                        <div class="d-flex align-items-start pt-1"><span class="text-muted me-2">Regions:</span> <span class="text-dark">${(c.active_countries||[]).join(', ')}</span></div>
                                    </div>
                                    <div class="d-flex gap-2">
                                        <button class="btn btn-pico btn-pico-outline flex-grow-1 edit-card" data-id="${c.id}"><i class="bi bi-pencil me-1"></i> Edit</button>
                                        <button class="btn btn-pico btn-pico-danger-outline delete-card" data-id="${c.id}"><i class="bi bi-trash"></i></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // --- TIERS TAB ---
    function renderTiersTab() {
        return `
            <div class="p-4 bg-white m-3 rounded shadow-sm border">
                <div class="d-flex justify-content-between mb-4 pb-2 border-bottom">
                    <div>
                        <h5 class="mb-0 fw-bold">Approval Hierarchy Tiers</h5>
                        <p class="text-muted small mb-0">Define escalation routing logic and per-card thresholds.</p>
                    </div>
                    <button class="btn btn-pico btn-pico-primary px-3" id="btn-add-tier"><i class="bi bi-plus-lg me-1"></i> Add Tier</button>
                </div>
                
                <div class="row g-3">
                    ${state.tiers.map(t => `
                        <div class="col-12">
                            <div class="card border border-light shadow-sm">
                                <div class="card-body">
                                    <div class="row align-items-center">
                                        <div class="col-md-3 border-end">
                                            <div class="d-flex align-items-center mb-1">
                                                <span class="badge bg-dark rounded-circle me-2 d-flex justify-content-center align-items-center" style="width: 24px; height: 24px;">${t.level}</span>
                                                <h6 class="mb-0 fw-bold text-dark">${t.name}</h6>
                                            </div>
                                            <div class="small text-muted mb-2">Default Approver:</div>
                                            <div class="small fw-medium text-primary"><i class="bi bi-envelope me-1"></i>${t.approver_email || 'Not set'}</div>
                                        </div>
                                        <div class="col-md-7 border-end">
                                            <div class="d-flex align-items-center mb-2">
                                                <div class="small fw-bold text-muted me-2">Approval Strategy:</div>
                                                <span class="badge ${t.approval_strategy === 'nbr' ? 'bg-info' : 'bg-secondary'}">${t.approval_strategy === 'nbr' ? 'Net Blended Rate (NBR)' : 'Per-Card Strict'}</span>
                                            </div>
                                            <div class="small fw-bold text-muted mb-2">Escalation Thresholds <span class="fw-normal">(triggers if rate is below value)</span></div>
                                            <div class="d-flex flex-wrap gap-2 mb-2">
                                                <div class="border rounded px-2 py-1 bg-light border-primary">
                                                    <span class="small text-muted me-2">Min Monthly GMV:</span>
                                                    <strong class="text-primary">${t.min_monthly_gmv ? Number(t.min_monthly_gmv).toLocaleString() : 'N/A'}</strong>
                                                </div>
                                                ${t.approval_strategy === 'nbr' ? `
                                                <div class="border rounded px-2 py-1 bg-info bg-opacity-10 border-info">
                                                    <span class="small text-muted me-2">NBR Threshold:</span>
                                                    <strong class="text-info">${t.nbr_threshold ? (t.nbr_threshold * 100).toFixed(2) + '%' : 'N/A'}</strong>
                                                </div>
                                                ` : ''}
                                            </div>
                                            <div class="d-flex flex-wrap gap-2">
                                                ${state.cards.map(c => `
                                                    <div class="border rounded px-2 py-1 bg-light">
                                                        <span class="small text-muted me-2">${c.name}:</span>
                                                        <strong class="text-danger">${(t.thresholds && t.thresholds[c.id]) ? t.thresholds[c.id] + '%' : 'N/A'}</strong>
                                                    </div>
                                                `).join('')}
                                            </div>
                                        </div>
                                        <div class="col-md-2 text-end d-flex flex-md-column gap-2 justify-content-center h-100">
                                            <button class="btn btn-pico btn-pico-outline edit-tier" data-id="${t.id}"><i class="bi bi-pencil me-1"></i> Edit Configuration</button>
                                            <button class="btn btn-pico btn-pico-danger-outline delete-tier" data-id="${t.id}"><i class="bi bi-trash"></i></button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                    <div class="col-12 mt-4 text-center">
                        <div class="text-muted small"><i class="bi bi-info-circle me-1"></i> Higher level number = Higher authority (e.g. Level 3 approves exceptions that Level 1/2 cannot).</div>
                    </div>
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

        // --- Cards Events ---
        const btnAddCard = element.querySelector('#btn-add-card');
        if (btnAddCard) btnAddCard.addEventListener('click', () => openCardModal());

        element.querySelectorAll('.edit-card').forEach(btn => {
            btn.addEventListener('click', e => {
                const id = e.currentTarget.dataset.id;
                const card = state.cards.find(c => c.id === id);
                if(card) openCardModal(card);
            });
        });

        element.querySelectorAll('.delete-card').forEach(btn => {
            btn.addEventListener('click', async e => {
                const id = e.currentTarget.dataset.id;
                if(!confirm('Are you sure you want to delete this card configuration?')) return;
                await db.remove('pricing_cards', id);
                await loadData();
            });
        });

        // --- Tiers Events ---
        const btnAddTier = element.querySelector('#btn-add-tier');
        if(btnAddTier) btnAddTier.addEventListener('click', () => openTierModal());

        element.querySelectorAll('.edit-tier').forEach(btn => {
            btn.addEventListener('click', e => {
                const id = e.currentTarget.dataset.id;
                const tier = state.tiers.find(t => t.id === id);
                if(tier) openTierModal(tier);
            });
        });

        element.querySelectorAll('.delete-tier').forEach(btn => {
            btn.addEventListener('click', async e => {
                const id = e.currentTarget.dataset.id;
                if(!confirm('Delete this approval tier?')) return;
                await db.remove('pricing_tiers', id);
                await loadData();
            });
        });
    }

    // Modal Helpers
    function openCardModal(card = null) {
        const modal = createModal({
            title: card ? 'Edit Card Configuration' : 'Add New Card',
            body: `
                <form id="card-config-form" class="row g-3">
                    <div class="col-md-6">
                        <label class="form-label small fw-bold">Brand ID (Internal)</label>
                        <input type="text" name="id" class="form-control" value="${card?.id || ''}" ${card?'disabled':''} required pattern="[A-Za-z0-9_]+">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label small fw-bold">Display Name</label>
                        <input type="text" name="name" class="form-control" value="${card?.name || ''}" required>
                    </div>
                    
                    <div class="col-12"><hr class="my-1"></div>
                    <div class="col-12"><h6 class="text-primary small mb-0 fw-bold">Percentage Fee (%) Bounds</h6></div>
                    <div class="col-md-4">
                        <label class="form-label small">Min %</label>
                        <input type="number" step="0.01" name="min_pct" class="form-control" value="${card?.min_pct || 0}" required>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label small">Max %</label>
                        <input type="number" step="0.01" name="max_pct" class="form-control" value="${card?.max_pct || 0}" required>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label small">Default %</label>
                        <input type="number" step="0.01" name="default_pct" class="form-control" value="${card?.default_pct || 0}" required>
                    </div>

                    <div class="col-12"><hr class="my-1"></div>
                    <div class="col-12"><h6 class="text-primary small mb-0 fw-bold">Flat Fee Bounds</h6></div>
                    <div class="col-md-6">
                        <label class="form-label small">Min Flat</label>
                        <input type="number" step="0.01" name="min_flat" class="form-control" value="${card?.min_flat || 0}" required>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label small">Max Flat</label>
                        <input type="number" step="0.01" name="max_flat" class="form-control" value="${card?.max_flat || 0}" required>
                    </div>

                    <div class="col-12"><hr class="my-1"></div>
                    <div class="col-md-6">
                        <label class="form-label small fw-bold">Active Countries (comma separated)</label>
                        <input type="text" name="active_countries" class="form-control" value="${(card?.active_countries || []).join(',')}" placeholder="KSA,UAE,KW">
                    </div>
                    <div class="col-md-3">
                        <label class="form-label small fw-bold">Sort Order</label>
                        <input type="number" name="sort_order" class="form-control" value="${card?.sort_order || 1}" required>
                    </div>
                    <div class="col-md-3 d-flex align-items-end">
                        <div class="form-check mb-2">
                            <input class="form-check-input" type="checkbox" name="mandatory" id="chk-mandatory" ${card?.mandatory?'checked':''}>
                            <label class="form-check-label small" for="chk-mandatory">Mandatory</label>
                        </div>
                    </div>
                    <div class="col-12 mt-4">
                        <button type="submit" class="btn btn-pico btn-pico-primary w-100">Save Configuration</button>
                    </div>
                </form>
            `
        });
        modal.show();
        
        modal.element.querySelector('#card-config-form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const data = {
                id: card ? card.id : fd.get('id'),
                name: fd.get('name'),
                min_pct: parseFloat(fd.get('min_pct')),
                max_pct: parseFloat(fd.get('max_pct')),
                default_pct: parseFloat(fd.get('default_pct')),
                min_flat: parseFloat(fd.get('min_flat')),
                max_flat: parseFloat(fd.get('max_flat')),
                sort_order: parseInt(fd.get('sort_order')),
                mandatory: e.target.querySelector('#chk-mandatory').checked,
                active_countries: fd.get('active_countries').split(',').map(s=>s.trim()).filter(Boolean)
            };
            try {
                if(card) {
                    await db.update('pricing_cards', card.id, data);
                } else {
                    await db.create('pricing_cards', data, data.id);
                }
                modal.hide();
                await loadData();
            } catch(err) {
                alert(err.message);
            }
        };
    }

    function openTierModal(tier = null) {
        const thFields = state.cards.map(c => `
            <div class="col-md-6 mb-2">
                <label class="form-label small text-muted mb-1">${c.name} Threshold (%)</label>
                <div class="input-group input-group-sm">
                    <span class="input-group-text">&lt;</span>
                    <input type="number" step="0.01" name="th_${c.id}" class="form-control" value="${tier?.thresholds?.[c.id] || ''}">
                    <span class="input-group-text">%</span>
                </div>
            </div>
        `).join('');

        const modal = createModal({
            title: tier ? 'Edit Tier Configuration' : 'Add New Tier',
            body: `
                <form id="tier-config-form" class="row g-3">
                    <div class="col-12">
                        <div class="alert alert-info py-2 small border-0 bg-light text-secondary">
                            Exceptions below the thresholds defined here will be routed to this tier.
                        </div>
                    </div>
                    <div class="col-md-9">
                        <label class="form-label small fw-bold">Tier Name</label>
                        <input type="text" name="name" class="form-control" value="${tier?.name || ''}" required placeholder="e.g. Director">
                    </div>
                    <div class="col-md-3">
                        <label class="form-label small fw-bold">Rank (Level)</label>
                        <input type="number" name="level" class="form-control" value="${tier?.level || 1}" required min="1">
                    </div>
                    
                    <div class="col-12">
                        <label class="form-label small fw-bold">Default Approver Email</label>
                        <input type="email" name="approver_email" class="form-control" value="${tier?.approver_email || ''}" required>
                    </div>

                    <div class="col-12"><hr class="my-1"></div>
                    <div class="col-12"><h6 class="text-primary small mb-2 fw-bold">Strategy & Per-Card Escalation Thresholds</h6></div>
                    
                    <div class="col-md-6 mb-2">
                        <label class="form-label small fw-bold">Approval Strategy</label>
                        <select name="approval_strategy" id="sel-strategy" class="form-select form-select-sm">
                            <option value="normal" ${tier?.approval_strategy !== 'nbr' ? 'selected' : ''}>Per-Card Strict (Normal)</option>
                            <option value="nbr" ${tier?.approval_strategy === 'nbr' ? 'selected' : ''}>Net Blended Rate (NBR)</option>
                        </select>
                    </div>
                    
                    <div class="col-md-6 mb-2 nbr-fields" style="${tier?.approval_strategy === 'nbr' ? '' : 'display:none;'}">
                        <label class="form-label small fw-bold">NBR Minimum Threshold (%)</label>
                        <input type="number" step="0.001" name="nbr_threshold" class="form-control form-control-sm" value="${tier?.nbr_threshold ? (tier.nbr_threshold * 100).toFixed(3) : ''}" placeholder="e.g. 1.05">
                    </div>

                    <div class="col-12 mb-2 normal-fields" style="${tier?.approval_strategy !== 'nbr' ? '' : 'display:none;'}">
                        <div class="alert alert-warning small py-1 mb-0 border-0">
                            <strong>Note:</strong> Standard card thresholds are ignored if NBR strategy is active, but you can retain them for reference.
                        </div>
                    </div>

                    <div class="col-12 mb-2">
                        <label class="form-label small fw-bold">Min Monthly GMV (triggers tier if GMV is below value)</label>
                        <div class="input-group input-group-sm">
                            <span class="input-group-text">$</span>
                            <input type="number" step="1" name="min_monthly_gmv" class="form-control" value="${tier?.min_monthly_gmv || ''}">
                        </div>
                    </div>
                    <div class="row g-1">
                        ${thFields}
                    </div>

                    <div class="col-12 mt-4">
                        <button type="submit" class="btn btn-pico btn-pico-primary w-100">Save Configuration</button>
                    </div>
                </form>
            `
        });
        modal.show();

        modal.element.querySelector('#sel-strategy').addEventListener('change', (e) => {
            const isNbr = e.target.value === 'nbr';
            const nbrFields = modal.element.querySelectorAll('.nbr-fields');
            const normalFields = modal.element.querySelectorAll('.normal-fields');
            nbrFields.forEach(f => f.style.display = isNbr ? '' : 'none');
            normalFields.forEach(f => f.style.display = isNbr ? 'none' : '');
        });

        modal.element.querySelector('#tier-config-form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            
            const thresholds = {};
            state.cards.forEach(c => {
                const val = fd.get(`th_${c.id}`);
                if(val) thresholds[c.id] = parseFloat(val);
            });

            const lvl = parseInt(fd.get('level'));
            
            // convert nbr % layout to decimal
            const rawNbr = fd.get('nbr_threshold');
            const nbrParsed = rawNbr ? parseFloat(rawNbr) / 100 : undefined;

            const data = {
                id: tier ? tier.id : `tier${lvl}_${Math.random().toString(36).substr(2,5)}`, // simple id
                name: fd.get('name'),
                level: lvl,
                approver_email: fd.get('approver_email'),
                min_monthly_gmv: parseFloat(fd.get('min_monthly_gmv')) || 0,
                approval_strategy: fd.get('approval_strategy') || 'normal',
                nbr_threshold: nbrParsed,
                thresholds
            };

            try {
                if(tier) {
                    await db.update('pricing_tiers', tier.id, data);
                } else {
                    await db.create('pricing_tiers', data, data.id);
                }
                modal.hide();
                await loadData();
            } catch(err) {
                alert(err.message);
            }
        };
    }

    return view;
}
