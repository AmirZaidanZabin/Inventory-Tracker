import { controller } from '../lib/controller.js';
import { firebase } from '../lib/firebase.js';

export function ProductTypesView() {
    const view = controller({
        stringComponent: `
            <div>
                <style>
                    .product-type-row:hover { background-color: #f8f9fa; }
                    .custom-field-item { background: #f1f3f5; padding: 8px; border-radius: 4px; margin-bottom: 8px; display: flex; gap: 8px; align-items: center; }
                </style>
                <div class="card p-4">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h5 class="mb-0 fw-bold">Product Types</h5>
                        <button class="btn-pico btn-pico-primary" id="btn-add-product-type">
                            <i class="bi bi-plus-lg me-2"></i>New Product Type
                        </button>
                    </div>
                    
                    <div class="table-responsive">
                        <table class="modern-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Name</th>
                                    <th>Duration (min)</th>
                                    <th>Custom Fields</th>
                                    <th width="100">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="product-types-list">
                                <tr><td colspan="5" class="text-center py-4 text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Loading...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `
    });

    view.onboard({ id: 'btn-add-product-type' })
        .onboard({ id: 'product-types-list' });

    let activeModal = null;

    const createModal = (title, content) => {
        if(activeModal) activeModal.hide();
        const html = `
            <div class="modal fade" id="productTypeModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content border-0 shadow">
                        <div class="modal-header bg-light">
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
        
        const mEl = document.getElementById('productTypeModal');
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
            <form id="pt-form">
                <div class="row g-3">
                    <div class="col-md-4">
                        <label class="form-label small fw-bold">Type ID</label>
                        <input type="text" class="form-control" name="id" value="${pt ? pt.id : ''}" ${pt ? 'readonly' : 'required'} placeholder="e.g. PT-ROUTER">
                    </div>
                    <div class="col-md-5">
                        <label class="form-label small fw-bold">Name</label>
                        <input type="text" class="form-control" name="name" value="${pt ? pt.name : ''}" required>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label small fw-bold">Duration (min)</label>
                        <input type="number" class="form-control" name="duration_minutes" value="${pt ? pt.duration_minutes : '30'}" required min="1">
                    </div>
                </div>
                
                <hr class="my-4">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="fw-bold mb-0">Custom Fields (Optional)</h6>
                    <button type="button" class="btn btn-sm btn-outline-secondary" id="btn-add-cf"><i class="bi bi-plus"></i> Add Field</button>
                </div>
                
                <div id="cf-container"></div>
                
                <div class="mt-4 text-end">
                    <button type="submit" class="btn-pico btn-pico-primary">Save Product Type</button>
                </div>
            </form>
        `;
    };

    const initFormJS = (modalEl, pt) => {
        const cfContainer = modalEl.querySelector('#cf-container');
        const btnAddCf = modalEl.querySelector('#btn-add-cf');
        const form = modalEl.querySelector('#pt-form');
        
        let cfs = pt ? (pt.custom_fields || []) : [];

        const renderCfs = () => {
            cfContainer.innerHTML = '';
            if(cfs.length === 0) {
                cfContainer.innerHTML = '<div class="text-muted small">No custom fields defined.</div>';
                return;
            }
            cfs.forEach((cf, i) => {
                const div = document.createElement('div');
                div.className = 'custom-field-item';
                div.innerHTML = `
                    <input type="text" class="form-control form-control-sm" placeholder="Field Label (e.g. Serial Number)" value="${cf.label}" onchange="updateCf(${i}, 'label', this.value)" required>
                    <select class="form-select form-select-sm" style="width: 150px;" onchange="updateCf(${i}, 'type', this.value)">
                        <option value="text" ${cf.type==='text'?'selected':''}>Text</option>
                        <option value="number" ${cf.type==='number'?'selected':''}>Number</option>
                        <option value="boolean" ${cf.type==='boolean'?'selected':''}>Checkbox</option>
                    </select>
                    <button type="button" class="btn btn-sm btn-outline-danger border-0" onclick="removeCf(${i})"><i class="bi bi-x"></i></button>
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
                id: fd.get('id'),
                name: fd.get('name'),
                duration_minutes: parseInt(fd.get('duration_minutes') || '0', 10),
                custom_fields: cfs.map(c => ({...c, key: c.label.toLowerCase().replace(/[^a-z0-9]/g, '_')}))
            };

            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

            try {
                const docRef = firebase.db.doc(firebase.db.db, 'product_types', data.id);
                if(!pt) { // Creating
                    const snap = await firebase.db.getDoc(docRef);
                    if(snap.exists()) {
                        alert("A Product Type with this ID already exists.");
                        btn.disabled = false;
                        btn.innerHTML = 'Save Product Type';
                        return;
                    }
                }
                
                await firebase.db.setDoc(docRef, data);
                firebase.logAction(`Product Type ${pt ? 'Updated' : 'Created'}`, data.id);
                activeModal.hide();
            } catch(err) {
                alert("Error: " + err.message);
                btn.disabled = false;
                btn.innerHTML = 'Save Product Type';
            }
        };
    };

    view.trigger('click', 'btn-add-product-type', () => {
        const modal = createModal('New Product Type', getFormHTML());
        modal.show();
        initFormJS(modal.element, null);
    });

    view.on('init', () => {
        const q = firebase.db.collection(firebase.db.db, 'product_types');
        view.emit('loading:start');
        view.unsub(firebase.db.subscribe(q, (snap) => {
            const list = view.$('product-types-list');
            view.emit('loading:end');
            if(!list) return;
            
            if(snap.empty) {
                list.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No product types found.</td></tr>';
                return;
            }

            list.innerHTML = '';
            snap.forEach(doc => {
                const pt = doc.data();
                const tr = document.createElement('tr');
                tr.className = 'product-type-row';
                
                const cfBadges = (pt.custom_fields || []).map(cf => `<span class="badge bg-light text-dark border me-1">${cf.label}</span>`).join('');
                
                tr.innerHTML = `
                    <td><code class="data-mono">${pt.id}</code></td>
                    <td class="fw-bold">${pt.name}</td>
                    <td>${pt.duration_minutes}</td>
                    <td>${cfBadges || '-'}</td>
                    <td>
                        <button class="btn-pico btn-pico-outline table-action-btn edit-pt me-1"><i class="bi bi-pencil"></i></button>
                        <button class="btn-pico btn-pico-danger-outline table-action-btn delete-pt"><i class="bi bi-trash"></i></button>
                    </td>
                `;

                tr.querySelector('.edit-pt').onclick = () => {
                    const modal = createModal('Edit Product Type', getFormHTML(pt));
                    modal.show();
                    initFormJS(modal.element, pt);
                };

                tr.querySelector('.delete-pt').onclick = async () => {
                    // Refactoring confirm dialog to modal
                    const confirmModal = createModal('Delete Product Type', `
                        <div class="text-center">
                            <i class="bi bi-exclamation-triangle-fill text-danger" style="font-size: 3rem;"></i>
                            <h5 class="mt-3">Are you sure?</h5>
                            <p class="text-muted">You are about to delete <b>${pt.name}</b>. This action cannot be undone.</p>
                            <div class="d-flex justify-content-center gap-2 mt-4">
                                <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
                                <button type="button" class="btn btn-danger" id="confirm-del-btn">Delete</button>
                            </div>
                        </div>
                    `);
                    confirmModal.show();
                    
                    confirmModal.element.querySelector('#confirm-del-btn').onclick = async function() {
                        this.disabled = true;
                        this.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
                        try {
                            // Delete document
                            await firebase.db.deleteDoc(firebase.db.doc(firebase.db.db, 'product_types', pt.id));
                            firebase.logAction("Product Type Deleted", pt.id);
                            confirmModal.hide();
                        } catch(e) {
                            alert("Error deleting: " + e.message);
                            this.innerHTML = 'Delete';
                            this.disabled = false;
                        }
                    };
                };

                list.appendChild(tr);
            });
        }));
    });

    return view;
}
