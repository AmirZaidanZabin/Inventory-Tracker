import { controller } from '../lib/controller.js';
import { firebase } from '../lib/firebase.js';

const FIELD_TYPES = [
    { value: 'text',     label: 'Short Text' },
    { value: 'textarea', label: 'Long Text' },
    { value: 'number',   label: 'Number' },
    { value: 'date',     label: 'Date' },
    { value: 'select',   label: 'Dropdown' },
    { value: 'checkbox', label: 'Checkbox' },
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
            <div class="border border-secondary-subtle rounded p-2 mb-2 d-flex align-items-start gap-2" id="bfield-${i}">
                <div class="flex-grow-1">
                    <div class="d-flex gap-2 mb-1 flex-wrap">
                        <input class="form-control form-control-sm bf-name" data-fi="${i}" value="${(f.name||f.label||'').replace(/"/g,'&quot;')}" placeholder="System Name (e.g. employee_id)" style="max-width:150px;" title="No spaces, used in API">
                        <input class="form-control form-control-sm bf-label" data-fi="${i}" value="${(f.label||'').replace(/"/g,'&quot;')}" placeholder="Display Label (e.g. Employee ID)" style="max-width:200px;">
                        <select class="form-select form-select-sm bf-type" data-fi="${i}" style="max-width:120px;">
                            ${FIELD_TYPES.map(t => `<option value="${t.value}" ${f.type===t.value?'selected':''}>${t.label}</option>`).join('')}
                        </select>
                        <div class="form-check d-flex align-items-center gap-1 m-0">
                            <input class="form-check-input bf-required" type="checkbox" data-fi="${i}" id="bf-req-${i}" ${f.required?'checked':''}>
                            <label class="form-check-label small" for="bf-req-${i}">Required</label>
                        </div>
                    </div>
                    ${f.type === 'select' ? `
                        <div>
                            <input class="form-control form-control-sm bf-options" data-fi="${i}"
                                value="${(f.options||[]).join(', ')}" placeholder="Options (comma-separated, e.g. Low, Medium, High)">
                        </div>` : ''}
                </div>
                <button class="btn btn-sm btn-outline-danger border-0 bf-del" data-fi="${i}" title="Remove field">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>`;
    }

    const stringComponent = `
        <div class="container-fluid px-0 h-100 pb-5">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h6 class="fw-bold mb-0">
                    <i class="bi bi-ui-checks me-2 text-primary"></i>Custom Forms
                </h6>
                <button id="btn-new-form" class="btn btn-primary btn-sm auth-forms:manage hidden">
                    <i class="bi bi-plus-lg me-1"></i>New Form
                </button>
            </div>

            <!-- Existing forms -->
            <div id="forms-list">
                <div class="text-center py-5 text-muted border border-secondary-subtle rounded">
                    Loading forms...
                </div>
            </div>

            <!-- Builder panel -->
            <div id="form-builder-panel" class="card border-primary" style="display:none; margin-top:20px;">
                <div class="card-body">
                    <h6 class="fw-bold mb-3"><i class="bi bi-layout-text-sidebar me-2"></i>Form Builder</h6>

                    <div class="row g-3 mb-3">
                        <div class="col-md-5">
                            <label class="form-label small fw-semibold text-secondary">Form Group Name *</label>
                            <input id="builder-form-name" type="text" class="form-control form-control-sm" placeholder="e.g. Sales Fields">
                        </div>
                        <div class="col-md-7">
                            <label class="form-label small fw-semibold text-secondary">Assign to Entity Type</label>
                            <div class="d-flex flex-wrap gap-2 mt-1" id="builder-entity-checkboxes">
                                ${ENTITIES.map(p => `
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input builder-proj-cb" type="checkbox" value="${p.id}" id="bpr-${p.id}">
                                        <label class="form-check-label small" for="bpr-${p.id}">${p.name}</label>
                                    </div>`).join('')}
                            </div>
                            <div class="small text-muted mt-1">Checking multiple boxes maps these fields into all checked entities.</div>
                        </div>
                    </div>

                    <!-- Dynamic field list -->
                    <div class="d-flex justify-content-between align-items-center mb-2 mt-4">
                        <label class="form-label small fw-semibold text-secondary mb-0">Fields Map to Entity Root (e.g. <code>custom_{System Name}</code>)</label>
                        <button id="btn-add-field" class="btn btn-sm btn-outline-secondary">
                            <i class="bi bi-plus-lg me-1"></i>Add Field
                        </button>
                    </div>
                    
                    <div id="builder-fields-list" class="bg-light p-2 border rounded">
                        <p class="text-muted small" id="builder-empty-hint">No fields yet — click "Add Field" to start.</p>
                    </div>

                    <div class="d-flex gap-2 justify-content-end mt-3">
                        <button id="btn-builder-cancel" class="btn btn-sm btn-outline-secondary">Cancel</button>
                        <button id="btn-builder-save"   class="btn btn-sm btn-primary">
                            <i class="bi bi-save me-1"></i>Save Form Configuration
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const view = controller({ stringComponent });

    ['btn-new-form'
    ,'form-builder-panel'
    ,'builder-form-name'
    ,'btn-add-field'
    ,'btn-builder-cancel'
    ,'btn-builder-save'
    ,'builder-fields-list'
    ,'forms-list'
    ].forEach(id => view.onboard({ id }));

    const renderFormsList = () => {
        const list = view.$('forms-list');
        if (!list) return;

        if(!state.forms || !state.forms.length) {
            list.innerHTML = `
                 <div class="text-center py-5 text-muted border border-secondary-subtle rounded">
                     <i class="bi bi-ui-checks fs-2 d-block mb-2"></i>
                     No forms yet. Create one to attach custom fields to your tables.
                 </div>`;
            return;
        }

        list.innerHTML = `
            <div class="d-flex flex-column gap-3">
                ${state.forms.map((f, fi) => `
                <div class="card border-secondary-subtle" id="form-card-${f.id}">
                    <div class="card-header d-flex align-items-center justify-content-between py-2">
                        <div>
                            <span class="fw-semibold">${f.name}</span>
                            <span class="text-muted small ms-2">${f.fields?.length||0} field(s)</span>
                        </div>
                        <div class="d-flex gap-1 align-items-center">
                            ${f.entities?.length ? `<span class="badge bg-primary bg-opacity-25 text-primary">${f.entities.map(id => ENTITIES.find(e=>e.id===id)?.name||id).join(', ')}</span>` : '<span class="badge bg-secondary">No entities</span>'}
                            <button id="form-edit-${f.id}" class="btn btn-sm btn-outline-secondary border-0 form-edit-btn" title="Edit">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button id="form-del-${f.id}" class="btn btn-sm btn-outline-danger border-0 form-del-btn" title="Delete">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="card-body py-2">
                         <div class="d-flex flex-wrap gap-2">
                             ${(f.fields||[]).map(field => `
                                 <span class="badge bg-secondary fw-normal text-xs font-monospace">
                                     ${field.name} (${field.label}) : ${fieldTypeLabel(field.type)}
                                     ${field.required ? '<i class="bi bi-asterisk text-danger ms-1" style="font-size:0.5rem;vertical-align:middle;"></i>' : ''}
                                 </span>`).join('')}
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
                        <p>Are you sure you want to delete form <strong>${f.name}</strong>?</p>
                        <p class="small text-muted mb-0">Existing data in records won't be physically deleted, but fields will no longer be prompted.</p>
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
                        firebase.logAction("Form Deleted", `Form ${f.name} removed`);
                    } catch (e) {
                        alert("Delete failed: " + e.message);
                    }
                };
                modal.show();
            };
        });
    };

    const renderBuilderFields = () => {
        const listEl = view.$('builder-fields-list');
        if (!listEl) return;
        if (builderFields.length === 0) {
            listEl.innerHTML = '<p class="text-muted small mb-0" id="builder-empty-hint">No fields yet — click "Add Field" to start.</p>';
            return;
        }
        listEl.innerHTML = builderFields.map((f, i) => builderFieldRow(f, i)).join('');

        // Bind live-edit handlers
        listEl.querySelectorAll('.bf-name').forEach(el => {
            el.addEventListener('input', e => { 
                let clean = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                e.target.value = clean;
                builderFields[+e.target.dataset.fi].name = clean; 
            });
        });
        listEl.querySelectorAll('.bf-label').forEach(el => {
            el.addEventListener('input', e => { builderFields[+e.target.dataset.fi].label = e.target.value; });
        });
        listEl.querySelectorAll('.bf-type').forEach(el => {
            el.addEventListener('change', e => {
                builderFields[+e.target.dataset.fi].type = e.target.value;
                renderBuilderFields();
            });
        });
        listEl.querySelectorAll('.bf-required').forEach(el => {
            el.addEventListener('change', e => { builderFields[+e.target.dataset.fi].required = e.target.checked; });
        });
        listEl.querySelectorAll('.bf-options').forEach(el => {
            el.addEventListener('input', e => {
                builderFields[+e.target.dataset.fi].options = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
            });
        });
        listEl.querySelectorAll('.bf-del').forEach(el => {
            el.addEventListener('click', e => {
                builderFields.splice(+e.currentTarget.dataset.fi, 1);
                renderBuilderFields();
            });
        });
    };

    const openBuilder = (formId = null) => {
        builderFields = [];
        editingFormId = formId;

        const panel   = view.$('form-builder-panel');
        const nameEl  = view.$('builder-form-name');
        panel.style.display = '';
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

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
    };

    view.trigger('click', 'btn-new-form', () => openBuilder(null));

    view.trigger('click', 'btn-add-field', () => {
        builderFields.push({ id: `f_${Date.now()}`, name: '', label: '', type: 'text', required: false, options: [] });
        renderBuilderFields();
    });

    view.trigger('click', 'btn-builder-cancel', () => {
        view.$('form-builder-panel').style.display = 'none';
        resetBuilder();
    });

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

        const originalBtnText = view.$('btn-builder-save').innerHTML;
        view.$('btn-builder-save').innerHTML = 'Saving...';
        
        try {
            await firebase.db.setDoc(firebase.db.doc(firebase.db.db, 'forms', fid), formObj);
            view.$('form-builder-panel').style.display = 'none';
            resetBuilder();
        } catch(e) {
            alert('Failed to save form config: ' + e.message);
        } finally {
            view.$('btn-builder-save').innerHTML = originalBtnText;
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
