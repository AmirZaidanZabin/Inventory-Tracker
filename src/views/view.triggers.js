import { controller } from '../lib/controller.js';
import { firebase } from '../lib/firebase.js';

let blueprintData = null;
let FIELDS = ['status', 'id']; // Default fallback

const OPERATORS = [
    { value: 'equals',       label: 'equals',         needsValue: true  },
    { value: 'not equals',   label: 'not equals',      needsValue: true  },
    { value: 'contains',     label: 'contains',        needsValue: true  },
    { value: 'starts with',  label: 'starts with',     needsValue: true  },
    { value: 'changed to',   label: 'changed to ▶',    needsValue: true  },
    { value: 'changed from', label: '◀ changed from',  needsValue: true  },
    { value: 'changed',      label: 'changed (any)',    needsValue: false },
    { value: 'is empty',     label: 'is empty',         needsValue: false },
    { value: 'is not empty', label: 'is not empty',     needsValue: false },
];
const HTTP_METHODS = ['POST', 'GET', 'PUT', 'PATCH'];

const updateBlueprintFields = (collectionName) => {
    if (!blueprintData || !blueprintData.firestore) return;
    
    // Find path in firestore
    const pathKey = Object.keys(blueprintData.firestore).find(k => k.startsWith(`/${collectionName}/`));
    if (pathKey) {
        const schemaRef = blueprintData.firestore[pathKey].schema.$ref;
        if (schemaRef && blueprintData.entities[schemaRef]) {
            FIELDS = Object.keys(blueprintData.entities[schemaRef].properties || {});
            return;
        }
    }
    FIELDS = ['id', 'status']; // Fallback
};

function conditionRow(c, i) {
    const needsValue = OPERATORS.find(o => o.value === c.operator)?.needsValue !== false;
    return `
        <div class="row g-2 align-items-center mb-2" id="cond-row-${i}">
            <div class="col-auto">
                <select class="form-select form-select-sm cond-field" data-idx="${i}" style="min-width:110px;">
                    ${FIELDS.map(f => `<option value="${f}" ${c.field===f?'selected':''}>${f}</option>`).join('')}
                </select>
            </div>
            <div class="col-auto">
                <select class="form-select form-select-sm cond-op" data-idx="${i}" style="min-width:150px;">
                    ${OPERATORS.map(o => `<option value="${o.value}" ${c.operator===o.value?'selected':''}>${o.label}</option>`).join('')}
                </select>
            </div>
            <div class="col" style="${needsValue?'':'visibility:hidden;'}">
                <input type="text" class="form-control form-control-sm cond-val" data-idx="${i}"
                    value="${c.value||''}" placeholder="value">
            </div>
            <div class="col-auto">
                <button class="btn btn-sm btn-outline-danger border-0 cond-del" data-idx="${i}">
                    <i class="bi bi-dash-circle"></i>
                </button>
            </div>
        </div>`;
}

function triggerCard(t) {
    const condSummary = t.conditions.map(c => `<code>${c.field}</code> <span class="text-info">${c.operator}</span> ${c.value ? `"<em>${c.value}</em>"` : ''}`).join(` <span class="badge bg-secondary">${t.conditionType}</span> `);
    return `
        <div class="card border-secondary-subtle mb-2" id="trigger-card-${t.id}">
            <div class="card-body py-2 px-3">
                <div class="d-flex justify-content-between align-items-start gap-2">
                    <div class="flex-grow-1 min-w-0">
                        <span class="fw-semibold me-2">${t.name}</span>
                        <span class="badge ${t.enabled ? 'bg-success' : 'bg-secondary'}">${t.enabled ? 'Active' : 'Off'}</span>
                        <div class="text-muted small mt-1">${condSummary}</div>
                        <div class="small mt-1">
                            <span class="badge bg-dark border border-secondary-subtle me-1">${t.action.method}</span>
                            <code class="small">${t.action.url}</code>
                        </div>
                    </div>
                    <div class="d-flex gap-1 flex-shrink-0">
                        <button id="toggle-trigger-${t.id}" class="btn btn-sm btn-outline-secondary border-0" title="${t.enabled?'Disable':'Enable'}">
                            <i class="bi bi-${t.enabled?'pause-circle':'play-circle'}"></i>
                        </button>
                        <button id="edit-trigger-${t.id}" class="btn btn-sm btn-outline-secondary border-0"><i class="bi bi-pencil"></i></button>
                        <button id="del-trigger-${t.id}"  class="btn btn-sm btn-outline-danger   border-0"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            </div>
        </div>`;
}

