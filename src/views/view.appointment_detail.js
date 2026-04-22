import { controller } from '../lib/controller.js';
import { firebase } from '../lib/firebase.js';
import { createModal } from '../lib/modal.js';

export function AppointmentDetailView(appointmentId) {
    const view = controller({
        stringComponent: `
            <div class="appointment-detail">
                <div class="row g-4">
                    <div class="col-lg-4">
                        <div class="card mb-4">
                            <div class="card-header">Job Info</div>
                            <div class="card-body">
                                <h4 id="det-name" class="fw-bold">...</h4>
                                <div id="det-id" class="text-muted small mb-3"></div>
                                <div class="mb-2"><i class="bi bi-calendar me-2"></i><span id="det-date"></span></div>
                                <div class="mb-2"><i class="bi bi-clock me-2"></i><span id="det-time"></span></div>
                                <div class="mb-2"><i class="bi bi-geo-alt me-2"></i><span id="det-location"></span></div>
                                <div class="mb-2"><i class="bi bi-person me-2"></i><span id="det-tech"></span></div>
                                <div class="mb-2"><i class="bi bi-box-seam me-2"></i><span id="det-products"></span></div>
                                <div id="det-products-list" class="mt-2 mb-2 p-2 bg-light rounded" style="max-height: 150px; overflow-y: auto;"></div>
                                <div id="det-status" class="badge bg-warning text-dark mt-2"></div>
                                <button id="delete-apt-btn" class="btn btn-outline-danger btn-sm w-100 mt-3 auth-admin hidden">
                                    <i class="bi bi-trash me-2"></i>Delete Appointment
                                </button>
                            </div>
                        </div>
                        <div class="card mb-4">
                            <div class="card-header">Location</div>
                            <div class="card-body p-0">
                                <div id="apt-detail-map" style="height: 200px; width: 100%;"></div>
                            </div>
                        </div>
                        <div class="card">
                            <div class="card-header">Required Hardware (Frozen from Booking)</div>
                            <div class="card-body">
                                <div id="required-hardware-snapshot" class="mb-3"></div>
                                <hr>
                                <div class="small fw-bold mb-1">Status:</div>
                                <div id="hardware-list-display" class="small text-muted">Awaiting completion...</div>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-8">
                        <div class="card mb-4">
                            <div class="card-header">Job Execution & Hardware Pairing</div>
                            <div class="card-body">
                                <div class="mb-4">
                                    <label class="form-label fw-bold">Scan & Pair Hardware (Must match requirements)</label>
                                    <div class="row g-2">
                                        <div class="col-md-4">
                                            <div class="p-2 border rounded bg-light" style="height: 350px; overflow-y: auto;">
                                                <div class="small fw-bold mb-2">Technician Van Stock</div>
                                                <div id="available-hardware" class="d-flex flex-column gap-1"></div>
                                            </div>
                                        </div>
                                        <div class="col-md-8">
                                            <div class="d-flex justify-content-between align-items-center mb-2">
                                                <div class="small fw-bold">Installation Audit Slots</div>
                                                <div class="text-xs text-muted">Drag stock into specific slots</div>
                                            </div>
                                            <div id="hardware-slots-container" class="d-flex flex-column gap-2" style="max-height: 350px; overflow-y: auto;">
                                                <!-- Dynamic requirement slots go here -->
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="mb-4">
                                    <label class="form-label fw-bold">Photos (URLs)</label>
                                    <div class="input-group mb-2">
                                        <input type="text" id="photo-url" class="form-control" placeholder="Paste photo URL...">
                                        <button id="add-photo" class="btn btn-dark">Add</button>
                                    </div>
                                    <div id="photo-list" class="d-flex flex-wrap gap-2 mt-3"></div>
                                </div>
                                <div class="mb-4">
                                    <label class="form-label fw-bold">Customer Signature</label>
                                    <div id="sig-pad" class="border rounded bg-light" style="height: 150px; cursor: crosshair;">
                                        <div class="h-100 d-flex align-items-center justify-content-center text-muted small">
                                            [ Signature Pad Placeholder ]
                                        </div>
                                    </div>
                                    <button id="clear-sig" class="btn btn-sm btn-link text-danger mt-1">Clear</button>
                                </div>
                                <div class="mb-4">
                                    <label class="form-label fw-bold">Completion Description</label>
                                    <textarea id="completion-desc" class="form-control" rows="3" placeholder="Enter details about the completed job..."></textarea>
                                </div>
                                <button id="complete-job" class="btn btn-success w-100 py-3 fw-bold">
                                    <i class="bi bi-check-circle me-2"></i>Complete & Close Job
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `
    });

    view.onboard({ id: 'det-name' }).onboard({ id: 'det-id' }).onboard({ id: 'det-date' })
        .onboard({ id: 'det-time' }).onboard({ id: 'det-location' })
        .onboard({ id: 'det-tech' }).onboard({ id: 'det-status' })
        .onboard({ id: 'photo-url' }).onboard({ id: 'add-photo' })
        .onboard({ id: 'photo-list' }).onboard({ id: 'complete-job' }).onboard({ id: 'completion-desc' })
        .onboard({ id: 'delete-apt-btn' })
        .onboard({ id: 'available-hardware' })
        .onboard({ id: 'hardware-pairs' })
        .onboard({ id: 'add-pair-btn' })
        .onboard({ id: 'hardware-list-display' });

    let photos = [];

    view.trigger('click', 'add-photo', () => {
        const urlInput = view.$('photo-url');
        const url = urlInput ? urlInput.value : '';
        if (!url) return;
        photos.push(url);
        const img = document.createElement('img');
        img.src = url;
        img.className = 'rounded border';
        img.style = 'width: 100px; height: 100px; object-fit: cover;';
        const list = view.$('photo-list');
        if (list) list.appendChild(img);
        if (urlInput) urlInput.value = '';
    });

    let hardwareSlots = []; // { id, catalog_id, item_name, assigned_id, assigned_type }

    const renderHardwareSlots = () => {
        const container = view.$('hardware-slots-container');
        if(!container) return;
        container.innerHTML = '';
        
        hardwareSlots.forEach((slot, index) => {
            const div = document.createElement('div');
            div.className = 'border rounded p-2 bg-white d-flex align-items-center gap-2';
            div.innerHTML = `
                <div class="flex-grow-1">
                    <div class="text-xs fw-bold text-accent">${slot.item_name}</div>
                    <div class="text-xxs text-muted">ID: ${slot.catalog_id}</div>
                </div>
                <div class="drop-slot border-dashed p-2 text-center small rounded flex-grow-1" 
                     id="slot-${index}" 
                     style="border: 2px dashed ${slot.assigned_id ? '#22c55e' : '#cbd5e1'}; min-width: 150px; background: ${slot.assigned_id ? '#f0fdf4' : ''}">
                    ${slot.assigned_id ? `<span class="badge bg-success">${slot.assigned_id}</span>` : `<span class="text-muted text-xs">Drop ${slot.item_name} here</span>`}
                </div>
                ${slot.assigned_id ? `<button class="btn btn-sm text-danger clear-slot-btn" data-index="${index}"><i class="bi bi-x-circle"></i></button>` : ''}
            `;
            container.appendChild(div);

            const dropEl = div.querySelector(`#slot-${index}`);
            dropEl.ondragover = (e) => e.preventDefault();
            dropEl.ondrop = (e) => {
                e.preventDefault();
                const draggedId = e.dataTransfer.getData('id');
                const draggedCatalogId = e.dataTransfer.getData('catalog_id');

                if (draggedCatalogId === slot.catalog_id) {
                    slot.assigned_id = draggedId;
                    renderHardwareSlots();
                } else {
                    alert(`Invalid Hardware. Slot requires [${slot.catalog_id}], but you attempted to deploy [${draggedCatalogId}].`);
                }
            };

            if (slot.assigned_id) {
                div.querySelector('.clear-slot-btn').onclick = () => {
                    slot.assigned_id = null;
                    renderHardwareSlots();
                };
            }
        });
    };

    view.trigger('click', 'delete-apt-btn', async () => {
        const modal = createModal({
            title: 'Confirm Deletion',
            body: `
                <p>Are you sure you want to delete this appointment?</p>
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
                // Fetch appointment to check its status and hardware
                const docSnap = await firebase.db.getDoc(firebase.db.doc(firebase.db.db, 'appointments', appointmentId));
                if (docSnap.exists()) {
                    const apt = docSnap.data();
                    
                    // If appointment is not complete, free up hardware (wait, actually completion assigns it now)
                    // But if it was completely deployed, we might want to un-deploy. 
                    // Let's release ALL tracked hardware in this appointment array.
                    if (apt.status !== 'completed' && apt.metadata && Array.isArray(apt.metadata.hardware)) {
                        const updates = [];
                        apt.metadata.hardware.forEach(pair => {
                            if (pair.pico_id) {
                                updates.push(firebase.db.updateDoc(firebase.db.doc(firebase.db.db, 'items', pair.pico_id), {
                                    status: 'available',
                                    is_available: true,
                                    current_location_type: 'WAREHOUSE',
                                    current_location_id: ''
                                }));
                            }
                            if (pair.sim_id) {
                                updates.push(firebase.db.updateDoc(firebase.db.doc(firebase.db.db, 'items', pair.sim_id), {
                                    status: 'available',
                                    is_available: true,
                                    current_location_type: 'WAREHOUSE',
                                    current_location_id: ''
                                }));
                            }
                        });
                        
                        if (updates.length > 0) {
                            await Promise.all(updates);
                            console.log("Hardware released to available.");
                        }
                    }
                }

                await firebase.db.updateDoc(firebase.db.doc(firebase.db.db, 'appointments', appointmentId), { is_deleted: true });
                window.location.hash = '#appointments';
            } catch (err) {
                console.error('Delete failed:', err.message);
            }
        };
        modal.show();
    });
    
    view.trigger('click', 'complete-job', async () => {
        const completionDesc = view.$('completion-desc').value;
        const incomplete = hardwareSlots.some(s => !s.assigned_id);

        if (incomplete) {
            return alert("Job Integrity Error: You must assign all required hardware types as per the booking snapshot before completing.");
        }

        const modal = createModal({
            title: 'Confirm Job Completion',
            body: `
                <p>Are you sure you want to complete this job? Correct inventory associations will be saved.</p>
                <div class="d-flex justify-content-end gap-2 mt-4">
                    <button type="button" class="btn-pico btn-pico-outline cancel-btn">Cancel</button>
                    <button type="button" class="btn-pico btn-pico-primary confirm-btn">Complete & Save</button>
                </div>
            `
        });
        
        modal.element.querySelector('.cancel-btn').onclick = () => modal.hide();
        modal.element.querySelector('.confirm-btn').onclick = async () => {
            modal.hide();
            try {
                // Batch update items as assigned
                const itemUpdates = [];
                const location_string = view.$('det-id').textContent;
                
                hardwareSlots.forEach(slot => {
                    itemUpdates.push(firebase.db.updateDoc(firebase.db.doc(firebase.db.db, 'items', slot.assigned_id), { 
                        is_available: false, 
                        status: 'assigned', 
                        current_location_type: 'APPOINTMENT', 
                        current_location_id: location_string 
                    }));
                });
                
                if(itemUpdates.length > 0) {
                    await Promise.all(itemUpdates);
                }

                // Prepare hardware results (legacy support for pair format if needed, but going generic)
                const deployedHw = hardwareSlots.map(s => ({ catalog_id: s.catalog_id, item_id: s.assigned_id }));

                await firebase.db.updateDoc(firebase.db.doc(firebase.db.db, 'appointments', appointmentId), {
                    status: 'completed',
                    'metadata.hardware': deployedHw,
                    'metadata.photos': photos,
                    'metadata.completion_description': completionDesc,
                    'metadata.completed_at': firebase.db.serverTimestamp()
                });
                firebase.logAction("Job Completed", `Appointment ${appointmentId} closed with ${deployedHw.length} items.`);
                window.location.hash = '#appointments';
            } catch (err) {
                console.error('Completion failed:', err.message);
                alert("Completion failed: " + err.message);
            }
        };
        modal.show();
    });

    view.on('init', () => {
        let map;
        view.emit('loading:start');
        
        const renderAvailableHardwareList = async () => {
            const listEl = view.$('available-hardware');
            if(!listEl) return;
            listEl.innerHTML = '';

            const catalogSnap = await firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'item_catalog'));
            const catalogMap = {};
            catalogSnap.forEach(doc => {
                const c = doc.data();
                catalogMap[c.catalog_id || c.id] = c.item_type;
            });

            const itemsRes = await firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'items'));
            itemsRes.docs.forEach(doc => {
                const item = doc.data();
                const isAvail = item.status === 'available' || (!item.status && item.is_available);
                if (!isAvail) return;

                const el = document.createElement('div');
                el.className = 'p-2 bg-white border rounded small cursor-move mb-1';
                el.draggable = true;
                const displayType = catalogMap[item.catalog_id] || 'Unknown';
                el.textContent = `${displayType}: ${item.item_id}`;
                el.dataset.id = item.item_id;
                el.dataset.type = displayType;
                el.dataset.catalogId = item.catalog_id; // PASS CATALOG ID FOR VALIDATION

                el.ondragstart = (e) => {
                    e.dataTransfer.setData('id', el.dataset.id);
                    e.dataTransfer.setData('type', el.dataset.type);
                    e.dataTransfer.setData('catalog_id', el.dataset.catalogId);
                };
                listEl.appendChild(el);
            });
        };

        let initialLoadDone = false;

        view.unsub(firebase.db.subscribe(firebase.db.doc(firebase.db.db, 'appointments', appointmentId), (snap) => {
            if (!snap.exists()) return;
            const apt = snap.data();
            
            renderAvailableHardwareList();

            // Render Required Snapshot (Instruction 4)
            const snapshotEl = view.$('required-hardware-snapshot');
            if (snapshotEl && apt.metadata?.required_hardware) {
                const reqs = apt.metadata.required_hardware;
                snapshotEl.innerHTML = reqs.map(r => `
                    <div class="d-flex justify-content-between align-items-center mb-1 text-xs">
                        <span><i class="bi bi-tag-fill me-1"></i>${r.item_name}</span>
                        <span class="badge bg-pale-secondary text-dark">${r.count} required</span>
                    </div>
                `).join('') || '<div class="text-muted small">No hardware requirements frozen for this booking.</div>';

                // Initialize Slots ONLY once
                if (!initialLoadDone && apt.status !== 'completed' && hardwareSlots.length === 0) {
                    reqs.forEach(r => {
                        for(let i=0; i<r.count; i++) {
                            hardwareSlots.push({ catalog_id: r.catalog_id, item_name: r.item_name, assigned_id: null });
                        }
                    });
                    renderHardwareSlots();
                    initialLoadDone = true;
                }
            }

            const nameEl = view.$('det-name');
            const idEl = view.$('det-id');
            const dateEl = view.$('det-date');
            const timeEl = view.$('det-time');
            const locEl = view.$('det-location');
            const techEl = view.$('det-tech');
            const prodEl = view.$('det-products');
            const statusEl = view.$('det-status');

            if(nameEl) nameEl.textContent = apt.appointment_name;
            if(idEl) idEl.textContent = apt.appointment_id;
            if(dateEl) dateEl.textContent = apt.schedule_date;
            if(timeEl) timeEl.textContent = `${apt.appointment_time || 'N/A'} (${apt.metadata?.duration_minutes || 60}m)`;
            if(locEl) locEl.textContent = apt.location_name || 'N/A';
            if(techEl) techEl.textContent = apt.tech_id;
            if(prodEl) {
                const p = apt.metadata?.products;
                if(!p || p.length === 0) {
                    prodEl.textContent = "No Products Selected";
                } else {
                    prodEl.textContent = `${p.length} Product(s) [Total Effort: ${apt.metadata?.duration_minutes || 0} min]`;
                }
            }
            if(statusEl) statusEl.textContent = apt.status;

            // Render Product Breakdown (Instruction 4)
            const productsBreakdown = view.$('det-products-list');
            if (productsBreakdown && apt.metadata?.products) {
                const pIds = apt.metadata.products;
                firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'product_types')).then(snap => {
                    const products = snap.docs.map(d => ({id: d.id, ...d.data()})).filter(pt => pIds.includes(pt.id));
                    productsBreakdown.innerHTML = products.map(pt => `
                        <div class="small d-flex justify-content-between border-bottom py-1">
                            <span>${pt.name}</span>
                            <span class="text-muted">${pt.duration_minutes} min</span>
                        </div>
                    `).join('') || '<div class="small text-muted">No specific product data found.</div>';
                });
            }
            
            // Render array of hardware
            const hwArray = apt.metadata?.hardware || [];
            const hwDisplay = view.$('hardware-list-display');
            if (hwDisplay) {
                if (apt.status === 'completed' && Array.isArray(hwArray) && hwArray.length > 0) {
                    hwDisplay.innerHTML = hwArray.map((hw, i) => `
                        <div class="mb-2 p-2 border rounded">
                            <strong>Item ${i+1}:</strong><br>
                            Type: <span class="badge bg-secondary">${hw.catalog_id || 'N/A'}</span><br>
                            Serial: <span class="badge bg-primary">${hw.item_id || 'N/A'}</span>
                        </div>
                    `).join('');
                } else if (apt.status === 'completed') {
                    hwDisplay.innerHTML = 'No hardware assigned.';
                } else {
                    hwDisplay.innerHTML = '<span class="text-warning">Awaiting deployment...</span>';
                }
            }
            
            if (apt.metadata?.location && apt.metadata.location.lat) {
                if (!map) {
                    const mapEl = document.getElementById('apt-detail-map');
                    if (mapEl) {
                        map = L.map('apt-detail-map').setView([apt.metadata.location.lat, apt.metadata.location.lng], 13);
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
                    }
                }
                if (map) L.marker([apt.metadata.location.lat, apt.metadata.location.lng]).addTo(map);
            }
            
            if (apt.status === 'completed') {
                const completeBtn = view.$('complete-job');
                if(completeBtn) {
                    completeBtn.disabled = true;
                    completeBtn.textContent = 'Job Already Completed';
                }
                if(statusEl) statusEl.className = 'badge bg-success';
                const descEl = view.$('completion-desc');
                if(descEl) {
                    descEl.value = apt.metadata?.completion_description || '';
                    descEl.disabled = true;
                }
                const addPairBtn = view.$('add-pair-btn');
                    if(addPairBtn) addPairBtn.style.display = 'none';
                const hwSlots = view.$('hardware-slots-container');
                    if(hwSlots) hwSlots.style.display = 'none';
                const availHw = view.$('available-hardware');
                    if(availHw && availHw.parentElement) availHw.parentElement.style.display = 'none';
            }
            
            document.dispatchEvent(new CustomEvent('apply-auth'));
            view.emit('loading:end');
        }));
    });

    return view;
}
