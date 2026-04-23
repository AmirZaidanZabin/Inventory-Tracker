import { controller } from '../lib/controller.js';
import { firebase } from '../lib/firebase.js';
import { createModal } from '../lib/modal.js';
import { renderTable } from '../lib/table.js';
import { calculateDistance, estimateDuration, findAdjacentAppointments, isUserOnVacation } from '../lib/travel-logic.js';

export function AppointmentsView() {
    const view = controller({
        stringComponent: `
            <div class="appointments-view">
                <style>
                    .locked-overlay { position: absolute; inset: 0; background: rgba(255,255,255,0.8); z-index: 50; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(2px); border-radius: 8px; }
                    .hw-counter-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
                    .hw-controls { display: flex; align-items: center; background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; }
                    .hw-btn { background: transparent; border: none; padding: 4px 12px; cursor: pointer; color: #475569; font-weight: bold; transition: background 0.2s; }
                    .hw-btn:hover { background: #f1f5f9; color: #0f172a; }
                    .hw-count { padding: 4px 16px; font-weight: 600; font-family: monospace; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; min-width: 40px; text-align: center; }
                </style>
                <div class="d-flex justify-content-end mb-4">
                    <button id="open-add-apt" class="btn-pico btn-pico-primary auth-appointments:create hidden">
                        <i class="bi bi-calendar-plus me-2"></i>Schedule Appointment
                    </button>
                </div>

                <div class="card border-0 shadow-sm">
                    <div class="card-body p-0">
                        ${renderTable({
                            headers: ['Job ID', 'Customer', 'Date', 'Time', 'Location', 'Tech', 'Status', 'Actions'],
                            tbodyId: 'apt-list',
                            emptyMessage: 'Loading appointments...'
                        })}
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
                                    <option value="" disabled selected>Select from Grid...</option>
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
                                <div id="apt-map" class="border" style="height: 200px; border-radius: 8px; z-index: 1;"></div>
                                <input type="hidden" name="lat"><input type="hidden" name="lng">
                            </div>

                            <div class="col-12 mt-2" id="hardware-selection-container"></div>
                            <div class="col-12 mt-2" id="custom-fields-container"></div>
                            
                            <div class="col-12 mt-4">
                                <button type="submit" class="btn-pico btn-pico-primary w-100">Book Appointment</button>
                            </div>
                        </form>
                    </div>
                    
                    <div class="col-lg-7 border-start position-relative">
                        <div id="availability-locked-overlay" class="locked-overlay">
                            <div class="text-center">
                                <div class="spinner-border spinner-border-sm text-primary mb-2 d-none" id="availability-loading"></div>
                                <h6 class="fw-bold text-dark mb-1"><i class="bi bi-geo-alt me-1"></i>Location Required</h6>
                                <p class="text-xs text-muted mb-0">Select a point on the map to unlock technician slots.</p>
                            </div>
                        </div>
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h6 class="fw-bold mb-0">Daily Schedule View</h6>
                            <h6 class="text-muted mb-0 small" id="daily-view-date">No date selected</h6>
                        </div>
                        <div class="calendar-grid w-100 rounded border overflow-auto" style="height: 60vh; min-height: 400px;">
                            <div id="daily-schedule-container" style="min-width: 600px;">
                                <div class="text-muted small p-3 text-center">Please select a date and location.</div>
                            </div>
                        </div>
                    </div>
                </div>
            `
        });

        modal.show();

        const [vans, users, rawApts, rawItemCatalog] = await Promise.all([
            firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'vans')),
            firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'users')),
            firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'appointments')),
            firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'item_catalog'))
        ]);
        
        let allAppointments = rawApts.docs.map(d => d.data());
        let allHardwareTypes = rawItemCatalog.docs.map(d => ({ id: d.id, ...d.data() }));

        const userDataArray = users.docs.map(u => ({ id: u.id, ...u.data() }));
        const vanDataArray = vans.docs.map(v => ({ id: v.id, ...v.data() }));

        // Render Hardware Quantity UI
        const hwContainer = modal.element.querySelector('#hardware-selection-container');
        let currentTotalDuration = 0;

        if (hwContainer && allHardwareTypes.length > 0) {
            let html = `<div class="col-12 mt-3 p-3 border rounded bg-white shadow-sm">
                <div class="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                    <h6 class="text-dark mb-0 fw-bold"><i class="bi bi-box-seam me-2 text-primary"></i>Hardware Requirements</h6>
                    <div id="total-duration-tracker" class="badge badge-pale-primary text-sm">Total: 0 min</div>
                </div>
                <div class="d-flex flex-column gap-2" id="hw-counters-list">`;
            
            allHardwareTypes.forEach(hw => {
                const duration = parseInt(hw.duration_minutes || '30', 10);
                html += `
                    <div class="hw-counter-box d-flex justify-content-between align-items-center">
                        <div>
                            <div class="fw-bold text-dark text-sm">${hw.item_name}</div>
                            <div class="text-xs text-muted">${hw.item_type} • ${duration} min</div>
                        </div>
                        <div class="hw-controls">
                            <button type="button" class="hw-btn hw-dec" data-id="${hw.id}" data-duration="${duration}">-</button>
                            <div class="hw-count" id="count-${hw.id}">0</div>
                            <button type="button" class="hw-btn hw-inc" data-id="${hw.id}" data-duration="${duration}">+</button>
                        </div>
                    </div>
                `;
            });
            html += `</div></div>`;
            hwContainer.innerHTML = html;
            
            const counters = {};
            allHardwareTypes.forEach(h => counters[h.id] = 0);

            const updateDuration = () => {
                currentTotalDuration = 0;
                allHardwareTypes.forEach(hw => {
                    currentTotalDuration += (counters[hw.id] * parseInt(hw.duration_minutes || '30', 10));
                });
                const tracker = modal.element.querySelector('#total-duration-tracker');
                if(tracker) {
                    tracker.textContent = `Total: ${currentTotalDuration} min`;
                    tracker.className = currentTotalDuration > 480 ? 'badge badge-pale-danger text-sm' : 'badge badge-pale-primary text-sm';
                }
            };

            hwContainer.querySelectorAll('.hw-inc').forEach(btn => {
                btn.onclick = () => {
                    const id = btn.dataset.id;
                    counters[id]++;
                    hwContainer.querySelector(`#count-${id}`).textContent = counters[id];
                    updateDuration();
                };
            });

            hwContainer.querySelectorAll('.hw-dec').forEach(btn => {
                btn.onclick = () => {
                    const id = btn.dataset.id;
                    if(counters[id] > 0) {
                        counters[id]--;
                        hwContainer.querySelector(`#count-${id}`).textContent = counters[id];
                        updateDuration();
                    }
                };
            });

            // Store counters getter for form submission
            hwContainer.getHardwarePayload = () => {
                const payload = [];
                allHardwareTypes.forEach(hw => {
                    if(counters[hw.id] > 0) {
                        payload.push({
                            catalog_id: hw.catalog_id || hw.id,
                            item_name: hw.item_name,
                            count: counters[hw.id]
                        });
                    }
                });
                return payload;
            };
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
                modal.element.querySelector('#location-status').innerHTML = `<span class="badge badge-pale-success"><i class="bi bi-check-circle me-1"></i>Covered by ${validVans.length} VAN(s).</span>`;
                
                let techIds = new Set();
                validVans.forEach(v => {
                    if(v.assigned_users) v.assigned_users.forEach(uid => techIds.add(uid));
                });
                validTechs = userDataArray.filter(u => techIds.has(u.user_id));
            } else if (lat && lng) {
                modal.element.querySelector('#auto_van_id').value = '';
                modal.element.querySelector('#location-status').innerHTML = `<span class="badge badge-pale-danger"><i class="bi bi-exclamation-triangle me-1"></i>Out of bounds.</span>`;
            }

            if (dateStr && validTechs.length > 0) {
                const d = new Date(dateStr);
                const dayIdx = d.getDay(); 
                validTechs = validTechs.filter(u => !!(u.schedule && u.schedule[dayIdx]));
            }

            currentValidTechs = validTechs;
            currentValidVans = validVans;
        };

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
                return `${hInt % 12 || 12}:${m} ${ampm}`;
            }

            const travelMetrics = new Map(); 
            await Promise.all(currentValidTechs.map(async (t) => {
                const adj = findAdjacentAppointments(t.id, dateStr, '12:00', dailyApts, t.metadata?.base_location);
                let prevTravel = 0;
                if (adj.prev) prevTravel = await estimateDuration(parseFloat(lat), parseFloat(lng), adj.prev.lat, adj.prev.lng);
                travelMetrics.set(t.id, { prevTravel, adj });
            }));

            const gridHtml = `
                <div class="calendar-grid bg-white" style="display: grid; grid-template-columns: 80px 1fr; gap: 0;">
                    <div class="p-2 border-bottom border-end bg-light text-center fw-bold small sticky-top position-sticky" style="z-index: 3; left: 0;">Time</div>
                    <div class="p-2 border-bottom border-end bg-light text-center fw-bold small sticky-top" style="z-index: 2;">Availability (Inc. Travel)</div>
                    
                    ${hours.map(hour => {
                        const [cellH, cellM] = hour.split(':').map(Number);
                        const cellTotal = cellH * 60 + cellM;
                        const dDay = new Date(dateStr).getDay();

                        let availableTechs = [];
                        let totalServiceableTechs = 0;

                        currentValidTechs.forEach(t => {
                            const sched = t.schedule?.[dDay];
                            let startHour = sched ? parseInt(sched.start.split(':')[0], 10) : 9;
                            let endHour = sched ? parseInt(sched.end.split(':')[0], 10) : 17;

                            const onVacation = isUserOnVacation(t, dateStr);

                            if (cellH >= startHour && cellH < endHour && !onVacation) {
                                totalServiceableTechs++;
                                
                                const overlappingApt = dailyApts.find(a => {
                                    if (a.tech_id !== t.id) return false;
                                    const [ah, am] = (a.appointment_time || '08:00').split(':').map(Number);
                                    const s = ah * 60 + am;
                                    const e = s + (a.metadata?.duration_minutes || 60);
                                    return cellTotal >= s && cellTotal < e;
                                });

                                if (!overlappingApt) {
                                    const metric = travelMetrics.get(t.id);
                                    const prevApt = dailyApts
                                        .filter(a => a.tech_id === t.id && (a.appointment_time || '00:00') < hour)
                                        .sort((a,b) => (b.appointment_time || '00:00').localeCompare(a.appointment_time || '00:00'))[0];
                                    
                                    let travelBlocked = false;
                                    if (prevApt) {
                                        const [ph, pm] = prevApt.appointment_time.split(':').map(Number);
                                        const prevEnd = (ph * 60 + pm) + (prevApt.metadata?.duration_minutes || 60);
                                        if (cellTotal < prevEnd + metric.prevTravel) travelBlocked = true;
                                    }
                                    if (!travelBlocked) availableTechs.push(t);
                                }
                            }
                        });

                        const isBlocked = availableTechs.length === 0;
                        const hasNoCoverage = currentValidTechs.length === 0;

                        let availOpacity = 0.1 + (Math.min(availableTechs.length, 3) * 0.15);
                        let bgStyle = isBlocked ? 'background: #f8fafc;' : `background: rgba(34, 197, 94, ${availOpacity});`;

                        let slotText = '';
                        if (hasNoCoverage) slotText = '<span class="text-muted"><i class="bi bi-geo-alt-fill me-1"></i>No area coverage</span>';
                        else if (totalServiceableTechs === 0) {
                            // Check if all techs in this shift are on vacation
                            const anyShiftMemberNotOnVacation = currentValidTechs.some(t => {
                                const sched = t.schedule?.[dDay];
                                let startHour = sched ? parseInt(sched.start.split(':')[0], 10) : 9;
                                let endHour = sched ? parseInt(sched.end.split(':')[0], 10) : 17;
                                return cellH >= startHour && cellH < endHour;
                            });
                            
                            const allOnVacation = anyShiftMemberNotOnVacation && currentValidTechs.every(t => {
                                const sched = t.schedule?.[dDay];
                                let startHour = sched ? parseInt(sched.start.split(':')[0], 10) : 9;
                                let endHour = sched ? parseInt(sched.end.split(':')[0], 10) : 17;
                                if (cellH >= startHour && cellH < endHour) {
                                    return isUserOnVacation(t, dateStr);
                                }
                                return true;
                            });

                            if (allOnVacation) {
                                slotText = '<span class="text-danger fw-bold"><i class="bi bi-sun me-1"></i>On Vacation</span>';
                            } else {
                                slotText = '<span class="text-muted"><i class="bi bi-moon-stars me-1"></i>Off Hours</span>';
                            }
                        }
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

            container.querySelectorAll('.select-slot-btn').forEach(cell => {
                cell.addEventListener('click', (e) => {
                    if(cell.classList.contains('select-slot-disabled')) return;
                    
                    const timeSelect = modal.element.querySelector('[name="appointment_time"]');
                    if(timeSelect) timeSelect.value = cell.dataset.time;
                    selectedTechId = cell.dataset.tech;
                    
                    container.querySelectorAll('.select-slot-btn').forEach(c => c.style.border = '');
                    cell.style.border = '2px solid #3b82f6'; 
                });
            });
        };

        const dateInput = modal.element.querySelector('[name="schedule_date"]');
        if (dateInput) {
            dateInput.addEventListener('change', (e) => {
                updateTechOptions(modal.element.querySelector('[name="lat"]').value, modal.element.querySelector('[name="lng"]').value);
                updateDailyGrid(e.target.value);
            });
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        const map = L.map('apt-map').setView([24.7136, 46.6753], 10);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
            maxZoom: 19
        }).addTo(map);
        setTimeout(() => map.invalidateSize(), 500);
        let marker;

        // Add Search Geocoder (Triggers the click event to auto-place marker)
        L.Control.geocoder({
            defaultMarkGeocode: false,
            placeholder: 'Search service address...',
            position: 'topleft'
        }).on('markgeocode', function(e) {
            const center = e.geocode.center;
            map.setView(center, 15);
            // Simulate a map click to trigger reverse geocoding and tech logic
            map.fireEvent('click', { latlng: center });
        }).addTo(map);

        map.on('click', async (e) => {
            const { lat, lng } = e.latlng;
            if (marker) map.removeLayer(marker);
            marker = L.marker(e.latlng).addTo(map);
            modal.element.querySelector('[name="lat"]').value = lat;
            modal.element.querySelector('[name="lng"]').value = lng;
            
            const locInput = modal.element.querySelector('[name="location_name"]');
            locInput.placeholder = "Loading address...";
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
                const geoData = await res.json();
                if(geoData && geoData.display_name) locInput.value = geoData.display_name;
            } catch(err) { locInput.placeholder = "Enter address manually"; }

            updateTechOptions(lat, lng);
            updateDailyGrid(modal.element.querySelector('[name="schedule_date"]').value);
        });

        const form = modal.element.querySelector('#add-apt-form');
        form.onsubmit = async (e) => {
            e.preventDefault();
            
            if(!selectedTechId) return alert("Please select an available time slot from the daily chart.");
            if(!modal.element.querySelector('#auto_van_id').value) return alert("Location is not covered by any VAN.");

            const requiredHardwarePayload = hwContainer.getHardwarePayload();
            if (requiredHardwarePayload.length === 0) return alert("Please add at least one hardware item using the counters.");

            const fd = new FormData(form);
            const data = Object.fromEntries(fd);
            const id = 'APT-' + Math.random().toString(36).substr(2, 9).toUpperCase();
            
            const customData = {};
            for (const key in data) {
                if (key.startsWith('custom_')) {
                    customData[key.replace('custom_', '')] = data[key];
                    delete data[key]; 
                }
            }

            const tech = userDataArray.find(u => u.id === selectedTechId);
            const schedule = tech?.schedule?.[new Date(data.schedule_date).getDay()] || { start: '09:00', end: '17:00' };
            const shiftEndTotal = parseInt(schedule.end.split(':')[0], 10) * 60 + parseInt(schedule.end.split(':')[1], 10);
            const startTotal = parseInt(data.appointment_time.split(':')[0], 10) * 60 + parseInt(data.appointment_time.split(':')[1], 10);

            if (startTotal + currentTotalDuration > shiftEndTotal) {
                return alert(`Duration (${currentTotalDuration}m) exceeds shift end (${schedule.end}).`);
            }
            
            const btn = modal.element.querySelector('button[type="submit"]');
            const ogBtn = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Booking...';
            
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
                        required_hardware: requiredHardwarePayload,
                        duration_minutes: currentTotalDuration
                    }
                });

                firebase.logAction("Appointment Scheduled", `Job ${id} created`);
                modal.hide();
            } catch (err) { 
                alert(err.message); 
                btn.disabled = false;
                btn.innerHTML = ogBtn;
            }
        };
    });

    view.on('init', () => {
        view.emit('loading:start');
        view.unsub(firebase.db.subscribe(firebase.db.collection(firebase.db.db, 'appointments'), (snap) => {
            const list = view.$('apt-list');
            view.emit('loading:end');
            if (!list) return;
            list.innerHTML = '';
            
            if (snap && snap.forEach) {
                snap.forEach(doc => {
                    const apt = doc.data();
                    if (apt.is_deleted) return;
                    const row = document.createElement('tr');
                        row.innerHTML = `
                            <td><code class="data-mono fw-bold">${apt.appointment_id}</code></td>
                            <td class="fw-bold">${apt.appointment_name}</td>
                            <td>${apt.schedule_date}</td>
                            <td>${apt.appointment_time || '-'}</td>
                            <td class="text-truncate" style="max-width: 150px;" title="${apt.location_name}">${apt.location_name || '-'}</td>
                            <td>${apt.tech_id || 'Unassigned'}</td>
                            <td><span class="badge ${apt.status === 'pending' ? 'badge-pale-warning' : 'badge-pale-success'} text-capitalize">${apt.status}</span></td>
                            <td>
                                <button class="btn-pico btn-pico-outline table-action-btn view-apt me-1" data-id="${apt.appointment_id}" title="View Details">
                                    <i class="bi bi-eye"></i>
                                </button>
                                <button class="btn-pico btn-pico-danger-outline table-action-btn delete-apt auth-appointments:delete hidden" data-id="${apt.appointment_id}" title="Delete">
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
                                        <div class="text-center py-3">
                                            <i class="bi bi-exclamation-triangle-fill text-danger mb-3" style="font-size: 3rem;"></i>
                                            <h5 class="fw-bold">Delete Appointment?</h5>
                                            <div class="d-flex justify-content-center gap-2 mt-4">
                                                <button type="button" class="btn-pico btn-pico-outline cancel-btn">Cancel</button>
                                                <button type="button" class="btn-pico btn-pico-danger-outline confirm-btn">Delete</button>
                                            </div>
                                        </div>
                                    `
                                });
                                modal.element.querySelector('.cancel-btn').onclick = () => modal.hide();
                                modal.element.querySelector('.confirm-btn').onclick = async () => {
                                    modal.hide();
                                    try {
                                        await firebase.db.updateDoc(firebase.db.doc(firebase.db.db, 'appointments', apt.appointment_id), { is_deleted: true });
                                    } catch (err) { console.error('Delete failed: ', err.message); }
                                };
                                modal.show();
                            });
                        }
                        list.appendChild(row);
                    });
            }
            document.dispatchEvent(new CustomEvent('apply-auth'));
        }));
    });

    return view;
}
