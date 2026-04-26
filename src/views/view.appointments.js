import { controller, debounce } from '../lib/controller.js';
import { db } from '../lib/db/index.js';
import { formatServerToLocalTime } from '../lib/timezone.js';

import { createModal } from '../lib/modal.js';
import { renderTable } from '../lib/table.js';
import { calculateDistance, estimateDuration, findAdjacentAppointments, isUserOnVacation } from '../lib/travel-logic.js';

export function AppointmentsView() {
    let currentPage = 1;
    let aptsUnsub = null;

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
                <div class="d-flex flex-wrap gap-3 align-items-end justify-content-between mb-4">
                    <div class="d-flex flex-wrap gap-2 align-items-end flex-grow-1">
                        <div style="min-width: 150px;">
                            <label class="form-label small fw-bold text-muted mb-1">Filter by Date</label>
                            <input type="date" id="filter-date" class="form-control form-control-sm">
                        </div>
                        <div style="min-width: 140px;">
                            <label class="form-label small fw-bold text-muted mb-1">Status</label>
                            <select id="filter-status" class="form-select form-select-sm">
                                <option value="">None</option>
                                <option value="scheduled">Scheduled</option>
                                <option value="rescheduled">Rescheduled</option>
                                <option value="completed">Completed</option>
                            </select>
                        </div>
                        <div style="min-width: 140px;">
                            <label class="form-label small fw-bold text-muted mb-1">City</label>
                            <input type="text" id="filter-city" class="form-control form-control-sm" placeholder="Search City...">
                        </div>
                        <div style="min-width: 140px;">
                            <label class="form-label small fw-bold text-muted mb-1">PS/Tech ID</label>
                            <input type="text" id="filter-tech" class="form-control form-control-sm" placeholder="Search Tech ID...">
                        </div>
                        <button id="bulk-delete-apt" class="btn-pico btn-pico-danger-outline auth-appointments:delete hidden" style="display:none; height: 31px;">
                            <i class="bi bi-trash"></i> Delete Selected (<span id="bulk-delete-count">0</span>)
                        </button>
                    </div>
                    <button id="open-add-apt" class="btn-pico btn-pico-primary auth-appointments:create hidden">
                        <i class="bi bi-calendar-plus me-2"></i>Schedule Appointment
                    </button>
                </div>

                <div class="card border-0 shadow-sm">
                    <div class="card-body p-0">
                        ${renderTable({
                            headers: ['<input type="checkbox" id="apt-select-all" class="form-check-input">', 'Job ID', 'Customer', 'Date', 'Time', 'Location', 'Technician (PS ID)', 'Status', 'Actions'],
                            tbodyId: 'apt-list',
                            emptyMessage: 'Loading appointments...',
                            pagination: true
                        })}
                    </div>
                </div>
            </div>
        `
    });

    view.onboard({ id: 'open-add-apt' }).onboard({ id: 'apt-list' })
        .onboard({ id: 'filter-date' }).onboard({ id: 'filter-status' })
        .onboard({ id: 'filter-city' }).onboard({ id: 'filter-tech' })
        .onboard({ id: 'apt-list-prev-btn' }).onboard({ id: 'apt-list-next-btn' }).onboard({ id: 'apt-list-page-indicator' });

    let userMap = {}; // Lookup for human-readable names

    const openAppointmentModal = async (existingAptData = null) => {
        const isUpdate = !!existingAptData;
        const modal = createModal({
            title: isUpdate ? `Reschedule Appointment: ${existingAptData.appointment_id}` : 'Schedule Appointment & Availability',
            width: '1200px',
            body: `
                <div class="row g-4">
                    <div class="col-lg-5">
                        <form id="add-apt-form" class="row g-3">
                            <div class="col-12">
                                <label class="form-label small fw-bold">Customer Name</label>
                                <input type="text" name="appointment_name" class="form-control" value="${existingAptData?.appointment_name || ''}" required>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label small fw-bold">Date</label>
                                <input type="date" name="schedule_date" id="schedule_date_input" class="form-control" value="${existingAptData?.schedule_date || ''}" required>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label small fw-bold">Time Slot</label>
                                <select name="appointment_time" class="form-select" required>
                                    <option value="" disabled ${!isUpdate ? 'selected' : ''}>Select from Grid...</option>
                                    <option value="08:00" ${existingAptData?.appointment_time === '08:00' ? 'selected' : ''}>08:00 AM</option>
                                    <option value="09:00" ${existingAptData?.appointment_time === '09:00' ? 'selected' : ''}>09:00 AM</option>
                                    <option value="10:00" ${existingAptData?.appointment_time === '10:00' ? 'selected' : ''}>10:00 AM</option>
                                    <option value="11:00" ${existingAptData?.appointment_time === '11:00' ? 'selected' : ''}>11:00 AM</option>
                                    <option value="12:00" ${existingAptData?.appointment_time === '12:00' ? 'selected' : ''}>12:00 PM</option>
                                    <option value="13:00" ${existingAptData?.appointment_time === '13:00' ? 'selected' : ''}>01:00 PM</option>
                                    <option value="14:00" ${existingAptData?.appointment_time === '14:00' ? 'selected' : ''}>02:00 PM</option>
                                    <option value="15:00" ${existingAptData?.appointment_time === '15:00' ? 'selected' : ''}>03:00 PM</option>
                                    <option value="16:00" ${existingAptData?.appointment_time === '16:00' ? 'selected' : ''}>04:00 PM</option>
                                    <option value="17:00" ${existingAptData?.appointment_time === '17:00' ? 'selected' : ''}>05:00 PM</option>
                                </select>
                            </div>
                            <div class="col-12">
                                <label class="form-label small fw-bold">Location Address / Description</label>
                                <input type="text" name="location_name" class="form-control" placeholder="Click map to auto-fill" value="${existingAptData?.location_name || ''}" required>
                                <div class="small text-muted mt-1" id="location-status"></div>
                            </div>
                            
                            <input type="hidden" name="auto_van_id" id="auto_van_id" value="${existingAptData?.van_id || ''}">
                            <input type="hidden" id="raw_valid_techs" value="[]">

                            <div class="col-12">
                                <label class="form-label small fw-bold">Service Location</label>
                                <div id="apt-map" class="border" style="height: 200px; border-radius: 8px; z-index: 1;"></div>
                                <input type="hidden" name="lat" value="${existingAptData?.metadata?.location?.lat || ''}">
                                <input type="hidden" name="lng" value="${existingAptData?.metadata?.location?.lng || ''}">
                            </div>

                            <div class="col-12 mt-2" id="hardware-selection-container"></div>
                            <div class="col-12 mt-2" id="custom-fields-container"></div>
                            
                            <div class="col-12 mt-4">
                                <button type="submit" class="btn-pico btn-pico-primary w-100">${isUpdate ? 'Update Appointment' : 'Book Appointment'}</button>
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

        const [vanDataArray, userDataArray, allAppointments, allHardwareTypes] = await Promise.all([
            db.findMany('vans'),
            db.findMany('users'),
            db.findMany('appointments'),
            db.findMany('item_catalog')
        ]);

        // Render Hardware Quantity UI
        const hwContainer = modal.element.querySelector('#hardware-selection-container');
        let currentTotalDuration = 0;
        let selectedStartTime = '';
        let selectedTechId = '';

        const parseTime = (t) => {
            if (!t) return 0;
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
        };

        const formatTimeAMPM = (mins) => {
            const h = Math.floor(mins / 60) % 24;
            const m = mins % 60;
            const ampm = h >= 12 ? 'PM' : 'AM';
            return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`;
        };

        const updateBookingUI = () => {
            const dateHeader = modal.element.querySelector('#daily-view-date');
            const container = modal.element.querySelector('#daily-schedule-container');
            const dateStr = modal.element.querySelector('[name="schedule_date"]')?.value;
            const serverTz = (window.state?.data?.settings?.server_timezone || 'UTC');

            // Update select dropdown labels based on selected date
            const timeSelect = modal.element.querySelector('[name="appointment_time"]');
            if (dateStr && timeSelect && timeSelect.options) {
                Array.from(timeSelect.options).forEach(opt => {
                    if (opt.value) {
                        opt.text = formatServerToLocalTime(dateStr, opt.value, serverTz);
                    }
                });
            }
            
            // 1. Clear previous highlights
            if (container) {
                container.querySelectorAll('.calendar-day').forEach(cell => {
                    cell.style.background = cell.dataset.originalBg || cell.style.background;
                    cell.classList.remove('booking-highlight');
                    cell.style.border = '';
                });
            }

            if (!selectedStartTime || !dateStr) return;

            const startMins = parseTime(selectedStartTime);
            const endMins = startMins + currentTotalDuration;
            
            // 2. Update Header
            const startStr = formatTimeAMPM(startMins);
            const endStr = formatTimeAMPM(endMins);
            
            // Check shift end boundary
            const date = new Date(dateStr);
            const tech = userDataArray.find(u => (u.user_id || u.id) === selectedTechId);
            const userSched = tech?.metadata?.schedule || tech?.schedule;
            const sched = userSched?.[date.getDay()];
            const shiftEndMins = sched ? parseTime(sched.end) : 1020; // 17:00 default
            
            const isExceeding = endMins > shiftEndMins;
            const windowHtml = `<span class="ms-3 ${isExceeding ? 'text-danger fw-bold' : 'text-primary fw-bold'}">
                Selected: ${startStr} - ${endStr} ${isExceeding ? '(Exceeds Shift!)' : ''}
            </span>`;
            
            const baseDateText = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
            if (dateHeader) dateHeader.innerHTML = `${baseDateText} ${windowHtml}`;

            // 3. Visual Grid Highlighting
            if (container) {
                container.querySelectorAll('.calendar-day').forEach(cell => {
                    if (cell.dataset.tech === selectedTechId) {
                        const cellMins = parseTime(cell.dataset.time);
                        // Highlight if cell falls within the booking window
                        // Note: Grid is in 1-hour chunks usually, but duration can be precise. 
                        // We highlight cells that overlap with the window.
                        if (cellMins >= startMins && cellMins < endMins) {
                            if (!cell.dataset.originalBg) cell.dataset.originalBg = cell.style.background;
                            cell.style.background = isExceeding ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.4)';
                            cell.classList.add('booking-highlight');
                            if (cellMins === startMins) cell.style.border = '2px solid #3b82f6';
                        }
                    }
                });
            }
        };

        if (hwContainer && allHardwareTypes.length > 0) {
            const counters = {};
            
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
                updateBookingUI(); // Update window and highlights
            };

            let html = `<div class="col-12 mt-3 p-3 border rounded bg-white shadow-sm">
                <div class="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                    <h6 class="text-dark mb-0 fw-bold"><i class="bi bi-box-seam me-2 text-primary"></i>Hardware Requirements</h6>
                    <div id="total-duration-tracker" class="badge badge-pale-primary text-sm">Total: 0 min</div>
                </div>
                <div class="d-flex flex-column gap-2" id="hw-counters-list">`;
            
            allHardwareTypes.forEach(hw => {
                const duration = parseInt(hw.duration_minutes || '30', 10);
                const existingReq = existingAptData?.metadata?.required_hardware?.find(rh => rh.catalog_id === hw.catalog_id);
                const initialCount = existingReq ? existingReq.count : 0;
                counters[hw.id] = initialCount;
                
                html += `
                    <div class="hw-counter-box d-flex justify-content-between align-items-center">
                        <div>
                            <div class="fw-bold text-dark text-sm">${hw.item_name}</div>
                            <div class="text-xs text-muted">${hw.item_type} • ${duration} min</div>
                        </div>
                        <div class="hw-controls">
                            <button type="button" class="hw-btn hw-dec" data-id="${hw.id}" data-duration="${duration}">-</button>
                            <div class="hw-count" id="count-${hw.id}">${initialCount}</div>
                            <button type="button" class="hw-btn hw-inc" data-id="${hw.id}" data-duration="${duration}">+</button>
                        </div>
                    </div>
                `;
            });
            html += `</div></div>`;
            hwContainer.innerHTML = html;
            
            updateDuration(); // Initial calculate for hydration

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
                            requires_scan: hw.requires_scan !== false,
                            count: counters[hw.id]
                        });
                    }
                });
                return payload;
            };
        }

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
                    const coverageArea = v.metadata?.coverage_area || v.coverage_area;
                    if (coverageArea) {
                        try {
                            const geo = JSON.parse(coverageArea);
                            if (geo.geometry && geo.geometry.type === 'Polygon') {
                                const ring = geo.geometry.coordinates[0];
                                if (pointInPolygon(pt, ring)) validVans.push(v);
                            }
                        } catch(e) {}
                    }
                });
            }

            if (validVans.length > 0) {
                const primaryVan = validVans[0];
                modal.element.querySelector('#auto_van_id').value = primaryVan.van_id || primaryVan.id;
                
                const assignedUserId = (primaryVan.metadata?.assigned_users || primaryVan.assigned_users)?.[0];
                const assignedUser = userDataArray.find(u => u.user_id === assignedUserId || u.id === assignedUserId);
                const techName = assignedUser ? assignedUser.user_name : 'Unassigned';

                modal.element.querySelector('#location-status').innerHTML = `<span class="badge badge-pale-success"><i class="bi bi-check-circle me-1"></i>Covered by VAN: ${primaryVan.van_id || primaryVan.id} (Assigned To: ${techName})</span>`;
                
                let techIds = new Set();
                validVans.forEach(v => {
                    const assignedUsers = v.metadata?.assigned_users || v.assigned_users;
                    if(assignedUsers) assignedUsers.forEach(uid => techIds.add(uid));
                });
                validTechs = userDataArray.filter(u => techIds.has(u.user_id) || techIds.has(u.id));
            } else if (lat && lng) {
                modal.element.querySelector('#auto_van_id').value = '';
                modal.element.querySelector('#location-status').innerHTML = `<span class="badge badge-pale-danger"><i class="bi bi-exclamation-triangle me-1"></i>Out of bounds.</span>`;
            }

            if (dateStr && validTechs.length > 0) {
                const d = new Date(dateStr);
                const dayIdx = d.getDay(); 
                validTechs = validTechs.filter(u => {
                    const sched = u.metadata?.schedule || u.schedule;
                    return !!(sched && sched[dayIdx]);
                });
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
            
            const serverTz = (window.state?.data?.settings?.server_timezone || 'UTC');

            function formatTime(t) {
                if(!t)return'';
                return formatServerToLocalTime(dateStr || new Date().toISOString().split('T')[0], t, serverTz);
            }

            const worker = new Worker(new URL('../workers/travel.worker.js', import.meta.url));
            const metricsProm = new Promise((resolve) => {
                const id = Date.now();
                worker.postMessage({
                    id,
                    type: 'CALCULATE_GRID',
                    payload: {
                        techs: currentValidTechs.map(t => ({ id: t.user_id || t.id, metadata: t.metadata })),
                        dateStr,
                        lat,
                        lng,
                        dailyApts: dailyApts.map(a => ({
                            tech_id: a.tech_id,
                            schedule_date: a.schedule_date,
                            appointment_time: a.appointment_time,
                            metadata: a.metadata,
                            appointment_id: a.appointment_id,
                            is_deleted: a.is_deleted
                        }))
                    }
                });

                worker.onmessage = (e) => {
                    if (e.data.id === id) {
                        const travelMetrics = new Map();
                        if (e.data.success && e.data.result) {
                            e.data.result.forEach(r => {
                                travelMetrics.set(r.techId, { prevTravel: r.prevTravel, adj: r.adj });
                            });
                        }
                        worker.terminate();
                        resolve(travelMetrics);
                    }
                };
            });

            const travelMetrics = await metricsProm;

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
                            const userSched = t.metadata?.schedule || t.schedule;
                            const sched = userSched?.[dDay];
                            let startHour = sched ? parseInt((sched.start || '09:00').split(':')[0], 10) : 9;
                            let endHour = sched ? parseInt((sched.end || '17:00').split(':')[0], 10) : 17;

                            const onVacation = isUserOnVacation(t, dateStr);

                            if (cellH >= startHour && cellH < endHour && !onVacation) {
                                totalServiceableTechs++;
                                
                                const overlappingApt = dailyApts.find(a => {
                                    if (a.tech_id !== (t.user_id || t.id)) return false;
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
                                        const [ph, pm] = (prevApt.appointment_time || '00:00').split(':').map(Number);
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
                                const sched = (t.metadata?.schedule || t.schedule)?.[dDay];
                                let startHour = sched ? parseInt((sched.start || '09:00').split(':')[0], 10) : 9;
                                let endHour = sched ? parseInt((sched.end || '17:00').split(':')[0], 10) : 17;
                                return cellH >= startHour && cellH < endHour;
                            });
                            
                            const allOnVacation = anyShiftMemberNotOnVacation && currentValidTechs.every(t => {
                                const sched = (t.metadata?.schedule || t.schedule)?.[dDay];
                                let startHour = sched ? parseInt((sched.start || '09:00').split(':')[0], 10) : 9;
                                let endHour = sched ? parseInt((sched.end || '17:00').split(':')[0], 10) : 17;
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
                    selectedStartTime = cell.dataset.time;
                    
                    updateBookingUI();
                });
            });
            // Auto-refresh highlights if it was already selected
            if (selectedStartTime) updateBookingUI();
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
            
            const customData = {};
            for (const key in data) {
                if (key.startsWith('custom_')) {
                    customData[key.replace('custom_', '')] = data[key];
                    delete data[key]; 
                }
            }

            const tech = userDataArray.find(u => (u.user_id || u.id) === selectedTechId);
            const userSched = tech?.metadata?.schedule || tech?.schedule;
            const schedule = userSched?.[new Date(data.schedule_date).getDay()] || { start: '09:00', end: '17:00' };
            const shiftEndTotal = parseInt((schedule.end || '17:00').split(':')[0], 10) * 60 + parseInt((schedule.end || '17:00').split(':')[1], 10);
            const startTotal = parseInt((data.appointment_time || '00:00').split(':')[0], 10) * 60 + parseInt((data.appointment_time || '00:00').split(':')[1], 10);
            const endTotal = startTotal + currentTotalDuration;

            if (endTotal > shiftEndTotal) {
                return alert(`Duration (${currentTotalDuration}m) exceeds shift end (${schedule.end}).`);
            }
            
            const btn = modal.element.querySelector('button[type="submit"]');
            const ogBtn = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${isUpdate ? 'Updating...' : 'Booking...'}`;
            
            try {
                // Strict Pre-flight Concurrency Check
                const freshAppointments = await db.findMany('appointments');
                
                const hasCollision = freshAppointments.some(appt => {
                    // Ignore self in update mode
                    if (isUpdate && appt.appointment_id === existingAptData.appointment_id) return false;
                    if (appt.schedule_date !== data.schedule_date || appt.tech_id !== selectedTechId) return false;
                    if (appt.status === 'completed' || appt.is_deleted) return false;

                    const existStart = parseInt((appt.appointment_time || '00:00').split(':')[0], 10) * 60 + parseInt((appt.appointment_time || '00:00').split(':')[1], 10);
                    const existDuration = appt.metadata?.duration_minutes || parseInt(appt.duration || '60', 10);
                    const existEnd = existStart + existDuration;

                    return (startTotal < existEnd) && (endTotal > existStart);
                });

                if (hasCollision) {
                    btn.disabled = false;
                    btn.innerHTML = ogBtn;
                    return alert("CONCURRENCY ERROR: That slot was just booked by another dispatcher. Please select a different time or technician.");
                }

                const payload = {
                    ...data,
                    tech_id: selectedTechId,
                    van_id: data.auto_van_id,
                    status: isUpdate ? 'rescheduled' : 'scheduled',
                    updated_at: db.serverTimestamp(),
                    metadata: { 
                        hardware: existingAptData?.metadata?.hardware || [], 
                        location: { lat: parseFloat(data.lat), lng: parseFloat(data.lng) },
                        custom_data: customData,
                        required_hardware: requiredHardwarePayload,
                        duration_minutes: currentTotalDuration
                    }
                };

                if (isUpdate) {
                    await db.update('appointments', existingAptData.appointment_id, { ...payload, updated_at: db.serverTimestamp() });
                    db.logAction("Appointment Rescheduled", `Job ${existingAptData.appointment_id} updated via modular flow`);
                } else {
                    const newId = 'APT-' + Math.random().toString(36).substr(2, 9).toUpperCase();
                    payload.appointment_id = newId;
                    payload.created_at = db.serverTimestamp();
                    await db.create('appointments', payload, newId);
                    db.logAction("Appointment Scheduled", `Job ${newId} created`);
                }
                
                modal.hide();
            } catch (err) { 
                alert(err.message); 
                btn.disabled = false;
                btn.innerHTML = ogBtn;
            }
        };

        // If hydration (Reschedule)
        if (isUpdate) {
            // Wait for map and counters to be ready, then trigger logic
            setTimeout(async () => {
                if (existingAptData.metadata?.location) {
                    const { lat, lng } = existingAptData.metadata.location;
                    marker = L.marker([lat, lng]).addTo(map);
                    map.setView([lat, lng], 15);
                    updateTechOptions(lat, lng);
                    updateDailyGrid(existingAptData.schedule_date);
                }
            }, 600);
        }
    };

    view.trigger('click', 'open-add-apt', () => openAppointmentModal());

    view.on('init', () => {
        view.emit('loading:start');

        // Fetch users once for the map
        db.findMany('users').then(users => {
            users.forEach(u => {
                userMap[u.user_id] = u.user_name;
            });
            renderAptList();
        });

        const attachFilterListeners = () => {
            const renderDebounced = debounce(() => renderAptList(), 300);
            ['filter-date', 'filter-status', 'filter-city', 'filter-tech'].forEach(id => {
                view.$(id).oninput = renderDebounced;
            });
        };

        let allAptData = [];
        let selectedAptIds = new Set();
        
        const renderAptList = () => {
            const list = view.$('apt-list');
            if (!list) return;
            
            const filterDate = view.$('filter-date').value;
            const filterStatus = view.$('filter-status').value;
            const filterCity = (view.$('filter-city').value || '').toLowerCase();
            const filterTech = (view.$('filter-tech').value || '').toLowerCase();

            const filtered = allAptData.filter(apt => {
                if(apt.is_deleted) return false;
                if(filterDate && apt.schedule_date !== filterDate) return false;
                if(filterStatus && apt.status !== filterStatus) return false;
                if(filterCity && !(apt.location_name || '').toLowerCase().includes(filterCity)) return false;
                if(filterTech) {
                    const techId = (apt.tech_id || '').toLowerCase();
                    const techName = (userMap[apt.tech_id] || '').toLowerCase();
                    if(!techId.includes(filterTech) && !techName.includes(filterTech)) return false;
                }
                return true;
            });

            list.innerHTML = '';
            filtered.forEach(apt => {
                const row = document.createElement('tr');
                
                let statusClass = 'badge-pale-info';
                if(apt.status === 'scheduled') statusClass = 'badge-pale-primary';
                if(apt.status === 'rescheduled') statusClass = 'badge-pale-warning';
                if(apt.status === 'completed') statusClass = 'badge-pale-success';

                let localTime = '-';
                if (apt.appointment_time && apt.schedule_date) {
                    const serverTz = (window.state?.data?.settings?.server_timezone || 'UTC');
                    localTime = formatServerToLocalTime(apt.schedule_date, apt.appointment_time, serverTz);
                }

                row.innerHTML = `
                    <td style="width: 40px;"><input type="checkbox" class="form-check-input apt-record-cb" data-id="${apt.appointment_id}"></td>
                    <td><code class="data-mono fw-bold">${apt.appointment_id}</code></td>
                    <td class="fw-bold">${apt.appointment_name}</td>
                    <td>${apt.schedule_date}</td>
                    <td>${localTime}</td>
                    <td class="text-truncate" style="max-width: 150px;" title="${apt.location_name}">${apt.location_name || '-'}</td>
                    <td>${userMap[apt.tech_id] || apt.tech_id || 'Unassigned'}</td>
                    <td><span class="badge ${statusClass} text-capitalize text-xs">${apt.status}</span></td>
                    <td>
                        <button class="btn-pico btn-pico-outline table-action-btn view-apt me-1" data-id="${apt.appointment_id}" title="View Details">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn-pico btn-pico-outline table-action-btn reschedule-apt me-1 auth-appointments:create hidden" data-id="${apt.appointment_id}" title="Reschedule">
                            <i class="bi bi-calendar-range"></i>
                        </button>
                        <button class="btn-pico btn-pico-danger-outline table-action-btn delete-apt auth-appointments:delete hidden" data-id="${apt.appointment_id}" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                `;
                
                row.querySelector('.view-apt').onclick = () => {
                    window.location.hash = `#appointment/${apt.appointment_id}`;
                };

                row.querySelector('.reschedule-apt').onclick = () => {
                    openAppointmentModal(apt);
                };

                const deleteBtn = row.querySelector('.delete-apt');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const deleteModal = createModal({
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
                        deleteModal.element.querySelector('.cancel-btn').onclick = () => deleteModal.hide();
                        deleteModal.element.querySelector('.confirm-btn').onclick = async () => {
                            deleteModal.hide();
                            try {
                                await db.remove('appointments', apt.appointment_id);
                                selectedAptIds.delete(apt.appointment_id);
                            } catch (err) { console.error('Delete failed: ', err.message); }
                        };
                        deleteModal.show();
                    });
                }

                list.appendChild(row);
            });

            const updateBulkDeleteUI = () => {
                const bulkBtn = view.$('bulk-delete-apt');
                const cnt = view.$('bulk-delete-count');
                if(bulkBtn && cnt) {
                    if(selectedAptIds.size > 0) {
                        bulkBtn.style.display = 'inline-flex';
                        cnt.textContent = selectedAptIds.size;
                    } else {
                        bulkBtn.style.display = 'none';
                    }
                }
                const sa = view.$('apt-select-all');
                if(sa) {
                    const totalVisible = filtered.length;
                    sa.checked = totalVisible > 0 && [...list.querySelectorAll('.apt-record-cb')].every(cb => cb.checked);
                }
            };

            list.querySelectorAll('.apt-record-cb').forEach(cb => {
                cb.checked = selectedAptIds.has(cb.dataset.id);
                cb.addEventListener('change', (e) => {
                    if(e.target.checked) selectedAptIds.add(cb.dataset.id);
                    else selectedAptIds.delete(cb.dataset.id);
                    updateBulkDeleteUI();
                });
            });

            const sa = view.$('apt-select-all');
            if (sa) {
                sa.checked = false; 
                sa.onclick = (e) => {
                    const isChecked = e.target.checked;
                    list.querySelectorAll('.apt-record-cb').forEach(cb => {
                        cb.checked = isChecked;
                        if(isChecked) selectedAptIds.add(cb.dataset.id);
                        else selectedAptIds.delete(cb.dataset.id);
                    });
                    updateBulkDeleteUI();
                };
            }
            updateBulkDeleteUI();

            document.dispatchEvent(new CustomEvent('apply-auth'));
        };

        attachFilterListeners();

        view.trigger('click', 'bulk-delete-apt', async () => {
            if(selectedAptIds.size === 0) return;
            const deleteModal = createModal({
                title: 'Confirm Bulk Deletion',
                body: `
                    <div class="text-center py-3">
                        <i class="bi bi-exclamation-triangle-fill text-danger mb-3" style="font-size: 3rem;"></i>
                        <h5 class="fw-bold">Delete ${selectedAptIds.size} Appointments?</h5>
                        <p class="text-muted">This action cannot be undone.</p>
                        <div class="d-flex justify-content-center gap-2 mt-4">
                            <button type="button" class="btn-pico btn-pico-outline cancel-btn">Cancel</button>
                            <button type="button" class="btn-pico btn-pico-danger-outline confirm-btn">Delete All</button>
                        </div>
                    </div>
                `
            });
            deleteModal.element.querySelector('.cancel-btn').onclick = () => deleteModal.hide();
            deleteModal.element.querySelector('.confirm-btn').onclick = async () => {
                deleteModal.hide();
                view.emit('loading:start');
                try {
                    const ids = Array.from(selectedAptIds);
                    await Promise.all(ids.map(id => db.remove('appointments', id)));
                    selectedAptIds.clear();
                } catch (err) {
                    console.error('Bulk delete failed: ', err.message);
                } finally {
                    view.emit('loading:end');
                    // Data will refresh from subscription. Forcing render just in case:
                    renderAptList();
                }
            };
            deleteModal.show();
        });

        const PAGE_LIMIT = 50;

        view.trigger('click', 'apt-list-prev-btn', () => {
            if (currentPage > 1) {
                currentPage--;
                loadData();
            }
        });
        
        view.trigger('click', 'apt-list-next-btn', () => {
            currentPage++;
            loadData();
        });

        const loadData = () => {
            if (aptsUnsub) aptsUnsub();
            view.emit('loading:start');
            aptsUnsub = db.subscribe('appointments', { limit: PAGE_LIMIT, page: currentPage }, (data) => {
                view.emit('loading:end');
                
                const indicator = view.$('apt-list-page-indicator');
                const prevBtn = view.$('apt-list-prev-btn');
                const nextBtn = view.$('apt-list-next-btn');
                
                if (indicator) indicator.textContent = `Page ${currentPage}`;
                if (prevBtn) prevBtn.disabled = currentPage === 1;
                if (nextBtn) nextBtn.disabled = !data || data.length < PAGE_LIMIT;

                if (data) {
                    allAptData = data;
                    renderAptList();
                }
            });
        };
        
        loadData();
        view.unsub(() => { if (aptsUnsub) aptsUnsub(); });
    });

    return view;
}
