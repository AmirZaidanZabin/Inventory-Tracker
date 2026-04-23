import { controller } from '../lib/controller.js';
import { firebase } from '../lib/firebase.js';
import { createModal } from '../lib/modal.js';

const FIELD_TYPES = [
    { value: 'text',     label: 'Short Text' },
    { value: 'textarea', label: 'Long Text' },
    { value: 'number',   label: 'Number' },
    { value: 'email',    label: 'Email Address' },
    { value: 'tel',      label: 'Phone Number' },
    { value: 'date',     label: 'Date' },
    { value: 'select',   label: 'Dropdown' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'regex',    label: 'Custom Regex' }
];

function fieldTypeLabel(t) {
    return FIELD_TYPES.find(f => f.value === t)?.label || t;
}

const ENTITIES = [
    { id: 'appointments', name: 'Appointments' },
    { id: 'users',        name: 'Users' },
    { id: 'vans',         name: 'Vans' },
    { id: 'items',        name: 'Hardware Items' }
];

export function FormsView() {
    let state = {
        forms: []
    };
    
    let builderFields = [];
    let editingFormId = null;

    function resetBuilder() {
        builderFields = [];
        editingFormId = null;
    }

    function builderFieldRow(f, i) {
        return `
            <div class="border rounded p-3 bg-white mb-2 d-flex align-items-start gap-3 shadow-sm" id="bfield-${i}">
                <div class="flex-grow-1">
                    <div class="row g-2 align-items-center mb-2">
                        <div class="col-md-3">
                            <input class="form-control form-control-sm bf-name font-monospace text-xs" data-fi="${i}" value="${(f.name||f.label||'').replace(/"/g,'&quot;')}" placeholder="sys_name" title="No spaces, used in API">
                        </div>
                        <div class="col-md-4">
                            <input class="form-control form-control-sm bf-label" data-fi="${i}" value="${(f.label||'').replace(/"/g,'&quot;')}" placeholder="Display Label">
                        </div>
                        <div class="col-md-3">
                            <select class="form-select form-select-sm bf-type" data-fi="${i}">
                                ${FIELD_TYPES.map(t => `<option value="${t.value}" ${f.type===t.value?'selected':''}>${t.label}</option>`).join('')}
                            </select>
                        </div>
                        <div class="col-md-2">
                            <div class="form-check d-flex align-items-center m-0">
                                <input class="form-check-input bf-required" type="checkbox" data-fi="${i}" id="bf-req-${i}" ${f.required?'checked':''}>
                                <label class="form-check-label small ms-1" for="bf-req-${i}">Required</label>
                            </div>
                        </div>
                    </div>
                    ${f.type === 'select' ? `
                        <div class="mt-2">
                            <input class="form-control form-control-sm bf-options text-xs" data-fi="${i}"
                                value="${(f.options||[]).join(', ')}" placeholder="Options (comma-separated, e.g. Low, Medium, High)">
                        </div>` : ''}
                    ${f.type === 'regex' ? `
                        <div class="mt-2">
                            <input class="form-control form-control-sm bf-pattern font-monospace text-xs" data-fi="${i}"
                                value="${(f.pattern||'').replace(/"/g,'&quot;')}" placeholder="Regex pattern (e.g. ^[A-Z]{3}-\\d{4}$)">
                            <div class="form-text text-xs mt-1">Pattern will be applied to the HTML input validation.</div>
                        </div>` : ''}
                </div>
                <button class="btn btn-sm btn-outline-danger border-0 bf-del flex-shrink-0 mt-1" data-fi="${i}" title="Remove field">
                    <i class="bi bi-x-circle fs-6"></i>
                </button>
            </div>`;
    }

    const stringComponent = `
        <div class="container-fluid px-0 h-100 pb-5">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h5 class="fw-bold mb-0"><i class="bi bi-ui-checks text-primary me-2"></i>Custom Data Forms</h5>
                <button id="btn-new-form" class="btn-pico btn-pico-primary auth-forms:manage hidden"><i class="bi bi-plus-lg me-1"></i>Create Form</button>
            </div>

            <div id="forms-list">
                <div class="text-center text-muted py-5 bg-white border rounded">
                    <span class="spinner-border spinner-border-sm me-2"></span>Loading forms...
                </div>
            </div>

            <div id="form-editor-overlay" class="modal-overlay hidden">
                <div class="modal-content-custom" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
                    <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
                        <h5 class="fw-bold m-0"><i class="bi bi-layout-text-sidebar text-primary me-2"></i>Form Builder</h5>
                        <button id="btn-builder-close" class="btn-close"></button>
                    </div>

                    <div class="row g-3 mb-4">
                        <div class="col-md-5">
                            <label class="form-label small fw-bold">Form Group Name</label>
                            <input id="builder-form-name" type="text" class="form-control" placeholder="e.g. Client Details">
                        </div>
                        <div class="col-md-7">
                            <label class="form-label small fw-bold">Assign to Entity Type</label>
                            <div class="d-flex flex-wrap gap-2 mt-1 p-2 bg-light border rounded" id="builder-entity-checkboxes">
                                ${ENTITIES.map(p => `
                                    <div class="form-check form-check-inline m-0">
                                        <input class="form-check-input builder-proj-cb" type="checkbox" value="${p.id}" id="bpr-${p.id}">
                                        <label class="form-check-label small" for="bpr-${p.id}">${p.name}</label>
                                    </div>`).join('')}
                            </div>
                            <div class="small text-muted mt-1" style="font-size: 0.7rem;">Mapping injects these fields into selected entities automatically.</div>
                        </div>
                    </div>

                    <div class="mt-4 p-3 bg-light rounded border">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <label class="form-label small fw-bold text-accent mb-0"><i class="bi bi-input-cursor-text me-1"></i>Data Fields</label>
                            <button id="btn-add-field" class="btn btn-sm btn-outline-primary border-dashed bg-white">
                                <i class="bi bi-plus-circle me-1"></i>Add Field
                            </button>
                        </div>
                        
                        <div id="builder-fields-list" class="d-flex flex-column gap-1">
                            <div class="text-center text-muted small py-4 bg-white border rounded" id="builder-empty-hint">
                                No fields configured. Click "Add Field" to start.
                            </div>
                        </div>
                    </div>

                    <div class="d-flex gap-2 justify-content-end mt-4 pt-3 border-top">
                        <button id="btn-builder-cancel" class="btn-pico btn-pico-outline">Cancel</button>
                        <button id="btn-builder-save"   class="btn-pico btn-pico-primary">Save Configuration</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const view = controller({ stringComponent });

    ['btn-new-form', 'form-editor-overlay', 'builder-form-name', 'btn-add-field',
     'btn-builder-cancel', 'btn-builder-save', 'builder-fields-list', 'forms-list', 'btn-builder-close'
    ].forEach(id => view.onboard({ id }));

    const renderFormsList = () => {
        const list = view.$('forms-list');
        if (!list) return;

        if(!state.forms || !state.forms.length) {
            list.innerHTML = `
                 <div class="text-center py-5 text-muted bg-white border rounded shadow-sm">
                     <i class="bi bi-ui-checks fs-2 d-block mb-3 text-primary opacity-50"></i>
                     <h6 class="fw-bold text-dark">No Custom Forms</h6>
                     <p class="small">Create forms to attach custom data fields to your records.</p>
                 </div>`;
            return;
        }

        list.innerHTML = `
            <div class="d-flex flex-column gap-2">
                ${state.forms.map((f, fi) => `
                <div class="card border-secondary-subtle mb-1" id="form-card-${f.id}">
                    <div class="card-body py-3 px-4">
                        <div class="d-flex justify-content-between align-items-start gap-2">
                            <div class="flex-grow-1 min-w-0">
                                <div class="d-flex align-items-center gap-2 mb-1">
                                    <span class="fw-bold fs-6">${f.name}</span>
                                    ${f.entities?.length ? `<span class="badge bg-pale-primary text-primary border">${f.entities.map(id => ENTITIES.find(e=>e.id===id)?.name||id).join(', ')}</span>` : '<span class="badge bg-pale-secondary border">No entities</span>'}
                                </div>
                                <div class="text-muted small mt-2 bg-light p-2 rounded border d-flex flex-wrap gap-2">
                                     ${(f.fields||[]).map(field => `
                                         <span class="badge bg-white border text-dark fw-normal" style="font-size: 0.75rem;">
                                             ${field.label} <span class="text-muted fw-light ms-1">(${fieldTypeLabel(field.type)})</span>
                                             ${field.required ? '<i class="bi bi-asterisk text-danger ms-1" style="font-size:0.5rem;vertical-align:middle;"></i>' : ''}
                                             ${field.pattern ? `<i class="bi bi-regex text-muted ms-1" title="Regex: ${field.pattern}"></i>` : ''}
                                         </span>`).join('') || '<span class="text-muted fst-italic w-100 text-center">No fields defined</span>'}
                                </div>
                            </div>
                            <div class="d-flex gap-1 flex-shrink-0">
                                <button id="form-edit-${f.id}" class="btn-pico btn-pico-outline table-action-btn" title="Edit">
                                    <i class="bi bi-pencil"></i>
                                </button>
                                <button id="form-del-${f.id}" class="btn-pico btn-pico-danger-outline table-action-btn" title="Delete">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`).join('')}
             </div>`;
             
        state.forms.forEach((f) => {
            const editBtn = list.querySelector(`#form-edit-${f.id}`);
            const delBtn = list.querySelector(`#form-del-${f.id}`);
            
            if(editBtn) editBtn.onclick = () => openBuilder(f.id);
            if(delBtn) delBtn.onclick = () => {
                const modal = createModal({
                    title: 'Confirm Deletion',
                    body: `
                        <p>Are you sure you want to delete the form <strong>${f.name}</strong>?</p>
                        <p class="small text-muted mb-0">Existing data in records won't be deleted, but these fields will no longer be visible or editable.</p>
                        <div class="d-flex justify-content-end gap-2 mt-4">
                            <button type="button" class="btn-pico btn-pico-outline cancel-btn">Cancel</button>
                            <button type="button" class="btn-pico btn-pico-danger-outline confirm-btn">Delete</button>
                        </div>
                    `
                });

                modal.element.querySelector('.cancel-btn').onclick = () => modal.hide();
                modal.element.querySelector('.confirm-btn').onclick = async () => {
                    modal.hide();
                    try {
                        await firebase.db.deleteDoc(firebase.db.doc(firebase.db.db, 'forms', f.id));
                        // No logAction available directly in FormsView, might need to check if it exists in controller or firebase
                        // firebase.logAction("Form Deleted", `Form ${f.name} removed`);
                    } catch (e) {
                        alert("Delete failed: " + e.message);
                    }
                };
                modal.show();
            };
        });
    };

    const attachFieldListeners = () => {
        const listEl = view.$('builder-fields-list');
        if (!listEl) return;
        
        listEl.querySelectorAll('.bf-name').forEach(el => el.addEventListener('input', e => { 
            let clean = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
            e.target.value = clean;
            builderFields[+e.target.dataset.fi].name = clean; 
        }));
        
        listEl.querySelectorAll('.bf-label').forEach(el => el.addEventListener('input', e => { 
            builderFields[+e.target.dataset.fi].label = e.target.value; 
        }));
        
        listEl.querySelectorAll('.bf-type').forEach(el => el.addEventListener('change', e => {
            builderFields[+e.target.dataset.fi].type = e.target.value;
            renderBuilderFields(); // Re-render to show/hide options or regex pattern inputs
        }));
        
        listEl.querySelectorAll('.bf-required').forEach(el => el.addEventListener('change', e => { 
            builderFields[+e.target.dataset.fi].required = e.target.checked; 
        }));
        
        listEl.querySelectorAll('.bf-options').forEach(el => el.addEventListener('input', e => {
            builderFields[+e.target.dataset.fi].options = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
        }));

        listEl.querySelectorAll('.bf-pattern').forEach(el => el.addEventListener('input', e => {
            builderFields[+e.target.dataset.fi].pattern = e.target.value;
        }));
        
        listEl.querySelectorAll('.bf-del').forEach(el => el.addEventListener('click', e => {
            builderFields.splice(+e.currentTarget.dataset.fi, 1);
            renderBuilderFields();
        }));
    };

    const renderBuilderFields = () => {
        const listEl = view.$('builder-fields-list');
        if (!listEl) return;
        if (builderFields.length === 0) {
            listEl.innerHTML = '<div class="text-center text-muted small py-4 bg-white border rounded" id="builder-empty-hint">No fields configured. Click "Add Field" to start.</div>';
            return;
        }
        listEl.innerHTML = builderFields.map((f, i) => builderFieldRow(f, i)).join('');
        attachFieldListeners();
    };

    const openBuilder = (formId = null) => {
        builderFields = [];
        editingFormId = formId;

        const nameEl  = view.$('builder-form-name');
        document.querySelectorAll('.builder-proj-cb').forEach(cb => { cb.checked = false; });

        if (formId) {
            const f = state.forms.find(x => x.id === formId);
            if (nameEl) nameEl.value = f.name;
            builderFields = f.fields.map(field => ({ ...field, options: [...(field.options||[])] }));
            f.entities?.forEach(entId => {
                const cb = document.getElementById(`bpr-${entId}`);
                if (cb) cb.checked = true;
            });
        } else {
            if (nameEl) nameEl.value = '';
        }
        renderBuilderFields();
        
        view.$('form-editor-overlay').classList.remove('hidden');
        view.$('form-editor-overlay').classList.add('show');
    };

    const closeBuilder = () => {
        view.$('form-editor-overlay').classList.remove('show');
        setTimeout(() => view.$('form-editor-overlay').classList.add('hidden'), 300);
        resetBuilder();
    };

    view.trigger('click', 'btn-new-form', () => openBuilder(null));

    view.trigger('click', 'btn-add-field', () => {
        builderFields.push({ id: `f_${Date.now()}`, name: '', label: '', type: 'text', required: false, options: [], pattern: '' });
        renderBuilderFields();
    });

    view.trigger('click', 'btn-builder-cancel', closeBuilder);
    view.trigger('click', 'btn-builder-close', closeBuilder);

    view.trigger('click', 'btn-builder-save', async () => {
        const name = view.$('builder-form-name')?.value?.trim();
        if (!name) return alert('Form group name is required.');
        if (builderFields.length === 0) return alert('Add at least one field.');

        const validFields = [];
        for(let f of builderFields) {
            if(!f.name) {
                return alert("All fields must have a System Name.");
            }
            validFields.push({
                ...f,
                label: f.label.trim() || f.name
            });
        }

        const entities = Array.from(document.querySelectorAll('.builder-proj-cb:checked')).map(cb => cb.value);
        if(entities.length === 0) return alert('Assign to at least one entity type above.');

        const fid = editingFormId || 'FORM-' + Math.random().toString(36).substr(2, 9).toUpperCase();

        const formObj = { 
            id: fid, 
            name, 
            fields: validFields, 
            entities 
        };

        const btn = view.$('btn-builder-save');
        const originalBtnText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
        btn.disabled = true;
        
        try {
            await firebase.db.setDoc(firebase.db.doc(firebase.db.db, 'forms', fid), formObj);
            closeBuilder();
        } catch(e) {
            alert('Failed to save form config: ' + e.message);
        } finally {
            btn.innerHTML = originalBtnText;
            btn.disabled = false;
        }
    });

    view.on('init', () => {
        view.emit('loading:start');
        view.unsub(firebase.db.subscribe(firebase.db.collection(firebase.db.db, 'forms'), (snap) => {
            const arr = [];
            if(snap && snap.forEach) {
                snap.forEach(doc => {
                    arr.push({ id: doc.id, ...doc.data() });
                });
            }
            state.forms = arr;
            view.emit('loading:end');
            renderFormsList();
        }));
    });

    return view;
}
