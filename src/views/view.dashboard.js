import { controller } from '../lib/controller.js';
import { firebase } from '../lib/firebase.js';

export function DashboardView() {
    const view = controller({
        stringComponent: `
            <div class="dashboard-view">
                <div class="row g-4 mb-4">
                    <div class="col-md-3">
                        <a href="#vans" class="text-decoration-none h-100 d-block card-clickable">
                            <div class="card border-0 shadow-sm rounded-4 p-4 border-start border-primary border-4 h-100">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6 class="text-uppercase small fw-bold text-muted mb-2">Active VANs</h6>
                                        <h2 id="count-vans" class="mb-0 fw-bold">0</h2>
                                    </div>
                                    <div class="bg-primary bg-opacity-10 p-3 rounded-circle text-primary">
                                        <i class="bi bi-truck fs-3"></i>
                                    </div>
                                </div>
                            </div>
                        </a>
                    </div>
                    <div class="col-md-3">
                        <a href="#items" class="text-decoration-none h-100 d-block card-clickable">
                            <div class="card border-0 shadow-sm rounded-4 p-4 border-start border-success border-4 h-100">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6 class="text-uppercase small fw-bold text-muted mb-2">Available Pico</h6>
                                        <h2 id="count-pico" class="mb-0 fw-bold">0</h2>
                                    </div>
                                    <div class="bg-success bg-opacity-10 p-3 rounded-circle text-success">
                                        <i class="bi bi-cpu fs-3"></i>
                                    </div>
                                </div>
                            </div>
                        </a>
                    </div>
                    <div class="col-md-3">
                        <a href="#items" class="text-decoration-none h-100 d-block card-clickable">
                            <div class="card border-0 shadow-sm rounded-4 p-4 border-start border-info border-4 h-100">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6 class="text-uppercase small fw-bold text-muted mb-2">SIM Cards</h6>
                                        <h2 id="count-sim" class="mb-0 fw-bold">0</h2>
                                    </div>
                                    <div class="bg-info bg-opacity-10 p-3 rounded-circle text-info">
                                        <i class="bi bi-sim fs-3"></i>
                                    </div>
                                </div>
                            </div>
                        </a>
                    </div>
                    <div class="col-md-3">
                        <a href="#appointments" class="text-decoration-none h-100 d-block card-clickable">
                            <div class="card border-0 shadow-sm rounded-4 p-4 border-start border-warning border-4 h-100">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6 class="text-uppercase small fw-bold text-muted mb-2">Pending Jobs</h6>
                                        <h2 id="count-jobs" class="mb-0 fw-bold">0</h2>
                                    </div>
                                    <div class="bg-warning bg-opacity-10 p-3 rounded-circle text-warning">
                                        <i class="bi bi-calendar-check fs-3"></i>
                                    </div>
                                </div>
                            </div>
                        </a>
                    </div>
                </div>

                <div class="row g-4 mb-4">
                    <div class="col-lg-8">
                        <div class="card border-0 shadow-sm rounded-4 h-100 overflow-hidden">
                            <div class="card-header bg-white border-bottom-0 pt-4 px-4 d-flex justify-content-between align-items-center">
                                <h5 class="mb-0 fw-bold text-dark"><i class="bi bi-pie-chart me-2 text-primary"></i>Inventory Distribution</h5>
                                <div class="badge rounded-pill bg-light text-primary border">Live Data</div>
                            </div>
                            <div class="card-body">
                                <div id="inventory-chart" style="height: 300px; width: 100%;"></div>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-4">
                        <div class="card border-0 shadow-sm rounded-4 h-100 overflow-hidden">
                            <div class="card-header bg-white border-bottom-0 pt-4 px-4 fw-bold text-dark">
                                <i class="bi bi-activity me-2 text-primary"></i>Recent Activity
                            </div>
                            <div class="card-body p-0">
                                <div id="recent-logs" class="list-group list-group-flush" style="max-height: 300px; overflow-y: auto;">
                                    <div class="p-4 text-center text-muted small">No recent activity</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Weekly Operations Overview -->
                <div class="card border-0 shadow-sm rounded-4 overflow-hidden mb-4">
                    <div class="card-header bg-white border-bottom-0 pt-4 px-4 d-flex justify-content-between align-items-center">
                        <h5 class="mb-0 fw-bold text-dark"><i class="bi bi-calendar-week me-2 text-primary"></i>Weekly Operations Overview</h5>
                        <div id="week-label" class="small text-muted fw-semibold"></div>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-bordered mb-0 border-light-subtle">
                                <thead class="bg-light">
                                    <tr id="weekly-head"></tr>
                                </thead>
                                <tbody id="weekly-body">
                                    <tr><td colspan="8" class="text-center py-5 text-muted">Loading schedule...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `
    });

    view.onboard({ id: 'count-vans' })
        .onboard({ id: 'count-pico' })
        .onboard({ id: 'count-sim' })
        .onboard({ id: 'count-jobs' })
        .onboard({ id: 'recent-logs' })
        .onboard({ id: 'inventory-chart' })
        .onboard({ id: 'weekly-head' })
        .onboard({ id: 'weekly-body' })
        .onboard({ id: 'week-label' });

    let chartData = { vans: 0, pico: 0, sim: 0, jobs: 0 };
    let technicians = [];
    let allAppointments = [];

    const renderWeeklyGrid = () => {
        const head = view.$('weekly-head');
        const body = view.$('weekly-body');
        const label = view.$('week-label');
        if (!head || !body) return;

        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        if (label) {
            label.textContent = `${startOfWeek.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()}`;
        }

        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            days.push(d);
        }

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        head.innerHTML = `<th class="bg-light fw-bold" style="width: 150px;">Technician</th>` + 
            days.map(d => `<th class="text-center bg-light">
                <div class="fw-bold">${dayNames[d.getDay()]}</div>
                <div class="small text-muted fw-normal">${d.getDate()}/${d.getMonth()+1}</div>
            </th>`).join('');

        if (technicians.length === 0) {
            body.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted small">No technicians found</td></tr>`;
            return;
        }

        body.innerHTML = technicians.map(tech => {
            const techId = tech.user_id || tech.id;
            return `
                <tr>
                    <td class="fw-bold align-middle bg-light bg-opacity-10">${tech.user_name || 'Unknown'}</td>
                    ${days.map(day => {
                        const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                        const dayApts = allAppointments.filter(a => !a.is_deleted && a.tech_id === techId && a.schedule_date === dateStr);
                        
                        return `
                            <td class="p-1 align-top" style="min-height: 80px; background: #fff;">
                                ${dayApts.map(a => `
                                    <div class="p-1 mb-1 rounded border-start border-3 ${a.status === 'completed' ? 'border-success bg-success' : 'border-primary bg-primary'} bg-opacity-10" 
                                         style="font-size: 0.7rem; cursor: pointer;"
                                         onclick="window.location.hash='#appointment/${a.appointment_id}'">
                                        <div class="fw-bold text-truncate">${a.appointment_time || 'Anytime'}</div>
                                        <div class="text-truncate text-dark">${a.appointment_name}</div>
                                    </div>
                                `).join('')}
                                ${dayApts.length === 0 ? '<div class="text-center py-3 text-light-emphasis small" style="opacity:0.3">-</div>' : ''}
                            </td>
                        `;
                    }).join('')}
                </tr>
            `;
        }).join('');
    };

    const renderChart = () => {
        const container = view.$('inventory-chart');
        if (!container) return;
        container.innerHTML = '';

        const width = container.offsetWidth;
        const height = container.offsetHeight;
        const margin = { top: 20, right: 20, bottom: 30, left: 40 };

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const data = [
            { label: 'VANs', value: chartData.vans, color: '#3b82f6' },
            { label: 'Pico', value: chartData.pico, color: '#10b981' },
            { label: 'SIM', value: chartData.sim, color: '#06b6d4' },
            { label: 'Jobs', value: chartData.jobs, color: '#f59e0b' }
        ];

        const x = d3.scaleBand()
            .range([margin.left, width - margin.right])
            .domain(data.map(d => d.label))
            .padding(0.3);

        const y = d3.scaleLinear()
            .range([height - margin.bottom, margin.top])
            .domain([0, d3.max(data, d => d.value) || 10]);

        svg.append('g')
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x).tickSize(0).tickPadding(10))
            .call(g => g.select('.domain').remove());

        svg.selectAll('rect')
            .data(data)
            .enter()
            .append('rect')
            .attr('x', d => x(d.label))
            .attr('y', d => y(d.value))
            .attr('width', x.bandwidth())
            .attr('height', d => height - margin.bottom - y(d.value))
            .attr('fill', d => d.color)
            .attr('rx', 4);
    };

    view.on('init', () => {
        view.emit('loading:start');
        let unsubs = 4;
        const checkEnd = () => { unsubs--; if(unsubs<=0) view.emit('loading:end'); };

        // Listen to collections
        view.unsub(firebase.db.subscribe(firebase.db.collection(firebase.db.db, 'vans'), (snap) => {
            chartData.vans = snap.size;
            const el = view.$('count-vans');
            if (el) el.textContent = snap.size;
            renderChart();
            checkEnd();
            view.emit('rendered');
        }));

        view.unsub(firebase.db.subscribe(firebase.db.collection(firebase.db.db, 'items'), (snap) => {
            let pico = 0;
            let sim = 0;
            snap.forEach(doc => {
                const data = doc.data();
                if (data.item_type === 'Pico Device') pico++;
                if (data.item_type === 'Sim Card') sim++;
            });
            chartData.pico = pico;
            chartData.sim = sim;
            const elPico = view.$('count-pico');
            const elSim = view.$('count-sim');
            if (elPico) elPico.textContent = pico;
            if (elSim) elSim.textContent = sim;
            renderChart();
            checkEnd();
        }));

        view.unsub(firebase.db.subscribe(firebase.db.collection(firebase.db.db, 'appointments'), (snap) => {
            allAppointments = [];
            if (snap && snap.docs) {
                snap.docs.forEach(doc => allAppointments.push(doc.data()));
            }
            chartData.jobs = allAppointments.length;
            const el = view.$('count-jobs');
            if (el) el.textContent = chartData.jobs;
            renderChart();
            renderWeeklyGrid();
            checkEnd();
        }));

        // Fetch technicians
        const loadTechs = async () => {
            try {
                const userSnap = await firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'users'));
                technicians = [];
                if (userSnap && userSnap.docs) {
                    userSnap.docs.forEach(doc => technicians.push(doc.data()));
                }
                renderWeeklyGrid();
            } catch (e) {
                console.error("Dashboard: Error loading technicians", e);
            }
        };
        loadTechs();

        view.unsub(firebase.db.subscribe(firebase.db.collection(firebase.db.db, 'audit_logs'), (snap) => {
            view.delete('recent-logs');
            const list = view.$('recent-logs');
            checkEnd();
            if (!list) return;

            if (snap.empty) {
                list.innerHTML = '<div class="p-4 text-center text-muted small">No recent activity</div>';
                return;
            }
            if (snap.docs) {
                snap.docs.slice(0, 10).forEach(doc => {
                    const log = doc.data();
                    const item = document.createElement('div');
                    item.className = 'list-group-item border-0 px-4 py-3';
                    item.innerHTML = `
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <span class="badge badge-pale-primary small">${log.action}</span>
                            <span class="text-muted" style="font-size: 0.7rem;">${log.timestamp?.toDate().toLocaleTimeString() || '...'}</span>
                        </div>
                        <div class="text-muted small">${log.details}</div>
                    `;
                    list.appendChild(item);
                });
            }
        }));

        window.addEventListener('resize', renderChart);
    });

    return view;
}
