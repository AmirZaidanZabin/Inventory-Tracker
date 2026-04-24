// src/views/view.gantt.js
import { controller, debounce } from '../lib/controller.js';
import { db } from '../lib/db/index.js';
import { optimizeRoute } from '../lib/travel-logic.js';

function toDate(str) {
    if (!str) return null;
    const d = new Date(str);
    return isNaN(d) ? null : d;
}

function toYMD(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
}

const ROW_H = 48; // Adjusted for a tighter, enterprise look
const LABEL_W = 260; // Resource column width
const DAY_W = 240; // Width of one day in Daily view
const HOUR_W = DAY_W / 24;
const SCROLL_STEP = DAY_W;

export function AppointmentsGanttView() {
    const view = controller({
        stringComponent: `
            <div class="gantt-view h-100 d-flex flex-column gap-3">
                <!-- Cleaner Toolbar -->
                <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
                    <div class="card-body p-3 d-flex justify-content-between align-items-center">
                        <div class="d-flex align-items-center gap-4">
                            <h5 class="mb-0 fw-bold"><i class="bi bi-calendar3 me-2 text-primary"></i>Gantt Timeline</h5>
                        </div>
                        
                        <div class="d-flex align-items-center gap-2">
                            <div class="btn-group border rounded-pill overflow-hidden">
                                <button id="gantt-prev" class="btn btn-sm btn-pico-outline border-0 px-3"><i class="bi bi-chevron-left"></i></button>
                                <button id="gantt-today" class="btn btn-sm btn-pico-outline border-0 border-start border-end px-3">Today</button>
                                <button id="gantt-next" class="btn btn-sm btn-pico-outline border-0 px-3"><i class="bi bi-chevron-right"></i></button>
                            </div>
                            
                            <select id="gantt-scale" class="form-select form-select-sm border shadow-none" style="width: 110px;">
                                <option value="hourly">Hourly</option>
                                <option value="daily" selected>Daily View</option>
                                <option value="weekly">Weekly View</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Main Layout Container -->
                <div class="card border-0 shadow-sm rounded-4 flex-grow-1 overflow-hidden d-flex flex-row">
                    <!-- Left Sidebar (Appt Browser) -->
                    <div class="border-end d-flex flex-column bg-light bg-opacity-10" style="width: 320px; flex-shrink: 0;">
                        <div class="p-3 border-bottom bg-white">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <span class="fw-bold text-dark small text-uppercase">Service Appointments</span>
                            </div>
                            
                            <div class="position-relative">
                                <i class="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-2 text-muted" style="font-size: 0.85rem;"></i>
                                <input type="text" id="apt-search" class="form-control form-control-sm ps-4" placeholder="Search by ID or name...">
                            </div>
                        </div>
                        
                        <div class="flex-grow-1 overflow-auto">
                            <table class="modern-table w-100" style="--radius: 0;">
                                <thead class="sticky-top bg-white z-index-1">
                                    <tr style="font-size: 0.75rem;">
                                        <th class="ps-3 border-bottom">ID</th>
                                        <th class="border-bottom">NAME / LOC</th>
                                        <th class="border-bottom">STATUS</th>
                                        <th class="border-bottom">DATE</th>
                                    </tr>
                                </thead>
                                <tbody id="apt-sidebar-tbody"></tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Right Pane (Timeline) -->
                    <div class="flex-grow-1 d-flex flex-column overflow-hidden position-relative bg-white">
                        <!-- Resource Search / Date Range Header -->
                        <div class="d-flex justify-content-between align-items-center px-3 border-bottom bg-white" style="height: 56px; flex-shrink:0;">
                            <div class="position-relative" style="width: 250px;">
                                <i class="bi bi-person position-absolute top-50 start-0 translate-middle-y ms-2 text-muted"></i>
                                <input type="text" id="resource-search" class="form-control form-control-sm ps-4" placeholder="Filter resources...">
                            </div>
                            
                            <div class="fw-bold text-dark d-flex align-items-center gap-2" style="font-size: 0.9rem;">
                                <i class="bi bi-calendar-event text-primary"></i>
                                <span id="gantt-date-range"></span>
                            </div>
                            
                            <div style="width: 15px;"></div> <!-- Spacer -->
                        </div>
                        
                        <!-- The Scroller -->
                        <div class="gantt-canvas-container flex-grow-1 overflow-auto" id="gantt-scroller">
                            <div id="gantt-inner"></div>
                        </div>
                    </div>
                </div>
                
                <style>
                    .tech-row:hover .gantt-resource-cell { background: #f8fafc !important; }
                    .gantt-task-bar { cursor: pointer; transition: filter 0.2s; }
                    .gantt-task-bar:hover { filter: brightness(0.9); }
                    .gantt-apt-row { cursor: pointer; transition: background 0.15s; }
                    .gantt-apt-row:hover { background: #f1f5f9; }
                    .gantt-resource-cell { border-right: 1px solid #f1f5f9; transition: background 0.2s; }
                </style>
            </div>
        `
    });

    view.onboard({ id: 'gantt-scroller' })
        .onboard({ id: 'gantt-inner' })
        .onboard({ id: 'gantt-prev' })
        .onboard({ id: 'gantt-next' })
        .onboard({ id: 'gantt-today' })
        .onboard({ id: 'gantt-scale' })
        .onboard({ id: 'apt-search' })
        .onboard({ id: 'resource-search' })
        .onboard({ id: 'apt-sidebar-tbody' })
        .onboard({ id: 'gantt-date-range' });

    let appointments = [];
    let technicians = [];
    let vans = [];
    let vanMap = {};
    let hiddenTechs = new Set();
    let currentScale = 'daily';
    let todayX = 0;
    
    // Derived state for the current visible window
    let windowMinDate = null;
    let windowMaxDate = null;

    const fetchGanttData = async () => {
        const [apptsData, usersData, vansData] = await Promise.all([
            db.findMany('appointments'),
            db.findMany('users'),
            db.findMany('vans')
        ]);

        appointments = (apptsData || [])
            .filter(a => !a.is_deleted);

        technicians = (usersData || [])
            .filter(u => u.role_id === 'technician' || appointments.some(a => a.tech_id === u.user_id));

        vans = (vansData || []);
        
        // Build map: tech_id -> Van Name
        vanMap = {};
        vans.forEach(v => {
            const techId = v.assigned_users?.[0] || v.assigned_tech_id || v.tech_id;
            if(techId) vanMap[techId] = v.van_id || v.id;
        });

        renderGantt(); // Sets window boundaries first
        renderAptList();
    };

    const renderAptList = () => {
        const tbody = view.$('apt-sidebar-tbody');
        const search = view.$('apt-search')?.value.toLowerCase() || '';
        
        let filtered = appointments.filter(a => 
            ((a.appointment_name || '').toLowerCase().includes(search) || (a.appointment_id || '').toLowerCase().includes(search))
        );

        tbody.innerHTML = filtered.slice(0, 75).map(a => {
            let badgeClass = 'badge-pale-warning';
            if(a.status === 'completed') badgeClass = 'badge-pale-success';
            if(a.status === 'assigned') badgeClass = 'badge-pale-primary';
            
            const displayText = a.appointment_name || a.location_name || '-';

            return `
                <tr class="gantt-apt-row" data-id="${a.appointment_id}">
                    <td class="ps-3 fw-bold text-primary" style="font-size: 0.75rem;">${(a.appointment_id || '').split('-')[1] || a.appointment_id}</td>
                    <td class="fw-bold text-dark text-truncate" style="max-width: 100px; font-size: 0.75rem;" title="${displayText}">${displayText}</td>
                    <td><span class="badge ${badgeClass}">${a.status || 'Draft'}</span></td>
                    <td class="text-muted" style="font-size: 0.7rem;">${new Date(a.schedule_date).toLocaleDateString('en-US', {month:'numeric', day:'numeric'})}</td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="4" class="text-center py-4 text-muted">No appointments match search.</td></tr>';
    };

    const renderGantt = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const resourceSearch = view.$('resource-search')?.value.toLowerCase() || '';

        // Timeline Boundary Math
        const bufferMin = addDays(today, -2);
        const bufferMax = addDays(today, 12);
        windowMinDate = new Date(bufferMin);
        windowMaxDate = new Date(bufferMax);
        
        const totalDays = Math.ceil((windowMaxDate - windowMinDate) / 86400000) + 1;
        
        let scaleW = DAY_W;
        if (currentScale === 'weekly') scaleW = DAY_W / 4;
        else if (currentScale === 'hourly') scaleW = 1440; 
        
        const gridW = totalDays * scaleW;
        const currentHourW = scaleW / 24;
        
        todayX = Math.round((today - windowMinDate) / 86400000) * scaleW;
        if (currentScale === 'hourly') {
            const now = new Date();
            todayX += now.getHours() * currentHourW;
        }
        
        const rangeText = `${windowMinDate.toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'})} - ${windowMaxDate.toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'})}`;
        view.$('gantt-date-range').textContent = rangeText;

        const visibleTechs = technicians.filter(t => 
            !hiddenTechs.has(t.user_id) && 
            (t.user_name || '').toLowerCase().includes(resourceSearch)
        );
        
        const groups = {};
        visibleTechs.forEach(t => {
            const van = vanMap[t.user_id] || 'Unassigned';
            if (!groups[van]) groups[van] = [];
            groups[van].push(t);
        });

        const flatItems = [];
        let runningY = 0;
        Object.entries(groups).forEach(([van, techs]) => {
            const groupAppts = appointments.filter(a => techs.some(t => t.user_id === a.tech_id) && a.schedule_date >= toYMD(windowMinDate) && a.schedule_date <= toYMD(windowMaxDate));
            const totalGroupMins = groupAppts.reduce((sum, a) => sum + (a.metadata?.duration_minutes || 60), 0);
            const groupUtil = totalGroupMins > 0 ? Math.min(100, Math.round((totalGroupMins / (techs.length * 480)) * 100)) : 0;
            
            flatItems.push({ type: 'group', van, totalGroupMins, groupUtil, y: runningY, h: 32 });
            runningY += 32;
            
            techs.forEach(t => {
                const techAppts = appointments.filter(a => a.tech_id === t.user_id && a.schedule_date >= toYMD(windowMinDate) && a.schedule_date <= toYMD(windowMaxDate));
                const totalMins = techAppts.reduce((sum, a) => sum + (a.metadata?.duration_minutes || 60), 0);
                const utilPercent = Math.min(100, Math.round((totalMins / 480) * 100));
                flatItems.push({ type: 'tech', t, techAppts, totalMins, utilPercent, y: runningY, h: ROW_H });
                runningY += ROW_H;
            });
        });

        const totalGridHeight = runningY;

        const headerHtml = `
            <div style="min-width:${LABEL_W + gridW}px; background: #fff;">
                <div style="display:flex; position:sticky; top:0; z-index:20; background:white; border-bottom: 1px solid #cbd5e1;">
                    <div class="border-end flex-shrink-0 bg-light" style="width:${LABEL_W}px; height:50px; position:sticky; left:0; z-index:21;"></div>
                    <div style="width:${gridW}px; position:relative; height:50px; background: #fff;">
                        <svg width="${gridW}" height="50" style="position: absolute; top:0;">
                            ${Array.from({length: totalDays}).map((_, i) => {
                                const d = addDays(windowMinDate, i);
                                const x = i * scaleW;
                                const isToday = toYMD(d) === toYMD(today);
                                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                
                                let hourTicks = '';
                                if (currentScale === 'daily') {
                                    [6, 12, 18].forEach(h => {
                                        const hx = x + (h * currentHourW);
                                        const label = h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h-12} PM`;
                                        hourTicks += `
                                            <line x1="${hx}" y1="30" x2="${hx}" y2="50" stroke="#cbd5e1" stroke-width="1"/>
                                            <text x="${hx}" y="42" text-anchor="middle" font-size="9" fill="#64748b" font-weight="600">${label}</text>
                                        `;
                                    });
                                } else if (currentScale === 'hourly') {
                                    for (let h = 0; h < 24; h++) {
                                        const hx = x + (h * currentHourW);
                                        const label = h === 0 ? 'Midnight' : h === 12 ? 'Noon' : h < 12 ? `${h} AM` : `${h-12} PM`;
                                        hourTicks += `
                                            <line x1="${hx}" y1="30" x2="${hx}" y2="50" stroke="#cbd5e1" stroke-width="1" opacity="${h % 6 === 0 ? 1 : 0.5}"/>
                                            <text x="${hx + 2}" y="42" text-anchor="start" font-size="8" fill="#64748b" font-weight="500">${label}</text>
                                        `;
                                    }
                                }

                                return `
                                    <rect x="${x}" y="0" width="${scaleW}" height="50" fill="${isToday ? '#f0f9ff' : isWeekend ? '#f8fafc' : 'white'}"/>
                                    <text x="${x + scaleW/2}" y="18" font-size="11" font-weight="600" text-anchor="middle" fill="${isToday ? '#0ea5e9' : '#334155'}">${d.toLocaleDateString('en-US', {weekday: 'short'}).toUpperCase()}, ${d.getDate()}</text>
                                    <line x1="${x}" y1="0" x2="${x}" y2="50" stroke="#cbd5e1" stroke-width="1"/>
                                    <line x1="${x}" y1="28" x2="${x+scaleW}" y2="28" stroke="#cbd5e1" stroke-width="1"/>
                                    ${hourTicks}
                                `;
                            }).join('')}
                            <line x1="${todayX}" y1="0" x2="${todayX}" y2="50" stroke="#3b82f6" stroke-width="2"/>
                        </svg>
                    </div>
                </div>
                <div id="virtual-container" class="bg-white position-relative" style="height: ${totalGridHeight}px; width: 100%;">
                </div>
            </div>
        `;

        view.$('gantt-inner').innerHTML = headerHtml;

        const renderVirtualRows = () => {
            const scroller = view.$('gantt-scroller');
            if (!scroller) return;
            const container = view.$('gantt-inner').querySelector('#virtual-container');
            if (!container) return;

            const scrollTop = scroller.scrollTop;
            const clientHeight = scroller.clientHeight;
            const buffer = 200; // preload buffer

            const visibleItems = flatItems.filter(item => 
                (item.y + item.h >= scrollTop - buffer) && 
                (item.y <= scrollTop + clientHeight + buffer)
            );

            container.innerHTML = visibleItems.map(item => {
                if (item.type === 'group') {
                    return `
                        <div class="d-flex bg-light text-muted fw-bold position-absolute w-100" style="height: 32px; font-size: 0.7rem; align-items:center; top: ${item.y}px;">
                            <div class="px-3 border-bottom flex-shrink-0 border-end" style="width:${LABEL_W}px; height: 100%; display: flex; align-items: center; position:sticky; left:0; z-index:15; background: #f8fafc;">
                                <i class="bi bi-truck text-primary me-2"></i>${item.van}
                            </div>
                            <div class="ms-2 badge badge-pale-info py-1 px-2 border-bottom flex-grow-1 text-start" style="font-size: 0.65rem; height: 100%; display: flex; align-items: center;">
                                Group Load: <span class="fw-bold ms-1" style="color: ${item.groupUtil > 80 ? '#dc2626' : '#16a34a'};">${(item.totalGroupMins/60).toFixed(1)}h</span>
                            </div>
                        </div>
                    `;
                } else {
                    const { t, techAppts, totalMins, utilPercent } = item;
                    return `
                        <div class="d-flex tech-row position-absolute w-100 border-bottom" style="height:${ROW_H}px; top: ${item.y}px;">
                            <div class="gantt-resource-cell flex-shrink-0 d-flex align-items-center px-2 bg-white border-end" style="width:${LABEL_W}px; position:sticky; left:0; z-index:10;">
                                <div class="user-avatar-small me-2 flex-shrink-0" style="width:32px; height:32px; border-radius:50%; background:#dbeafe; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                                    <img src="https://api.dicebear.com/7.x/initials/svg?seed=${t.user_name}&backgroundColor=0284c7&textColor=ffffff" width="32" height="32">
                                </div>
                                <div class="flex-grow-1 min-w-0 lh-sm">
                                    <div class="fw-semibold text-dark text-truncate" style="font-size: 0.8rem;">${t.user_name}</div>
                                    <div class="text-muted text-truncate" style="font-size: 0.65rem;">${t.role_id === 'technician' ? 'Field Specialist' : t.role_id}</div>
                                </div>
                                <div class="text-end d-flex align-items-center gap-1 border border-secondary-subtle rounded-3 px-2 py-1 text-muted bg-light bg-opacity-10" style="font-size: 0.65rem;">
                                    <div class="rounded-circle" style="width: 8px; height: 8px; background: ${utilPercent > 80 ? '#ef4444' : '#10b981'};"></div>
                                    <span class="fw-bold text-dark">${(totalMins/60).toFixed(1)}h</span>
                                    <button class="btn btn-link p-0 text-primary ms-1 btn-optimize-tech" data-tech="${t.user_id}" title="Optimize Today's Route">
                                        <i class="bi bi-lightning-charge-fill"></i>
                                    </button>
                                </div>
                            </div>
                            
                            <div style="width:${gridW}px; height:${ROW_H}px; position:relative; background-image: repeating-linear-gradient(90deg, transparent, transparent ${currentScale==='daily' ? currentHourW * 6 : currentScale==='hourly' ? currentHourW : scaleW}px, #f1f5f9 ${currentScale==='daily' ? currentHourW * 6 : currentScale==='hourly' ? currentHourW : scaleW}px, #f1f5f9 ${currentScale==='daily' ? (currentHourW * 6) + 1 : currentScale==='hourly' ? currentHourW + 1 : scaleW + 1}px);">
                                <svg width="${gridW}" height="${ROW_H}" style="position: absolute; top:0; left:0;">
                                    ${Array.from({length: totalDays}).map((_, i) => `<line x1="${i * scaleW}" y1="0" x2="${i * scaleW}" y2="${ROW_H}" stroke="#cbd5e1" stroke-width="1"/>`).join('')}
                                    <line x1="${todayX}" y1="0" x2="${todayX}" y2="${ROW_H}" stroke="#3b82f6" stroke-width="1" stroke-dasharray="2,2" opacity="0.5"/>
                                    
                                    ${techAppts.map(a => {
                                        const startD = toDate(a.schedule_date) || today;
                                        const [h, m] = (a.appointment_time || '08:00').split(':').map(Number);
                                        const finalX = (Math.round((startD - windowMinDate) / 86400000) * scaleW) + ((h + m/60) * currentHourW);
                                        const width = Math.max(16, (a.metadata?.duration_minutes || 60) / 60 * currentHourW);
                                        
                                        let taskColor = '#fde047'; 
                                        let edgeColor = '#1e3a8a'; 
                                        
                                        if (a.status === 'completed') {
                                            taskColor = '#dcfce7'; 
                                            edgeColor = '#15803d'; 
                                        } else if (a.status === 'scheduled' || a.status === 'assigned' || a.status === 'in-progress') {
                                            taskColor = '#dbeafe'; 
                                            edgeColor = '#1d4ed8'; 
                                        } else if (a.status === 'rescheduled') {
                                            taskColor = '#ffedd5'; 
                                            edgeColor = '#c2410c'; 
                                        }

                                        const displayText = a.appointment_name || a.location_name || ((a.appointment_id || '').split('-')[1] || '...');

                                        return `
                                            <g class="gantt-task-bar" data-appt="${a.appointment_id}">
                                                <rect x="${finalX}" y="10" width="${width}" height="${ROW_H - 20}" fill="${taskColor}" rx="2" />
                                                <rect x="${finalX}" y="10" width="4" height="${ROW_H - 20}" fill="${edgeColor}" rx="1" />
                                                <rect x="${finalX + width - 4}" y="10" width="4" height="${ROW_H - 20}" fill="${edgeColor}" rx="1" />
                                                ${width > 45 ? `<text x="${finalX + 8}" y="${ROW_H/2 + 3}" font-size="9" fill="${edgeColor}" font-weight="700">${displayText}</text>` : ''}
                                            </g>
                                        `;
                                    }).join('')}
                                </svg>
                            </div>
                        </div>
                    `;
                }
            }).join('');
        };

        renderVirtualRows();

        const scroller = view.$('gantt-scroller');
        if (scroller) {
            scroller.onscroll = () => {
                requestAnimationFrame(renderVirtualRows);
            };
        }
    };

    const searchInput = view.$('resource-search');
    if (searchInput) searchInput.oninput = debounce(() => renderGantt(), 300);

    view.trigger('change', 'gantt-scale', (e) => {
        currentScale = e.target.value;
        renderGantt();
    });

    view.trigger('input', 'apt-search', debounce(() => renderAptList(), 300));

    view.trigger('click', 'gantt-prev', () => { view.$('gantt-scroller').scrollLeft -= SCROLL_STEP; });
    view.trigger('click', 'gantt-next', () => { view.$('gantt-scroller').scrollLeft += SCROLL_STEP; });
    view.trigger('click', 'gantt-today', () => { view.$('gantt-scroller').scrollLeft = todayX - LABEL_W; }); // Center near today

    view.trigger('click', 'gantt-scroller', async (e) => {
        const btnOpt = e.target.closest('.btn-optimize-tech');
        if (btnOpt) {
            e.stopPropagation();
            const techId = btnOpt.dataset.tech;
            const todayStr = toYMD(new Date());
            
            // Get today's appts for this tech
            const techAppts = appointments.filter(a => a.tech_id === techId && a.schedule_date === todayStr && !a.is_deleted);
            
            if (techAppts.length < 2) {
                return alert("Not enough appointments today to optimize.");
            }
            
            btnOpt.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
            
            try {
                const optimized = await optimizeRoute(techAppts);
                
                // Save back
                for (const apt of optimized) {
                    await db.update('appointments', apt.appointment_id, 
                        { appointment_time: apt.appointment_time }
                    );
                }
                
                alert(`Optimized ${optimized.length} appointments for today!`);
                await fetchGanttData();
            } catch (err) {
                alert("Failed to optimize: " + err.message);
            }
            return;
        }

        const apptEl = e.target.closest('[data-appt]');
        if(apptEl) {
            window.location.hash = `appointment/${apptEl.dataset.appt}`;
        }
    });

    view.trigger('click', 'apt-sidebar-tbody', (e) => {
        const row = e.target.closest('[data-id]');
        if(row) {
            window.location.hash = `appointment/${row.dataset.id}`;
        }
    });

    view.on('init', () => {
        view.emit('loading:start');
        fetchGanttData().finally(() => {
            view.emit('loading:end');
            setTimeout(() => {
                if(view.$('gantt-scroller')) view.$('gantt-scroller').scrollLeft = todayX;
            }, 100);
        });
    });

    return view;
}
