import { controller } from '../lib/controller.js';
import { firebase } from '../lib/firebase.js';

export function AppointmentDetailView(appointmentId) {
    const view = controller({
        stringComponent: `
            <div class="appointment-detail-view pb-5">
                <style>
                    .req-slot { border: 2px dashed #cbd5e1; border-radius: var(--radius); padding: 1rem; min-height: 80px; transition: all 0.2s; display: flex; align-items: center; justify-content: space-between; background: #f8fafc; }
                    .req-slot.drag-over { border-color: var(--primary-color); background: #f3e8ff; }
                    .req-slot.fulfilled { border: 2px solid #10b981; background: #f0fdf4; }
                    
                    .draggable-hw { background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.75rem; margin-bottom: 0.5rem; cursor: grab; box-shadow: 0 1px 2px rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center; }
                    .draggable-hw:active { cursor: grabbing; }
                    
                    .scanner-overlay { position: fixed; inset: 0; background: #000; z-index: 9999; display: flex; flex-direction: column; }
                    .scanner-header { padding: 1rem; display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.5); color: #fff; }
                    #hw-reader { flex-grow: 1; width: 100%; }

                    #apt-detail-map { height: 450px !important; }
                </style>
                
                <div class="mb-4">
                    <button id="btn-back" class="btn-pico btn-pico-outline mb-3">
                        <i class="bi bi-arrow-left me-2"></i>Back to Appointments
                    </button>
                    <div class="d-flex flex-wrap gap-3 justify-content-between align-items-center">
                        <div>
                            <h4 class="fw-bold mb-1">Job Execution</h4>
                            <div class="text-muted font-monospace small">${appointmentId}</div>
                        </div>
                        <div class="d-flex gap-2">
                            <span id="det-status" class="badge bg-secondary d-flex align-items-center px-3">Loading</span>
                        </div>
                    </div>
                </div>

                <div class="row g-4">
                    <div class="col-lg-5">
                        <div class="card border-0 shadow-sm mb-4">
                            <div class="card-body p-4">
                                <h5 id="det-name" class="fw-bold mb-3">...</h5>
                                <div class="d-flex flex-column gap-2 text-sm text-muted mb-4">
                                    <div><i class="bi bi-person-badge me-2 text-primary"></i><span id="det-tech-name">Loading...</span> <small class="text-xs">(<span id="det-tech-id">...</span>)</small></div>
                                    <div><i class="bi bi-clock me-2 text-primary"></i><span id="det-time-range">...</span></div>
                                    <div><i class="bi bi-geo-alt me-2 text-primary"></i><span id="det-location"></span></div>
                                    <div><i class="bi bi-truck me-2 text-primary"></i><span id="det-van"></span></div>
                                </div>
                                
                                <div id="apt-detail-map" class="border rounded" style="height: 200px; z-index: 1;"></div>
                            </div>
                        </div>

                        <div id="completion-panel" class="card border-0 shadow-sm">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-3"><i class="bi bi-journal-check text-primary me-2"></i>Completion Notes</h6>
                                <textarea id="completion-desc" class="form-control mb-4" rows="4" placeholder="Enter signal strength, port numbers, or installation notes..."></textarea>
                                
                                <button id="btn-complete-job" class="btn-pico btn-pico-primary w-100 py-3 fw-bold fs-6">
                                    <i class="bi bi-check2-circle me-2"></i>Complete Job
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="col-lg-7">
                        <div class="card border-0 shadow-sm h-100">
                            <div class="card-body p-4 d-flex flex-column">
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <h6 class="fw-bold mb-0"><i class="bi bi-box-seam text-primary me-2"></i>Hardware Fulfillment</h6>
                                    <button id="btn-open-scanner" class="btn-pico btn-pico-outline text-primary border-primary">
                                        <i class="bi bi-upc-scan me-1"></i>Scan Barcode
                                    </button>
                                </div>
                                <p class="text-xs text-muted mb-4">Drag items from the van inventory into the required slots, or use the scanner.</p>

                                <div class="row g-4 flex-grow-1">
                                    <div class="col-md-7 d-flex flex-column gap-2" id="required-slots-container">
                                        <div class="text-center py-4 text-muted small"><span class="spinner-border spinner-border-sm"></span></div>
                                    </div>
                                    
                                    <div class="col-md-5 border-start">
                                        <h6 class="fw-bold text-sm mb-3 text-muted">Available in Van</h6>
                                        <div id="van-inventory-container" class="d-flex flex-column overflow-auto pe-2" style="max-height: 400px;">
                                            <div class="text-center py-4 text-muted small">Loading van stock...</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="hw-scanner-modal" class="scanner-overlay hidden">
                    <div class="scanner-header">
                        <span class="fw-bold"><i class="bi bi-upc-scan me-2"></i>Scan Hardware Barcode</span>
                        <button id="btn-close-scanner" class="btn btn-sm btn-outline-light border-0"><i class="bi bi-x-lg"></i></button>
                    </div>
                    <div id="hw-reader"></div>
                    <div class="p-3 text-center text-white bg-dark small">
                        Align the barcode. It will auto-assign to the correct slot.
                    </div>
                </div>
            </div>
        `
    });

    view.onboard({ id: 'det-name' }).onboard({ id: 'det-tech-name' }).onboard({ id: 'det-tech-id' }).onboard({ id: 'det-time-range' }).onboard({ id: 'det-location' })
        .onboard({ id: 'det-van' }).onboard({ id: 'det-status' })
        .onboard({ id: 'required-slots-container' }).onboard({ id: 'van-inventory-container' })
        .onboard({ id: 'btn-complete-job' }).onboard({ id: 'completion-desc' }).onboard({ id: 'completion-panel' })
        .onboard({ id: 'btn-open-scanner' }).onboard({ id: 'hw-scanner-modal' }).onboard({ id: 'btn-close-scanner' })
        .onboard({ id: 'btn-back' });

    view.trigger('click', 'btn-back', () => {
        window.location.hash = '#appointments';
    });

    let aptData = null;
    let hardwareSlots = []; // { index, catalog_id, item_name, assigned_id }
    let availableVanInventory = []; // { item_id, catalog_id }
    let isCompleted = false;
    let map = null;
    let html5QrcodeScanner = null;

    // --- Drag and Drop & Rendering Logic ---

    const renderHardwareUI = () => {
        const slotsCont = view.$('required-slots-container');
        const invCont = view.$('van-inventory-container');
        if(!slotsCont || !invCont) return;

        // Render Drop Zones (Slots)
        slotsCont.innerHTML = hardwareSlots.map((slot, idx) => {
            if (slot.assigned_id) {
                return `
                    <div class="req-slot fulfilled">
                        <div>
                            <div class="fw-bold text-success text-sm">${slot.item_name}</div>
                            <code class="data-mono text-dark">${slot.assigned_id}</code>
                        </div>
                        ${!isCompleted ? `<button class="btn btn-sm btn-outline-danger p-1 btn-unassign" data-idx="${idx}" title="Remove"><i class="bi bi-x-lg"></i></button>` : ''}
                    </div>
                `;
            } else {
                return `
                    <div class="req-slot drop-zone" data-catalog="${slot.catalog_id}" data-idx="${idx}">
                        <div>
                            <div class="fw-bold text-dark text-sm">${slot.item_name}</div>
                            <div class="text-xs text-muted">Needs: ${slot.catalog_id}</div>
                        </div>
                        <div class="text-muted"><i class="bi bi-box-arrow-in-down fs-4"></i></div>
                    </div>
                `;
            }
        }).join('');

        // Render Draggable Inventory
        if (isCompleted) {
            invCont.innerHTML = '<div class="text-center text-muted small py-4">Job is completed. Inventory locked.</div>';
        } else {
            invCont.innerHTML = availableVanInventory.length > 0 ? availableVanInventory.map(item => `
                <div class="draggable-hw" draggable="true" data-id="${item.item_id}" data-catalog="${item.catalog_id}">
                    <code class="data-mono text-dark">${item.item_id}</code>
                    <span class="badge bg-light text-muted border text-xs">${item.catalog_id}</span>
                </div>
            `).join('') : '<div class="text-center text-muted small py-4">No available hardware in van.</div>';
        }

        attachDnDHandlers();
    };

    const attachDnDHandlers = () => {
        if (isCompleted) return;

        // Unassign Button
        view.$('required-slots-container').querySelectorAll('.btn-unassign').forEach(btn => {
            btn.onclick = () => {
                const idx = btn.dataset.idx;
                const itemId = hardwareSlots[idx].assigned_id;
                const catalogId = hardwareSlots[idx].catalog_id;
                
                hardwareSlots[idx].assigned_id = null;
                availableVanInventory.push({ item_id: itemId, catalog_id: catalogId }); // Put back in van
                renderHardwareUI();
            };
        });

        // Draggables
        view.$('van-inventory-container').querySelectorAll('.draggable-hw').forEach(el => {
            el.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ item_id: el.dataset.id, catalog_id: el.dataset.catalog }));
                e.dataTransfer.effectAllowed = 'move';
                el.style.opacity = '0.5';
            });
            el.addEventListener('dragend', (e) => {
                el.style.opacity = '1';
            });
        });

        // Drop Zones
        view.$('required-slots-container').querySelectorAll('.drop-zone').forEach(zone => {
            zone.addEventListener('dragover', (e) => {
                e.preventDefault(); // Necessary to allow dropping
                e.dataTransfer.dropEffect = 'move';
                zone.classList.add('drag-over');
            });
            zone.addEventListener('dragleave', () => {
                zone.classList.remove('drag-over');
            });
            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('drag-over');
                
                try {
                    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                    const targetCatalog = zone.dataset.catalog;
                    
                    if (data.catalog_id !== targetCatalog) {
                        return alert(`Hardware mismatch! This slot requires a '${targetCatalog}', but you dropped a '${data.catalog_id}'.`);
                    }

                    const idx = zone.dataset.idx;
                    hardwareSlots[idx].assigned_id = data.item_id;
                    
                    // Remove from available inventory
                    availableVanInventory = availableVanInventory.filter(i => i.item_id !== data.item_id);
                    renderHardwareUI();

                } catch(err) { console.error("Drop failed", err); }
            });
        });
    };

    // --- Scanner Logic ---

    const handleScan = (decodedText) => {
        if (html5QrcodeScanner) html5QrcodeScanner.pause();

        try {
            // 1. Is it already slotted?
            if (hardwareSlots.some(s => s.assigned_id === decodedText)) {
                alert("Item already assigned to a slot.");
                if (html5QrcodeScanner) html5QrcodeScanner.resume();
                return;
            }

            // 2. Is it in the van inventory?
            const itemInVan = availableVanInventory.find(i => i.item_id === decodedText);
            if (!itemInVan) {
                alert(`Barcode ${decodedText} not found in this Van's available inventory.`);
                if (html5QrcodeScanner) html5QrcodeScanner.resume();
                return;
            }

            // 3. Is there an open slot for this catalog type?
            const openSlot = hardwareSlots.find(s => s.catalog_id === itemInVan.catalog_id && !s.assigned_id);
            if (!openSlot) {
                alert(`No open requirements found for hardware type: ${itemInVan.catalog_id}.`);
                if (html5QrcodeScanner) html5QrcodeScanner.resume();
                return;
            }

            // 4. Assign it!
            openSlot.assigned_id = decodedText;
            availableVanInventory = availableVanInventory.filter(i => i.item_id !== decodedText);
            
            if (navigator.vibrate) navigator.vibrate(100);
            renderHardwareUI();
            stopScanner(); // Auto-close on success
            
        } catch (e) {
            alert("Scan error: " + e.message);
            if (html5QrcodeScanner) html5QrcodeScanner.resume();
        }
    };

    const startScanner = () => {
        view.$('hw-scanner-modal').classList.remove('hidden');
        if (!html5QrcodeScanner) {
            // Use window global for qrcode library
            html5QrcodeScanner = new window.Html5Qrcode("hw-reader");
        }
        html5QrcodeScanner.start(
            { facingMode: "environment" }, 
            { fps: 10, qrbox: { width: 250, height: 100 } },
            handleScan,
            () => {} // ignore errors
        ).catch(err => {
            alert("Camera init failed. Check permissions.");
            stopScanner();
        });
    };

    const stopScanner = () => {
        if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
            html5QrcodeScanner.stop().then(() => {
                view.$('hw-scanner-modal').classList.add('hidden');
            }).catch(console.error);
        } else {
            view.$('hw-scanner-modal').classList.add('hidden');
        }
    };

    view.trigger('click', 'btn-open-scanner', startScanner);
    view.trigger('click', 'btn-close-scanner', stopScanner);

    // --- Completion Logic ---

    view.trigger('click', 'btn-complete-job', async () => {
        const incomplete = hardwareSlots.some(s => !s.assigned_id);
        if (incomplete) return alert("You must fill all hardware slots before completing the job.");

        const btn = view.$('btn-complete-job');
        const ogHtml = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Completing...';
        btn.disabled = true;

        try {
            // Update items to APPOINTMENT location
            const itemUpdates = hardwareSlots.map(slot => {
                return firebase.db.updateDoc(firebase.db.doc(firebase.db.db, 'items', slot.assigned_id), { 
                    is_available: false, 
                    status: 'assigned', 
                    current_location_type: 'APPOINTMENT', 
                    current_location_id: appointmentId 
                });
            });
            if(itemUpdates.length > 0) await Promise.all(itemUpdates);

            const deployedHw = hardwareSlots.map(s => ({ catalog_id: s.catalog_id, item_id: s.assigned_id }));
            const completionDesc = view.$('completion-desc').value;

            await firebase.db.updateDoc(firebase.db.doc(firebase.db.db, 'appointments', appointmentId), {
                status: 'completed',
                'metadata.hardware': deployedHw,
                'metadata.completion_description': completionDesc,
                'metadata.completed_at': firebase.db.serverTimestamp()
            });

            firebase.logAction("Job Completed", `Appointment ${appointmentId} closed.`);
            alert("Job Completed Successfully!");
            // The view will auto-update via the snapshot listener
            
        } catch (err) {
            alert("Completion failed: " + err.message);
        } finally {
            btn.innerHTML = ogHtml;
            btn.disabled = false;
        }
    });

    // --- Initialization ---

    view.on('init', () => {
        view.emit('loading:start');
        
        view.unsub(firebase.db.subscribe(firebase.db.doc(firebase.db.db, 'appointments', appointmentId), async (snap) => {
            view.emit('loading:end');
            if (!snap.exists()) return;
            aptData = snap.data();
            isCompleted = aptData.status === 'completed';

            // Hydrate UI Text
            if(view.$('det-name')) view.$('det-name').textContent = aptData.appointment_name;
            
            if(view.$('det-tech-id')) view.$('det-tech-id').textContent = aptData.tech_id || '...';
            
            // Resolve Technician Name
            const techDoc = await firebase.db.getDoc(firebase.db.doc(firebase.db.db, 'users', aptData.tech_id));
            if(view.$('det-tech-name')) {
                view.$('det-tech-name').textContent = techDoc.exists() ? techDoc.data().user_name : 'Unknown Technician';
            }

            // Calculate Time Window
            if(view.$('det-time-range')) {
                const startTimeStr = aptData.appointment_time || '00:00';
                const duration = aptData.metadata?.duration_minutes || 60;
                
                const [sh, sm] = startTimeStr.split(':').map(Number);
                const startDate = new Date();
                startDate.setHours(sh, sm, 0);
                
                const endDate = new Date(startDate.getTime() + duration * 60000);
                
                const formatTime = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                view.$('det-time-range').textContent = `${aptData.schedule_date} | ${formatTime(startDate)} - ${formatTime(endDate)}`;
            }

            if(view.$('det-location')) view.$('det-location').textContent = aptData.location_name || 'N/A';
            if(view.$('det-van')) view.$('det-van').textContent = aptData.van_id || 'No Van Assigned';
            
            const statusEl = view.$('det-status');
            if(statusEl) {
                statusEl.textContent = aptData.status;
                let badgeClass = 'badge-pale-info';
                if (aptData.status === 'scheduled') badgeClass = 'badge-pale-primary';
                if (aptData.status === 'rescheduled') badgeClass = 'badge-pale-warning';
                if (aptData.status === 'completed') badgeClass = 'badge-pale-success';
                statusEl.className = `badge ${badgeClass} text-uppercase px-3`;
            }

            if (isCompleted) {
                if(view.$('completion-panel')) view.$('completion-panel').style.display = 'none';
                if(view.$('btn-open-scanner')) view.$('btn-open-scanner').style.display = 'none';
                if(view.$('completion-desc')) view.$('completion-desc').value = aptData.metadata?.completion_description || '';
            } else {
                if(view.$('completion-desc')) view.$('completion-desc').value = aptData.metadata?.completion_description || '';
            }

            // Map Initialization
            if (aptData.metadata?.location && !map) {
                const mapEl = document.getElementById('apt-detail-map');
                if (mapEl) {
                    map = L.map('apt-detail-map').setView([aptData.metadata.location.lat, aptData.metadata.location.lng], 13);
                    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
                        maxZoom: 19
                    }).addTo(map);
                    L.marker([aptData.metadata.location.lat, aptData.metadata.location.lng]).addTo(map);
                }
            }

            // Build Hardware Slots & Fetch Van Inventory
            hardwareSlots = [];
            if (aptData.metadata?.required_hardware) {
                aptData.metadata.required_hardware.forEach(req => {
                    for(let i=0; i<req.count; i++) {
                        hardwareSlots.push({ catalog_id: req.catalog_id, item_name: req.item_name, assigned_id: null });
                    }
                });
            }

            if (isCompleted && aptData.metadata?.hardware) {
                // If completed, just populate slots from saved data
                aptData.metadata.hardware.forEach(h => {
                    const slot = hardwareSlots.find(s => s.catalog_id === h.catalog_id && !s.assigned_id);
                    if (slot) slot.assigned_id = h.item_id;
                });
                renderHardwareUI();
            } else if (!isCompleted && aptData.van_id) {
                // Fetch van inventory
                const itemsSnap = await firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'items'));
                availableVanInventory = [];
                itemsSnap.forEach(doc => {
                    const item = doc.data();
                    const isAvail = item.status === 'available' || (!item.status && item.is_available);
                    if (isAvail && item.current_location_type === 'VAN' && item.current_location_id === aptData.van_id) {
                        availableVanInventory.push({ item_id: item.item_id, catalog_id: item.catalog_id });
                    }
                });
                renderHardwareUI();
            } else {
                renderHardwareUI();
            }
            
            document.dispatchEvent(new CustomEvent('apply-auth'));
        }));
    });

    view.destroy = () => {
        stopScanner();
        if(map) map.remove();
    };

    return view;
}
