import { controller } from '../lib/controller.js';
import { firebase } from '../lib/firebase.js';
import { createModal } from '../lib/modal.js';

// --- Constants & System Mappings ---
const SYSTEM_TABLES = [
    "appointments", "users", "vans", "items", "item_catalog", 
    "product_types", "roles", "audit_logs", "stock_takes", "stock_take_logs", "forms"
];

const COLLECTION_FIELDS = {
    'appointments': ['status', 'tech_id', 'appointment_time', 'schedule_date', 'van_id', 'appointment_id'],
    'items': ['status', 'is_available', 'current_location_id', 'current_location_type', 'catalog_id', 'item_id'],
    'users': ['role_id', 'user_name', 'email'],
    'vans': ['status', 'location_id', 'van_id'],
    'item_catalog': ['item_type', 'provider', 'duration_minutes'],
    'product_types': ['catalog_id', 'name', 'duration_minutes']
};

const KNOWN_VALUES = {
    'status': ['pending', 'assigned', 'completed', 'available', 'damaged', 'returned'],
    'is_available': ['true', 'false'],
    'current_location_type': ['WAREHOUSE', 'VAN', 'APPOINTMENT']
};

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

let currentFields = COLLECTION_FIELDS['appointments']; // Default

// --- UI Generators ---
function renderValueInput(c, i) {
    const needsValue = OPERATORS.find(o => o.value === c.operator)?.needsValue !== false;
    if (!needsValue) return '';

    if (KNOWN_VALUES[c.field] && ['equals', 'not equals', 'changed to', 'changed from'].includes(c.operator)) {
        const options = KNOWN_VALUES[c.field];
        return `
            <select class="form-select form-select-sm cond-val" data-idx="${i}">
                <option value="" disabled ${!c.value ? 'selected' : ''}>Select ${c.field}...</option>
                ${options.map(v => `<option value="${v}" ${c.value === v ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
        `;
    }
    return `<input type="text" class="form-control form-control-sm cond-val" data-idx="${i}" value="${c.value || ''}" placeholder="value...">`;
}

function conditionRow(c, i) {
    const logicalOpHtml = i === 0 ? '' : `
        <div class="col-auto pe-0">
            <select class="form-select form-select-sm cond-logic text-primary fw-bold" data-idx="${i}" style="width: 80px; background-color: #f8fafc; border-color: #cbd5e1;">
                <option value="AND" ${c.logicalOp === 'AND' ? 'selected' : ''}>AND</option>
                <option value="OR" ${c.logicalOp === 'OR' ? 'selected' : ''}>OR</option>
            </select>
        </div>
    `;

    return `
        <div class="row g-2 align-items-center mb-2" id="cond-row-${i}">
            ${logicalOpHtml}
            <div class="col-auto">
                <select class="form-select form-select-sm cond-field" data-idx="${i}" style="min-width:130px;">
                    ${currentFields.map(f => `<option value="${f}" ${c.field === f ? 'selected' : ''}>${f}</option>`).join('')}
                </select>
            </div>
            <div class="col-auto">
                <select class="form-select form-select-sm cond-op" data-idx="${i}" style="min-width:150px;">
                    ${OPERATORS.map(o => `<option value="${o.value}" ${c.operator === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                </select>
            </div>
            <div class="col" id="cond-val-container-${i}">
                ${renderValueInput(c, i)}
            </div>
            <div class="col-auto">
                <button class="btn btn-sm btn-outline-danger border-0 cond-del" data-idx="${i}">
                    <i class="bi bi-dash-circle"></i>
                </button>
            </div>
        </div>`;
}

function triggerCard(t) {
    const condSummary = (t.conditions || []).map((c, i) => {
        const prefix = i === 0 ? '' : `<span class="badge bg-primary bg-opacity-10 text-primary mx-1">${c.logicalOp || 'AND'}</span>`;
        const valStr = c.value ? `"<em>${c.value}</em>"` : '';
        return `${prefix}<code>${c.field}</code> <span class="text-info">${c.operator}</span> ${valStr}`;
    }).join('');

    return `
        <div class="card border-secondary-subtle mb-2" id="trigger-card-${t.id}">
            <div class="card-body py-3 px-4">
                <div class="d-flex justify-content-between align-items-start gap-2">
                    <div class="flex-grow-1 min-w-0">
                        <div class="d-flex align-items-center gap-2 mb-1">
                            <span class="fw-bold fs-6">${t.name}</span>
                            <span class="badge ${t.enabled ? 'bg-success' : 'bg-secondary'}">${t.enabled ? 'Active' : 'Off'}</span>
                            <span class="badge bg-light text-dark border"><i class="bi bi-database me-1"></i>${t.collection}</span>
                        </div>
                        <div class="text-muted small mt-2 bg-light p-2 rounded border">${condSummary}</div>
                        <div class="small mt-2 font-monospace text-muted">
                            <span class="badge bg-dark border border-secondary-subtle me-1">${t.action?.method || 'POST'}</span>
                            ${t.action?.url || 'No URL configured'}
                        </div>
                    </div>
                    <div class="d-flex gap-1 flex-shrink-0">
                        <button id="toggle-trigger-${t.id}" class="btn btn-pico btn-pico-outline" title="${t.enabled ? 'Disable' : 'Enable'}">
                            <i class="bi bi-${t.enabled ? 'pause-circle text-warning' : 'play-circle text-success'}"></i>
                        </button>
                        <button id="edit-trigger-${t.id}" class="btn btn-pico btn-pico-outline"><i class="bi bi-pencil"></i></button>
                        <button id="del-trigger-${t.id}"  class="btn btn-pico btn-pico-danger-outline"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            </div>
        </div>`;
}

// --- JSON Formatting & Validation Helpers ---
function formatJSONString(str) {
    if (!str || !str.trim()) return '';
    try {
        const obj = JSON.parse(str);
        return JSON.stringify(obj, null, 2);
    } catch (e) {
        return str; // Return as-is if invalid to prevent erasing work
    }
}

function validateJSON(str) {
    if (!str || !str.trim()) return true; 
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
}

export function TriggersView() {
    let internalState = { triggers: [] };
    let editingTriggerId = null;
    let workingConditions = [];

    const stringComponent = `
        <div class="container-fluid px-0 h-100 pb-5">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h5 class="fw-bold mb-0"><i class="bi bi-lightning-charge text-warning me-2"></i>Automation Rules Engine</h5>
                <button id="btn-new-trigger" class="btn-pico btn-pico-primary auth-triggers:manage hidden"><i class="bi bi-plus-lg me-1"></i>Create Automation</button>
            </div>

            <div id="trigger-list">
                <div class="text-center text-muted py-5"><span class="spinner-border spinner-border-sm me-2"></span>Loading automations...</div>
            </div>

            <div id="trigger-editor-overlay" class="modal-overlay hidden">
                <div class="modal-content-custom" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
                    <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
                        <h5 class="fw-bold m-0"><i class="bi bi-gear-fill text-primary me-2"></i>Trigger Builder</h5>
                        <button id="btn-te-close" class="btn-close"></button>
                    </div>

                    <div class="row g-3">
                        <div class="col-md-6">
                            <label class="form-label small fw-bold">Automation Name</label>
                            <input id="te-name" type="text" class="form-control" placeholder="e.g. Notify Technician on Assignment">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold">Listen to Collection</label>
                            <select id="te-collection" class="form-select">
                                ${SYSTEM_TABLES.map(c => `<option value="${c}">${c}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="mt-4 p-3 bg-light rounded border">
                        <label class="form-label small fw-bold text-accent mb-3"><i class="bi bi-funnel me-1"></i>Execution Conditions</label>
                        <div id="conditions-container" class="mb-2"></div>
                        <button id="btn-add-condition" class="btn btn-sm btn-outline-primary border-dashed w-100">
                            <i class="bi bi-plus-circle me-1"></i>Add Condition
                        </button>
                    </div>

                    <hr class="my-4">
                    
                    <h6 class="fw-bold mb-3"><i class="bi bi-hdd-network text-accent me-2"></i>Webhook Action (HTTP Request)</h6>
                    <div class="row g-2 mb-3">
                        <div class="col-md-3">
                            <select id="te-method" class="form-select">
                                ${HTTP_METHODS.map(m => `<option>${m}</option>`).join('')}
                            </select>
                        </div>
                        <div class="col-md-9">
                            <input id="te-url" type="url" class="form-control" placeholder="https://api.yourdomain.com/webhook">
                        </div>
                    </div>

                    <div class="row g-3 mb-3">
                        <div class="col-md-5">
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <label class="form-label small fw-bold mb-0">Headers (JSON)</label>
                                <span id="headers-warn" class="text-danger text-xs hidden"><i class="bi bi-exclamation-triangle me-1"></i>Invalid JSON</span>
                            </div>
                            <div class="json-editor-container">
                                <textarea id="te-headers" class="form-control json-textarea" rows="5" spellcheck="false"
                                    placeholder='{\n  "Authorization": "Bearer token",\n  "Content-Type": "application/json"\n}'></textarea>
                                <pre class="json-highlighted"><code id="te-headers-code" class="language-json"></code></pre>
                            </div>
                        </div>
                        <div class="col-md-7">
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <label class="form-label small fw-bold mb-0">Payload (JSON)</label>
                                <div class="d-flex gap-2 align-items-center">
                                    <span id="payload-warn" class="text-danger text-xs hidden"><i class="bi bi-exclamation-triangle me-1"></i>Invalid JSON</span>
                                    <span class="badge bg-pale-primary text-primary" data-bs-toggle="tooltip" title="Available Variables: {{doc.field}}, {{prevDoc.field}}">
                                        <i class="bi bi-info-circle me-1"></i>Variables
                                    </span>
                                </div>
                            </div>
                            <div class="json-editor-container">
                                <textarea id="te-payload" class="form-control json-textarea" rows="5" spellcheck="false"
                                    placeholder='{\n  "event": "status_changed",\n  "record_id": "{{doc.id}}",\n  "old_status": "{{prevDoc.status}}",\n  "new_status": "{{doc.status}}"\n}'></textarea>
                                <pre class="json-highlighted"><code id="te-payload-code" class="language-json"></code></pre>
                            </div>
                        </div>
                    </div>

                    <div class="d-flex gap-2 justify-content-end mt-4 pt-3 border-top">
                        <button id="btn-te-cancel" class="btn-pico btn-pico-outline">Cancel</button>
                        <button id="btn-te-save"   class="btn-pico btn-pico-primary">Save Automation</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const view = controller({ stringComponent });

    ['trigger-list', 'trigger-editor-overlay', 'btn-new-trigger', 'btn-te-close',
     'te-name', 'te-collection', 'te-method', 'te-url', 'te-headers', 'te-payload',
     'btn-add-condition', 'conditions-container', 'btn-te-cancel', 'btn-te-save',
     'headers-warn', 'payload-warn', 'te-headers-code', 'te-payload-code'
    ].forEach(id => view.onboard({ id }));

    // Core Live Highlighting Function
    const syncJSONHighlight = (textareaId, codeId) => {
        const textarea = view.$(textareaId);
        const codeBlock = view.$(codeId);
        const container = codeBlock?.parentElement; // The <pre> tag

        if (!textarea || !codeBlock || !container) return;

        const updateHighlight = () => {
            let val = textarea.value;
            
            // Ensure the highlight layer accounts for the last newline
            if (val[val.length - 1] === "\n") val += " "; 
            
            // Escape HTML
            codeBlock.textContent = val; 
            
            if (window.Prism) {
                Prism.highlightElement(codeBlock);
            }
        };

        textarea.addEventListener('input', updateHighlight);

        // CRITICAL: Scroll synchronization to prevent the shift seen in screenshot
        textarea.addEventListener('scroll', () => {
            container.scrollTop = textarea.scrollTop;
            container.scrollLeft = textarea.scrollLeft;
        });

        // Initial run
        updateHighlight();
    };

    const initJsonValidators = () => {
        ['te-headers', 'te-payload'].forEach(id => {
            const el = view.$(id);
            const warnEl = view.$(`${id.split('-')[1]}-warn`); // Matches headers-warn or payload-warn
            if (!el || !warnEl) return;

            el.addEventListener('input', () => {
                warnEl.classList.toggle('hidden', validateJSON(el.value));
            });

            el.addEventListener('blur', () => {
                const isValid = validateJSON(el.value);
                warnEl.classList.toggle('hidden', isValid);
                if (isValid) {
                    // Auto-beautify on blur so we don't mess up the cursor while typing
                    el.value = formatJSONString(el.value);
                    // Force the syntax highlighter to catch the beautified code
                    el.dispatchEvent(new Event('input')); 
                }
            });
        });
    };

    const renderTriggersList = () => {
        const list = view.$('trigger-list');
        if (!list) return;
        
        if (!internalState.triggers || !internalState.triggers.length) {
            list.innerHTML = `<div class="text-center text-muted py-5 bg-white border rounded">
                <i class="bi bi-lightning-charge fs-2 d-block mb-3 text-warning opacity-50"></i>
                <h6 class="fw-bold text-dark">No Automations Configured</h6>
                <p class="small">Create triggers to automatically fire API webhooks when specific data changes occur.</p>
            </div>`;
            return;
        }

        list.innerHTML = internalState.triggers.map(triggerCard).join('');

        internalState.triggers.forEach((t) => {
            const toggleBtn = list.querySelector(`#toggle-trigger-${t.id}`);
            const editBtn = list.querySelector(`#edit-trigger-${t.id}`);
            const delBtn = list.querySelector(`#del-trigger-${t.id}`);

            if(toggleBtn) toggleBtn.onclick = async () => {
                try {
                    await firebase.db.updateDoc(firebase.db.doc(firebase.db.db, 'triggers', String(t.id)), { enabled: !t.enabled });
                } catch (e) { alert ("Update failed: " + e.message); }
            };
            if(editBtn) editBtn.onclick = () => openEditor(t);
            if(delBtn) delBtn.onclick = () => {
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
                    } catch (e) { alert("Delete failed: " + e.message); }
                };
                modal.show();
            };
        });
        
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    };

    const attachConditionListeners = () => {
        const container = view.$('conditions-container');
        
        container.querySelectorAll('.cond-logic').forEach(sel => sel.addEventListener('change', (e) => {
            workingConditions[parseInt(e.target.dataset.idx)].logicalOp = e.target.value;
        }));

        container.querySelectorAll('.cond-field').forEach(sel => sel.addEventListener('change', (e) => { 
            const idx = parseInt(e.target.dataset.idx);
            workingConditions[idx].field = e.target.value; 
            workingConditions[idx].value = ''; 
            renderConditions(); 
        }));

        container.querySelectorAll('.cond-op').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                workingConditions[idx].operator = e.target.value;
                renderConditions();
            });
        });

        container.querySelectorAll('.cond-val').forEach(inp => inp.addEventListener('input', (e) => { 
            workingConditions[parseInt(e.target.dataset.idx)].value = e.target.value; 
        }));
        container.querySelectorAll('.cond-val').forEach(inp => inp.addEventListener('change', (e) => { 
            workingConditions[parseInt(e.target.dataset.idx)].value = e.target.value; 
        }));

        container.querySelectorAll('.cond-del').forEach(btn => btn.addEventListener('click', (e) => { 
            workingConditions.splice(parseInt(e.currentTarget.dataset.idx), 1); 
            renderConditions(); 
        }));
    };

    const renderConditions = () => {
        const container = view.$('conditions-container');
        if (!container) return;
        container.innerHTML = workingConditions.length
            ? workingConditions.map(conditionRow).join('')
            : `<div class="text-center text-muted small py-3">No conditions defined. Trigger will fire on ALL updates to the collection.</div>`;
        attachConditionListeners();
    };

    const openEditor = (trigger = null) => {
        editingTriggerId = trigger ? trigger.id : null;
        
        const col = trigger?.collection || 'appointments';
        view.$('te-collection').value = col;
        currentFields = COLLECTION_FIELDS[col] || ['id', 'status', 'created_at'];

        workingConditions = trigger ? JSON.parse(JSON.stringify(trigger.conditions)) : [{ logicalOp: 'AND', field: 'status', operator: 'changed to', value: '' }];
        
        view.$('te-name').value       = trigger?.name || '';
        view.$('te-method').value     = trigger?.action?.method || 'POST';
        view.$('te-url').value        = trigger?.action?.url    || '';
        view.$('te-headers').value    = formatJSONString(trigger?.action?.headers || '{\n  "Content-Type": "application/json"\n}');
        view.$('te-payload').value    = formatJSONString(trigger?.action?.payload || '{\n  "event": "data_changed",\n  "record_id": "{{doc.id}}"\n}');

        // Boot up live highlighters
        syncJSONHighlight('te-headers', 'te-headers-code');
        syncJSONHighlight('te-payload', 'te-payload-code');

        // Manually trigger validation check on load
        view.$('te-headers').dispatchEvent(new Event('input'));
        view.$('te-payload').dispatchEvent(new Event('input'));

        renderConditions();
        view.$('trigger-editor-overlay').classList.remove('hidden');
        view.$('trigger-editor-overlay').classList.add('show');
    };

    const closeEditor = () => { 
        view.$('trigger-editor-overlay').classList.remove('show');
        setTimeout(() => view.$('trigger-editor-overlay').classList.add('hidden'), 300);
        editingTriggerId = null; 
        workingConditions = []; 
    };

    view.trigger('change', 'te-collection', (e) => {
        currentFields = COLLECTION_FIELDS[e.target.value] || ['id', 'status', 'created_at'];
        workingConditions.forEach(c => {
            if (!currentFields.includes(c.field)) c.field = currentFields[0];
            c.value = ''; 
        });
        renderConditions();
    });

    view.trigger('click', 'btn-new-trigger',    () => openEditor());
    view.trigger('click', 'btn-add-condition',  () => { 
        workingConditions.push({ logicalOp: 'AND', field: currentFields[0], operator: 'equals', value: '' }); 
        renderConditions(); 
    });
    view.trigger('click', 'btn-te-cancel', closeEditor);
    view.trigger('click', 'btn-te-close', closeEditor);
    
    view.trigger('click', 'btn-te-save', async () => {
        const name = view.$('te-name').value.trim();
        const url  = view.$('te-url').value.trim();
        const headersStr = view.$('te-headers').value.trim();
        const payloadStr = view.$('te-payload').value.trim();

        if (!name || !url) return alert('Automation Name and Webhook URL are strictly required.');
        if (!validateJSON(headersStr) || !validateJSON(payloadStr)) {
            return alert('Cannot save: The Headers or Payload contain invalid JSON. Please fix the formatting errors indicated in red.');
        }
        
        const triggerId = editingTriggerId || 'TRG-' + Math.random().toString(36).substr(2, 9).toUpperCase();

        const triggerData = {
            id: triggerId,
            name, 
            collection: view.$('te-collection').value,
            enabled: true, 
            conditions: JSON.parse(JSON.stringify(workingConditions)),
            action: { 
                type: 'webhook', 
                method: view.$('te-method').value, 
                url, 
                headers: formatJSONString(headersStr), // Enforce clean formatting on save
                payload: formatJSONString(payloadStr)  // Enforce clean formatting on save
            },
            updated_at: firebase.db.serverTimestamp()
        };

        const btn = view.$('btn-te-save');
        const ogText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        btn.disabled = true;

        try {
            await firebase.db.setDoc(firebase.db.doc(firebase.db.db, 'triggers', triggerId), triggerData);
            closeEditor();
        } catch(e) {
            alert('Failed to save trigger: ' + e.message);
        } finally {
            btn.innerHTML = ogText;
            btn.disabled = false;
        }
    });

    view.on('init', async () => {
        initJsonValidators(); // Attach event listeners for dynamic formatting
        view.emit('loading:start');
        
        view.unsub(firebase.db.subscribe(firebase.db.collection(firebase.db.db, 'triggers'), (snap) => {
            view.emit('loading:end');
            const arr = [];
            if(snap && snap.forEach) {
                snap.forEach(doc => { arr.push(doc.data()); });
            }
            internalState.triggers = arr;
            renderTriggersList();
        }));
    });

    return view;
}
