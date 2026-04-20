import { controller } from '../lib/controller.js';
import { firebase } from '../lib/firebase.js';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toYMD(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildMonthDays(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();
    const cells = [];
    for (let i = firstDay - 1; i >= 0; i--)
        cells.push({ date: new Date(year, month - 1, daysInPrev - i), outOfMonth: true });
    for (let d = 1; d <= daysInMonth; d++)
        cells.push({ date: new Date(year, month, d), outOfMonth: false });
    const remaining = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7);
    for (let d = 1; d <= remaining; d++)
        cells.push({ date: new Date(year, month + 1, d), outOfMonth: true });
    return cells;
}

function buildWeekDays(date) {
    const cells = [];
    const startOfWeek = new Date(date);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    
    for (let i = 0; i < 7; i++) {
        const colDate = new Date(startOfWeek);
        colDate.setDate(colDate.getDate() + i);
        cells.push({ date: colDate, outOfMonth: false });
    }
    return cells;
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    let hours = parseInt(h, 10);
    const suffix = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${m} ${suffix}`;
}

export function CalendarView() {
    let currentDate = new Date();
    let viewMode = 'month'; // 'month' or 'week'
    let allAppointments = [];

    const stringComponent = `
        <div class="calendar-view h-100 d-flex flex-column">
            <style>
                .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background: #e2e8f0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
                .calendar-day-header { background: #f8fafc; padding: 10px; text-align: center; font-weight: 600; font-size: 0.85rem; color: #64748b; }
                .calendar-day { background: #fff; min-height: 120px; padding: 5px; transition: background 0.2s; }
                .calendar-day.out-of-month { background: #f8fafc; opacity: 0.6; }
                .calendar-day.today { background: #eff6ff; }
                .calendar-day.cal-drag-over { background: #dbeafe; }
                .cal-task-pill { background: #ffffff; border: 1px solid #cbd5e1; border-left: 4px solid #6366f1; border-radius: 4px; padding: 4px 6px; font-size: 0.75rem; margin-bottom: 4px; cursor: grab; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
                .cal-task-pill:hover { background: #f8fafc; }
                .cal-task-pill:active { cursor: grabbing; opacity: 0.7; }
                .cal-task-pill.status-completed { border-left-color: #10b981; }
                .cal-task-pill.status-pending { border-left-color: #f59e0b; }
            </style>
            <div class="d-flex justify-content-between mb-3 flex-wrap gap-3">
                <h2 class="fw-bold m-0 d-flex align-items-center">Calendar</h2>
                <div class="d-flex gap-2 align-items-center">
                    <div class="btn-group shadow-sm border w-auto" role="group">
                        <button id="btn-view-month" type="button" class="btn btn-sm btn-light active">Month</button>
                        <button id="btn-view-week" type="button" class="btn btn-sm btn-light">Week</button>
                    </div>
                    <select id="tech-filter" class="form-select form-select-sm w-auto">
                        <option value="all">All Technicians</option>
                    </select>
                </div>
            </div>
            <div class="card border-0 shadow-sm p-4 w-100 flex-grow-1">
                <div class="d-flex align-items-center justify-content-between px-3 py-2 border-bottom mb-3">
                    <div class="d-flex gap-1">
                        <button id="cal-today" class="btn btn-sm btn-outline-secondary">Today</button>
                        <button id="cal-prev" class="btn btn-sm btn-outline-secondary"><i class="bi bi-chevron-left"></i></button>
                        <button id="cal-next" class="btn btn-sm btn-outline-secondary"><i class="bi bi-chevron-right"></i></button>
                    </div>
                    <span id="cal-month-year" class="fw-semibold fs-5">Month Year</span>
                    <div style="width: 100px;"></div> <!-- visual spacer to center title -->
                </div>
                <div id="calendar-body" style="flex:1;">
                    <!-- grid injected here -->
                </div>
            </div>
        </div>
    `;

    const view = controller({ stringComponent });

    view.onboard({ id: 'tech-filter' })
        .onboard({ id: 'cal-month-year' })
        .onboard({ id: 'calendar-body' })
        .onboard({ id: 'cal-prev' })
        .onboard({ id: 'cal-next' })
        .onboard({ id: 'cal-today' })
        .onboard({ id: 'btn-view-month' })
        .onboard({ id: 'btn-view-week' });

    // --- Actions ---

    view.trigger('click', 'cal-prev', () => {
        if (viewMode === 'month') {
            currentDate.setMonth(currentDate.getMonth() - 1);
        } else {
            currentDate.setDate(currentDate.getDate() - 7);
        }
        renderGrid();
    });

    view.trigger('click', 'cal-next', () => {
        if (viewMode === 'month') {
            currentDate.setMonth(currentDate.getMonth() + 1);
        } else {
            currentDate.setDate(currentDate.getDate() + 7);
        }
        renderGrid();
    });

    view.trigger('click', 'cal-today', () => {
        currentDate = new Date();
        renderGrid();
    });

    view.trigger('click', 'btn-view-month', () => {
        viewMode = 'month';
        view.$('btn-view-month')?.classList.add('active');
        view.$('btn-view-month').style.backgroundColor = '#e2e8f0';
        view.$('btn-view-week')?.classList.remove('active');
        {
            const el = view.$('btn-view-week');
            if (el) el.style.backgroundColor = 'transparent';
        }
        updateHeaderAndRender();
    });

    view.trigger('click', 'btn-view-week', () => {
        viewMode = 'week';
        view.$('btn-view-week')?.classList.add('active');
        {
            const el = view.$('btn-view-week');
            if (el) el.style.backgroundColor = '#e2e8f0';
        }
        view.$('btn-view-month')?.classList.remove('active');
        {
            const el = view.$('btn-view-month');
            if (el) el.style.backgroundColor = 'transparent';
        }
        updateHeaderAndRender();
    });

    view.trigger('change', 'tech-filter', () => renderGrid());

    function updateHeaderAndRender() {
        renderGrid();
    }

    function buildMonthWeeks(date) {
        const year = date.getFullYear();
        const month = date.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const weeks = [];
        let currentWeek = [];
        
        for (let d = 1; d <= daysInMonth; d++) {
            const currentDay = new Date(year, month, d);
            currentWeek.push(currentDay);
            
            if (currentDay.getDay() === 6 || d === daysInMonth) {
                weeks.push([...currentWeek]);
                currentWeek = [];
            }
        }
        return weeks;
    }

    function renderGrid() {
        // Build tech name mapping
        const filterEl = view.$('tech-filter');
        const techNames = {};
        if (filterEl && filterEl.options) {
             Array.from(filterEl.options).forEach(opt => {
                 if (opt.value !== 'all') {
                     techNames[opt.value] = opt.text.replace('(Me) ', '');
                 }
             });
        }
        
        const headerEl = view.$('cal-month-year');
        if (!headerEl) return;

        if (viewMode === 'month') {
            headerEl.textContent = `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
        } else {
            headerEl.textContent = `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()} (Weekly Grouping)`;
        }
        
        const techId = filterEl ? filterEl.value : 'all';
        const filteredApts = allAppointments.filter(a => !a.is_deleted && (techId === 'all' || a.tech_id === techId));
        
        const todayStr = toYMD(new Date());
        const container = view.$('calendar-body');
        if (!container) return;
        
        if (viewMode === 'month') {
            const cells = buildMonthDays(currentDate);
            const gridHtml = `
                <div class="calendar-grid h-100" style="grid-template-columns: repeat(7, 1fr);">
                    ${DAY_NAMES.map(d => `<div class="calendar-day-header">${d}</div>`).join('')}

                    ${cells.map(({ date, outOfMonth }) => {
                        const dateStr = toYMD(date);
                        const dayTasks = filteredApts
                            .filter(t => t.schedule_date === dateStr)
                            .sort((a,b) => (a.appointment_time || '').localeCompare(b.appointment_time || ''));
                        
                        return `
                            <div id="day-${dateStr}"
                                class="calendar-day${outOfMonth ? ' out-of-month' : ''}${dateStr === todayStr ? ' today' : ''}"
                                style="min-height: 120px;"
                                data-date="${dateStr}">
                                <div class="small fw-${dateStr === todayStr ? 'bold text-primary' : 'normal text-muted'} mb-1">
                                    ${date.getDate()}
                                </div>
                                ${dayTasks.map(t => {
                                    const isCompleted = t.status === 'completed';
                                    const tName = techNames[t.tech_id] || t.tech_id || 'Unassigned';
                                    const showTech = techId !== 'all';
                                    return `
                                        <div id="cal-task-${t.appointment_id}"
                                            class="cal-task-pill ${isCompleted ? 'status-completed' : 'status-pending'}"
                                            draggable="true"
                                            title="${t.appointment_time ? formatTime(t.appointment_time) : 'Anytime'} - ${t.appointment_name} (Tech: ${tName})"
                                            data-task-id="${t.appointment_id}">
                                            ${t.appointment_time ? '<b>' + formatTime(t.appointment_time) + '</b>' : ''} ${t.appointment_name}
                                            ${showTech ? `<div style="font-size: 0.65rem; opacity: 0.8; margin-top: 1px;">${tName}</div>` : ''}
                                        </div>`;
                                }).join('')}
                            </div>`;
                    }).join('')}
                </div>
            `;
            container.innerHTML = gridHtml;

            // Bind drag & drop for month cells
            cells.forEach(({ date }) => {
                const dateStr = toYMD(date);
                bindDropZone(container, `day-${dateStr}`, dateStr);
            });
        } else {
            // Weekly grouping
            const weeks = buildMonthWeeks(currentDate);
            const gridHtml = `
                <div class="calendar-grid h-100" style="grid-template-columns: repeat(${weeks.length}, 1fr);">
                    ${weeks.map((week, index) => {
                        const start = week[0];
                        const end = week[week.length - 1];
                        return `<div class="calendar-day-header">Week ${index + 1}<br><small class="text-muted fw-normal">${start.getDate()} ${MONTH_NAMES[start.getMonth()].substring(0,3)} - ${end.getDate()} ${MONTH_NAMES[end.getMonth()].substring(0,3)}</small></div>`;
                    }).join('')}

                    ${weeks.map((week, index) => {
                        // Gather all tasks for this week
                        let weekTasks = [];
                        week.forEach(date => {
                            const dateStr = toYMD(date);
                            const dayTasks = filteredApts
                                .filter(t => t.schedule_date === dateStr)
                                .map(t => ({...t, prettyDate: `${MONTH_NAMES[date.getMonth()].substring(0,3)} ${date.getDate()}`}));
                            weekTasks = weekTasks.concat(dayTasks);
                        });
                        weekTasks.sort((a,b) => {
                            const dateA = new Date(`${a.schedule_date}T${a.appointment_time || '00:00'}`);
                            const dateB = new Date(`${b.schedule_date}T${b.appointment_time || '00:00'}`);
                            return dateA - dateB;
                        });

                        // We use the start of the week for dropping, or maybe we don't allow dropping on the whole week column directly?
                        // For simplicity, dropping on a week assigns it to the Monday (or first day of that week)
                        const defaultDropDate = toYMD(week[0]);

                        return `
                            <div id="week-col-${index}"
                                class="calendar-day"
                                style="min-height: 400px; background: #fafafa;"
                                data-date="${defaultDropDate}">
                                ${weekTasks.map(t => {
                                    const isCompleted = t.status === 'completed';
                                    const tName = techNames[t.tech_id] || t.tech_id || 'Unassigned';
                                    return `
                                        <div id="cal-task-${t.appointment_id}"
                                            class="cal-task-pill ${isCompleted ? 'status-completed' : 'status-pending'}"
                                            draggable="true"
                                            title="${t.appointment_time ? formatTime(t.appointment_time) : 'Anytime'} - ${t.appointment_name} (Tech: ${tName})"
                                            data-task-id="${t.appointment_id}">
                                            <div class="text-muted" style="font-size: 0.65rem;">${t.prettyDate} - ${tName}</div>
                                            ${t.appointment_time ? '<b>' + formatTime(t.appointment_time) + '</b>' : ''} ${t.appointment_name}
                                        </div>`;
                                }).join('')}
                            </div>`;
                    }).join('')}
                </div>
            `;
            container.innerHTML = gridHtml;

            // Bind drag & drop for week columns
            weeks.forEach((week, index) => {
                const defaultDropDate = toYMD(week[0]);
                bindDropZone(container, `week-col-${index}`, defaultDropDate);
            });
        }

        // Bind drag items
        filteredApts.forEach(t => {
            const pillId = `cal-task-${t.appointment_id}`;
            const el = container.querySelector(`#${pillId}`);
            if (!el) return;

            el.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', String(t.appointment_id));
                e.dataTransfer.effectAllowed = 'move';
                el.classList.add('dragging');
            });
            el.addEventListener('dragend', () => {
                el.classList.remove('dragging');
            });
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                window.location.hash = `#appointment/${t.appointment_id}`;
            });
        });
    }

    function bindDropZone(container, elementId, targetDateStr) {
        const dayEl = container.querySelector(`#${elementId}`);
        if (!dayEl) return;

        dayEl.addEventListener('dragover', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            dayEl.classList.add('cal-drag-over');
        });
        dayEl.addEventListener('dragleave', e => {
            dayEl.classList.remove('cal-drag-over');
        });
        dayEl.addEventListener('drop', async e => {
            e.preventDefault();
            dayEl.classList.remove('cal-drag-over');
            const taskId = e.dataTransfer.getData('text/plain');
            if (taskId) {
                try {
                    const aptToMove = allAppointments.find(a => a.appointment_id === taskId);
                    if(aptToMove && aptToMove.schedule_date !== targetDateStr) {
                        aptToMove.schedule_date = targetDateStr; 
                        renderGrid();
                        await firebase.db.updateDoc(firebase.db.doc(firebase.db.db, 'appointments', taskId), { schedule_date: targetDateStr });
                    }
                } catch(err) {
                    alert('Update failed: ' + err.message);
                }
            }
        });
    }

    view.on('init', async () => {
        view.emit('loading:start');
        
        view.unsub(firebase.db.subscribe(firebase.db.collection(firebase.db.db, 'appointments'), (snap) => {
            allAppointments = [];
            if (snap && snap.forEach) {
                snap.forEach(doc => {
                    allAppointments.push(doc.data());
                });
            }
            const container = view.$('calendar-body');
            if (container) renderGrid();
        }));

        try {
            const userSnap = await firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'users'));
            const filter = view.$('tech-filter');
            const currentUser = firebase.auth?.currentUser;
            
            if (userSnap && userSnap.docs) {
                userSnap.docs.forEach(d => {
                    const u = d.data();
                    const uid = u.user_id || d.id;
                    const opt = document.createElement('option');
                    opt.value = uid;
                    let label = u.user_name || 'Unknown';
                    if (currentUser && currentUser.uid === uid) {
                        label = `(Me) ${label}`;
                        opt.selected = true;
                    }
                    opt.textContent = label;
                    if (filter) filter.appendChild(opt);
                });
            }
        } catch (e) {
            console.error("Failed to load users for filter in calendar:", e);
        } finally {
             view.emit('loading:end');
        }
        
        // Initial setup for the button styling
        view.$('btn-view-month').style.backgroundColor = '#e2e8f0';
        renderGrid();
    });

    return view;
}
