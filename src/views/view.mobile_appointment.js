import { controller } from '../lib/controller.js';
import { db } from '../lib/db/index.js';
import { calculateDistance } from '../lib/travel-logic.js';

export function MobileAppointmentView(appointmentId) {
    const view = controller({
        stringComponent: `
            <div class="mobile-appointment-view pb-5">
                <style>
                    .mobile-header { position: sticky; top: 0; z-index: 100; background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); border-bottom: 1px solid var(--border-color); padding: 1rem; }
                    .scanner-overlay { position: fixed; inset: 0; background: #000; z-index: 9999; display: flex; flex-direction: column; }
                    .scanner-header { padding: 1rem; display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.5); color: #fff; }
                    #reader { flex-grow: 1; width: 100%; }
                    .hw-slot { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center; }
                    .hw-slot.fulfilled { border-color: #10b981; background: #f0fdf4; }
                </style>
                
                <div class="mobile-header d-flex justify-content-between align-items-center mb-3">
                    <div>
                        <h6 class="fw-bold mb-0">Job Completion</h6>
                        <div class="text-xs text-muted font-monospace">${appointmentId}</div>
                    </div>
                    <span id="det-status" class="badge bg-secondary">Loading</span>
                </div>

                <div class="px-3">
                    <div class="card border-0 shadow-sm mb-3">
                        <div class="card-body">
                            <h5 id="det-name" class="fw-bold mb-2">...</h5>
                            <div class="d-flex flex-column gap-2 text-sm text-muted">
                                <div><i class="bi bi-geo-alt me-2 text-primary"></i><span id="det-location"></span></div>
                                <div><i class="bi bi-clock me-2 text-primary"></i><span id="det-time"></span></div>
                            </div>
                        </div>
                    </div>

                    <h6 class="fw-bold mb-2">Hardware Deployment</h6>
                    <p class="text-xs text-muted mb-3">Scan barcodes to fulfill the required hardware for this installation.</p>
                    
                    <div id="hardware-slots-container" class="mb-4">
                        <div class="text-center text-muted small py-3"><span class="spinner-border spinner-border-sm"></span></div>
                    </div>

                    <button id="btn-open-scanner" class="btn-pico btn-pico-outline w-100 mb-4 py-3 border-dashed border-primary text-primary fw-bold" style="border-width: 2px;">
                        <i class="bi bi-upc-scan fs-4 d-block mb-1"></i>Tap to Scan Hardware
                    </button>

                    <div class="mb-3">
                        <label class="form-label fw-bold text-sm">Completion Notes</label>
                        <textarea id="completion-desc" class="form-control" rows="3" placeholder="Signal strength, port numbers, etc..."></textarea>
                    </div>

                    <button id="complete-job" class="btn-pico btn-pico-primary w-100 py-3 fw-bold fs-6 mt-2">
                        <i class="bi bi-check2-circle me-2"></i>Complete Job
                    </button>
                </div>

                <div id="scanner-modal" class="scanner-overlay hidden">
                    <div class="scanner-header">
                        <span class="fw-bold"><i class="bi bi-upc-scan me-2"></i>Scan Barcode</span>
                        <button id="btn-close-scanner" class="btn btn-sm btn-outline-light border-0"><i class="bi bi-x-lg"></i></button>
                    </div>
                    <div id="reader"></div>
                    <div class="p-3 text-center text-white-50 small bg-dark">
                        Align the barcode within the frame.
                    </div>
                </div>
            </div>
        `
    });

    view.onboard({ id: 'det-name' }).onboard({ id: 'det-location' }).onboard({ id: 'det-time' }).onboard({ id: 'det-status' })
        .onboard({ id: 'hardware-slots-container' }).onboard({ id: 'btn-open-scanner' })
        .onboard({ id: 'scanner-modal' }).onboard({ id: 'btn-close-scanner' })
        .onboard({ id: 'complete-job' }).onboard({ id: 'completion-desc' });

    let hardwareSlots = [];
    let html5QrcodeScanner = null;
    let isCompleted = false;

    const renderHardwareSlots = () => {
        const container = view.$('hardware-slots-container');
        if(!container) return;
        container.innerHTML = '';
        
        hardwareSlots.forEach((slot, index) => {
            const isOptional = slot.requires_scan === false;
            const div = document.createElement('div');
            div.className = `hw-slot ${slot.assigned_id ? 'fulfilled' : ''} ${isOptional && !slot.assigned_id ? 'opacity-75' : ''}`;
            div.innerHTML = `
                <div>
                    <div class="fw-bold text-sm" style="color: ${slot.assigned_id ? '#166534' : 'inherit'}">
                        ${slot.item_name} ${isOptional ? '<span class="text-xs fw-normal text-muted fst-italic ms-1">(Optional Scan)</span>' : ''}
                    </div>
                    <div class="text-xs text-muted">${slot.catalog_id}</div>
                </div>
                <div class="text-end">
                    ${slot.assigned_id 
                        ? `<span class="badge badge-pale-success font-monospace slot-status-badge">Fulfilled</span>
                           <small class="text-xs text-muted d-block mt-1">${slot.assigned_id}</small>
                           ${!isCompleted ? `<button class="btn btn-link text-danger p-0 text-xs text-decoration-none mt-1 clear-slot" data-index="${index}">Remove</button>` : ''}` 
                        : `<span class="badge ${isOptional ? 'bg-light text-muted' : 'bg-light text-dark'}">Awaiting Scan</span>`
                    }
                </div>
            `;
            container.appendChild(div);

            if (slot.assigned_id && !isCompleted) {
                div.querySelector('.clear-slot').onclick = () => {
                    slot.assigned_id = null;
                    renderHardwareSlots();
                };
            }
        });
    };

    const handleScan = async (decodedText) => {
        // Pause scanner to process
        if (html5QrcodeScanner) html5QrcodeScanner.pause();

        try {
            // Check if already slotted
            if (hardwareSlots.some(s => s.assigned_id === decodedText)) {
                alert("This item is already assigned to a slot.");
                if (html5QrcodeScanner) html5QrcodeScanner.resume();
                return;
            }

            // Fetch item from database
            const item = await db.findOne('items', decodedText);
            if (!item) {
                alert(`Hardware ID "${decodedText}" not found in system inventory.`);
                if (html5QrcodeScanner) html5QrcodeScanner.resume();
                return;
            }

            const isAvail = item.status === 'available' || (!item.status && item.is_available);
            
            if (!isAvail) {
                alert(`Item "${decodedText}" is marked as ${item.status || 'unavailable'} and cannot be deployed.`);
                if (html5QrcodeScanner) html5QrcodeScanner.resume();
                return;
            }

            // Find an empty slot matching the catalog_id
            const slot = hardwareSlots.find(s => s.catalog_id === item.catalog_id && !s.assigned_id);
            if (!slot) {
                alert(`No open requirement found for hardware type: ${item.catalog_id}. Check if it's already fulfilled or not needed for this job.`);
                if (html5QrcodeScanner) html5QrcodeScanner.resume();
                return;
            }

            // Slot it in!
            slot.assigned_id = decodedText;
            renderHardwareSlots();
            
            // Vibrate device if supported to indicate success
            if (navigator.vibrate) navigator.vibrate(100);

            // Close scanner automatically
            stopScanner();
            
        } catch (e) {
            console.error(e);
            alert("Error validating scan: " + e.message);
            if (html5QrcodeScanner) html5QrcodeScanner.resume();
        }
    };

    const startScanner = () => {
        view.$('scanner-modal').classList.remove('hidden');
        if (!html5QrcodeScanner) {
            // Use the global class from the script tag
            html5QrcodeScanner = new window.Html5Qrcode("reader");
        }
        
        html5QrcodeScanner.start(
            { facingMode: "environment" }, 
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => handleScan(decodedText),
            (errorMessage) => { /* ignore background scan noise */ }
        ).catch(err => {
            alert("Camera initialization failed. Please ensure permissions are granted.");
            stopScanner();
        });
    };

    const stopScanner = () => {
        if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
            html5QrcodeScanner.stop().then(() => {
                view.$('scanner-modal').classList.add('hidden');
            }).catch(e => console.error(e));
        } else {
            view.$('scanner-modal').classList.add('hidden');
        }
    };

    view.trigger('click', 'btn-open-scanner', startScanner);
    view.trigger('click', 'btn-close-scanner', stopScanner);

    view.trigger('click', 'complete-job', async () => {
        const completionDesc = view.$('completion-desc').value;
        const incomplete = hardwareSlots.some(s => !s.assigned_id && s.requires_scan !== false);

        if (incomplete) return alert("You must scan and assign all required hardware before completing the job.");

        const btn = view.$('complete-job');
        const ogHtml = btn.innerHTML;
        btn.innerHTML = '<i class="bi bi-check2-circle me-2"></i>Completed';
        btn.disabled = true;

        // Optimistic State Update
        isCompleted = true;
        const statusEl = view.$('det-status');
        if (statusEl) {
            statusEl.textContent = 'completed';
            statusEl.className = 'badge bg-success';
        }
        btn.style.display = 'none';
        const scanBtn = view.$('btn-open-scanner');
        if(scanBtn) scanBtn.style.display = 'none';
        
        renderHardwareSlots();

        const itemUpdates = [];
        hardwareSlots.forEach(slot => {
            if (slot.assigned_id) {
                itemUpdates.push(db.update('items', slot.assigned_id, { 
                    is_available: false, 
                    status: 'assigned', 
                    current_location_type: 'APPOINTMENT', 
                    current_location_id: appointmentId 
                }));
            }
        });
        
        const deployedHw = hardwareSlots.map(s => ({ catalog_id: s.catalog_id, item_id: s.assigned_id || null }));

        const aptUpdate = db.update('appointments', appointmentId, {
            status: 'completed',
            'metadata.hardware': deployedHw,
            'metadata.completion_description': completionDesc,
            'metadata.completed_at': db.serverTimestamp()
        });

        Promise.all([...itemUpdates, aptUpdate]).then(() => {
            db.logAction("Mobile Job Completed", `Appointment ${appointmentId} closed via mobile app.`);
            window.location.hash = '#dashboard';
        }).catch(err => {
            console.error(err);
            alert("Completion failed: " + err.message);
            isCompleted = false;
            btn.innerHTML = ogHtml;
            btn.disabled = false;
            btn.style.display = 'block';
            if (statusEl) {
                statusEl.textContent = 'scheduled';
                statusEl.className = 'badge bg-warning text-dark';
            }
            if(scanBtn) scanBtn.style.display = 'block';
            renderHardwareSlots();
        });
    });

    let geoWatchId = null;
    let lastGeoPush = 0;

    view.on('init', () => {
        view.emit('loading:start');
        
        view.unsub(db.subscribe('appointments', { id: appointmentId }, (apt) => {
            if (!apt) return;
            view.emit('loading:end');
            
            isCompleted = apt.status === 'completed';

            const nameEl = view.$('det-name');
            const dateEl = view.$('det-time');
            const locEl = view.$('det-location');
            const statusEl = view.$('det-status');

            if(nameEl) nameEl.textContent = apt.appointment_name;
            if(dateEl) dateEl.textContent = `${apt.schedule_date} @ ${apt.appointment_time || 'N/A'}`;
            if(locEl) locEl.textContent = apt.location_name || 'N/A';
            
            if(statusEl) {
                statusEl.textContent = apt.status;
                if(isCompleted) statusEl.className = 'badge bg-success';
                else statusEl.className = 'badge bg-warning text-dark';
            }

            // Start Geolocation if not completed
            if (!isCompleted && navigator.geolocation) {
                if (!geoWatchId) {
                    geoWatchId = navigator.geolocation.watchPosition(async (pos) => {
                        const { latitude, longitude } = pos.coords;
                        const now = Date.now();
                        
                        let updates = {};
                        let updateNeeded = false;
                        
                        // Push location every 15 seconds for tracking portal
                        if (now - lastGeoPush > 15000) {
                            updates['metadata.tech_location'] = { lat: latitude, lng: longitude, updated_at: now };
                            updateNeeded = true;
                            lastGeoPush = now;
                        }
                        
                        // Geofenced Arrival Check (100 meters)
                        if (apt.metadata?.location?.lat && apt.status !== 'in-progress' && apt.status !== 'completed') {
                            const distKm = calculateDistance(latitude, longitude, parseFloat(apt.metadata.location.lat), parseFloat(apt.metadata.location.lng));
                            if (distKm <= 0.1) {
                                updates.status = 'in-progress';
                                updateNeeded = true;
                                
                                if (statusEl) {
                                    statusEl.textContent = 'in-progress';
                                    statusEl.className = 'badge bg-primary text-white';
                                }
                            }
                        }
                        
                        if (updateNeeded) {
                            try {
                                await db.update('appointments', appointmentId, updates);
                            } catch (e) {
                                console.warn("Geofence update failed:", e);
                            }
                        }
                    }, (err) => console.warn(err), { enableHighAccuracy: true });
                }
            } else if (isCompleted && geoWatchId) {
                navigator.geolocation.clearWatch(geoWatchId);
                geoWatchId = null;
            }

            // Build hardware slots if not done
            if (apt.metadata?.required_hardware && hardwareSlots.length === 0) {
                const reqs = apt.metadata.required_hardware;
                reqs.forEach(r => {
                    for(let i=0; i<r.count; i++) {
                        hardwareSlots.push({ catalog_id: r.catalog_id, item_name: r.item_name, requires_scan: r.requires_scan, assigned_id: null });
                    }
                });
                
                // If it was already completed previously, populate from saved hardware
                if (isCompleted && apt.metadata?.hardware) {
                    const savedHw = apt.metadata.hardware;
                    // Safely re-assign saved items to slots
                    let tempSlots = [...hardwareSlots];
                    savedHw.forEach(shw => {
                        const slot = tempSlots.find(s => s.catalog_id === shw.catalog_id && !s.assigned_id);
                        if (slot) slot.assigned_id = shw.item_id;
                    });
                }
                renderHardwareSlots();
            } else {
                renderHardwareSlots();
            }

            if (isCompleted) {
                const completeBtn = view.$('complete-job');
                if(completeBtn) completeBtn.style.display = 'none';
                
                const scanBtn = view.$('btn-open-scanner');
                if(scanBtn) scanBtn.style.display = 'none';
                
                const descEl = view.$('completion-desc');
                if(descEl) {
                    descEl.value = apt.metadata?.completion_description || '';
                    descEl.disabled = true;
                }
            }
        }));
    });

    view.destroy = () => {
        stopScanner();
        if (geoWatchId) {
            navigator.geolocation.clearWatch(geoWatchId);
        }
    };

    return view;
}
