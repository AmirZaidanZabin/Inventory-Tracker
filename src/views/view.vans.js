import { controller } from '../lib/controller.js';
import { firebase } from '../lib/firebase.js';
import { createModal } from '../lib/modal.js';
import { renderTable } from '../lib/table.js';

export function VansView() {
    const view = controller({
        stringComponent: `
            <div class="vans-view">
                <div class="d-flex justify-content-end mb-4">
                    <button id="open-add-van" class="btn-pico btn-pico-primary auth-vans:create hidden">
                        <i class="bi bi-plus-lg"></i>Add New VAN
                    </button>
                </div>

                <div class="card border-0 shadow-sm">
                    <div class="card-body p-0">
                        ${renderTable({
                            headers: ['VAN ID', 'Location', 'Created', 'Actions'],
                            tbodyId: 'vans-list',
                            emptyMessage: 'Loading fleet...'
                        })}
                    </div>
                </div>
            </div>
        `
    });

    view.onboard({ id: 'open-add-van' }).onboard({ id: 'vans-list' });

    view.trigger('click', 'open-add-van', async () => {
        const [usersSnap, formsSnap] = await Promise.all([
            firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'users')),
            firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'forms'))
        ]);
        const techs = [];
        usersSnap.forEach(u => techs.push(u.data()));

        const formSchemas = (formsSnap?.docs || []).map(d => d.data()).filter(f => f.entities && f.entities.includes('vans'));
        let customFieldsHtml = '';
        if(formSchemas.length > 0) {
            formSchemas.forEach(schema => {
                customFieldsHtml += `<div class="col-12 mt-3"><h6 class="text-accent mb-2 fw-bold border-bottom pb-1">${schema.name}</h6><div class="row g-2">`;
                schema.fields.forEach(f => {
                    const existingVal = ''; 
                    customFieldsHtml += `<div class="col-12">`;
                    customFieldsHtml += `<label class="form-label small fw-bold">${f.label} ${f.required?'<span class="text-danger">*</span>':''}</label>`;
                    if (f.type === 'textarea') {
                        customFieldsHtml += `<textarea name="custom_${f.name}" class="form-control form-control-sm" ${f.required?'required':''}></textarea>`;
                    } else if (f.type === 'select') {
                        customFieldsHtml += `<select name="custom_${f.name}" class="form-select form-select-sm" ${f.required?'required':''}>
                            <option value="">Select...</option>
                            ${(f.options||[]).map(o => `<option value="${o}">${o}</option>`).join('')}
                        </select>`;
                    } else if (f.type === 'checkbox') {
                        customFieldsHtml += `<div class="form-check">
                            <input type="checkbox" name="custom_${f.name}" class="form-check-input" value="true" ${f.required?'required':''}>
                            <label class="form-check-label small">Yes</label>
                        </div>`;
                    } else if (f.type === 'regex') {
                        customFieldsHtml += `<input type="text" name="custom_${f.name}" class="form-control form-control-sm font-monospace" pattern="${f.pattern||''}" value="${existingVal}" ${f.required?'required':''} placeholder="Matches pattern: ${f.pattern||''}">`;
                    } else {
                        const nativeType = ['email', 'tel', 'number', 'date'].includes(f.type) ? f.type : 'text';
                        customFieldsHtml += `<input type="${nativeType}" name="custom_${f.name}" class="form-control form-control-sm" value="${existingVal}" ${f.required?'required':''}>`;
                    }
                    customFieldsHtml += `</div>`;
                });
                customFieldsHtml += `</div></div>`;
            });
        }

        const techCheckboxes = techs.map(t => `
            <div class="form-check">
                <input class="form-check-input van-tech-chk" type="checkbox" value="${t.user_id}" id="chk-add-${t.user_id}">
                <label class="form-check-label small" for="chk-add-${t.user_id}">${t.user_name} <span class="text-muted">(${t.role_id})</span></label>
            </div>
        `).join('');

        const modal = createModal({
            title: 'Add New VAN',
            body: `
                <form id="add-van-form" class="row g-3">
                    <div class="col-12">
                        <label class="form-label small fw-bold">VAN ID</label>
                        <input type="text" name="van_id" class="form-control" placeholder="e.g. VAN-001" required>
                    </div>
                    <div class="col-12">
                        <label class="form-label small fw-bold">Location / City</label>
                        <input type="text" name="location_id" class="form-control" placeholder="e.g. Riyadh" required>
                    </div>
                    <div class="col-12">
                        <label class="form-label small fw-bold">Assigned Technicians</label>
                        <div class="border rounded p-2" style="max-height: 120px; overflow-y: auto;">
                            ${techCheckboxes}
                        </div>
                    </div>
                    ${customFieldsHtml}
                    <div class="col-12">
                        <label class="form-label small fw-bold">Coverage Area (Map Selection)</label>
                        <div id="van-map-picker" class="border rounded" style="height: 300px; width: 100%;"></div>
                        <input type="hidden" name="coverage_area" id="van-coverage">
                        <div class="small text-muted mt-1">Draw a polygon using the toolbar to set the coverage area.</div>
                    </div>
                    <div class="col-12 mt-4">
                        <button type="submit" class="btn-pico btn-pico-primary w-100">Create VAN</button>
                    </div>
                </form>
            `
        });

        modal.show();

        // Initialize Map
        const map = L.map('van-map-picker').setView([24.7136, 46.6753], 6); // Riyadh default
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
            maxZoom: 19
        }).addTo(map);

        // Add Search Geocoder
        L.Control.geocoder({
            defaultMarkGeocode: false,
            placeholder: 'Search for a city or region...',
            position: 'topleft'
        }).on('markgeocode', function(e) {
            map.fitBounds(e.geocode.bbox);
        }).addTo(map);

        const drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);
        
        const drawControl = new L.Control.Draw({
            edit: { featureGroup: drawnItems },
            draw: {
                polygon: true,
                polyline: false,
                circle: false,
                circlemarker: false,
                marker: false,
                rectangle: true
            }
        });
        map.addControl(drawControl);

        map.on(L.Draw.Event.CREATED, (e) => {
            drawnItems.clearLayers();
            const layer = e.layer;
            drawnItems.addLayer(layer);
            modal.element.querySelector('#van-coverage').value = JSON.stringify(layer.toGeoJSON());
        });

        map.on(L.Draw.Event.EDITED, (e) => {
            const layers = e.layers;
            layers.eachLayer((layer) => {
                modal.element.querySelector('#van-coverage').value = JSON.stringify(layer.toGeoJSON());
            });
        });

        map.on(L.Draw.Event.DELETED, () => {
            modal.element.querySelector('#van-coverage').value = '';
        });

        const form = modal.element.querySelector('#add-van-form');
        form.onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const data = Object.fromEntries(fd);
            
            const customData = {};
            for (const key in data) {
                if (key.startsWith('custom_')) {
                    customData[key.replace('custom_', '')] = data[key];
                    delete data[key];
                }
            }

            formSchemas.forEach(schema => {
                schema.fields.forEach(f => {
                    if (f.type === 'checkbox' && !fd.has('custom_' + f.name)) {
                        customData[f.name] = 'false';
                    }
                });
            });
            
            const assigned_users = Array.from(modal.element.querySelectorAll('.van-tech-chk:checked')).map(cb => cb.value);

            try {
                // Check if VAN already exists
                const vanRef = firebase.db.doc(firebase.db.db, 'vans', data.van_id);
                const vanDoc = await firebase.db.getDoc(vanRef);

                if (vanDoc.exists()) {
                    return alert(`Error: VAN with ID "${data.van_id}" already exists.`);
                }

                await firebase.db.setDoc(vanRef, {
                    ...data,
                    custom_data: customData,
                    assigned_users,
                    created_at: firebase.db.serverTimestamp(),
                    updated_at: firebase.db.serverTimestamp(),
                    is_deleted: false,
                    metadata: {}
                });
                firebase.logAction("VAN Created", `VAN ${data.van_id} added at ${data.location_id}`);
                modal.hide();
            } catch (err) {
                alert("Error adding VAN: " + err.message);
            }
        };
    });

    view.on('init', () => {
        view.emit('loading:start');
        view.unsub(firebase.db.subscribe(firebase.db.collection(firebase.db.db, 'vans'), (snap) => {
            view.delete('vans-list');
            const list = view.$('vans-list');
            view.emit('loading:end');
            if (!list) return;

            if (snap && snap.forEach) {
                snap.forEach(doc => {
                    const van = doc.data();
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td><code class="data-mono fw-bold">${van.van_id}</code></td>
                        <td>${van.location_id}</td>
                        <td class="small text-muted">${van.created_at?.toDate().toLocaleDateString() || '...'}</td>
                        <td>
                            <button class="btn-pico btn-pico-outline table-action-btn edit-van me-1" data-id="${van.van_id}">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn-pico btn-pico-danger-outline table-action-btn delete-van" data-id="${van.van_id}">
                                <i class="bi bi-trash"></i>
                            </button>
                        </td>
                    `;
                    
                    row.querySelector('.edit-van').addEventListener('click', async () => {
                        const usersSnap = await firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'users'));
                        const techs = [];
                        usersSnap.forEach(u => techs.push(u.data()));

                        const vanAssigned = van.assigned_users || [];
                        const techCheckboxes = techs.map(t => `
                            <div class="form-check">
                                <input class="form-check-input van-tech-chk-edit" type="checkbox" value="${t.user_id}" id="chk-edit-${van.van_id}-${t.user_id}" ${vanAssigned.includes(t.user_id) ? 'checked' : ''}>
                                <label class="form-check-label small" for="chk-edit-${van.van_id}-${t.user_id}">${t.user_name} <span class="text-muted">(${t.role_id})</span></label>
                            </div>
                        `).join('');

                        const modal = createModal({
                            title: 'Edit VAN',
                            body: `
                                <form id="edit-van-form" class="row g-3">
                                    <div class="col-12">
                                        <label class="form-label small fw-bold">VAN ID</label>
                                        <input type="text" class="form-control" value="${van.van_id}" disabled>
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label small fw-bold">Location / City</label>
                                        <input type="text" name="location_id" class="form-control" value="${van.location_id}" required>
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label small fw-bold">Assigned Technicians</label>
                                        <div class="border rounded p-2" style="max-height: 120px; overflow-y: auto;">
                                            ${techCheckboxes}
                                        </div>
                                    </div>
                                    <div id="edit-custom-fields-container"></div>
                                    <div class="col-12">
                                        <label class="form-label small fw-bold">Coverage Area (Map Selection)</label>
                                        <div id="van-map-picker-edit" class="border rounded" style="height: 300px; width: 100%;"></div>
                                        <input type="hidden" name="coverage_area" id="van-coverage-edit" value='${van.coverage_area || ''}'>
                                        <div class="small text-muted mt-1">Use the toolbar to edit or redraw the coverage area.</div>
                                    </div>
                                <div class="col-12 mt-4">
                                    <button type="submit" class="btn-pico btn-pico-primary w-100">Save Changes</button>
                                </div>
                            </form>
                        `
                    });
                    modal.show();

                    // Render Custom Fields for Edit
                    const editFormsSnap = await firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'forms'));
                    const editFormSchemas = (editFormsSnap?.docs || []).map(d => d.data()).filter(f => f.entities && f.entities.includes('vans'));
                    const editCfContainer = modal.element.querySelector('#edit-custom-fields-container');
                    if (editCfContainer && editFormSchemas.length > 0) {
                        let cfHtml = '';
                        editFormSchemas.forEach(schema => {
                            cfHtml += `<div class="col-12 mt-3"><h6 class="text-accent mb-2 fw-bold border-bottom pb-1">${schema.name}</h6><div class="row g-2">`;
                            schema.fields.forEach(f => {
                                const existingVal = van.custom_data?.[f.name] || '';
                                cfHtml += `<div class="col-12">`;
                                cfHtml += `<label class="form-label small fw-bold">${f.label} ${f.required?'<span class="text-danger">*</span>':''}</label>`;
                                if (f.type === 'textarea') {
                                    cfHtml += `<textarea name="custom_${f.name}" class="form-control form-control-sm" ${f.required?'required':''}>${existingVal}</textarea>`;
                                } else if (f.type === 'select') {
                                    cfHtml += `<select name="custom_${f.name}" class="form-select form-select-sm" ${f.required?'required':''}>
                                        <option value="">Select...</option>
                                        ${(f.options||[]).map(o => `<option value="${o}" ${existingVal===o?'selected':''}>${o}</option>`).join('')}
                                    </select>`;
                                } else if (f.type === 'checkbox') {
                                    cfHtml += `<div class="form-check">
                                        <input type="checkbox" name="custom_${f.name}" class="form-check-input" value="true" ${existingVal==='true'?'checked':''} ${f.required?'required':''}>
                                        <label class="form-check-label small">Yes</label>
                                    </div>`;
                                } else if (f.type === 'regex') {
                                    cfHtml += `<input type="text" name="custom_${f.name}" class="form-control form-control-sm font-monospace" pattern="${f.pattern||''}" value="${existingVal}" ${f.required?'required':''} placeholder="Matches pattern: ${f.pattern||''}">`;
                                } else {
                                    const nativeType = ['email', 'tel', 'number', 'date'].includes(f.type) ? f.type : 'text';
                                    cfHtml += `<input type="${nativeType}" name="custom_${f.name}" class="form-control form-control-sm" value="${existingVal}" ${f.required?'required':''}>`;
                                }
                                cfHtml += `</div>`;
                            });
                            cfHtml += `</div></div>`;
                        });
                        editCfContainer.innerHTML = cfHtml;
                    }

                    // Initialize Map for Edit
                    const map = L.map('van-map-picker-edit').setView([van.default_lat || 24.7136, van.default_lng || 46.6753], 10);
                    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
                        maxZoom: 19
                    }).addTo(map);

                    // Add Search Geocoder
                    L.Control.geocoder({
                        defaultMarkGeocode: false,
                        placeholder: 'Search for a city or region...',
                        position: 'topleft'
                    }).on('markgeocode', function(e) {
                        map.fitBounds(e.geocode.bbox);
                    }).addTo(map);
                    
                    const drawnItems = new L.FeatureGroup();
                    map.addLayer(drawnItems);
                    
                    if (van.coverage_area) {
                        try {
                            const geoData = JSON.parse(van.coverage_area);
                            const layer = L.geoJSON(geoData);
                            layer.eachLayer(l => drawnItems.addLayer(l));
                            map.fitBounds(drawnItems.getBounds());
                        } catch(e) { console.error("Could not parse coverage area", e); }
                    }

                    const drawControl = new L.Control.Draw({
                        edit: { featureGroup: drawnItems },
                        draw: { polygon: true, polyline: false, circle: false, circlemarker: false, marker: false, rectangle: true }
                    });
                    map.addControl(drawControl);

                    map.on(L.Draw.Event.CREATED, (e) => {
                        drawnItems.clearLayers();
                        const layer = e.layer;
                        drawnItems.addLayer(layer);
                        modal.element.querySelector('#van-coverage-edit').value = JSON.stringify(layer.toGeoJSON());
                    });

                    map.on(L.Draw.Event.EDITED, (e) => {
                        const layers = e.layers;
                        layers.eachLayer((layer) => {
                            modal.element.querySelector('#van-coverage-edit').value = JSON.stringify(layer.toGeoJSON());
                        });
                    });

                    map.on(L.Draw.Event.DELETED, () => {
                        modal.element.querySelector('#van-coverage-edit').value = '';
                    });

                    const form = modal.element.querySelector('#edit-van-form');
                    form.onsubmit = async (e) => {
                        e.preventDefault();
                        const fd = new FormData(form);
                        const assigned_users = Array.from(modal.element.querySelectorAll('.van-tech-chk-edit:checked')).map(cb => cb.value);

                        try {
                            const customData = van.custom_data || {};
                            for (let [key, val] of fd.entries()) {
                                if (key.startsWith('custom_')) {
                                    customData[key.replace('custom_', '')] = val;
                                }
                            }
                            // Handle checkboxes
                            editFormSchemas.forEach(schema => {
                                schema.fields.forEach(f => {
                                    if (f.type === 'checkbox' && !fd.has('custom_' + f.name)) {
                                        customData[f.name] = 'false';
                                    }
                                });
                            });

                            await firebase.db.updateDoc(firebase.db.doc(firebase.db.db, 'vans', van.van_id), {
                                location_id: fd.get('location_id'),
                                coverage_area: fd.get('coverage_area'),
                                assigned_users,
                                custom_data: customData,
                                updated_at: firebase.db.serverTimestamp()
                            });
                            firebase.logAction("VAN Updated", `VAN ${van.van_id} updated with location ${fd.get('location_id')}`);
                            modal.hide();
                        } catch (err) { alert(err.message); }
                    };
                });

                row.querySelector('.delete-van').addEventListener('click', () => {
                    const modal = createModal({
                        title: 'Confirm Deletion',
                        body: `
                            <p>Are you sure you want to delete this VAN? This action cannot be undone.</p>
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
                            await firebase.db.deleteDoc(firebase.db.doc(firebase.db.db, 'vans', van.van_id));
                            firebase.logAction("VAN Deleted", `VAN ${van.van_id} removed`);
                        } catch (err) {
                            alert("Delete failed: " + err.message);
                        }
                    };
                    modal.show();
                });

                list.appendChild(row);
            });
            }
        }));
    });

    return view;
}
