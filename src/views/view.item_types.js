import { controller } from '../lib/controller.js';
import { firebase } from '../lib/firebase.js';

export function ItemTypesView() {
    const view = controller({
        stringComponent: `
            <div>
                <style>
                    .item-type-row:hover { background-color: #f8f9fa; }
                </style>
                <div class="card p-4">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h5 class="mb-0 fw-bold">Hardware Item Types</h5>
                        <button class="btn-pico btn-pico-primary" id="btn-add-item-type">
                            <i class="bi bi-plus-lg me-2"></i>New Item Type
                        </button>
                    </div>
                    
                    <div class="table-responsive">
                        <table class="modern-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Name</th>
                                    <th width="100">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="item-types-list">
                                <tr><td colspan="3" class="text-center py-4 text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Loading...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `
    });

    view.onboard({ id: 'btn-add-item-type' })
        .onboard({ id: 'item-types-list' });

    let activeModal = null;

    const createModal = (title, content) => {
        if(activeModal) activeModal.hide();
        const html = `
            <div class="modal fade" id="itemTypeModal" tabindex="-1">
                <div class="modal-dialog">
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
                    <div class="col-12">
                        <label class="form-label small fw-bold">Catalog ID</label>
                        <input type="text" class="form-control" name="catalog_id" value="${pt ? (pt.catalog_id || pt.id) : ''}" ${pt ? 'readonly' : 'required'} placeholder="e.g. pico-device-v2">
                    </div>
                    <div class="col-12 col-md-6">
                        <label class="form-label small fw-bold">Item Type</label>
                        <select class="form-select" name="item_type" required>
                            <option value="Sim Card" ${pt && pt.item_type === 'Sim Card' ? 'selected' : ''}>Sim Card</option>
                            <option value="Pico Device" ${pt && pt.item_type === 'Pico Device' ? 'selected' : ''}>Pico Device</option>
                        </select>
                    </div>
                    <div class="col-12 col-md-6">
                        <label class="form-label small fw-bold">Item Name</label>
                        <input type="text" class="form-control" name="item_name" value="${pt ? (pt.item_name || pt.name || '') : ''}" placeholder="e.g. Pico Device V2" required>
                    </div>
                    <div class="col-12 col-md-6">
                        <label class="form-label small fw-bold">Installation Duration (min)</label>
                        <input type="number" class="form-control" name="duration_minutes" value="${pt ? (pt.duration_minutes || 30) : 30}" required min="0">
                    </div>
                    <div class="col-12">
                        <label class="form-label small fw-bold">Provider</label>
                        <input type="text" class="form-control" name="provider" value="${pt ? (pt.provider || '') : ''}" placeholder="e.g. Verizon">
                    </div>
                </div>
                
                <div class="mt-4 text-end">
                    <button type="submit" class="btn-pico btn-pico-primary">Save Item Type</button>
                </div>
            </form>
        `;
    };

    const initFormJS = (modalEl, pt) => {
        const form = modalEl.querySelector('#it-form');

        form.onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(form);

            const data = {
                id: fd.get('catalog_id'), // Need an ID for firebase doc
                catalog_id: fd.get('catalog_id'),
                item_type: fd.get('item_type'),
                item_name: fd.get('item_name'),
                duration_minutes: parseInt(fd.get('duration_minutes') || '0', 10),
                provider: fd.get('provider')
            };

            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

            try {
                const docRef = firebase.db.doc(firebase.db.db, 'item_catalog', data.id);
                if(!pt) { // Creating
                    const snap = await firebase.db.getDoc(docRef);
                    if(snap.exists()) {
                        alert("An Item Type with this ID already exists.");
                        btn.disabled = false;
                        btn.innerHTML = 'Save Item Type';
                        return;
                    }
                }
                
                await firebase.db.setDoc(docRef, data);
                firebase.logAction(`Item Type ${pt ? 'Updated' : 'Created'}`, data.id);
                activeModal.hide();
            } catch(err) {
                alert("Error: " + err.message);
                btn.disabled = false;
                btn.innerHTML = 'Save Item Type';
            }
        };
    };

    view.trigger('click', 'btn-add-item-type', () => {
        const modal = createModal('New Item Type', getFormHTML());
        modal.show();
        initFormJS(modal.element, null);
    });

    view.on('init', () => {
        const q = firebase.db.collection(firebase.db.db, 'item_catalog');
        view.emit('loading:start');
        view.unsub(firebase.db.subscribe(q, (snap) => {
            const list = view.$('item-types-list');
            view.emit('loading:end');
            view.emit('rendered');
            if(!list) return;
            
            if(snap.empty) {
                list.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-muted">No item types found.</td></tr>';
                return;
            }

            list.innerHTML = '';
            snap.forEach(doc => {
                const pt = doc.data();
                const tr = document.createElement('tr');
                tr.className = 'item-type-row';
                
                tr.innerHTML = `
                    <td><code class="data-mono">${pt.catalog_id || pt.id}</code></td>
                    <td class="fw-bold">${pt.item_name || pt.name || 'Unnamed'}<div class="text-muted small">${pt.item_type || 'Unknown'} - ${pt.provider || 'No provider'}</div></td>
                    <td>
                        <button class="btn-pico btn-pico-outline table-action-btn edit-pt me-1"><i class="bi bi-pencil"></i></button>
                        <button class="btn-pico btn-pico-danger-outline table-action-btn delete-pt"><i class="bi bi-trash"></i></button>
                    </td>
                `;

                tr.querySelector('.edit-pt').onclick = () => {
                    const modal = createModal('Edit Item Type', getFormHTML(pt));
                    modal.show();
                    initFormJS(modal.element, pt);
                };

                tr.querySelector('.delete-pt').onclick = async () => {
                    const confirmModal = createModal('Delete Item Type', `
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
                            await firebase.db.deleteDoc(firebase.db.doc(firebase.db.db, 'item_catalog', pt.id));
                            firebase.logAction("Item Type Deleted", pt.id);
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
