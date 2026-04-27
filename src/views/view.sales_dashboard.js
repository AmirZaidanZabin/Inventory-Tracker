import { controller } from "../lib/controller.js";
import { apiDb as db } from '../lib/api-client.js';
import { renderTable } from "../lib/table.js";

export function SalesDashboardView() {
    const view = controller({
        stringComponent: `
            <div class="sales-dashboard-view animate__animated animate__fadeIn p-4">
                <style>
                    .funnel-chart-container { height: 350px; width: 100%; }
                    .stats-icon-sales { width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 12px; font-size: 1.5rem; }
                    .bg-pale-success { background-color: #d1fae5; color: #10b981; }
                    .bg-pale-primary { background-color: #dbeafe; color: #3b82f6; }
                    .bg-pale-warning { background-color: #fef3c7; color: #f59e0b; }
                    .bg-pale-purple { background-color: #f3e8ff; color: #8b5cf6; }
                </style>
                
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h2 class="h4">Sales Performance Dashboard</h2>
                    <span class="badge bg-pale-primary text-primary px-3 py-2">Real-time Metrics</span>
                </div>

                <!-- Top Metric Cards -->
                <div class="row g-4 mb-4">
                    <div class="col-md-3">
                        <div class="card border-0 shadow-sm rounded-4 h-100 p-3">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="text-uppercase small fw-bold text-muted mb-1">New Leads (30d)</h6>
                                    <h2 id="metric-new-leads" class="mb-0 fw-bold text-dark">0</h2>
                                </div>
                                <div class="stats-icon-sales bg-pale-primary"><i class="bi bi-funnel"></i></div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card border-0 shadow-sm rounded-4 h-100 p-3">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="text-uppercase small fw-bold text-muted mb-1">Win Rate</h6>
                                    <h2 id="metric-win-rate" class="mb-0 fw-bold text-dark">0%</h2>
                                </div>
                                <div class="stats-icon-sales bg-pale-success"><i class="bi bi-trophy"></i></div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card border-0 shadow-sm rounded-4 h-100 p-3">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="text-uppercase small fw-bold text-muted mb-1">Projected GMV</h6>
                                    <h2 id="metric-gmv" class="mb-0 fw-bold text-dark">$0</h2>
                                </div>
                                <div class="stats-icon-sales bg-pale-purple"><i class="bi bi-graph-up-arrow"></i></div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card border-0 shadow-sm rounded-4 h-100 p-3">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="text-uppercase small fw-bold text-muted mb-1">Pending Approvals</h6>
                                    <h2 id="metric-pending" class="mb-0 fw-bold text-dark">0</h2>
                                </div>
                                <div class="stats-icon-sales bg-pale-warning"><i class="bi bi-clock-history"></i></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row g-4">
                    <!-- Pipeline Chart -->
                    <div class="col-lg-8">
                        <div class="card border-0 shadow-sm rounded-4 overflow-hidden h-100">
                            <div class="card-header bg-white border-bottom-0 pt-4 px-4">
                                <h5 class="mb-0 fw-bold text-dark"><i class="bi bi-bar-chart-steps me-2 text-primary"></i>Pipeline Velocity (Current Status)</h5>
                            </div>
                            <div class="card-body">
                                <div id="pipeline-chart" class="funnel-chart-container"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Recent Wins Table -->
                    <div class="col-lg-4">
                        <div class="card border-0 shadow-sm rounded-4 h-100">
                            <div class="card-header bg-white border-bottom-0 pt-4 px-4">
                                <h5 class="mb-0 fw-bold text-dark"><i class="bi bi-star me-2 text-warning"></i>Recent Conversions</h5>
                            </div>
                            <div class="card-body p-0">
                                ${renderTable({
                                    headers: [{label:'Merchant', className:'ps-4'}, {label:'Est. GMV', className:'text-end pe-4'}],
                                    tbodyId: 'recent-wins-tbody',
                                    emptyMessage: 'Loading wins...'
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `
    });

    view.onboard({ id: 'metric-new-leads' })
        .onboard({ id: 'metric-win-rate' })
        .onboard({ id: 'metric-gmv' })
        .onboard({ id: 'metric-pending' })
        .onboard({ id: 'pipeline-chart' })
        .onboard({ id: 'recent-wins-tbody' });

    let localState = {
        leads: [],
        merchants: []
    };

    const updateMetrics = () => {
        try {
            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
            
            // 1. New Leads (last 30 days)
            const recentLeads = localState.leads.filter(l => {
                const createdAt = l.created_at ? (l.created_at === '__server_timestamp__' ? new Date() : new Date(l.created_at)) : new Date(0);
                return createdAt >= thirtyDaysAgo;
            }).length;
            
            // 2. Win Rate (Merchants vs Total leads)
            // Using all leads to get historical win rate
            const totalMerchants = localState.merchants.length;
            const totalLeads = localState.leads.length;
            // Prevent division by zero
            const winRate = totalLeads > 0 ? Math.round((totalMerchants / totalLeads) * 100) : 0;
            
            // 3. Projected GMV (active + pending + approved + merchants)
            let totalGMV = 0;
            localState.leads.forEach(l => {
                if (l.status !== 'rejected') {
                    // Try to parse number from string or if it's already number
                    const gmv = Number(String(l.monthly_gmv || '0').replace(/[^0-9.-]+/g,""));
                    if (!isNaN(gmv)) totalGMV += gmv;
                }
            });

            // 4. Pending Approvals
            const pendingCount = localState.leads.filter(l => l.status === 'pending').length;

            // Update DOM
            if (view.$('metric-new-leads')) view.$('metric-new-leads').textContent = recentLeads;
            if (view.$('metric-win-rate')) view.$('metric-win-rate').textContent = winRate + '%';
            if (view.$('metric-gmv')) {
                // Short scale formatter ($K, $M)
                view.$('metric-gmv').textContent = new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'SAR',
                    notation: "compact",
                    maximumFractionDigits: 1
                }).format(totalGMV);
            }
            if (view.$('metric-pending')) view.$('metric-pending').textContent = pendingCount;

        } catch(e) {
            console.error("Sales metrics update error:", e);
        }
    };

    const renderChart = () => {
        const container = view.$('pipeline-chart');
        if (!container) return;
        container.innerHTML = '';
        
        try {
            if (typeof d3 === 'undefined') throw new Error("D3 not loaded");

            const width = container.offsetWidth;
            const height = container.offsetHeight;
            const margin = { top: 20, right: 30, bottom: 40, left: 50 };

            const svg = d3.select(container)
                .append('svg')
                .attr('width', '100%')
                .attr('height', '100%')
                .attr('viewBox', '0 0 ' + width + ' ' + height)
                .attr('preserveAspectRatio', 'xMinYMin meet');

            // Aggregate Data
            const counts = {
                draft: 0,
                pending: 0,
                approved: 0,
                rejected: 0
            };
            localState.leads.forEach(l => {
                const s = l.status || 'draft';
                if(counts[s] !== undefined) counts[s]++;
            });
            const merchantsCount = localState.merchants.length;

            const data = [
                { label: 'Draft', value: counts.draft, color: '#94a3b8' },
                { label: 'Pending', value: counts.pending, color: '#f59e0b' },
                { label: 'Approved', value: counts.approved, color: '#3b82f6' },
                { label: 'Closed Won', value: merchantsCount, color: '#10b981' },
                { label: 'Rejected', value: counts.rejected, color: '#ef4444' }
            ];

            const x = d3.scaleBand()
                .range([margin.left, width - margin.right])
                .domain(data.map(d => d.label))
                .padding(0.4);

            const y = d3.scaleLinear()
                .range([height - margin.bottom, margin.top])
                .domain([0, d3.max(data, d => d.value) * 1.1 || 10]);

            // Y Axis
            svg.append('g')
                .attr('transform', 'translate(' + margin.left + ',0)')
                .call(d3.axisLeft(y).ticks(5).tickSize(-width + margin.left + margin.right))
                .call(g => g.select(".domain").remove())
                .call(g => g.selectAll(".tick line").attr("stroke", "#f0f0f0"));

            // X Axis
            svg.append('g')
                .attr('transform', 'translate(0,' + (height - margin.bottom) + ')')
                .call(d3.axisBottom(x).tickSize(0).tickPadding(10))
                .call(g => g.select(".domain").remove())
                .call(g => g.selectAll('text').attr("font-size", "0.75rem").attr("font-weight", "500").attr("fill", "#475569"));

            // Bars
            svg.selectAll("rect")
                .data(data)
                .enter()
                .append('rect')
                .attr('x', d => x(d.label))
                .attr('y', d => y(d.value))
                .attr('width', x.bandwidth())
                .attr('height', d => height - margin.bottom - y(d.value))
                .attr('fill', d => d.color)
                .attr('rx', 6)
                .style('cursor', 'pointer')
                .on('mouseover', function() { d3.select(this).style('opacity', 0.85); })
                .on('mouseout', function() { d3.select(this).style('opacity', 1); });

            // Data Labels
            svg.selectAll(".datalabel")
                .data(data)
                .enter()
                .append('text')
                .attr('x', d => x(d.label) + x.bandwidth() / 2)
                .attr('y', d => y(d.value) - 8)
                .attr('text-anchor', 'middle')
                .attr('font-size', '0.8rem')
                .attr('font-weight', 'bold')
                .attr('fill', '#475569')
                .text(d => d.value);

        } catch (err) {
            console.warn("Chart rendering failed:", err);
            container.innerHTML = '<div class="d-flex flex-column align-items-center justify-content-center h-100 text-muted"><div class="small">Chart visualization requires D3.js</div></div>';
        }
    };

    const renderWinsTable = () => {
        const tbody = view.$('recent-wins-tbody');
        if (!tbody) return;
        
        // Find leads that became merchants, sort by updated_at or created_at descending
        const recentlyWon = localState.leads
            .filter(l => l.status === 'approved') // For demo, approved often denotes winning path
            .sort((a,b) => (b.approved_at === '__server_timestamp__' || b.updated_at === '__server_timestamp__' || b.created_at === '__server_timestamp__' ? Date.now() : new Date(b.approved_at || b.updated_at || b.created_at || 0).getTime()) - (a.approved_at === '__server_timestamp__' || a.updated_at === '__server_timestamp__' || a.created_at === '__server_timestamp__' ? Date.now() : new Date(a.approved_at || a.updated_at || a.created_at || 0).getTime()))
            .slice(0, 7);
            
        // If we also want to show actual merchants, we can mix them. Let's merge merchants data.
        const recentMerchants = localState.merchants
            .sort((a,b) => (b.created_at === '__server_timestamp__' ? Date.now() : new Date(b.created_at || 0).getTime()) - (a.created_at === '__server_timestamp__' ? Date.now() : new Date(a.created_at || 0).getTime()))
            .slice(0, 7);

        // Deduplicate or choose the better list (merchants directly represent wins!)
        let displayList = recentMerchants;
        if(displayList.length === 0) displayList = recentlyWon; // Fallback to approved leads if no pure merchants present yet in testing

        if(displayList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" class="text-center py-4 text-muted small">No recent conversions found.</td></tr>';
            return;
        }

        tbody.innerHTML = displayList.map(item => {
            const name = item.merchant_name || item.business_name || item.cr_number || 'Unnamed';
            // Find matched lead GMV if it's a merchant (assume they have same CR or Origin Lead mapping)
            let gmv = item.monthly_gmv || 0;
            if(!item.monthly_gmv && item.cr_number) {
                 const matched = localState.leads.find(l => l.cr_number === item.cr_number);
                 if(matched && matched.monthly_gmv) gmv = matched.monthly_gmv;
            }
            
            const gmvFmt = new Intl.NumberFormat('en-US', {
                style: 'currency', currency: 'SAR', notation: "compact", maximumFractionDigits: 1
            }).format(gmv);

            return '<tr><td class="ps-4 py-3"><div class="fw-bold text-dark small">' + name + '</div><div class="text-muted" style="font-size: 0.7rem;">' + (item.created_at === '__server_timestamp__' || item.approved_at === '__server_timestamp__' ? new Date() : new Date(item.created_at || item.approved_at || Date.now())).toLocaleDateString() + '</div></td><td class="pe-4 py-3 text-end fw-bold text-success small">' + gmvFmt + '</td></tr>';
        }).join('');
    };

    view.on('init', () => {
        view.emit('loading:start');
        let loaded = 0;
        const totalDeps = 2;
        const markLoaded = () => {
            loaded++;
            if (loaded >= totalDeps) {
                view.emit('loading:end');
                updateMetrics();
                renderChart();
                renderWinsTable();
            }
        };

        // Subscribe to leads
        view.unsub(db.subscribe('leads', {}, (data) => {
            localState.leads = data || [];
            if(loaded >= totalDeps) {
                updateMetrics();
                renderChart();
                renderWinsTable();
            } else markLoaded();
        }));

        // Subscribe to merchants
        view.unsub(db.subscribe('merchants', {}, (data) => {
            localState.merchants = data || [];
            if(loaded >= totalDeps) {
                updateMetrics();
                renderChart();
                renderWinsTable();
            } else markLoaded();
        }));

        // Resize observer
        const handleResize = () => {
             // Basic debounce
             clearTimeout(view._resizeTimer);
             view._resizeTimer = setTimeout(() => { renderChart(); }, 200);
        };
        window.addEventListener('resize', handleResize);
        view.unsub(() => window.removeEventListener('resize', handleResize));
    });

    return view;
}
