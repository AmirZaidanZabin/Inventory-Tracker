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
                            <div class="card-header">Hardware Assigned</div>
                            <div class="card-body">
                                <div id="hardware-list-display" class="small text-muted">Awaiting completion...</div>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-8">
                        <div class="card mb-4">
                            <div class="card-header">Job Execution</div>
                            <div class="card-body">
                                <div class="mb-4">
                                    <label class="form-label fw-bold">Deploy Hardware (Drag to Pair Slots)</label>
                                    <div class="row g-2">
                                        <div class="col-md-5">
                                            <div class="p-2 border rounded bg-light" style="height: 250px; overflow-y: auto;">
                                                <div class="small fw-bold mb-2">Available DB Hardware</div>
                                                <div id="available-hardware" class="d-flex flex-column gap-1"></div>
                                            </div>
                                        </div>
                                        <div class="col-md-7">
                                            <div class="d-flex justify-content-between align-items-center mb-2">
                                                <div class="small fw-bold">Required Hardware Slots</div>
                                            </div>
                                            <div id="hardware-pairs" class="d-flex flex-column gap-2" style="max-height: 250px; overflow-y: auto;">
                                                <!-- Dynamic pair slots go here -->
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

    let hardwarePairsAssigned = [];

    const renderHardwarePairs = () => {
        const container = view.$('hardware-pairs');
        if(!container) return;
        container.innerHTML = '';
        hardwarePairsAssigned.forEach(group => {
            const slotHtml = document.createElement('div');
            slotHtml.className = 'border rounded p-2 bg-white d-flex flex-column gap-2 mb-2';
            
            let dropZones = group.requirements.map(reqType => {
                const assignedId = group.assigned_items[reqType];
                return `
                    <div class="drop-slot border-dashed p-2 text-center small rounded flex-grow-1" data-group="${group.id}" data-type="${reqType}" style="border: 1px dashed #ccc; min-width: 100px;">
                        ${assignedId ? `<span class="badge bg-primary">${assignedId}</span>` : `Drop ${reqType}`}
                    </div>
                `;
            }).join('');

            slotHtml.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <div class="fw-bold small text-muted">Slot ${group.id}</div>
                </div>
                <div class="d-flex flex-wrap gap-2 w-100">
                    ${dropZones}
                </div>
            `;
            container.appendChild(slotHtml);

            // Bind drag over and drop
            group.requirements.forEach(reqType => {
                const dropEl = slotHtml.querySelector(`.drop-slot[data-group="${group.id}"][data-type="${reqType}"]`);
                dropEl.ondragover = (e) => e.preventDefault();
                dropEl.ondrop = (e) => {
                    e.preventDefault();
                    const draggedId = e.dataTransfer.getData('id');
                    const draggedType = e.dataTransfer.getData('type');

                    if (draggedType === reqType) {
                        group.assigned_items[reqType] = draggedId;
                        renderHardwarePairs();
                    } else {
                        alert(`Invalid slot for ${draggedType}. Please drop in the ${reqType} slot.`);
                    }
                };
            });
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
                        apt.metadata.hardware.forEach(hwObj => {
                            Object.values(hwObj).forEach(itemId => {
                                if (itemId) {
                                    updates.push(firebase.db.updateDoc(firebase.db.doc(firebase.db.db, 'items', itemId), {
                                        status: 'available',
                                        is_available: true,
                                        location_name: ''
                                    }));
                                }
                            });
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
        const validPairs = hardwarePairsAssigned.filter(g => g.requirements.every(req => g.assigned_items[req]));
        const isIncomplete = validPairs.length !== hardwarePairsAssigned.length || hardwarePairsAssigned.length === 0;

        const modal = createModal({
            title: isIncomplete ? 'Warning: Incomplete Hardware' : 'Confirm Job Completion',
            body: `
                ${isIncomplete ? '<p class="text-danger fw-bold"><i class="bi bi-exclamation-triangle me-2"></i>Some hardware pairs are incomplete or missing.</p>' : ''}
                <p>Are you sure you want to complete this job ${isIncomplete ? 'without fully deploying hardware' : ''}?</p>
                <div class="d-flex justify-content-end gap-2 mt-4">
                    <button type="button" class="btn-pico btn-pico-outline cancel-btn">Cancel</button>
                    <button type="button" class="btn-pico ${isIncomplete ? 'btn-pico-warning' : 'btn-pico-primary'} confirm-btn">Complete Anyway</button>
                </div>
            `
        });
        
        modal.element.querySelector('.cancel-btn').onclick = () => modal.hide();
        modal.element.querySelector('.confirm-btn').onclick = async () => {
            modal.hide();
            try {
                // Batch update items as assigned
                const itemUpdates = [];
                validPairs.forEach(group => {
                    group.requirements.forEach(reqType => {
                        const itemId = group.assigned_items[reqType];
                        itemUpdates.push(firebase.db.updateDoc(firebase.db.doc(firebase.db.db, 'items', itemId), { is_available: false, status: 'assigned', location_name: view.$('det-location').textContent }));
                    });
                });
                
                if(itemUpdates.length > 0) {
                    await Promise.all(itemUpdates);
                }

                const hwPayload = validPairs.map(g => g.assigned_items);

                await firebase.db.updateDoc(firebase.db.doc(firebase.db.db, 'appointments', appointmentId), {
                    status: 'completed',
                    'metadata.hardware': hwPayload,
                    'metadata.photos': photos,
                    'metadata.completion_description': completionDesc,
                    'metadata.completed_at': firebase.db.serverTimestamp()
                });
                firebase.logAction("Job Completed", `Appointment ${appointmentId} closed: ${completionDesc}`);
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
        
        // Fetch and render available hardware to the list
        const renderAvailableHardwareList = async () => {
            const listEl = view.$('available-hardware');
            if(!listEl) return;
            listEl.innerHTML = '';
            const itemsRes = await firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'items'));
            itemsRes.docs.forEach(doc => {
                const item = doc.data();
                const isAvail = item.status === 'available' || (!item.status && item.is_available);
                if (!isAvail) return;

                const el = document.createElement('div');
                el.className = 'p-2 bg-white border rounded small cursor-move mb-1';
                el.draggable = true;
                const displayType = item.item_type || 'Unknown';
                el.textContent = `${displayType}: ${item.item_id}`;
                el.dataset.id = item.item_id;
                el.dataset.type = displayType;

                el.ondragstart = (e) => {
                    e.dataTransfer.setData('id', el.dataset.id);
                    e.dataTransfer.setData('type', el.dataset.type);
                };
                listEl.appendChild(el);
            });
        };
        view.unsub(firebase.db.subscribe(firebase.db.doc(firebase.db.db, 'appointments', appointmentId), (snap) => {
            if (!snap.exists()) return;
            const apt = snap.data();
            
            // Initialize hardwarePairsAssigned from appointment metadata
            if (hardwarePairsAssigned.length === 0 && apt.metadata && Array.isArray(apt.metadata.hardware)) {
                hardwarePairsAssigned = apt.metadata.hardware.map((hw, index) => {
                    return {
                        id: index + 1,
                        requirements: Object.keys(hw),
                        assigned_items: { ...hw }
                    };
                });
            }
            renderAvailableHardwareList();
            renderHardwarePairs();

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
                    // Ideally we fetch product_types but storing count or ID is fine for now
                    prodEl.textContent = p.length + " Product(s) Selected";
                }
            }
            if(statusEl) statusEl.textContent = apt.status;
            
            // Render array of hardware
            const hwArray = apt.metadata?.hardware || [];
            const hwDisplay = view.$('hardware-list-display');
            if (hwDisplay) {
                if (apt.status === 'completed' && Array.isArray(hwArray) && hwArray.length > 0) {
                    hwDisplay.innerHTML = hwArray.map((hw, i) => {
                        const keysStr = Object.keys(hw).map(k => `${k}: <span class="badge bg-primary">${hw[k] || 'N/A'}</span>`).join('<br>');
                        return `
                            <div class="mb-2 p-2 border rounded">
                                <strong>Slot ${i+1}:</strong><br>
                                ${keysStr}
                            </div>
                        `;
                    }).join('');
                } else if (apt.status === 'completed') {
                    hwDisplay.innerHTML = 'No hardware assigned.';
                } else {
                    hwDisplay.innerHTML = 'Awaiting completion...';
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
                const hwPairs = view.$('hardware-pairs');
                    if(hwPairs) hwPairs.style.display = 'none';
                const availHw = view.$('available-hardware');
                    if(availHw && availHw.parentElement) availHw.parentElement.style.display = 'none';
            }
            
            view.emit('rendered');
            view.emit('loading:end');
        }));
    });

    return view;
}