export function TriggersView() {
    let internalState = {
        triggers: []
    };

    const stringComponent = `
        <div class="container-fluid px-0 h-100 pb-5">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h6 class="fw-bold mb-0"><i class="bi bi-lightning-charge text-warning me-2"></i>Automation Triggers</h6>
                <button id="btn-new-trigger" class="btn btn-primary btn-sm auth-triggers:manage hidden"><i class="bi bi-plus-lg me-1"></i>New Trigger</button>
            </div>

            <!-- Trigger list -->
            <div id="trigger-list">
                <div class="text-center text-muted py-5">Loading...</div>
            </div>

            <!-- Editor -->
            <div id="trigger-editor" class="card border-primary mt-3" style="display:none;">
                <div class="card-body">
                    <h6 class="card-title fw-bold"><i class="bi bi-gear me-2"></i>Trigger Builder</h6>

                    <div class="mb-3">
                        <label class="form-label small fw-semibold text-secondary">Name</label>
                        <input id="te-name" type="text" class="form-control form-control-sm" placeholder="e.g. Notify on Done">
                    </div>

                    <div class="mb-3">
                        <label class="form-label small fw-semibold text-secondary">Target Collection</label>
                        <select id="te-collection" class="form-select form-select-sm">
                            <option value="appointments">Appointments</option>
                            <option value="users">Users</option>
                            <option value="vans">Vans</option>
                        </select>
                    </div>

                    <div class="mb-3">
                        <label class="form-label small fw-semibold text-secondary">Condition Logic</label>
                        <div class="d-flex gap-4">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="cond-type" id="cond-all" value="ALL" checked>
                                <label class="form-check-label small" for="cond-all">ALL conditions must match</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="cond-type" id="cond-any" value="ANY">
                                <label class="form-check-label small" for="cond-any">ANY condition matches</label>
                            </div>
                        </div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label small fw-semibold text-secondary">Conditions</label>
                        <div id="conditions-container"></div>
                        <button id="btn-add-condition" class="btn btn-sm btn-outline-secondary mt-2">
                            <i class="bi bi-plus me-1"></i>Add Condition
                        </button>
                    </div>

                    <hr class="border-secondary-subtle">
                    <h6 class="fw-semibold small mb-3">Action — HTTP Request</h6>
                    <div class="row g-2 mb-2">
                        <div class="col-auto">
                            <select id="te-method" class="form-select form-select-sm">
                                ${HTTP_METHODS.map(m => `<option>${m}</option>`).join('')}
                            </select>
                        </div>
                        <div class="col">
                            <input id="te-url" type="url" class="form-control form-control-sm" placeholder="https://hooks.example.com/notify">
                        </div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label small fw-semibold text-secondary">
                            Headers (JSON)
                        </label>
                        <textarea id="te-headers" class="form-control form-control-sm font-monospace" rows="2"
                            placeholder='{"Authorization":"Bearer token","Content-Type":"application/json"}'></textarea>
                    </div>
                    <div class="mb-3">
                        <label class="form-label small fw-semibold text-secondary">
                            Payload (JSON) — supports <code>{{doc.field}}</code> and <code>{{prevDoc.field}}</code>
                        </label>
                        <textarea id="te-payload" class="form-control form-control-sm font-monospace" rows="5"
                            placeholder='{"from":"{{prevDoc.status}}","to":"{{doc.status}}"}'></textarea>
                    </div>

                    <div class="d-flex gap-2 justify-content-end">
                        <button id="btn-te-cancel" class="btn btn-sm btn-outline-secondary">Cancel</button>
                        <button id="btn-te-save"   class="btn btn-sm btn-primary">Save Trigger</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const view = controller({ stringComponent });

    ['trigger-list','trigger-editor','btn-new-trigger',
     'te-name','te-collection','te-method','te-url', 'te-headers','te-payload',
     'btn-add-condition','conditions-container',
     'btn-te-cancel','btn-te-save'
    ].forEach(id => view.onboard({ id }));

    let editingTriggerId = null;
    let workingConditions = [];

    const renderTriggersList = () => {
        const list = view.$('trigger-list');
        if (!list) return;
        
        if (!internalState.triggers || !internalState.triggers.length) {
            list.innerHTML = `<div class="text-center text-muted py-5">
                <i class="bi bi-lightning-charge fs-3 d-block mb-2 text-warning"></i>
                No triggers yet. Triggers fire API calls when task conditions are met.
            </div>`;
            return;
        }

        list.innerHTML = internalState.triggers.map(triggerCard).join('');

        internalState.triggers.forEach((t) => {
            const toggleBtn = list.querySelector(`#toggle-trigger-${t.id}`);
            const editBtn = list.querySelector(`#edit-trigger-${t.id}`);
            const delBtn = list.querySelector(`#del-trigger-${t.id}`);

            if(toggleBtn) {
                toggleBtn.onclick = async () => {
                    try {
                        await firebase.db.updateDoc(firebase.db.doc(firebase.db.db, 'triggers', String(t.id)), { enabled: !t.enabled });
                    } catch (e) {
                         alert ("Update failed: " + e.message);
                    }
                };
            }
            if(editBtn) {
                editBtn.onclick = () => openEditor(t);
            }
            if(delBtn) {
                delBtn.onclick = () => {
                    const modal = createModal({
                        title: 'Confirm Deletion',
                        body: `
                            <p>Are you sure you want to delete trigger <strong>"${t.name}"</strong>?</p>
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
                            await firebase.db.deleteDoc(firebase.db.doc(firebase.db.db, 'triggers', String(t.id)));
                        } catch (e) {
                            alert("Delete failed: " + e.message);
                        }
                    };
                    modal.show();
                };
            }
        });
    };

    const renderConditions = () => {
        const container = view.$('conditions-container');
        if (!container) return;
        container.innerHTML = workingConditions.length
            ? workingConditions.map(conditionRow).join('')
            : `<p class="text-muted small">No conditions yet.</p>`;

        // Bind live change for operator to show/hide value field
        container.querySelectorAll('.cond-op').forEach(sel => {
            const toggleVal = (s) => {
                const row = s.closest('[id^="cond-row-"]');
                const valInput = row?.querySelector('.cond-val')?.closest('.col');
                const needsVal = OPERATORS.find(o => o.value === s.value)?.needsValue !== false;
                if (valInput) valInput.style.visibility = needsVal ? '' : 'hidden';
                workingConditions[parseInt(s.dataset.idx)].operator = s.value;
            };
            sel.addEventListener('change', (e) => toggleVal(e.target));
        });
        container.querySelectorAll('.cond-field').forEach(sel => sel.addEventListener('change', (e) => { workingConditions[parseInt(e.target.dataset.idx)].field = e.target.value; }));
        container.querySelectorAll('.cond-val').forEach(inp => inp.addEventListener('input', (e) => { workingConditions[parseInt(e.target.dataset.idx)].value = e.target.value; }));
        container.querySelectorAll('.cond-del').forEach(btn => btn.addEventListener('click', (e) => { workingConditions.splice(parseInt(e.currentTarget.dataset.idx), 1); renderConditions(); }));
    };

    const openEditor = (trigger = null) => {
        editingTriggerId = trigger ? trigger.id : null;
        workingConditions = trigger ? JSON.parse(JSON.stringify(trigger.conditions)) : [{ field: 'status', operator: 'changed to', value: 'completed' }];
        view.$('te-name').value       = trigger?.name || '';
        
        const col = trigger?.collection || 'appointments';
        view.$('te-collection').value = col;
        updateBlueprintFields(col);

        view.$('te-method').value     = trigger?.action?.method || 'POST';
        view.$('te-url').value        = trigger?.action?.url    || '';
        view.$('te-headers').value    = trigger?.action?.headers || '{"Content-Type":"application/json"}';
        view.$('te-payload').value    = trigger?.action?.payload || '{"from":"{{prevDoc.status}}","to":"{{doc.status}}","task":"{{doc.appointment_name}}"}';
        const condType = trigger?.conditionType || 'ALL';
        
        const rAll = document.querySelector('input[name="cond-type"][value="ALL"]');
        const rAny = document.querySelector('input[name="cond-type"][value="ANY"]');
        if(condType === 'ALL' && rAll) rAll.checked = true;
        if(condType === 'ANY' && rAny) rAny.checked = true;

        renderConditions();
        view.$('trigger-editor').style.display = '';
        view.$('trigger-editor').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    const closeEditor = () => { view.$('trigger-editor').style.display = 'none'; editingTriggerId = null; workingConditions = []; };

    view.trigger('click', 'btn-new-trigger',    () => openEditor());
    view.trigger('click', 'btn-add-condition',  () => { workingConditions.push({ field: 'status', operator: 'changed to', value: '' }); renderConditions(); });
    view.trigger('click', 'btn-te-cancel',      closeEditor);
    view.trigger('click', 'btn-te-save', async () => {
        const name = view.$('te-name').value.trim();
        const url  = view.$('te-url').value.trim();
        if (!name || !url) return alert('Name and URL are required.');
        const conditionType = document.querySelector('input[name="cond-type"]:checked')?.value || 'ALL';
        
        const triggerId = editingTriggerId || Date.now().toString();

        const triggerData = {
            id: triggerId,
            name, 
            conditionType,
            collection: view.$('te-collection').value,
            enabled: true, // defaults to true when saving new, or we should fetch existing
            conditions: JSON.parse(JSON.stringify(workingConditions)),
            action: { 
                type: 'api', 
                method: view.$('te-method').value, 
                url, 
                headers: view.$('te-headers').value.trim(),
                payload: view.$('te-payload').value.trim() 
            },
        };

        try {
            await firebase.db.setDoc(firebase.db.doc(firebase.db.db, 'triggers', triggerId), triggerData);
            closeEditor();
        } catch(e) {
            alert('Failed to save trigger: ' + e.message);
        }
    });

    const setupCollectionDropdown = () => {
        const colSelect = view.$('te-collection');
        if (!colSelect || !blueprintData) return;
        
        const availableCols = Object.keys(blueprintData.firestore).map(k => k.split('/')[1]).filter(Boolean);
        const uniqueCols = [...new Set(availableCols)];
        colSelect.innerHTML = uniqueCols.map(c => `<option value="${c}">${c}</option>`).join('');
        
        colSelect.addEventListener('change', (e) => {
            updateBlueprintFields(e.target.value);
            renderConditions(); // refresh fields list in dropdowns
        });
    };

    view.on('init', async () => {
        view.emit('loading:start');
        try {
            const res = await fetch('/firebase-blueprint.json');
            blueprintData = await res.json();
            setupCollectionDropdown();
        } catch(e) {
            console.error("Failed to load blueprint", e);
        }

        view.unsub(firebase.db.subscribe(firebase.db.collection(firebase.db.db, 'triggers'), (snap) => {
            view.emit('loading:end');
            const arr = [];
            if(snap && snap.forEach) {
                snap.forEach(doc => {
                    arr.push(doc.data());
                });
            }
            internalState.triggers = arr;
            renderTriggersList();
        }));
    });

    return view;
}
