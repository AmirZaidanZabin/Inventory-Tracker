import { controller } from '../lib/controller.js';
import { firebase } from '../lib/firebase.js';

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

const ROW_H = 44;
const LABEL_W = 240;
const DAY_W = 40;
const SCROLL_STEP = DAY_W * 7;

// Color palette for technicians
const TECH_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', 
    '#06b6d4', '#ec4899', '#f97316', '#6366f1', '#14b8a6'
];

export function AppointmentsGanttView() {
    const view = controller({
        stringComponent: `
            <div class="gantt-view">
                <div class="card border-0 shadow-sm p-4">
                    <div class="d-flex flex-column gap-3">
                        <!-- Toolbar (Static) -->
                        <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <div class="d-flex align-items-center gap-3">
                                <h5 class="fw-bold mb-0">Technician Schedule</h5>
                                <span id="tech-badge" class="badge badge-pale-primary">...</span>
                            </div>
                            <div class="d-flex align-items-center gap-2">
                                <div class="dropdown" id="tech-filter-dropdown">
                                    <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" data-bs-auto-close="outside">
                                        Filter Technicians
                                    </button>
                                    <ul class="dropdown-menu shadow p-3" style="min-width: 250px;" id="filter-dropdown-content">
                                        <div class="form-check mb-2 pb-2 border-bottom">
                                            <input class="form-check-input" type="checkbox" id="toggle-all-techs" checked>
                                            <label class="form-check-label fw-bold" for="toggle-all-techs">All Technicians</label>
                                        </div>
                                        <div id="tech-checkboxes" style="max-height: 200px; overflow-y: auto;">
                                            <!-- Dynamic checkboxes -->
                                        </div>
                                    </ul>
                                </div>
                                <div class="btn-group btn-group-sm">
                                    <button id="gantt-prev" class="btn btn-outline-secondary"><i class="bi bi-chevron-left"></i></button>
                                    <button id="gantt-today" class="btn btn-outline-primary fw-bold">Jump to Today</button>
                                    <button id="gantt-next" class="btn btn-outline-secondary"><i class="bi bi-chevron-right"></i></button>
                                </div>
                            </div>
                        </div>

                        <!-- Scroller (Wrapper) -->
                        <div class="border rounded gantt-scroll-container" style="overflow:auto; max-height: 600px;" id="gantt-scroller">
                            <div id="gantt-inner">
                                <!-- Dynamic Gantt Content -->
                            </div>
                        </div>
                    </div>
                </div>

                <style>
                    .gantt-task-row:hover { background: rgba(0,0,0,0.02); }
                    .gantt-bar-cell { background-image: linear-gradient(90deg, #f3f4f6 1px, transparent 1px); background-size: ${DAY_W}px 100%; }
                    .badge-done { background: #d1fae5; color: #065f46; }
                    .badge-pending { background: #fef3c7; color: #92400e; }
                    .badge-overdue { background: #fee2e2; color: #991b1b; }
                    .gantt-scroll-container::-webkit-scrollbar { height: 8px; }
                    .gantt-scroll-container::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
                    .tech-row:hover { background: #f1f3f5 !important; }
                </style>
            </div>
        `
    });

    view.onboard({ id: 'gantt-scroller' })
        .onboard({ id: 'gantt-inner' })
        .onboard({ id: 'gantt-prev' })
        .onboard({ id: 'gantt-next' })
        .onboard({ id: 'gantt-today' })
        .onboard({ id: 'toggle-all-techs' })
        .onboard({ id: 'tech-checkboxes' })
        .onboard({ id: 'tech-badge' });

    let appointments = [];
    let technicians = [];
    let collapsedTechs = new Set();
    let hiddenTechs = new Set();
    let todayX = 0;

    const fetchGanttData = async () => {
        const [apptsSnap, usersSnap] = await Promise.all([
            firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'appointments')),
            firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'users'))
        ]);

        appointments = apptsSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(a => !a.is_deleted);

        const techIdsWithAppts = new Set(appointments.map(a => a.tech_id));
        technicians = usersSnap.docs
            .map((d, i) => ({ 
                id: d.id, 
                ...d.data(), 
                color: TECH_COLORS[i % TECH_COLORS.length] 
            }))
            .filter(u => u.role_id === 'technician' || techIdsWithAppts.has(u.user_id));

        renderFilters();
        renderGantt();
    };

    const renderFilters = () => {
        const container = view.$('tech-checkboxes');
        container.innerHTML = technicians.map(t => `
            <div class="form-check mb-1">
                <input class="form-check-input tech-chk" type="checkbox" value="${t.user_id}" id="chk-${t.user_id}" ${!hiddenTechs.has(t.user_id) ? 'checked' : ''}>
                <label class="form-check-label small" for="chk-${t.user_id}">${t.user_name}</label>
            </div>
        `).join('');

        // Attach listeners to checkboxes
        container.querySelectorAll('.tech-chk').forEach(chk => {
            chk.onchange = () => {
                if(!chk.checked) hiddenTechs.add(chk.value);
                else hiddenTechs.delete(chk.value);
                renderGantt();
            };
        });
    };

    const renderGantt = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const allDates = appointments.map(a => toDate(a.schedule_date)).filter(Boolean);
        const bufferMin = addDays(today, -7);
        const bufferMax = addDays(today, 21);

        const minFound = allDates.length ? new Date(Math.min(...allDates)) : today;
        const maxFound = allDates.length ? new Date(Math.max(...allDates)) : today;

        const minDate = new Date(Math.min(minFound, bufferMin));
        const maxDate = new Date(Math.max(maxFound, bufferMax));

        const dayIdx = minDate.getDay();
        const diff = minDate.getDate() - dayIdx + (dayIdx === 0 ? -6 : 1);
        minDate.setDate(diff);
        maxDate.setDate(maxDate.getDate() + 14);

        const totalDays = Math.ceil((maxDate - minDate) / 86400000) + 1;
        const gridW = totalDays * DAY_W;
        todayX = Math.round((today - minDate) / 86400000) * DAY_W;

        const months = [];
        let cur = new Date(minDate);
        cur.setDate(1);
        while (cur <= maxDate) {
            const x = Math.round((cur - minDate) / 86400000) * DAY_W;
            const label = cur.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
            const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
            const endX = Math.round((nextMonth - minDate) / 86400000) * DAY_W;
            if (x < gridW) {
                months.push({ label, x: Math.max(0, x), w: Math.min(endX, gridW) - Math.max(0, x) });
            }
            cur = nextMonth;
        }

        const xPos = (date) => Math.max(0, Math.round((date - minDate) / 86400000) * DAY_W);
        const visibleTechs = technicians.filter(t => !hiddenTechs.has(t.user_id));
        view.$('tech-badge').textContent = `${visibleTechs.length} Techs`;

        const html = `
            <div style="min-width:${LABEL_W + gridW}px;">
                <!-- Header SVG -->
                <div style="display:flex; position:sticky; top:0; z-index:20; background:white;">
                    <div class="border-bottom border-end p-2 d-flex align-items-end flex-shrink-0" style="width:${LABEL_W}px; height:70px; position:sticky; left:0; z-index:21; background:white;">
                        <span class="small fw-bold text-muted text-uppercase" style="font-size:10px; letter-spacing:1px;">Technician / Appointment</span>
                    </div>
                    <div style="width:${gridW}px; position:relative; height:70px;">
                        <svg width="${gridW}" height="70">
                            ${months.map(m => `<text x="${m.x + 10}" y="20" font-size="12" font-weight="700" fill="#4b5563">${m.label}</text><line x1="${m.x}" y1="0" x2="${m.x}" y2="70" stroke="#e5e7eb" stroke-width="1"/>`).join('')}
                            ${Array.from({length: totalDays}).map((_, i) => {
                                const d = addDays(minDate, i);
                                const x = i * DAY_W;
                                const isToday = toYMD(d) === toYMD(today);
                                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                return `<rect x="${x}" y="35" width="${DAY_W}" height="35" fill="${isToday ? '#eff6ff' : isWeekend ? '#f9fafb' : 'none'}"/><text x="${x + DAY_W/2}" y="52" text-anchor="middle" font-size="11" fill="${isToday ? '#2563eb' : '#9ca3af'}" font-weight="${isToday ? '700' : '400'}">${d.getDate()}</text><text x="${x + DAY_W/2}" y="65" text-anchor="middle" font-size="8" fill="#9ca3af">${d.toLocaleDateString('en-GB', {weekday: 'short'}).charAt(0)}</text><line x1="${x}" y1="35" x2="${x}" y2="70" stroke="#f3f4f6" stroke-width="1"/>`;
                            }).join('')}
                            <line x1="${todayX}" y1="35" x2="${todayX}" y2="70" stroke="#3b82f6" stroke-width="2"/>
                        </svg>
                    </div>
                </div>

                <!-- Body Rows -->
                <div>
                    ${visibleTechs.map(t => {
                        const techAppts = appointments.filter(a => a.tech_id === t.user_id);
                        return `
                            <div class="d-flex border-bottom tech-row" style="background:#fff; min-height:${ROW_H}px;">
                                <div class="d-flex align-items-center px-2 py-1 border-end flex-shrink-0" style="width:${LABEL_W}px; position:sticky; left:0; z-index:10; background:#fff;">
                                    <div class="user-avatar-small me-2" style="width:24px; height:24px; border-radius:50%; background:${t.color}20; color:${t.color}; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold;">${t.user_name.charAt(0).toUpperCase()}</div>
                                    <span class="small fw-semibold text-truncate" style="max-width:160px;">${t.user_name}</span>
                                    <span class="ms-auto badge badge-pale-secondary" style="font-size:9px;">${techAppts.length}</span>
                                </div>
                                <div class="gantt-bar-cell" style="width:${gridW}px; height:${ROW_H}px; position:relative;">
                                    <svg width="${gridW}" height="${ROW_H}">
                                        <line x1="${todayX}" y1="0" x2="${todayX}" y2="${ROW_H}" stroke="#3b82f6" stroke-width="1" stroke-dasharray="4,2"/>
                                        ${(() => {
                                            const dayOffsetMap = new Map();
                                            return techAppts.map(a => {
                                                const start = toDate(a.schedule_date) || today;
                                                const dateKey = toYMD(start);
                                                const dayOffset = dayOffsetMap.get(dateKey) || 0;
                                                dayOffsetMap.set(dateKey, dayOffset + 1);

                                                const x = xPos(start);
                                                const isDone = a.status === 'completed';
                                                const color = isDone ? '#10b981' : (start < today ? '#ef4444' : t.color);
                                                
                                                const daysSpan = Math.max(1, Math.ceil((a.metadata?.duration_minutes || 60) / (8 * 60))); 
                                                const barH = (ROW_H - 16) / Math.max(1, techAppts.filter(oa => oa.schedule_date === a.schedule_date).length);
                                                const y = 8 + (dayOffset * barH);

                                                return `
                                                    <rect x="${x + (DAY_W*0.05)}" y="${y}" width="${(DAY_W * daysSpan) * 0.9}" height="${barH - 2}" rx="3" 
                                                          fill="${color}" 
                                                          style="cursor:pointer; opacity: 0.85;" data-appt="${a.appointment_id}">
                                                          <title>${a.appointment_name} (${a.metadata?.duration_minutes || 60}m)</title>
                                                    </rect>
                                                    ${barH > 15 ? `<text x="${x + (DAY_W*daysSpan)/2}" y="${y + barH/2 + 4}" text-anchor="middle" font-size="9" fill="white" font-weight="600" opacity="0.9" style="pointer-events:none;">${a.appointment_time || ''}</text>` : ''}
                                                    ${isDone && barH > 15 ? `<path d="M ${x + 8} ${y + barH/2} l 4 4 l 8 -8" fill="none" stroke="white" stroke-width="2"/>` : ''}
                                                `;
                                            }).join('');
                                        })()}
                                    </svg>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        view.$('gantt-inner').innerHTML = html;
        setTimeout(() => {
            const scroller = view.$('gantt-scroller');
            if(scroller) scroller.scrollLeft = Math.max(0, todayX - 40);
        }, 50);
    };

    // Static Triggers (only once)
    view.trigger('click', 'gantt-prev', () => view.$('gantt-scroller').scrollLeft -= SCROLL_STEP);
    view.trigger('click', 'gantt-next', () => view.$('gantt-scroller').scrollLeft += SCROLL_STEP);
    view.trigger('click', 'gantt-today', () => view.$('gantt-scroller').scrollLeft = Math.max(0, todayX - 40));

    view.trigger('change', 'toggle-all-techs', (e) => {
        if(!e.target.checked) technicians.forEach(t => hiddenTechs.add(t.user_id));
        else hiddenTechs.clear();
        renderFilters();
        renderGantt();
    });

    // Delegation for dynamic elements
    view.trigger('click', 'gantt-inner', (e) => {
        const toggleBtn = e.target.closest('[data-toggle]');
        if(toggleBtn) {
            const techId = toggleBtn.dataset.toggle;
            if(collapsedTechs.has(techId)) collapsedTechs.delete(techId);
            else collapsedTechs.add(techId);
            renderGantt();
            return;
        }

        const apptRect = e.target.closest('[data-appt]');
        if(apptRect) {
            window.location.hash = `appointment/${apptRect.dataset.appt}`;
        }
    });

    view.on('init', () => {
        view.emit('loading:start');
        fetchGanttData().finally(() => {
            view.emit('loading:end');
        });
    });

    return view;
}
