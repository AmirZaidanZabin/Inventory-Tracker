import { db } from '../lib/db/index.js';
import { createModal } from '../lib/modal.js';

// ---- BUILDER VIEW ----
export function PagesView() {
    let state = { pages: [], forms: [] };
    const element = document.createElement('div');
    element.className = 'p-4 max-w-6xl mx-auto pb-5';
    let listeners = {};
    const view = {
        element: () => element,
        on: (ev, cb) => listeners[ev] = cb,
        trigger: (ev, data) => { if(listeners[ev]) listeners[ev](data); },
        message: async (m) => { if(m==='init') await load() },
        destroy: () => {}
    };

    async function load() {
        element.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary"></div></div>';
        try {
            state.pages = await db.findMany('pages') || [];
            state.forms = await db.findMany('forms') || [];
        } catch(e) { console.error(e); }
        render();
    }

    function render() {
        element.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h2 class="h4 fw-bold mb-0"><i class="bi bi-layout-wtf text-primary me-2"></i>Dynamic Pages Builder</h2>
                <button class="btn btn-pico btn-pico-primary" id="btn-create-page">Create New Page</button>
            </div>
            <div class="card border-0 shadow-sm rounded-4">
                <div class="card-header bg-white border-bottom-0 pt-3 px-4">
                    <h5 class="mb-0 fw-bold">Existing Pages</h5>
                </div>
                <div class="card-body px-4 pb-4">
                    <div class="table-responsive">
                        <table class="table modern-table align-middle">
                            <thead><tr><th>Name</th><th>ID</th><th>Forms</th><th>Rules</th><th>Actions</th></tr></thead>
                            <tbody>
                                ${state.pages.length === 0 ? '<tr><td colspan="5" class="text-muted text-center py-4">No pages created yet.</td></tr>':''}
                                ${state.pages.map(p => `
                                    <tr>
                                        <td class="fw-bold">${p.name}</td>
                                        <td class="text-muted small">${p.id}</td>
                                        <td><span class="badge badge-pale-primary">${p.forms?.length||0} Forms</span></td>
                                        <td><span class="badge badge-pale-secondary">${p.rules?.length||0} Rules</span></td>
                                        <td>
                                            <button class="btn btn-pico btn-pico-outline btn-edit" data-id="${p.id}">Edit</button>
                                            <a class="btn btn-pico btn-pico-primary ms-1" href="#page_run?id=${p.id}">Run</a>
                                            <button class="btn btn-pico btn-pico-danger-outline ms-1 btn-del" data-id="${p.id}">Delete</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        element.querySelector('#btn-create-page').addEventListener('click', () => openBuilder());
        element.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', e => {
            const p = state.pages.find(x => x.id === e.target.dataset.id);
            if(p) openBuilder(p);
        }));
        element.querySelectorAll('.btn-del').forEach(btn => btn.addEventListener('click', async e => {
            if(!confirm('Delete this page?')) return;
            await db.remove('pages', e.target.dataset.id);
            await load();
        }));
    }

    function openBuilder(page = null) {
        let bState = {
            id: page?.id || ('page_' + Math.random().toString(36).substr(2,6)),
            name: page?.name || '',
            forms: JSON.parse(JSON.stringify(page?.forms || [])),
            rules: JSON.parse(JSON.stringify(page?.rules || []))
        };

        const m = createModal({ title: page ? 'Edit Page' : 'Create Page', body: '<div id="builder-root"></div>', size: 'lg' });
        m.show();
        const root = m.element.querySelector('#builder-root');

        function renderModal() {
            // Compute available selected forms for the rules dropdown
            const selFormsDetails = bState.forms.map(sf => state.forms.find(f => f.id === sf.form_id)).filter(Boolean);
            
            root.innerHTML = `
                <div class="row g-3">
                    <div class="col-md-4">
                        <label class="form-label small fw-bold">Page ID</label>
                        <input type="text" class="form-control" id="b-id" value="${bState.id}" ${page?'disabled':''}>
                    </div>
                    <div class="col-md-8">
                        <label class="form-label small fw-bold">Page Name</label>
                        <input type="text" class="form-control" id="b-name" value="${bState.name}">
                    </div>
                    
                    <div class="col-12 mt-4"><h6 class="fw-bold border-bottom pb-2 text-primary">1. Attached Forms & Order</h6></div>
                    <div class="col-12">
                        ${state.forms.map(f => {
                            const isSel = bState.forms.find(x => x.form_id === f.id);
                            return `
                                <div class="d-flex align-items-center mb-2 bg-light p-2 rounded border border-light shadow-sm">
                                    <div class="form-check me-3 mb-0">
                                        <input type="checkbox" class="form-check-input chk-form" id="chk-${f.id}" data-fid="${f.id}" ${isSel?'checked':''}>
                                        <label class="form-check-label fw-medium" for="chk-${f.id}">${f.name}</label>
                                    </div>
                                    <div style="width: 100px;">
                                        <input type="number" class="form-control form-control-sm inp-order ${!isSel?'d-none':''}" data-fid="${f.id}" value="${isSel?isSel.order:1}" placeholder="Order">
                                    </div>
                                    <div class="ms-3 small text-muted fst-italic ${!isSel?'d-none':''}">${(f.fields||[]).length} Fields</div>
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <div class="col-12 mt-4">
                        <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-2">
                            <h6 class="fw-bold mb-0 text-primary">2. Cross-Form Logic Rules</h6>
                            <button class="btn btn-pico btn-pico-outline" id="btn-add-rule"><i class="bi bi-plus-lg"></i> Add Rule</button>
                        </div>
                    </div>
                    <div class="col-12">
                        ${bState.rules.length === 0 ? '<div class="text-muted small fst-italic text-center py-3">No rules defined. Page will render all selected forms sequentially.</div>' : ''}
                        ${bState.rules.map((r, i) => {
                            const triggerFormModel = state.forms.find(x => x.id === r.trigger_form);
                            const activeFields = triggerFormModel ? triggerFormModel.fields : [];
                            return `
                            <div class="card shadow-sm border border-light mb-3 bg-light rounded-4">
                                <div class="card-body p-3">
                                    <div class="row g-2 align-items-end">
                                        <div class="col-md-3">
                                            <label class="small fw-bold">If Form</label>
                                            <select class="form-select form-select-sm rl-t-form" data-idx="${i}">
                                                <option value="">Select...</option>
                                                ${selFormsDetails.map(f => `<option value="${f.id}" ${r.trigger_form === f.id ? 'selected':''}>${f.name}</option>`).join('')}
                                            </select>
                                        </div>
                                        <div class="col-md-3">
                                            <label class="small fw-bold">Field</label>
                                            <select class="form-select form-select-sm rl-t-field" data-idx="${i}">
                                                <option value="">Select...</option>
                                                ${activeFields.map(fld => `<option value="${fld.name}" ${r.trigger_field === fld.name ? 'selected':''}>${fld.label || fld.name}</option>`).join('')}
                                            </select>
                                        </div>
                                        <div class="col-md-2">
                                            <label class="small fw-bold">Operator</label>
                                            <select class="form-select form-select-sm rl-op" data-idx="${i}">
                                                <option value="==" ${r.operator === '=='?'selected':''}>==</option>
                                                <option value="!=" ${r.operator === '!='?'selected':''}>!=</option>
                                            </select>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="small fw-bold">Value</label>
                                            <input type="text" class="form-control form-control-sm rl-val" data-idx="${i}" value="${r.value || ''}">
                                        </div>
                                        <div class="col-md-3 mt-3">
                                            <label class="small fw-bold text-primary">Then</label>
                                            <select class="form-select form-select-sm rl-action" data-idx="${i}">
                                                <option value="show" ${r.action === 'show'?'selected':''}>Show</option>
                                                <option value="hide" ${r.action === 'hide'?'selected':''}>Hide</option>
                                            </select>
                                        </div>
                                        <div class="col-md-7 mt-3">
                                            <label class="small fw-bold text-primary">Target Form</label>
                                            <select class="form-select form-select-sm rl-tgt" data-idx="${i}">
                                                <option value="">Select...</option>
                                                ${selFormsDetails.map(f => `<option value="${f.id}" ${r.target_form === f.id ? 'selected':''}>${f.name}</option>`).join('')}
                                            </select>
                                        </div>
                                        <div class="col-md-2 mt-3 text-end">
                                            <button class="btn btn-pico btn-pico-danger-outline btn-rm-rule" data-idx="${i}" title="Remove Rule"><i class="bi bi-trash"></i></button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            `;
                        }).join('')}
                    </div>

                    <div class="col-12 mt-4 text-end border-top pt-3">
                        <button class="btn btn-pico btn-pico-primary px-4" id="btn-save-page">Save Page Schema</button>
                    </div>
                </div>
            `;

            // State Binding
            root.querySelector('#b-id').addEventListener('input', e => bState.id = e.target.value);
            root.querySelector('#b-name').addEventListener('input', e => bState.name = e.target.value);
            
            root.querySelectorAll('.chk-form').forEach(chk => {
                chk.addEventListener('change', e => {
                    const fid = e.target.dataset.fid;
                    if(e.target.checked) {
                        bState.forms.push({ form_id: fid, order: bState.forms.length + 1 });
                    } else {
                        bState.forms = bState.forms.filter(x => x.form_id !== fid);
                        bState.rules = bState.rules.filter(r => r.trigger_form !== fid && r.target_form !== fid);
                    }
                    renderModal();
                });
            });

            root.querySelectorAll('.inp-order').forEach(inp => {
                inp.addEventListener('change', e => {
                    const sel = bState.forms.find(x => x.form_id === e.target.dataset.fid);
                    if(sel) sel.order = parseInt(e.target.value) || 0;
                });
            });

            root.querySelector('#btn-add-rule')?.addEventListener('click', () => {
                bState.rules.push({ trigger_form: '', trigger_field: '', operator: '==', value: '', action: 'show', target_form: '' });
                renderModal();
            });

            root.querySelectorAll('.btn-rm-rule').forEach(btn => btn.addEventListener('click', e => {
                bState.rules.splice(parseInt(e.currentTarget.dataset.idx), 1);
                renderModal();
            }));

            const bindRuleEvent = (selector, key, reRender = false) => {
                root.querySelectorAll(selector).forEach(el => el.addEventListener('change', e => {
                    bState.rules[parseInt(e.target.dataset.idx)][key] = e.target.value;
                    if(reRender) renderModal();
                }));
            };

            bindRuleEvent('.rl-t-form', 'trigger_form', true); // Re-render fields dropdown
            bindRuleEvent('.rl-t-field', 'trigger_field');
            bindRuleEvent('.rl-op', 'operator');
            bindRuleEvent('.rl-val', 'value', true); // Value might dictate UI state elsewhere, but optional
            bindRuleEvent('.rl-action', 'action');
            bindRuleEvent('.rl-tgt', 'target_form');

            root.querySelector('#btn-save-page').addEventListener('click', async () => {
                if(!bState.id || !bState.name) return alert('ID and Name required.');
                try {
                    if(page) {
                        await db.update('pages', bState.id, bState);
                    } else {
                        await db.create('pages', bState, bState.id);
                    }
                    m.hide();
                    await load();
                } catch(err) { alert(err.message); }
            });
        }
        renderModal();
    }

    return view;
}

// ---- PAGE RENDERER VIEW ----
export function PageRunView(paramStr) {
    let state = {
        pageId: paramStr ? new URLSearchParams(paramStr).get('id') : null,
        page: null,
        formsModels: [],
        formData: {} // aggregated payload flat-map: formId__fieldName => value
    };

    const element = document.createElement('div');
    element.className = 'p-4 max-w-4xl mx-auto pb-5';
    let listeners = {};
    const view = {
        element: () => element,
        on: (ev, cb) => listeners[ev] = cb,
        trigger: (ev, data) => { if(listeners[ev]) listeners[ev](data); },
        message: async (m) => { if(m==='init') await load() },
        destroy: () => {}
    };

    async function load() {
        if(!state.pageId) {
            element.innerHTML = '<div class="alert alert-danger">No Page ID provided in URL.</div>';
            return;
        }
        element.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary"></div></div>';
        try {
            state.page = await db.findOne('pages', state.pageId);
            if(!state.page) throw new Error("Page schema not found");
            
            // fetch the forms definitions
            if (state.page.forms) {
                state.page.forms.sort((a,b)=>a.order - b.order);
            }
            const allForms = await db.findMany('forms') || [];
            
            state.formsModels = (state.page.forms || []).map(pf => {
                return allForms.find(f => f.id === pf.form_id);
            }).filter(Boolean);

            render();
        } catch(e) {
            element.innerHTML = `<div class="alert alert-danger shadow-sm border-0 rounded-4 p-4"><i class="bi bi-exclamation-triangle me-2"></i> ${e.message}</div>`;
        }
    }

    function render() {
        let html = `
            <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
                <h2 class="h3 fw-bold mb-0 text-dark">${state.page.name}</h2>
                <button type="button" class="btn btn-pico btn-pico-outline" onclick="window.history.back()"><i class="bi bi-arrow-left me-1"></i> Back</button>
            </div>
            <form id="engine-runner-form">
        `;

        state.formsModels.forEach((formDef, idx) => {
            html += `
                <div class="card border-0 shadow-sm rounded-4 mb-4 engine-form-container" id="container-${formDef.id}">
                    <div class="card-header bg-white border-bottom-0 pt-3 px-4">
                        <h5 class="mb-0 fw-bold text-primary">${formDef.name}</h5>
                        ${formDef.description ? `<p class="small text-muted mb-0 mt-1">${formDef.description}</p>` : ''}
                    </div>
                    <div class="card-body px-4 pb-4">
                        <div class="row g-3">
            `;
            
            (formDef.fields || []).forEach(f => {
                html += `<div class="col-md-6 field-wrapper">
                            <label class="form-label small fw-bold text-muted">${f.label} ${f.required?'<span class="text-danger">*</span>':''}</label>`;
                
                if (f.type === 'select') {
                    html += `<select class="form-select form-control engine-field bg-light border-0" style="min-height:42px" name="${formDef.id}__${f.name}" data-form="${formDef.id}" data-field="${f.name}" ${f.required?'required':''}>
                                <option value="">Select...</option>
                                ${(f.options||[]).map(o => `<option value="${o}">${o}</option>`).join('')}
                             </select>`;
                } else if (f.type === 'textarea') {
                    html += `<textarea class="form-control engine-field bg-light border-0" name="${formDef.id}__${f.name}" data-form="${formDef.id}" data-field="${f.name}" rows="3" ${f.required?'required':''}></textarea>`;
                } else if (f.type === 'checkbox') {
                    html += `<div class="form-check mt-2">
                                <input type="checkbox" class="form-check-input engine-field" name="${formDef.id}__${f.name}" data-form="${formDef.id}" data-field="${f.name}" value="true" ${f.required?'required':''}>
                                <label class="form-check-label small fw-medium">Yes</label>
                             </div>`;
                } else if (f.type === 'decimal' || f.type === 'currency') {
                    const extraClasses = f.type === 'currency' ? 'ps-5' : '';
                    const currencyBadge = f.type === 'currency' ? `<span class="position-absolute top-50 start-0 translate-middle-y ms-3 small fw-bold text-muted" style="z-index: 5;">${f.currency || 'SAR'}</span>` : '';
                    
                    html += `<div class="position-relative">
                                ${currencyBadge}
                                <input type="number" step="0.0001" class="form-control engine-field bg-light border-0 ${extraClasses}" style="min-height:42px" name="${formDef.id}__${f.name}" data-form="${formDef.id}" data-field="${f.name}" ${f.required?'required':''} ${f.pattern?`pattern="${f.pattern}"`:''}>
                             </div>`;
                } else {
                    const natType = ['email', 'tel', 'number', 'date'].includes(f.type) ? f.type : 'text';
                    html += `<input type="${natType}" class="form-control engine-field bg-light border-0" style="min-height:42px" name="${formDef.id}__${f.name}" data-form="${formDef.id}" data-field="${f.name}" ${f.required?'required':''} ${f.pattern?`pattern="${f.pattern}"`:''}>`;
                }
                html += `</div>`;
            });

            html += `
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                <div class="mt-4 pt-4 border-top text-end">
                    <button type="submit" class="btn btn-pico btn-pico-primary px-5 py-2 fs-6 fw-bold shadow-sm">Submit Page Payload <i class="bi bi-arrow-right ms-2"></i></button>
                </div>
            </form>
        `;

        element.innerHTML = html;

        element.querySelectorAll('.engine-field').forEach(el => {
            el.addEventListener('change', (e) => {
                const isCheck = el.type === 'checkbox';
                const val = isCheck ? (el.checked ? 'true' : 'false') : el.value;
                state.formData[`${el.dataset.form}__${el.dataset.field}`] = val;
                evaluateRules();
            });
            // initial state injection
            const isCheck = el.type === 'checkbox';
            state.formData[`${el.dataset.form}__${el.dataset.field}`] = isCheck ? 'false' : '';
        });

        element.querySelector('#engine-runner-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                page_id: state.pageId,
                submitted_at: Date.now(),
                data: state.formData
            };
            console.log("Submitting Page Payload: ", payload);
            alert("Payload generated successfully! Check browser console for JSON output. (This is a dynamic builder demo).");
            window.history.back();
        });

        evaluateRules();
    }

    function evaluateRules() {
        if(!state.page) return;
        const rules = state.page.rules || [];
        
        let formVis = {};
        state.formsModels.forEach(f => formVis[f.id] = true); // show by default
        
        const explicitlyHiddenForms = new Set();
        const explicitlyShownForms = new Set();

        rules.forEach(r => {
            const currentVal = state.formData[`${r.trigger_form}__${r.trigger_field}`] || '';
            let conditionMet = false;
            
            if (r.operator === '==') conditionMet = (currentVal === r.value);
            else if (r.operator === '!=') conditionMet = (currentVal !== r.value);

            // If a rule targets this form, we mark its initial state as evaluated
            if (conditionMet) {
                if (r.action === 'show') { formVis[r.target_form] = true; explicitlyShownForms.add(r.target_form); }
                if (r.action === 'hide') { formVis[r.target_form] = false; explicitlyHiddenForms.add(r.target_form); }
            } else {
                if (r.action === 'show' && !explicitlyShownForms.has(r.target_form)) { formVis[r.target_form] = false; explicitlyHiddenForms.add(r.target_form); }
                if (r.action === 'hide' && !explicitlyHiddenForms.has(r.target_form)) { formVis[r.target_form] = true; explicitlyShownForms.add(r.target_form); }
            }
        });

        Object.keys(formVis).forEach(formId => {
            const container = element.querySelector(`#container-${formId}`);
            if (container) {
                if (formVis[formId]) {
                    container.classList.remove('d-none');
                    container.querySelectorAll('.engine-field[required]').forEach(el => el.disabled = false);
                } else {
                    container.classList.add('d-none');
                    container.querySelectorAll('.engine-field').forEach(el => el.disabled = true);
                }
            }
        });
    }

    return view;
}
