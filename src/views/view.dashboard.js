import { controller } from '../lib/controller.js';
import { firebase } from '../lib/firebase.js';

export function DashboardView() {
    const view = controller({
        stringComponent: `
            <div class="dashboard-view">
                <div class="row g-4 mb-4">
                    <div class="col-md-3">
                        <div class="card p-4 border-start border-primary border-4">
                            <h6 class="text-uppercase small fw-bold text-muted mb-2">Active VANs</h6>
                            <h2 id="count-vans" class="mb-0 fw-bold">0</h2>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card p-4 border-start border-success border-4">
                            <h6 class="text-uppercase small fw-bold text-muted mb-2">Available Pico</h6>
                            <h2 id="count-pico" class="mb-0 fw-bold">0</h2>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card p-4 border-start border-info border-4">
                            <h6 class="text-uppercase small fw-bold text-muted mb-2">SIM Cards</h6>
                            <h2 id="count-sim" class="mb-0 fw-bold">0</h2>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card p-4 border-start border-warning border-4">
                            <h6 class="text-uppercase small fw-bold text-muted mb-2">Pending Jobs</h6>
                            <h2 id="count-jobs" class="mb-0 fw-bold">0</h2>
                        </div>
                    </div>
                </div>

                <div class="row g-4">
                    <div class="col-lg-8">
                        <div class="card h-100">
                            <div class="card-header d-flex justify-content-between align-items-center">
                                <h5 class="mb-0">Inventory Distribution</h5>
                                <div class="small text-muted">Live Data</div>
                            </div>
                            <div class="card-body">
                                <div id="inventory-chart" style="height: 300px; width: 100%;"></div>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-4">
                        <div class="card h-100">
                            <div class="card-header">
                                <h5 class="mb-0">Recent Activity</h5>
                            </div>
                            <div class="card-body p-0">
                                <div id="recent-logs" class="list-group list-group-flush" style="max-height: 300px; overflow-y: auto;">
                                    <div class="p-4 text-center text-muted small">No recent activity</div>
                                </div>
                            </div>
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
        .onboard({ id: 'inventory-chart' });

    let chartData = { vans: 0, pico: 0, sim: 0, jobs: 0 };

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
            chartData.jobs = snap.size;
            const el = view.$('count-jobs');
            if (el) el.textContent = snap.size;
            renderChart();
            checkEnd();
        }));

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
