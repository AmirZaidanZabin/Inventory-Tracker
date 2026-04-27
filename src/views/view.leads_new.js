import { auth } from '../lib/auth.js';
import { apiDb as db } from '../lib/api-client.js';

export function LeadsNewView() {
    let state = {
        data: {}, // merged form state
        schemas: [],
        saving: false,
        checkingDuplicate: false,
        tiers: [],
        cards: []
    };

    let maps = []; // to keep track of leaflet maps

    const element = document.createElement('div');
    element.className = 'leads-new-container p-4 max-w-4xl mx-auto pb-5';

    let listeners = {};
    const view = {
        element: () => element,
        on: (event, callback) => { listeners[event] = callback; },
        trigger: (event, data) => { if (listeners[event]) listeners[event](data); },
        message: async (msg, data) => {
            if (msg === 'init') await init();
        },
        destroy: () => {
            maps.forEach(m => m.remove());
        }
    };

    async function init() {
        const hashParts = window.location.hash.split('?');
        let merchantContext = null;
        if (hashParts.length > 1) {
            const qs = new URLSearchParams(hashParts[1]);
            const mId = qs.get('merchant_id');
            const action = qs.get('action');
            if (mId) {
                merchantContext = { id: mId, action };
                const m = await db.findOne('merchants', mId);
                if (m) {
                    state.data = { ...state.data, ...m };
                }
            }
        }
        state.merchantContext = merchantContext;

        let forms = await db.findMany('forms');
        let leadForms = (forms || []).filter(f => f.entities && f.entities.includes('leads'));
        
        state.settings = await db.findOne('app_settings', 'global') || {};
        state.tiers = await db.findMany('pricing_tiers') || [];
        state.cards = await db.findMany('pricing_cards') || [];
        // Sort tiers by level desc (highest level = most strict)
        state.tiers.sort((a,b) => b.level - a.level);
        
        if (leadForms.length === 0) {
            // Seed the strict 3-section flow
            const s1 = {
                id: 'form_lead_sec1',
                name: '1. Merchant Details',
                entities: ['leads'],
                section_order: 1,
                fields: [
                    { name: 'country', label: 'Country', type: 'select', options: ['KSA', 'UAE', 'KW', 'JO', 'EG'], required: true },
                    { name: 'cr_number', label: 'CR / License Number', type: 'text', required: true },
                    { name: 'merchant_name', label: 'Merchant Name', type: 'text', required: true },
                    { name: 'owner_phone', label: 'Owner Phone', type: 'tel', required: true },
                    { name: 'monthly_gmv', label: 'Monthly GMV', type: 'currency', currency: 'SAR', required: true }
                ]
            };
            const s2 = {
                id: 'form_lead_sec2',
                name: '2. Branches & Devices',
                entities: ['leads'],
                section_order: 2,
                fields: [
                    { name: 'branches', label: 'Branch Locations', type: 'multi-map', required: false },
                    { name: 'terminals', label: 'Terminals Needed', type: 'number', required: true },
                    { name: 'sims', label: 'SIM Cards Needed', type: 'number', required: true },
                    { name: 'picos', label: 'Pico Systems Needed', type: 'number', required: true }
                ]
            };
            const s3 = {
                id: 'form_lead_sec3',
                name: '3. Card Rates (%)',
                entities: ['leads'],
                section_order: 3,
                condition: { field: 'country', value: 'KSA' },
                fields: [
                    { name: 'rate_mada', label: 'mada Rate', type: 'decimal', required: true },
                    { name: 'rate_visa', label: 'Visa Rate', type: 'decimal', required: true },
                    { name: 'rate_mastercard', label: 'Mastercard Rate', type: 'decimal', required: true },
                    { name: 'rate_amex', label: 'Amex Rate', type: 'decimal', required: true }
                ]
            };
            await db.create('forms', s1, s1.id);
            await db.create('forms', s2, s2.id);
            await db.create('forms', s3, s3.id);
            leadForms = [s1, s2, s3];
        } else {
            // Hot migration for existing schema
            const sec1 = leadForms.find(f => f.id === 'form_lead_sec1');
            if (sec1) {
                let updated = false;
                const gmvField = sec1.fields.find(f => f.name === 'monthly_gmv');
                if (!gmvField) {
                    sec1.fields.push({ name: 'monthly_gmv', label: 'Monthly GMV', type: 'currency', currency: 'SAR', required: true });
                    updated = true;
                } else if (gmvField.type !== 'currency') {
                    gmvField.type = 'currency'; gmvField.currency = 'SAR';
                    updated = true;
                }
                if (updated) await db.update('forms', sec1.id, sec1);
            }
            const sec3 = leadForms.find(f => f.id === 'form_lead_sec3');
            if (sec3) {
                let updated = false;
                sec3.fields.forEach(f => {
                    if (f.name.startsWith('rate_') && f.type === 'number') {
                        f.type = 'decimal';
                        updated = true;
                    }
                });
                if (updated) await db.update('forms', sec3.id, sec3);
            }
        }

        // Sort sections logically
        state.schemas = leadForms.sort((a,b) => (a.section_order||0) - (b.section_order||0) || a.name.localeCompare(b.name));
        
        // Enforce KYC if configured
        if (state.settings && state.settings.enforce_kyc) {
            let section1 = state.schemas.find(s => s.id === 'form_lead_sec1');
            if (section1 && !section1.fields.find(f => f.name === 'kyc_document')) {
                section1.fields.push({ name: 'kyc_document', label: 'KYC Document (Upload)', type: 'file', required: true });
            }
        }

        render();
    }

    function checkCondition(cond) {
        if (!cond || !cond.field) return true;
        return state.data[cond.field] == cond.value;
    }

    function render() {
        let html = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h2 class="h4 fw-bold mb-0"><i class="bi bi-funnel text-primary me-2"></i>Create New Lead ${state.merchantContext ? ` <span class="badge bg-primary ms-2" style="font-size:0.6rem;">${state.merchantContext.action.toUpperCase()}</span>` : ''}</h2>
                <button type="button" class="btn btn-outline-secondary btn-sm" id="btn-cancel">Cancel</button>
            </div>
            <div id="duplicate-alert" class="alert alert-danger d-none align-items-center">
                A merchant with this CR already exists. 
                <a href="#" id="duplicate-link" class="btn btn-sm btn-danger ms-auto">View Merchant Profile</a>
            </div>
            <form id="form-new-lead">
        `;

        state.schemas.forEach(schema => {
            const isSectionVisible = checkCondition(schema.condition);
            const sectionDisplay = isSectionVisible ? 'block' : 'none';
            html += `
                <div class="card border-0 shadow-sm mb-4" id="section-${schema.id}" style="display: ${sectionDisplay}">
                    <div class="card-header bg-light border-bottom-0"><h6 class="mb-0 fw-bold">${schema.name}</h6></div>
                    <div class="card-body">
                        <div class="row g-3">
            `;
            
            (schema.fields || []).forEach(f => {
                const isVisible = checkCondition(f.condition);
                const display = isVisible ? 'block' : 'none';
                
                html += `<div class="col-md-6 field-wrapper" id="wrapper-${f.name}" style="display: ${display}">
                            <label class="form-label small fw-bold text-muted">${f.label} ${f.required?'<span class="text-danger">*</span>':''}</label>`;
                
                const val = state.data[f.name] || '';
                const isDisabled = (state.merchantContext && schema.section_order === 1) ? 'disabled readonly' : '';
                
                if (f.type === 'select') {
                    const safeOptions = Array.isArray(f.options) ? f.options : [];
                    html += `<select class="form-select inp-dynamic" name="${f.name}" ${f.required&&isVisible?'required':''} ${isDisabled}>
                                <option value="">Select...</option>
                                ${safeOptions.map(o => `<option value="${o}" ${val===o?'selected':''}>${o}</option>`).join('')}
                             </select>`;
                } else if (f.type === 'textarea') {
                    html += `<textarea class="form-control inp-dynamic" name="${f.name}" rows="3" ${f.required&&isVisible?'required':''} ${isDisabled}>${val}</textarea>`;
                } else if (f.type === 'checkbox') {
                    html += `<div class="form-check mt-2">
                                <input type="checkbox" class="form-check-input inp-dynamic" name="${f.name}" value="true" ${val==='true'?'checked':''} ${f.required&&isVisible?'required':''} ${isDisabled}>
                                <label class="form-check-label small">Yes</label>
                             </div>`;
                } else if (f.type === 'decimal' || f.type === 'currency') {
                    const extraClasses = f.type === 'currency' ? 'ps-5' : '';
                    const currencyBadge = f.type === 'currency' ? `<span class="position-absolute top-50 start-0 translate-middle-y ms-3 small fw-bold text-muted">${f.currency || 'SAR'}</span>` : '';
                    
                    html += `<div class="position-relative">
                                ${currencyBadge}
                                <input type="number" step="0.0001" class="form-control inp-dynamic ${extraClasses}" name="${f.name}" value="${val}" ${f.required&&isVisible?'required':''} ${isDisabled}>
                             </div>`;
                } else if (f.type === 'multi-map') {
                    html += `<div class="mb-2">
                                <input type="text" class="form-control form-control-sm border-primary" id="paste-${f.name}" placeholder="Paste Google Maps URL or Coordinates (lat, lng)" ${isDisabled}>
                             </div>
                             <div class="border rounded bg-light" id="map-${f.name}" style="height: 300px; width: 100%; z-index: 1;"></div>
                             <div class="small text-muted mt-1 fst-italic">Search, click the map, or paste a link to add multiple location pins.</div>
                             <div id="pins-${f.name}" class="mt-2 text-sm text-muted d-flex flex-wrap gap-2"></div>
                             <input type="hidden" name="${f.name}" class="inp-dynamic" value='${JSON.stringify(val||[])}'>
                             `;
                } else {
                    const natType = ['email', 'tel', 'number', 'date', 'file'].includes(f.type) ? f.type : 'text';
                    const valueAttr = natType === 'file' ? '' : `value="${val}"`;
                    html += `<input type="${natType}" class="form-control inp-dynamic" name="${f.name}" ${valueAttr} ${f.required&&isVisible?'required':''} ${f.pattern?`pattern="${f.pattern}"`:''} ${isDisabled}>`;
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
                <div class="d-flex justify-content-between align-items-center mt-4 pt-3 border-top">
                    <div id="predictive-ui-container">
                        <span class="badge badge-pale-success p-2 d-none" id="predictive-badge">Pre-check: Auto-Approved</span>
                    </div>
                    <div class="d-flex gap-2">
                        <button type="button" class="btn btn-light" id="btn-save-draft">Save as Draft</button>
                        <button type="submit" class="btn btn-primary px-4" id="btn-save-submit">Save & Submit for Approval <i class="bi bi-arrow-right ms-2"></i></button>
                    </div>
                </div>
            </form>
        `;

        element.innerHTML = html;
        attachEvents();
        initMaps();
    }

    function attachEvents() {
        element.querySelector('#btn-cancel').addEventListener('click', () => { window.location.hash = 'leads'; });

        const crField = element.querySelector('input[name="cr_number"]');
        if (crField && !state.merchantContext) {
            crField.addEventListener('blur', async (e) => {
                const val = e.target.value.trim();
                if (!val) return;
                state.checkingDuplicate = true;
                const btnSubmit = element.querySelector('#btn-save-submit');
                if (btnSubmit) btnSubmit.disabled = true;

                try {
                    const token = await auth.getToken();
                    const res = await fetch(`/api/sales/check-cr/${encodeURIComponent(val)}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const result = await res.json();
                    
                    const btnSaveDraft = element.querySelector('#btn-save-draft');
                    const alertBox = element.querySelector('#duplicate-alert');
                    
                    // CR Registry Verification (External API)
                    if (result.registryData) {
                        const reg = result.registryData;
                        const mNameField = element.querySelector('input[name="merchant_name"]');
                        if (mNameField && reg.name) {
                            mNameField.value = reg.name;
                            state.data.merchant_name = reg.name;
                        }
                    }

                    if (result.duplicateMerchant) {
                        const m = result.duplicateMerchant;
                        alertBox.classList.remove('d-none');
                        alertBox.classList.add('d-flex');
                        alertBox.innerHTML = `
                            A merchant with this CR already exists. 
                            <a href="#merchant_detail/${m.id}" class="btn btn-sm btn-danger ms-auto">View Merchant Profile</a>
                        `;
                        btnSaveDraft.disabled = true;
                        btnSubmit.disabled = true;
                    } else if (result.duplicateLead) {
                        const l = result.duplicateLead;
                        alertBox.classList.remove('d-none');
                        alertBox.classList.add('d-flex');
                        alertBox.innerHTML = `
                            An active lead with this CR already exists (${l.status}). 
                            <a href="#lead_detail/${l.id}" class="btn btn-sm btn-danger ms-auto">View Lead Details</a>
                        `;
                        btnSaveDraft.disabled = true;
                        btnSubmit.disabled = true;
                    } else {
                        alertBox.classList.add('d-none');
                        alertBox.classList.remove('d-flex');
                        btnSaveDraft.disabled = false;
                        btnSubmit.disabled = false;

                        // Warning if registry verification failed but is required
                        if (result.externalCheckAttempted && !result.registryData) {
                            alertBox.classList.remove('d-none');
                            alertBox.classList.add('d-flex');
                            if (state.settings && state.settings.require_registry_verification) {
                                alertBox.innerHTML = `
                                    <span><i class="bi bi-x-octagon me-2"></i>CR verification failed. External registry lookup is mandatory.</span>
                                `;
                                alertBox.classList.replace('alert-warning', 'alert-danger');
                                btnSaveDraft.disabled = true;
                                btnSubmit.disabled = true;
                            } else {
                                alertBox.innerHTML = `
                                    <span><i class="bi bi-exclamation-triangle me-2"></i>CR verification failed. Proceed with caution.</span>
                                `;
                                alertBox.classList.replace('alert-danger', 'alert-warning');
                            }
                        }
                    }
                } catch(err) {
                    console.error("Duplicate check failed:", err);
                } finally {
                    state.checkingDuplicate = false;
                }
            });
        }

        element.querySelectorAll('.inp-dynamic').forEach(el => {
            const handleInput = (e) => {
                if (el.type === 'checkbox') {
                    state.data[el.name] = el.checked ? 'true' : 'false';
                } else if (el.type === 'number') {
                    state.data[el.name] = el.value === '' ? '' : parseFloat(el.value);
                } else {
                    state.data[el.name] = el.value;
                }
                updateVisibility();
                if (el.name.startsWith('rate_') || el.name === 'monthly_gmv') {
                    predictApproval();
                }
            };
            el.addEventListener('change', handleInput);
            el.addEventListener('input', handleInput);
        });

        element.querySelector('#btn-save-draft').addEventListener('click', () => saveLead('draft'));
        element.querySelector('#form-new-lead').addEventListener('submit', async (e) => {
            e.preventDefault();
            // Re-verify CR for race conditions
            const crVal = (state.data.cr_number || '').trim();
            if (crVal) {
                try {
                    const token = await auth.getToken();
                    const res = await fetch(`/api/sales/check-cr/${encodeURIComponent(crVal)}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const result = await res.json();
                    if (result.duplicateMerchant || result.duplicateLead) {
                        alert("A duplicate CR was found. Please rectify before submitting.");
                        return;
                    }
                } catch(e) {
                    console.error("Final CR check failed", e);
                }
            }
            saveLead('pending');
        });
    }

    function updateVisibility() {
        state.schemas.forEach(schema => {
            const sectionEl = element.querySelector(`#section-${schema.id}`);
            if (sectionEl) {
                const isSectionVisible = checkCondition(schema.condition);
                sectionEl.style.display = isSectionVisible ? 'block' : 'none';
            }

            (schema.fields || []).forEach(f => {
                const wrapper = element.querySelector(`#wrapper-${f.name}`);
                if (!wrapper) return;
                
                const isVisible = checkCondition(f.condition);
                wrapper.style.display = isVisible ? 'block' : 'none';
                
                const inp = wrapper.querySelector('.inp-dynamic');
                if (inp) {
                    if (isVisible && f.required) {
                        inp.required = true;
                    } else {
                        inp.required = false;
                    }
                }
            });
        });
    }
    
    function predictApproval() {
        const badge = element.querySelector('#predictive-badge');
        if (!badge) return;

        const gmv = parseFloat(state.data.monthly_gmv) || 0;
        let requiresApproval = false;
        let highestTier = null;

        // Evaluate across all tiers (already sorted by level descending)
        for (let tier of state.tiers) {
            let triggered = false;

            // 1. Check GMV
            if (tier.min_monthly_gmv > 0 && gmv < tier.min_monthly_gmv) {
                triggered = true;
            }

            // 2. Check Card Rates
            if (!triggered && tier.thresholds) {
                for (let card of state.cards) {
                    const fieldVal = state.data[`rate_${card.id}`];
                    // Skip if form field corresponds to missing rate
                    if (fieldVal !== undefined && fieldVal !== '') {
                        const proposed = parseFloat(fieldVal) || 0;
                        const th = tier.thresholds[card.id];
                        if (th !== undefined && proposed < th) {
                            triggered = true;
                            break;
                        }
                    }
                }
            }

            if (triggered) {
                highestTier = tier;
                requiresApproval = true;
                break; // Because tiers are sorted highest level first
            }
        }

        badge.classList.remove('d-none', 'badge-pale-success', 'badge-pale-warning', 'text-success', 'text-warning');
        
        if (requiresApproval && highestTier) {
            badge.classList.add('badge-pale-warning');
            badge.innerHTML = `<i class="bi bi-shield-exclamation me-1"></i>Pre-check: Requires ${highestTier.name} Approval`;
        } else if (gmv > 0 || Object.keys(state.data).some(k => k.startsWith('rate_') && state.data[k])) {
            badge.classList.add('badge-pale-success');
            badge.innerHTML = `<i class="bi bi-shield-check me-1"></i>Pre-check: Auto-Approved`;
        } else {
            badge.classList.add('d-none'); // Hide if nothing is filled
        }
    }

    function initMaps() {
        maps.forEach(m => {
            try { m.remove(); } catch(e) {}
        });
        maps = [];

        state.schemas.forEach(schema => {
            (schema.fields || []).forEach(f => {
                if (f.type === 'multi-map') {
                    const mapEl = element.querySelector(`#map-${f.name}`);
                    if (!mapEl) return;
                    
                    // Critical: Destroy existing map if it somehow survived innerHTML (unlikely but safe)
                    // or if initMaps was called twice on same DOM
                    if (mapEl._leaflet_id) {
                        return; // Already initialized on this specific DOM node
                    }

                    const map = L.map(mapEl).setView([24.7136, 46.6753], 5);
                    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
                        maxZoom: 19
                    }).addTo(map);

                    L.Control.geocoder({
                        defaultMarkGeocode: false,
                        placeholder: 'Search for a location...',
                        position: 'topleft'
                    }).on('markgeocode', function(e) {
                        map.fitBounds(e.geocode.bbox);
                    }).addTo(map);

                    const markersGroup = L.layerGroup().addTo(map);
                    let locations = [];
                    try {
                        const parsed = JSON.parse(state.data[f.name] || '[]');
                        if (Array.isArray(parsed)) locations = parsed;
                    } catch(e) {}

                    const renderPinsList = () => {
                        const listEl = element.querySelector(`#pins-${f.name}`);
                        if(listEl) {
                            listEl.innerHTML = locations.map((loc, idx) => `
                                <div class="badge bg-white border text-dark p-2 d-inline-flex align-items-center shadow-sm">
                                    <i class="bi bi-geo-alt-fill text-danger me-2"></i> 
                                    <span class="fw-normal">${loc.address || `Lat: ${loc.lat.toFixed(4)}, Lng: ${loc.lng.toFixed(4)}`}</span>
                                    <button type="button" class="btn-close ms-2" style="font-size: 0.65rem;" data-idx="${idx}"></button>
                                </div>
                            `).join('');
                            
                            listEl.querySelectorAll('.btn-close').forEach(btn => {
                                btn.addEventListener('click', (e) => {
                                    const idx = e.target.dataset.idx;
                                    locations.splice(idx, 1);
                                    updateMapData();
                                });
                            });
                        }
                    };

                    const updateMapData = () => {
                        markersGroup.clearLayers();
                        locations.forEach((loc, idx) => {
                            const marker = L.marker([loc.lat, loc.lng]).addTo(markersGroup);
                            marker.bindTooltip(`Location ${idx+1}`);
                        });
                        const hiddenInp = element.querySelector(`input[name="${f.name}"]`);
                        if (hiddenInp) {
                            hiddenInp.value = JSON.stringify(locations);
                            state.data[f.name] = hiddenInp.value;
                        }
                        renderPinsList();
                    };

                    updateMapData();

                    const pasteInp = element.querySelector(`#paste-${f.name}`);
                    if (pasteInp) {
                        pasteInp.addEventListener('input', (e) => {
                            const val = e.target.value.trim();
                            if (!val) return;
                            
                            let lat = null, lng = null;
                            const coordMatch = val.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
                            if (coordMatch) {
                                lat = parseFloat(coordMatch[1]);
                                lng = parseFloat(coordMatch[2]);
                            } else {
                                const atMatch = val.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                                if (atMatch) {
                                    lat = parseFloat(atMatch[1]);
                                    lng = parseFloat(atMatch[2]);
                                } else {
                                    const qMatch = val.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
                                    if (qMatch) {
                                        lat = parseFloat(qMatch[1]);
                                        lng = parseFloat(qMatch[2]);
                                    }
                                }
                            }
                            
                            if (lat !== null && lng !== null) {
                                map.setView([lat, lng], 15);
                                locations.push({ lat, lng, address: `Pasted: ${lat.toFixed(4)}, ${lng.toFixed(4)}` });
                                updateMapData();
                                e.target.value = '';
                            }
                        });
                    }

                    map.on('click', async (e) => {
                        const lat = e.latlng.lat;
                        const lng = e.latlng.lng;
                        
                        locations.push({ lat, lng, address: `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}` });
                        updateMapData();
                        
                        try {
                            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                            const data = await res.json();
                            if(data && data.display_name) {
                                // Just taking first two parts of address for brevity
                                locations[locations.length - 1].address = data.display_name.split(',').slice(0, 2).join(',');
                                updateMapData();
                            }
                        } catch(err) {
                            console.error("Reverse geocoding failed", err);
                        }
                    });

                    maps.push(map);
                }
            });
        });
    }

    function collectData() {
        const data = { ...state.data };
        element.querySelectorAll('.inp-dynamic').forEach(el => {
            // Robust visibility check
            const isVisible = el.type === 'hidden' || el.offsetParent !== null;
            if (!isVisible) return;

            if (el.tagName === 'INPUT' && el.type === 'checkbox') {
                data[el.name] = el.checked ? 'true' : 'false';
            } else if (el.tagName === 'INPUT' && el.type === 'number') {
                data[el.name] = el.value === '' ? '' : parseFloat(el.value);
            } else if (el.tagName === 'INPUT' && el.type === 'file') {
                if(el.files && el.files.length > 0) {
                    data[el.name] = el.files[0].name; // store standard file name for demo
                }
            } else if (el.name) {
                data[el.name] = el.value;
            }
        });
        return data;
    }

    async function saveLead(targetStatus) {
        if (state.saving || state.checkingDuplicate) return;
        
        const data = collectData();
        
        // Final validation before save
        if (targetStatus === 'pending') {
            if (!data.merchant_name || !data.cr_number) {
                alert("Please fill in Merchant Name and CR Number.");
                return;
            }
        }

        const btnSubmit = element.querySelector('#btn-save-submit');
        const btnDraft = element.querySelector('#btn-save-draft');
        const originalSubmit = btnSubmit ? btnSubmit.innerHTML : '';
        const originalDraft = btnDraft ? btnDraft.innerHTML : '';
        
        state.saving = true;
        if (targetStatus === 'pending' && btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
            if (btnDraft) btnDraft.disabled = true;
        } else if (targetStatus === 'draft' && btnDraft) {
            btnDraft.disabled = true;
            btnDraft.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
            if (btnSubmit) btnSubmit.disabled = true;
        }

        try {
            const currentUser = auth.currentUser;
            
            const payload = {
                ...data,
                merchant_name: data.merchant_name || 'Unnamed Merchant',
                cr_number: data.cr_number || 'N/A',
                country: data.country || 'N/A',
                custom_data: data,
                status: targetStatus,
                owner_id: currentUser ? currentUser.uid : 'anon',
                created_at: db.serverTimestamp(),
            };

            if (state.merchantContext) {
                payload.lead_type = state.merchantContext.action;
                payload.parent_merchant_id = state.merchantContext.id;
            }

            const leadRecord = await db.insert('leads', payload);
            
            if (targetStatus === 'pending') {
                try {
                    const token = await auth.getToken();
                    const res = await fetch('/api/sales/submit-lead', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ lead_id: leadRecord.id })
                    });
                    if (!res.ok) {
                        const errData = await res.json();
                        throw new Error(errData.error || errData.message || "Failed to submit for approval");
                    }
                } catch(backendErr) {
                    console.error("Backend processing failed:", backendErr);
                    // We still saved the lead as pending, so we don't necessarily want to fail everything,
                    // but it's better to warn the user.
                    alert("Lead saved but approval submission failed: " + backendErr.message);
                }
            }
            
            if(db.logAction) {
               db.logAction("Lead Created", `Lead created as ${targetStatus}`);
            }
            window.location.hash = 'leads';
        } catch(e) {
            console.error(e);
            alert("Failed to save: " + e.message);
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = originalSubmit;
            }
            if (btnDraft) {
                btnDraft.disabled = false;
                btnDraft.innerHTML = originalDraft;
            }
        } finally {
            state.saving = false;
        }
    }

    return view;
}
