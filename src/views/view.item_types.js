import { controller } from '../lib/controller.js';
import { db } from '../lib/db/index.js';
import { renderTable } from '../lib/table.js';

export function ItemTypesView() {
    const view = controller({
        stringComponent: `
            <div class="item-types-view">
                <style>
                    .custom-field-item { background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 8px; display: flex; gap: 8px; align-items: center; border: 1px solid #e2e8f0; }
                </style>
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h5 class="mb-0 fw-bold"><i class="bi bi-hdd-network text-primary me-2"></i>Hardware Catalog</h5>
                    <button class="btn-pico btn-pico-primary" id="btn-add-item-type">
                        <i class="bi bi-plus-lg me-2"></i>New Hardware Type
                    </button>
                </div>
                
                <div class="card border-0 shadow-sm">
                    <div class="card-body p-0">
                        ${renderTable({
                            headers: ['Catalog ID', 'Name & Details', 'Duration', 'Custom Fields', { label: 'Actions', width: 100 }],
                            tbodyId: 'item-types-list',
                            emptyMessage: 'Loading hardware catalog...'
                        })}
                    </div>
                </div>
            </div>
        `
    });

    view.onboard({ id: 'btn-add-item-type' }).onboard({ id: 'item-types-list' });

    let activeModal = null;

    const createModal = (title, content) => {
        if(activeModal) activeModal.hide();
        const html = `
            <div class="modal fade" id="itemTypeModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content border-0 shadow-lg rounded-4">
                        <div class="modal-header bg-light border-0 pt-4 px-4">
                            <h5 class="modal-title fw-bold">${title}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body p-4">
                            ${content}
                        </div>
                    </div>
                </div>
            </div>
        `;
        const div = document.createElement('div');
        div.innerHTML = html;
        document.body.appendChild(div);
        
        const mEl = document.getElementById('itemTypeModal');
        const bsModal = new bootstrap.Modal(mEl);
        
        mEl.addEventListener('hidden.bs.modal', () => {
            bsModal.dispose();
            mEl.remove();
            activeModal = null;
        });

        activeModal = bsModal;
        return { show: () => bsModal.show(), hide: () => bsModal.hide(), element: mEl };
    };

    const getFormHTML = (pt = null) => {
        return `
            <form id="it-form">
                <div class="row g-3">
                    <div class="col-12 col-md-6">
                        <label class="form-label small fw-bold">Catalog ID</label>
                        <input type="text" class="form-control" name="catalog_id" value="${pt ? (pt.catalog_id || pt.id) : ''}" ${pt ? 'readonly' : 'required'} placeholder="e.g. catalog-pico-device">
                    </div>
                    <div class="col-12 col-md-6">
                        <label class="form-label small fw-bold">Installation Duration (min)</label>
                        <input type="number" class="form-control" name="duration_minutes" value="${pt ? (pt.duration_minutes || 30) : 30}" required min="0">
                    </div>
                    <div class="col-12 col-md-6">
                        <label class="form-label small fw-bold">Hardware Category</label>
                        <select class="form-select" name="item_type" required>
                            <option value="Pico Device" ${pt && pt.item_type === 'Pico Device' ? 'selected' : ''}>Pico Device</option>
                            <option value="Sim Card" ${pt && pt.item_type === 'Sim Card' ? 'selected' : ''}>Sim Card</option>
                            <option value="Accessory" ${pt && pt.item_type === 'Accessory' ? 'selected' : ''}>Accessory / Cable</option>
                        </select>
                    </div>
                    <div class="col-12 col-md-6">
                        <label class="form-label small fw-bold">Display Name</label>
                        <input type="text" class="form-control" name="item_name" value="${pt ? (pt.item_name || pt.name || '') : ''}" placeholder="e.g. Pico Device V2" required>
                    </div>
                    <div class="col-12 col-md-6">
                        <label class="form-label small fw-bold">Provider / Manufacturer</label>
                        <input type="text" class="form-control" name="provider" value="${pt ? (pt.provider || '') : ''}" placeholder="e.g. Verizon">
                    </div>
                    <div class="col-12">
                        <div class="form-check mt-2">
                            <input class="form-check-input" type="checkbox" name="requires_scan" id="requiresScanCheck" ${pt && (pt.metadata?.requires_scan ?? pt.requires_scan) === false ? '' : 'checked'}>
                            <label class="form-check-label fw-bold small" for="requiresScanCheck">
                                Required to be scanned on completion
                            </label>
                        </div>
                    </div>
                </div>
                
                <hr class="my-4 border-secondary-subtle">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div>
                        <h6 class="fw-bold mb-0">Custom Data Fields</h6>
                        <div class="text-xs text-muted">Prompt technicians for extra info (e.g., Color, Cable Length) during booking.</div>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline-primary bg-white border-dashed" id="btn-add-cf">
                        <i class="bi bi-plus-circle me-1"></i>Add Field
                    </button>
                </div>
                
                <div id="cf-container" class="d-flex flex-column gap-2"></div>
                
                <div class="mt-4 pt-3 border-top text-end">
                    <button type="submit" class="btn-pico btn-pico-primary px-4">Save Hardware Configuration</button>
                </div>
            </form>
        `;
    };

    const initFormJS = (modalEl, pt) => {
        const cfContainer = modalEl.querySelector('#cf-container');
        const btnAddCf = modalEl.querySelector('#btn-add-cf');
        const form = modalEl.querySelector('#it-form');
        
        let cfs = pt ? (pt.metadata?.custom_fields || pt.custom_fields || []) : [];

        const renderCfs = () => {
            cfContainer.innerHTML = '';
            if(cfs.length === 0) {
                cfContainer.innerHTML = '<div class="text-muted small text-center py-3 bg-light rounded border">No custom fields defined.</div>';
                return;
            }
            cfs.forEach((cf, i) => {
                const div = document.createElement('div');
                div.className = 'custom-field-item';
                div.innerHTML = `
                    <input type="text" class="form-control form-control-sm" placeholder="Field Label (e.g. Color)" value="${cf.label}" onchange="updateCf(${i}, 'label', this.value)" required>
                    <select class="form-select form-select-sm" style="max-width: 150px;" onchange="updateCf(${i}, 'type', this.value)">
                        <option value="text" ${cf.type==='text'?'selected':''}>Text</option>
                        <option value="number" ${cf.type==='number'?'selected':''}>Number</option>
                        <option value="boolean" ${cf.type==='boolean'?'selected':''}>Checkbox</option>
                    </select>
                    <button type="button" class="btn btn-sm btn-outline-danger border-0" onclick="removeCf(${i})"><i class="bi bi-x-circle fs-6"></i></button>
                `;
                cfContainer.appendChild(div);
            });
        };

        window.updateCf = (i, k, v) => cfs[i][k] = v;
        window.removeCf = (i) => { cfs.splice(i, 1); renderCfs(); };
        
        btnAddCf.onclick = () => {
            cfs.push({ label: '', type: 'text' });
            renderCfs();
        };

        renderCfs();

        form.onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(form);

            const data = {
                id: fd.get('catalog_id'), 
                catalog_id: fd.get('catalog_id'),
                item_type: fd.get('item_type'),
                item_name: fd.get('item_name'),
                duration_minutes: parseInt(fd.get('duration_minutes') || '0', 10),
                provider: fd.get('provider'),
                updated_at: db.serverTimestamp(),
                ...(pt ? {} : { created_at: db.serverTimestamp() }),
                metadata: {
                    ...(pt?.metadata || {}),
                    requires_scan: fd.get('requires_scan') === 'on',
                    custom_fields: cfs.map(c => ({...c, key: (c.label || '').toLowerCase().replace(/[^a-z0-9]/g, '_')}))
                }
            };

            const btn = form.querySelector('button[type="submit"]');
            const ogHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

            try {
                if(!pt) { 
                    const snap = await db.findOne('item_catalog', data.id);
                    if(snap) {
                        alert("Hardware Type with this ID already exists.");
                        btn.disabled = false;
                        btn.innerHTML = ogHtml;
                        return;
                    }
                }
                
                await db.create('item_catalog', data, data.id);
                db.logAction(`Hardware Catalog ${pt ? 'Updated' : 'Created'}`, data.id);
                activeModal.hide();
            } catch(err) {
                alert("Error: " + err.message);
                btn.disabled = false;
                btn.innerHTML = ogHtml;
            }
        };
    };

    view.trigger('click', 'btn-add-item-type', () => {
        const modal = createModal('New Hardware Type', getFormHTML());
        modal.show();
        initFormJS(modal.element, null);
    });

    view.on('init', () => {
        view.emit('loading:start');
        view.unsub(db.subscribe('item_catalog', {}, (data) => {
            const list = view.$('item-types-list');
            view.emit('loading:end');
            if(!list) return;
            
            if(!data || data.length === 0) {
                list.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted small">No hardware types configured.</td></tr>';
                return;
            }

            list.innerHTML = '';
            data.forEach(pt => {
                const tr = document.createElement('tr');
                
                const cfBadges = (pt.metadata?.custom_fields || pt.custom_fields || []).map(cf => `<span class="badge bg-light text-dark border me-1">${cf.label}</span>`).join('');
                
                tr.innerHTML = `
                    <td><code class="data-mono fw-bold">${pt.catalog_id || pt.id}</code></td>
                    <td>
                        <div class="fw-bold text-dark">${pt.item_name || pt.name || 'Unnamed'}</div>
                        <div class="text-muted" style="font-size: 0.75rem;">${pt.item_type || 'Unknown'} • ${pt.provider || 'No provider'}</div>
                    </td>
                    <td><span class="badge bg-pale-primary">${pt.duration_minutes} min</span></td>
                    <td>${cfBadges || '<span class="text-muted small">—</span>'}</td>
                    <td>
                        <button class="btn-pico btn-pico-outline table-action-btn edit-pt me-1" title="Edit"><i class="bi bi-pencil"></i></button>
                        <button class="btn-pico btn-pico-danger-outline table-action-btn delete-pt" title="Delete"><i class="bi bi-trash"></i></button>
                    </td>
                `;

                tr.querySelector('.edit-pt').onclick = () => {
                    const modal = createModal('Edit Hardware Type', getFormHTML(pt));
                    modal.show();
                    initFormJS(modal.element, pt);
                };

                tr.querySelector('.delete-pt').onclick = async () => {
                    const confirmModal = createModal('Delete Hardware Type', `
                        <div class="text-center py-3">
                            <i class="bi bi-exclamation-triangle-fill text-danger mb-3" style="font-size: 3rem;"></i>
                            <h5 class="fw-bold">Are you sure?</h5>
                            <p class="text-muted small">You are about to delete <b>${pt.item_name || pt.catalog_id}</b>. Jobs requiring this hardware may break.</p>
                            <div class="d-flex justify-content-center gap-2 mt-4">
                                <button type="button" class="btn-pico btn-pico-outline" data-bs-dismiss="modal">Cancel</button>
                                <button type="button" class="btn-pico btn-pico-danger-outline" id="confirm-del-btn">Delete Type</button>
                            </div>
                        </div>
                    `);
                    confirmModal.show();
                    
                    confirmModal.element.querySelector('#confirm-del-btn').onclick = async function() {
                        this.disabled = true;
                        this.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
                        try {
                            const ptId = pt.id || pt.catalog_id;
                            await db.remove('item_catalog', ptId);
                            db.logAction("Hardware Type Deleted", ptId);
                            confirmModal.hide();
                        } catch(e) {
                            alert("Error deleting: " + e.message);
                            this.innerHTML = 'Delete Type';
                            this.disabled = false;
                        }
                    };
                };

                list.appendChild(tr);
            });
            document.dispatchEvent(new CustomEvent('apply-auth'));
        }));
    });

    return view;
}
