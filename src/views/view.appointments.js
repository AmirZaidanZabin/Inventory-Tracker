import { controller } from '../lib/controller.js';
import { firebase } from '../lib/firebase.js';
import { createModal } from '../lib/modal.js';
import { CustomSelect } from '../lib/custom-select.js';
import { calculateDistance, estimateDuration, findAdjacentAppointments } from '../lib/travel-logic.js';

export function AppointmentsView() {
    const view = controller({
        stringComponent: `
            <div class="appointments-view">
                <style>
                    .locked-overlay { position: absolute; inset: 0; background: rgba(255,255,255,0.8); z-index: 50; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(2px); border-radius: 8px; }
                    .travel-pad { border-left: 4px solid #f97316 !important; background: #fff7ed !important; }
                </style>
                <div class="d-flex justify-content-end mb-4">
                    <button id="open-add-apt" class="btn-pico btn-pico-primary auth-appointments:create hidden">
                        <i class="bi bi-calendar-plus"></i>Schedule Appointment
                    </button>
                </div>

                <div class="card border-0 shadow-sm">
                    <div class="card-body p-0">
                        <table class="modern-table">
                            <thead>
                                <tr>
                                    <th>Job ID</th>
                                    <th>Customer</th>
                                    <th>Date</th>
                                    <th>Time</th>
                                    <th>Location</th>
                                    <th>Tech</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="apt-list"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        `
    });

    view.onboard({ id: 'open-add-apt' }).onboard({ id: 'apt-list' });

    view.trigger('click', 'open-add-apt', async () => {
        const modal = createModal({
            title: 'Schedule Appointment & Availability',
            width: '1200px',
            body: `
                <div class="row g-4">
                    <!-- Left Column: Form -->
                    <div class="col-lg-5">
                        <form id="add-apt-form" class="row g-3">
                            <div class="col-12">
                                <label class="form-label small fw-bold">Customer Name</label>
                                <input type="text" name="appointment_name" class="form-control" required>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label small fw-bold">Date</label>
                                <input type="date" name="schedule_date" id="schedule_date_input" class="form-control" required>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label small fw-bold">Time Slot</label>
                                <select name="appointment_time" class="form-select" required>
                                    <option value="" disabled selected>Select...</option>
                                    <option value="08:00">08:00 AM</option>
                                    <option value="09:00">09:00 AM</option>
                                    <option value="10:00">10:00 AM</option>
                                    <option value="11:00">11:00 AM</option>
                                    <option value="12:00">12:00 PM</option>
                                    <option value="13:00">01:00 PM</option>
                                    <option value="14:00">02:00 PM</option>
                                    <option value="15:00">03:00 PM</option>
                                    <option value="16:00">04:00 PM</option>
                                    <option value="17:00">05:00 PM</option>
                                </select>
                            </div>
                            <div class="col-12">
                                <label class="form-label small fw-bold">Location Address / Description</label>
                                <input type="text" name="location_name" class="form-control" placeholder="Click map to auto-fill" required>
                                <div class="small text-muted mt-1" id="location-status"></div>
                            </div>
                            
                            <input type="hidden" name="auto_van_id" id="auto_van_id">
                            <input type="hidden" id="raw_valid_techs" value="[]">

                            <div class="col-12">
                                <label class="form-label small fw-bold">Service Location</label>
                                <div id="apt-map" style="height: 200px; border-radius: 8px;"></div>
                                <input type="hidden" name="lat"><input type="hidden" name="lng">
                            </div>

                            <!-- Travel Hints Section -->
                            <div class="col-12">
                                <div id="travel-hints-container" class="p-3 border rounded bg-light d-none">
                                    <label class="form-label small fw-bold text-accent mb-2"><i class="bi bi-info-circle me-1"></i>Travel Estimates</label>
                                    <div id="travel-hints-content" class="small text-muted d-flex flex-column gap-1">
                                    </div>
                                </div>
                            </div>

                            <div class="col-12 mt-2" id="products-selection-container"></div>
                            <div class="col-12 mt-2" id="custom-fields-container"></div>
                            
                            <div class="col-12 mt-4">
                                <button type="submit" class="btn-pico btn-pico-primary w-100">Book Appointment</button>
                            </div>
                        </form>
                    </div>
                    
                    <!-- Right Column: Daily Availability Grid -->
                    <div class="col-lg-7 border-start position-relative">
                        <div id="availability-locked-overlay" class="locked-overlay">
                            <div class="text-center">
                                <div class="spinner-border spinner-border-sm text-accent mb-2 d-none" id="availability-loading"></div>
                                <h6 class="fw-bold text-muted mb-1"><i class="bi bi-geo-alt me-1"></i>Location Required</h6>
                                <p class="text-xs text-muted mb-0">Select a point on the map to unlock slots.</p>
                            </div>
                        </div>
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h6 class="fw-bold mb-0">Daily Schedule View</h6>
                            <h6 class="text-muted mb-0 small" id="daily-view-date">No date selected</h6>
                        </div>
                        <div class="calendar-grid w-100 rounded border overflow-auto" style="height: 60vh; min-height: 400px;">
                            <div id="daily-schedule-container" style="min-width: 600px;">
                                <!-- Grid will heavily emulate standard calendar row headers -->
                                <div class="text-muted small p-3 text-center">Please select a date and location.</div>
                            </div>
                        </div>
                    </div>
                </div>
            `
        });

        modal.show();

        // Data for selects and grids
        const [vans, users, rawApts, rawForms, rawProductTypes, rawItemCatalog] = await Promise.all([
            firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'vans')),
            firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'users')),
            firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'appointments')),
            firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'forms')),
            firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'product_types')),
            firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'item_catalog'))
        ]);
        
        let allAppointments = rawApts.docs.map(d => d.data());
        let formSchemas = [];
        if(rawForms && rawForms.docs) {
            formSchemas = rawForms.docs.map(d => d.data()).filter(f => f.entities && f.entities.includes('appointments'));
        }
        
        const hardwareMap = {};
        if (rawItemCatalog && rawItemCatalog.docs) {
            rawItemCatalog.docs.forEach(doc => {
                hardwareMap[doc.id] = doc.data();
            });
        }

        let allProductTypes = [];
        if (rawProductTypes && rawProductTypes.docs) {
            allProductTypes = rawProductTypes.docs.map(d => {
                const pt = d.data();
                // Inherit duration from hardware if not explicitly set on product
                const hw = hardwareMap[pt.catalog_id];
                const inheritedDuration = hw ? parseInt(hw.duration_minutes || '30', 10) : 30;
                return {
                    ...pt,
                    id: d.id,
                    duration_minutes: pt.duration_minutes || inheritedDuration
                };
            });
        }

        const userDataArray = users.docs.map(u => ({ id: u.id, ...u.data() }));
        const vanDataArray = vans.docs.map(v => ({ id: v.id, ...v.data() }));

        // Render Product Types Selection
        const productsContainer = modal.element.querySelector('#products-selection-container');
        if (productsContainer && allProductTypes.length > 0) {
            let html = `<div class="col-12 mt-3 p-3 border rounded bg-white shadow-sm">
                <div class="d-flex justify-content-between align-items-center mb-2 border-bottom pb-1">
                    <h6 class="text-accent mb-0 fw-bold">Inventory - Product Configuration</h6>
                    <div id="total-duration-tracker" class="badge bg-pico-primary">Total: 0 min</div>
                </div>
                <div class="row g-2">`;
            allProductTypes.forEach(pt => {
                html += `
                    <div class="col-md-6">
                        <div class="form-check product-card-minimal">
                            <input class="form-check-input product-type-chk" type="checkbox" value="${pt.id}" id="pt-${pt.id}" data-duration="${pt.duration_minutes}">
                            <label class="form-check-label small" for="pt-${pt.id}">
                                <strong>${pt.name}</strong> 
                                <br><span class="text-muted text-xs">Est. ${pt.duration_minutes} min (via Hardware: ${hardwareMap[pt.catalog_id]?.item_name || 'Generic'})</span>
                            </label>
                        </div>
                    </div>
                `;
            });
            html += `</div></div>`;
            productsContainer.innerHTML = html;
            
            // Auto-update duration badge
            productsContainer.addEventListener('change', () => {
                let total = 0;
                productsContainer.querySelectorAll('.product-type-chk:checked').forEach(c => total += parseInt(c.dataset.duration || '0', 10));
                const tracker = modal.element.querySelector('#total-duration-tracker');
                if(tracker) {
                    tracker.textContent = `Total: ${total} min`;
                    tracker.className = total > 480 ? 'badge bg-danger' : 'badge bg-pico-primary';
                }
            });
        }

        // Render Custom Fields
        const customFieldsContainer = modal.element.querySelector('#custom-fields-container');
        if (customFieldsContainer && formSchemas.length > 0) {
            let html = '';
            formSchemas.forEach(schema => {
                html += `<div class="col-12 mt-3"><h6 class="text-accent mb-2 fw-bold border-bottom pb-1">${schema.name}</h6><div class="row g-2">`;
                schema.fields.forEach(f => {
                    html += `<div class="col-md-6">`;
                    html += `<label class="form-label small fw-bold">${f.label} ${f.required?'<span class="text-danger">*</span>':''}</label>`;
                    if (f.type === 'textarea') {
                        html += `<textarea name="custom_${f.name}" class="form-control form-control-sm custom-field-input" ${f.required?'required':''}></textarea>`;
                    } else if (f.type === 'select') {
                        html += `<select name="custom_${f.name}" class="form-select form-select-sm custom-field-input" ${f.required?'required':''}>
                            <option value="">Select...</option>
                            ${(f.options||[]).map(o => `<option value="${o}">${o}</option>`).join('')}
                        </select>`;
                    } else if (f.type === 'checkbox') {
                        html += `<div class="form-check">
                            <input type="checkbox" name="custom_${f.name}" class="form-check-input custom-field-input" value="true" ${f.required?'required':''}>
                            <label class="form-check-label small">Yes</label>
                        </div>`;
                    } else {
                        html += `<input type="${f.type==='number'?'number':f.type==='date'?'date':'text'}" name="custom_${f.name}" class="form-control form-control-sm custom-field-input" ${f.required?'required':''}>`;
                    }
                    html += `</div>`;
                });
                html += `</div></div>`;
            });
            customFieldsContainer.innerHTML = html;
        }

        let selectedTechId = '';
        let currentValidTechs = [];
        let currentValidVans = [];

        function pointInPolygon(pt, poly) {
            let x = pt[0], y = pt[1];
            let inside = false;
            for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                let xi = poly[i][0], yi = poly[i][1];
                let xj = poly[j][0], yj = poly[j][1];
                let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        }

        const updateTechOptions = (lat, lng) => {
            const dateStr = modal.element.querySelector('[name="schedule_date"]').value;
            let validTechs = [];
            let validVans = [];

            if (lat && lng) {
                const pt = [lng, lat];
                vanDataArray.forEach(v => {
                    if (v.coverage_area) {
                        try {
                            const geo = JSON.parse(v.coverage_area);
                            if (geo.geometry && geo.geometry.type === 'Polygon') {
                                const ring = geo.geometry.coordinates[0];
                                if (pointInPolygon(pt, ring)) validVans.push(v);
                            }
                        } catch(e) {}
                    }
                });
            }

            if (validVans.length > 0) {
                modal.element.querySelector('#auto_van_id').value = validVans[0].id;
                modal.element.querySelector('#location-status').innerHTML = `<span class="text-success"><i class="bi bi-check-circle"></i> Service area covered by ${validVans.length} VAN(s).</span>`;
                
                // Gather assigned techs from valid vans
                let techIds = new Set();
                validVans.forEach(v => {
                    if(v.assigned_users) v.assigned_users.forEach(uid => techIds.add(uid));
                });
                validTechs = userDataArray.filter(u => techIds.has(u.user_id));
            } else if (lat && lng) {
                modal.element.querySelector('#auto_van_id').value = '';
                modal.element.querySelector('#location-status').innerHTML = `<span class="text-danger"><i class="bi bi-exclamation-triangle"></i> No VAN covers this location.</span>`;
            } else {
                modal.element.querySelector('#location-status').innerHTML = 'Please click map to verify coverage.';
            }

            if (dateStr && validTechs.length > 0) {
                const d = new Date(dateStr);
                const dayIdx = d.getDay(); // 0 = Sunday
                validTechs = validTechs.filter(u => {
                    if (!u.schedule) return true;
                    return !!u.schedule[dayIdx];
                });
            }

            currentValidTechs = validTechs;
            currentValidVans = validVans;
        };

        // Define updateDailyGrid before we use it
        const updateDailyGrid = async (dateStr) => {
            if (!dateStr) return;
            const lat = modal.element.querySelector('[name="lat"]').value;
            const lng = modal.element.querySelector('[name="lng"]').value;

            const overlay = modal.element.querySelector('#availability-locked-overlay');
            const loader = modal.element.querySelector('#availability-loading');
            const container = modal.element.querySelector('#daily-schedule-container');

            if (!lat || !lng) {
                overlay.classList.remove('d-none');
                return;
            }

            loader.classList.remove('d-none');
            
            const headerDate = modal.element.querySelector('#daily-view-date');
            headerDate.textContent = new Date(dateStr).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

            const dailyApts = allAppointments.filter(a => a.schedule_date === dateStr && !a.is_deleted);
            const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
            
            function formatTime(t) {
                if(!t)return'';
                let [h, m] = t.split(':');
                let hInt = parseInt(h);
                let ampm = hInt >= 12 ? 'PM' : 'AM';
                hInt = hInt % 12 || 12;
                return `${hInt}:${m} ${ampm}`;
            }

            // Pre-calculate travel for all techs to this location at start of day (approx)
            const travelMetrics = new Map(); // techId -> { prevTravel, nextTravel }
            
            await Promise.all(currentValidTechs.map(async (t) => {
                const adj = findAdjacentAppointments(t.id, dateStr, '12:00', dailyApts, t.metadata?.base_location);
                let prevTravel = 0;
                if (adj.prev) {
                    prevTravel = await estimateDuration(parseFloat(lat), parseFloat(lng), adj.prev.lat, adj.prev.lng);
                }
                travelMetrics.set(t.id, { prevTravel, adj });
            }));

            const gridHtml = `
                <div class="calendar-grid bg-white" style="display: grid; grid-template-columns: 80px 1fr; gap: 0;">
                    <!-- Headers -->
                    <div class="p-2 border-bottom border-end bg-light text-center fw-bold small sticky-top position-sticky" style="z-index: 3; left: 0;">Time</div>
                    <div class="p-2 border-bottom border-end bg-light text-center fw-bold small sticky-top" style="z-index: 2;">Availability (Inc. Travel Padding)</div>
                    
                    <!-- Time Rows -->
                    ${hours.map(hour => {
                        const [cellH, cellM] = hour.split(':').map(Number);
                        const cellTotal = cellH * 60 + cellM;
                        const dDay = new Date(dateStr).getDay();

                        let availableTechs = [];
                        let totalServiceableTechs = 0;

                        currentValidTechs.forEach(t => {
                            const scheduleForDay = t.schedule?.[dDay];
                            let startHour = 9;
                            let endHour = 17;
                            if (scheduleForDay) {
                                startHour = parseInt(scheduleForDay.start.split(':')[0], 10);
                                endHour = parseInt(scheduleForDay.end.split(':')[0], 10);
                            }

                            const isWorking = cellH >= startHour && cellH < endHour;
                            if (isWorking) {
                                totalServiceableTechs++;
                                
                                // Check for direct overlap
                                const overlappingApt = dailyApts.find(a => {
                                    if (a.tech_id !== t.id) return false;
                                    const [ah, am] = (a.appointment_time || '08:00').split(':').map(Number);
                                    const s = ah * 60 + am;
                                    const e = s + (a.metadata?.duration_minutes || 60);
                                    return cellTotal >= s && cellTotal < e;
                                });

                                if (!overlappingApt) {
                                    // Check travel padding from PREVIOUS appt
                                    const metric = travelMetrics.get(t.id);
                                    const prevApt = dailyApts
                                        .filter(a => a.tech_id === t.id && (a.appointment_time || '00:00') < hour)
                                        .sort((a,b) => (b.appointment_time || '00:00').localeCompare(a.appointment_time || '00:00'))[0];
                                    
                                    let travelBlocked = false;
                                    if (prevApt) {
                                        const [ph, pm] = prevApt.appointment_time.split(':').map(Number);
                                        const prevEnd = (ph * 60 + pm) + (prevApt.metadata?.duration_minutes || 60);
                                        if (cellTotal < prevEnd + metric.prevTravel) {
                                            travelBlocked = true;
                                        }
                                    }

                                    if (!travelBlocked) {
                                        availableTechs.push(t);
                                    }
                                }
                            }
                        });

                        const isBlocked = availableTechs.length === 0;
                        const hasNoCoverage = currentValidTechs.length === 0;

                        let availOpacity = 0.1 + (Math.min(availableTechs.length, 3) * 0.15);
                        let bgStyle = isBlocked ? 'background: rgba(0,0,0,0.03);' : `background: rgba(34, 197, 94, ${availOpacity});`;

                        let slotText = '';
                        if (hasNoCoverage) slotText = '<span class="text-muted"><i class="bi bi-geo-alt-fill me-1"></i>Select valid location</span>';
                        else if (totalServiceableTechs === 0) slotText = '<span class="text-muted"><i class="bi bi-moon-stars me-1"></i>Off Hours</span>';
                        else if (isBlocked) slotText = '<span class="text-muted"><i class="bi bi-truck me-1"></i>Travel / Booked</span>';
                        else slotText = `<span class="text-success fw-bold"><i class="bi bi-check-circle me-1"></i>Available</span>`;

                        return `
                            <div class="p-2 border-bottom border-end text-muted small text-center position-sticky" style="background:#f8fafc; min-height: 60px; left: 0; z-index: 1;">
                                ${formatTime(hour)}
                            </div>
                            <div class="p-1 border-bottom border-end calendar-day position-relative ${isBlocked ? 'bg-light select-slot-disabled' : 'select-slot-btn'}" 
                                style="min-height: 60px; ${bgStyle} ${isBlocked ? 'cursor: not-allowed;' : 'cursor: pointer;'}"
                                data-tech="${availableTechs[0]?.id || ''}" data-time="${hour}">
                                <div class="w-100 h-100 d-flex align-items-center justify-content-center small" ${isBlocked ? 'style="background: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.02) 10px, rgba(0,0,0,0.02) 20px);"' : ''}>
                                    ${slotText}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
            container.innerHTML = gridHtml;
            overlay.classList.add('d-none');
            loader.classList.add('d-none');

            // ... rest of binding
            container.querySelectorAll('.select-slot-btn').forEach(cell => {
                cell.addEventListener('click', (e) => {
                    // Prevent click if clicking on an existing task or blocked cell
                    if(e.target.closest('.cal-task-pill') || cell.classList.contains('select-slot-disabled')) return;
                    
                    const time = cell.dataset.time;
                    const techId = cell.dataset.tech;
                    
                    // Update Time Dropdown
                    const timeSelect = modal.element.querySelector('[name="appointment_time"]');
                    if(timeSelect) timeSelect.value = time;

                    // Update Tech ID Selection
                    selectedTechId = techId;
                    
                    // Highlight selected slot
                    container.querySelectorAll('.select-slot-btn').forEach(c => c.style.backgroundColor = '');
                    cell.style.backgroundColor = '#e0f2fe'; // light blue highlight
                });
            });
        };

        const dateInput = modal.element.querySelector('[name="schedule_date"]');
        if (dateInput) {
            // Only add this event listener ONCE
            dateInput.addEventListener('change', (e) => {
                updateTechOptions();
                updateDailyGrid(e.target.value);
            });
            
            // Auto-select today to show standard matrix initially!
            const todayStr = new Date().toISOString().split('T')[0];
            dateInput.value = todayStr;
        }

        // initial build for tech -> builds validTechs array before initial grid render
        updateTechOptions();
        
        if (dateInput) {
            updateDailyGrid(dateInput.value);
        }

        // Map
        const map = L.map('apt-map').setView([24.7136, 46.6753], 10);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        let marker;

        const updateTravelHints = async () => {
            const dateStr = modal.element.querySelector('[name="schedule_date"]').value;
            const timeStr = modal.element.querySelector('[name="appointment_time"]').value;
            const lat = modal.element.querySelector('[name="lat"]').value;
            const lng = modal.element.querySelector('[name="lng"]').value;

            const hintsContainer = modal.element.querySelector('#travel-hints-container');
            const hintsContent = modal.element.querySelector('#travel-hints-content');

            if (!dateStr || !timeStr || !lat || !lng) {
                hintsContainer.classList.add('d-none');
                return;
            }

            hintsContent.innerHTML = '<div class="text-xs text-muted">Calculating road network routes...</div>';
            hintsContainer.classList.remove('d-none');

            let hintsHtml = '';
            const promises = currentValidTechs.map(async (tech) => {
                const adj = findAdjacentAppointments(tech.id, dateStr, timeStr, allAppointments, tech.metadata?.base_location);
                
                if (adj.prev) {
                    const dist = calculateDistance(parseFloat(lat), parseFloat(lng), adj.prev.lat, adj.prev.lng);
                    const dur = await estimateDuration(parseFloat(lat), parseFloat(lng), adj.prev.lat, adj.prev.lng);
                    
                    hintsHtml += `
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <span><strong>${tech.user_name}:</strong> ${dur} mins from ${adj.prev.source}</span>
                            <span class="text-xs badge badge-pale-info">${dist.toFixed(1)} km</span>
                        </div>
                    `;
                }
            });

            await Promise.all(promises);
            hintsContent.innerHTML = hintsHtml || '<div class="text-xs text-muted">No preceding travel context found for this technician.</div>';
        };

        map.on('click', async (e) => {
            const { lat, lng } = e.latlng;
            if (marker) map.removeLayer(marker);
            marker = L.marker(e.latlng).addTo(map);
            modal.element.querySelector('[name="lat"]').value = lat;
            modal.element.querySelector('[name="lng"]').value = lng;
            
            // Auto fill address
            const locInput = modal.element.querySelector('[name="location_name"]');
            locInput.placeholder = "Loading address...";
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
                const geoData = await res.json();
                if(geoData && geoData.display_name) {
                    locInput.value = geoData.display_name;
                }
            } catch(err) {
                console.warn("Reverse geocode failed", err);
                locInput.placeholder = "Enter address manually";
            }

            updateTechOptions(lat, lng);
            const dateStr = modal.element.querySelector('[name="schedule_date"]').value;
            updateDailyGrid(dateStr);
            updateTravelHints();
        });

        modal.element.querySelector('[name="schedule_date"]').addEventListener('change', (e) => {
            const lat = modal.element.querySelector('[name="lat"]').value;
            const lng = modal.element.querySelector('[name="lng"]').value;
            updateTechOptions(lat, lng);
            updateDailyGrid(e.target.value);
            updateTravelHints();
        });
        
        modal.element.querySelector('[name="appointment_time"]').addEventListener('change', updateTravelHints);

        const form = modal.element.querySelector('#add-apt-form');
        form.onsubmit = async (e) => {
            e.preventDefault();
            
            if(!selectedTechId) {
                return alert("Please select a valid time slot from the daily chart first.");
            }
            if(!modal.element.querySelector('#auto_van_id').value) {
                return alert("The selected location is not covered by any VAN.");
            }

            const fd = new FormData(form);
            const data = Object.fromEntries(fd);
            const id = 'APT-' + Math.random().toString(36).substr(2, 9).toUpperCase();
            
            // Extract custom fields
            const customData = {};
            for (const key in data) {
                if (key.startsWith('custom_')) {
                    customData[key.replace('custom_', '')] = data[key];
                    delete data[key]; // Do not store at root
                }
            }

            // Extract Products & Snapshot Hardware Requirements (Instruction 1 & 2)
            const selectedProducts = [];
            const requiredHardwareMap = {}; // catalog_id -> { item_name, count }
            let totalDurationMin = 0;
            
            const prodCheckboxes = modal.element.querySelectorAll('.product-type-chk:checked');
            for (const chk of prodCheckboxes) {
                const ptId = chk.value;
                selectedProducts.push(ptId);
                totalDurationMin += parseInt(chk.dataset.duration || '0', 10);
                
                const pt = allProductTypes.find(p => p.id === ptId);
                if (!pt || !pt.catalog_id) {
                    return alert(`Critical Data Error: Product ${ptId} lacks a mandatory Hardware Type link.`);
                }

                // Primary Hardware
                const primaryHw = hardwareMap[pt.catalog_id];
                if (!primaryHw) return alert(`Hardware Type ${pt.catalog_id} not found in inventory catalog.`);
                
                requiredHardwareMap[pt.catalog_id] = requiredHardwareMap[pt.catalog_id] || { item_name: primaryHw.item_name, count: 0 };
                requiredHardwareMap[pt.catalog_id].count++;

                // Additional Requirements
                if (pt.hardware_requirements) {
                    pt.hardware_requirements.forEach(extraHwId => {
                        const extraHw = hardwareMap[extraHwId];
                        if (!extraHw) return alert(`Additional Hardware Type ${extraHwId} not found in inventory.`);
                        requiredHardwareMap[extraHwId] = requiredHardwareMap[extraHwId] || { item_name: extraHw.item_name, count: 0 };
                        requiredHardwareMap[extraHwId].count++;
                    });
                }
            }

            if (selectedProducts.length === 0) {
                return alert("Please select at least one product for this appointment.");
            }

            const requiredHardwareSnapshot = Object.entries(requiredHardwareMap).map(([cid, val]) => ({
                catalog_id: cid,
                item_name: val.item_name,
                count: val.count
            }));

            // Technician Context (Instruction 4)
            const tech = userDataArray.find(u => u.id === selectedTechId);
            const dateObj = new Date(data.schedule_date);
            const dayIdx = dateObj.getDay();
            const schedule = tech?.schedule?.[dayIdx] || { start: '09:00', end: '17:00' };
            const shiftEndStr = schedule.end;
            const [startH, startM] = data.appointment_time.split(':').map(Number);
            const startTotal = startH * 60 + startM;
            const [endH, endM] = shiftEndStr.split(':').map(Number);
            const shiftEndTotal = endH * 60 + endM;

            // Calculate Travel Buffers (Instruction 4)
            const adj = findAdjacentAppointments(selectedTechId, data.schedule_date, data.appointment_time, allAppointments, tech?.metadata?.base_location);
            let travel_buffer_before = 0;
            let travel_buffer_after = 0;
            
            if (adj.prev) {
                travel_buffer_before = await estimateDuration(parseFloat(data.lat), parseFloat(data.lng), adj.prev.lat, adj.prev.lng);
            }
            if (adj.next) {
                travel_buffer_after = await estimateDuration(parseFloat(data.lat), parseFloat(data.lng), adj.next.lat, adj.next.lng);
            }

            // Duration Validation (Instruction 4)
            const appEndWithTravel = startTotal + totalDurationMin + travel_buffer_after;

            if (appEndWithTravel > shiftEndTotal) {
                return alert(`Appointment duration + Travel (${totalDurationMin + travel_buffer_after} min) exceeds technician's shift. Shift ends at ${shiftEndStr}.`);
            }

            // Check for overlaps with other appointments (Inc. Travel Padding)
            const dayApts = allAppointments.filter(a => a.schedule_date === data.schedule_date && a.tech_id === selectedTechId && !a.is_deleted);
            for (const apt of dayApts) {
                const aptStart = apt.appointment_time;
                const aptDuration = apt.metadata?.duration_minutes || 60;
                const [ah, am] = aptStart.split(':').map(Number);
                const s = ah * 60 + am;
                const e = s + aptDuration;
                
                // If the new appointment start - travel overlaps with existing end
                if (startTotal - travel_buffer_before < e && startTotal + totalDurationMin + travel_buffer_after > s) {
                    return alert(`Schedule conflict! Travel or Job duration overlaps with an existing booking at ${aptStart}.`);
                }
            }
            
            try {
                await firebase.db.setDoc(firebase.db.doc(firebase.db.db, 'appointments', id), {
                    appointment_id: id,
                    ...data,
                    tech_id: selectedTechId,
                    van_id: data.auto_van_id,
                    status: 'pending',
                    created_at: firebase.db.serverTimestamp(),
                    metadata: { 
                        hardware: [], 
                        location: { lat: data.lat, lng: data.lng },
                        custom_data: customData,
                        products: selectedProducts,
                        required_hardware: requiredHardwareSnapshot, // Frozen snapshot of what is needed
                        duration_minutes: totalDurationMin,
                        travel_buffer_before,
                        travel_buffer_after
                    }
                });

                // Sync to Google Calendar
                const gToken = localStorage.getItem('google_oauth_access_token');
                if (gToken) {
                    try {
                        const startTime = new Date(`${data.schedule_date}T${data.appointment_time}`);
                        const endTime = new Date(startTime.getTime() + (totalDurationMin || 60) * 60 * 1000); // Dynamic duration or fallback to 1 hour
                        
                        const calResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${gToken}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                summary: `${data.appointment_name}`,
                                location: data.location_name,
                                description: `Pico Job ID: ${id}\nTech: ${selectedTechId}\nVan: ${data.auto_van_id}`,
                                start: { dateTime: startTime.toISOString() },
                                end: { dateTime: endTime.toISOString() }
                            })
                        });
                        
                        if (calResponse.ok) {
                            console.log("Created Google Calendar Event successfully");
                        } else {
                            const errorData = await calResponse.json();
                            console.error("Google Calendar API Error:", errorData);
                            alert(`Google Calendar Sync Failed (${calResponse.status}). If your login expired, log out and back in. Check console for details.`);
                        }
                    } catch (cerr) { 
                        console.error("Google Calendar network error:", cerr); 
                        alert("Network error while syncing to Google Calendar.");
                    }
                } else {
                    console.warn("No google_oauth_access_token found. Calendar sync skipped.");
                    alert("Appointment created! Note: Google Calendar sync was skipped because you are not fully signed in with Google Calendar permissions (Sign out and sign back in to enable).");
                }

                firebase.logAction("Appointment Scheduled", `Job ${id} created`);
                modal.hide();
            } catch (err) { alert(err.message); }
        };
    });

    view.on('init', () => {
        // Load Appointments
        view.emit('loading:start');
        view.unsub(firebase.db.subscribe(firebase.db.collection(firebase.db.db, 'appointments'), (snap) => {
            const list = view.$('apt-list');
            view.emit('loading:end');
            if (!list) return;
            view.delete('apt-list');
            if (snap && snap.forEach) {
                snap.forEach(doc => {
                    const apt = doc.data();
                    if (apt.is_deleted) return;
                    const row = document.createElement('tr');
                        row.innerHTML = `
                            <td><code class="data-mono fw-bold">${apt.appointment_id}</code></td>
                            <td>${apt.appointment_name}</td>
                            <td>${apt.schedule_date}</td>
                            <td>${apt.appointment_time || '-'}</td>
                            <td>${apt.location_name || '-'}</td>
                            <td>${apt.tech_id || 'Unassigned'}</td>
                            <td><span class="badge ${apt.status === 'pending' ? 'badge-pale-warning' : 'badge-pale-success'}">${apt.status}</span></td>
                            <td>
                                <button class="btn-pico btn-pico-outline table-action-btn view-apt" data-id="${apt.appointment_id}">
                                    <i class="bi bi-eye"></i>
                                </button>
                                <button class="btn-pico btn-pico-danger-outline table-action-btn delete-apt auth-appointments:delete hidden" data-id="${apt.appointment_id}">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </td>
                        `;
                        row.querySelector('.view-apt').addEventListener('click', () => {
                            window.location.hash = `#appointment/${apt.appointment_id}`;
                        });
                        const deleteBtn = row.querySelector('.delete-apt');
                        if (deleteBtn) {
                            deleteBtn.addEventListener('click', async (e) => {
                                e.stopPropagation();
                                
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
                                        // If appointment is not complete, free up hardware
                                        if (apt.status !== 'completed' && apt.metadata && Array.isArray(apt.metadata.hardware)) {
                                            const updates = [];
                                            apt.metadata.hardware.forEach(hw => {
                                                if (hw.pico_id) {
                                                    updates.push(firebase.db.updateDoc(firebase.db.doc(firebase.db.db, 'items', hw.pico_id), {
                                                        status: 'available',
                                                        is_available: true,
                                                        current_location_type: 'WAREHOUSE',
                                                        current_location_id: ''
                                                    }));
                                                }
                                                if (hw.sim_id) {
                                                    updates.push(firebase.db.updateDoc(firebase.db.doc(firebase.db.db, 'items', hw.sim_id), {
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

                                        await firebase.db.updateDoc(firebase.db.doc(firebase.db.db, 'appointments', apt.appointment_id), { is_deleted: true });
                                        console.log("Appointment deleted.");
                                    } catch (err) {
                                        console.error('Delete failed: ', err.message);
                                    }
                                };
                                
                                modal.show();
                            });
                        }
                        const list = view.$('apt-list');
                        if (list) list.appendChild(row);
                    });
            }
            
            document.dispatchEvent(new CustomEvent('apply-auth'));
        }));
    });

    return view;
}
