import { auth } from '../lib/auth.js';
import { apiDb as db } from '../lib/api-client.js';

export function ApprovalsView() {
    let state = {
        approvals: [], // Aggregated list of pending approvals
        loading: true,
        userUid: null
    };

    const element = document.createElement('div');
    element.className = 'approvals-container p-4 max-w-5xl mx-auto';

    const listeners = {};
    const view = {
        element: () => element,
        on: (event, callback) => { listeners[event] = callback; },
        trigger: (event, data) => { if (listeners[event]) listeners[event](data); },
        message: async (msg, data) => {
            if (msg === 'init') {
                state.userUid = auth.currentUser ? auth.currentUser.uid : 'anon';
                loadApprovals();
            }
        },
        destroy: () => {}
    };

    async function loadApprovals() {
        state.loading = true;
        render();
        try {
            const token = await auth.getToken();
            // Fetch directly from approvals collection
            const allApprovals = await db.findMany('approvals') || [];
            
            state.approvals = [];
            for (let app of allApprovals) {
                // Filter client side for pending. 
                // In production, the server could filter this if we had a specific endpoint
                if (app.status === 'pending') {
                    const lead = await db.findOne('leads', app.lead_id);
                    state.approvals.push({ ...app, lead });
                }
            }
        } catch(e) {
            console.error("Load Approvals Error:", e);
        } finally {
            state.loading = false;
            render();
        }
    }

    function render() {
        if (state.loading) {
            element.innerHTML = `
                <div class="d-flex justify-content-center align-items-center" style="min-height: 200px;">
                    <div class="spinner-border text-primary" role="status"></div>
                    <span class="ms-2">Loading approval queue...</span>
                </div>
            `;
            return;
        }

        element.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h2 class="h4 fw-bold mb-0">My Approvals Queue</h2>
                <button class="btn btn-outline-primary btn-sm" id="btn-refresh"><i class="bi bi-refresh me-1"></i> Refresh</button>
            </div>
            
            <div class="row g-4">
                ${state.approvals.length === 0 ? '<div class="col-12"><div class="alert alert-info border-0 shadow-sm">No pending approvals in your queue.</div></div>' : ''}
                ${state.approvals.map(a => renderApprovalCard(a)).join('')}
            </div>
        `;

        attachEvents();
    }

    function renderApprovalCard(a) {
        const lead = a.lead || {};
        const breachHtml = a.breach_details ? a.breach_details.map(b => 
            `<span class="badge bg-danger-subtle text-danger border border-danger-subtle me-1 mb-1">Breach: ${b.type} &middot; Req: ${b.requested}${b.type==='GMV'?'':'%'} (Target: ${b.min_required}${b.type==='GMV'?'':'%'})</span>`
        ).join(' ') : '<span class="text-muted small">No specific thresholds breached in data</span>';

        // Date handling
        let dateStr = 'Unknown';
        if (a.created_at) {
            dateStr = a.created_at === '__server_timestamp__' ? new Date().toLocaleString() : new Date(a.created_at).toLocaleString();
        }

        return `
            <div class="col-12">
                <div class="card shadow-sm border-0 border-start border-warning border-5">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h5 class="card-title fw-bold mb-1">${lead.merchant_name || 'Merchant ' + a.lead_id}</h5>
                                <p class="card-text text-muted small mb-0"><i class="bi bi-globe me-1"></i> ${lead.country || 'N/A'} &middot; CR: ${lead.cr_number || 'N/A'}</p>
                            </div>
                            <div class="text-end">
                                <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle mb-2">Pending Review</span>
                                <div class="text-muted" style="font-size: 0.7rem;">Submitted: ${dateStr}</div>
                            </div>
                        </div>
                        <hr class="my-3">
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <h6 class="text-uppercase text-muted small fw-bold mb-2">Requested Pricing</h6>
                                <div class="d-flex flex-wrap gap-3 text-sm">
                                    <div class="border-end pe-3"><strong>mada:</strong> ${lead.rate_mada || 0}%</div>
                                    <div class="border-end pe-3"><strong>Visa:</strong> ${lead.rate_visa || 0}%</div>
                                    <div class="border-end pe-3"><strong>MC:</strong> ${lead.rate_mastercard || 0}%</div>
                                    <div><strong>Amex:</strong> ${lead.rate_amex || 0}%</div>
                                </div>
                                <div class="mt-2 small text-muted">GMV: ${lead.monthly_gmv ? Number(lead.monthly_gmv).toLocaleString() : '0'} / mo</div>
                            </div>
                            <div class="col-md-6 mb-3">
                                <h6 class="text-uppercase text-muted small fw-bold mb-2">Escalation Triggers</h6>
                                <div class="d-flex flex-wrap align-items-center">
                                    ${breachHtml}
                                </div>
                            </div>
                        </div>
                        <div class="mt-2 p-3 rounded" style="background-color: #f8f9fa;">
                            <label class="form-label fw-bold small text-muted text-uppercase mb-2">Resolution Notes</label>
                            <textarea class="form-control mb-3 txt-notes border-0 shadow-none" data-id="${a.id}" rows="2" placeholder="Explain your decision..."></textarea>
                            <div class="d-flex justify-content-end gap-2">
                                <button class="btn btn-outline-danger px-4 btn-decision" data-id="${a.id}" data-decision="rejected">Reject Request</button>
                                <button class="btn btn-primary px-4 btn-decision" data-id="${a.id}" data-decision="approved">Confirm approval</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function attachEvents() {
        const refreshBtn = element.querySelector('#btn-refresh');
        if (refreshBtn) refreshBtn.addEventListener('click', () => loadApprovals());

        element.querySelectorAll('.btn-decision').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const b = e.currentTarget;
                const id = b.dataset.id;
                const decision = b.dataset.decision;
                const notesField = element.querySelector(`.txt-notes[data-id="${id}"]`);
                const notes = notesField ? notesField.value : '';

                if (!id) {
                    console.error("[APPROVAL_FLOW] Missing ID on button", b);
                    return;
                }

                console.log("[APPROVAL_FLOW] 1. Button clicked:", { id, decision, notes });

                console.log("[APPROVAL_FLOW] 2. Sending request...");
                
                // Safe disabling: toggle all buttons for this specific card
                const card = b.closest('.card');
                if (card) {
                    card.querySelectorAll('.btn-decision').forEach(btn => {
                        btn.disabled = true;
                        if (btn === b) {
                            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Processing...';
                        }
                    });
                }

                try {
                    console.log("[APPROVAL_FLOW] 3. Getting token...");
                    const token = await auth.getToken();
                    console.log("[APPROVAL_FLOW] 4. Token received, fetching /api/sales/process-approval...");
                    
                    const res = await fetch('/api/sales/process-approval', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ 
                            approval_id: id, 
                            decision, 
                            notes
                        })
                    });
                    
                    console.log("[APPROVAL_FLOW] 5. Server response status:", res.status);

                    if (res.ok) {
                        const data = await res.json();
                        console.log("[APPROVAL_FLOW] 6. SUCCESS data:", data);
                        await loadApprovals(); // refresh
                    } else {
                        const errText = await res.text();
                        console.error("[APPROVAL_FLOW] 7. ERROR response:", errText);
                        let errMsg = errText;
                        try { errMsg = JSON.parse(errText).error || errText; } catch(ex){}
                        console.error("Error from server: " + errMsg);
                        
                        // Re-enable buttons on error
                        if (card) {
                            card.querySelectorAll('.btn-decision').forEach(btn => {
                                btn.disabled = false;
                                if (btn === b) {
                                    btn.innerHTML = btn.dataset.decision === 'approved' ? 'Confirm approval' : 'Reject Request';
                                }
                            });
                        }
                        
                        const notesWrapper = element.querySelector(`.txt-notes[data-id="${id}"]`).parentElement;
                        const errorDiv = document.createElement('div');
                        errorDiv.className = 'alert alert-danger mt-3 p-2 small';
                        errorDiv.innerText = "Error: " + errMsg;
                        notesWrapper.appendChild(errorDiv);
                        setTimeout(() => errorDiv.remove(), 5000);
                    }
                } catch(err) {
                    console.error("[APPROVAL_FLOW] 8. CATCH Block:", err);
                    
                    // Re-enable buttons on error
                    if (card) {
                        card.querySelectorAll('.btn-decision').forEach(btn => {
                            btn.disabled = false;
                            if (btn === b) {
                                btn.innerHTML = btn.dataset.decision === 'approved' ? 'Confirm approval' : 'Reject Request';
                            }
                        });
                    }
                    
                    const notesWrapper = element.querySelector(`.txt-notes[data-id="${id}"]`).parentElement;
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'alert alert-danger mt-3 p-2 small';
                    errorDiv.innerText = "Network Error: " + err.message;
                    notesWrapper.appendChild(errorDiv);
                    setTimeout(() => errorDiv.remove(), 5000);
                }
            });
        });
    }

    return view;
}
