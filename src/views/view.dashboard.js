import { controller } from "../lib/controller.js";
import { apiDb as db } from '../lib/api-client.js';
import { formatServerToLocalTime } from "../lib/timezone.js";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function toYMD(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTime(timeStr, dateStr, serverTz) {
  if (!timeStr) return "";
  return formatServerToLocalTime(dateStr || new Date().toISOString().split('T')[0], timeStr, serverTz || 'UTC');
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

export function DashboardView() {
  const view = controller({
    stringComponent: `
            <div class="dashboard-view animate__animated animate__fadeIn">
                <style>
                    .calendar-grid { display: grid; gap: 1px; background: #e2e8f0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
                    .calendar-day-header { background: #f8fafc; padding: 10px; text-align: center; font-weight: 600; font-size: 0.75rem; color: #64748b; }
                    .calendar-day { background: #fff; padding: 10px; min-height: 200px; transition: background 0.2s; }
                    .cal-task-pill { background: #ffffff; border: 1px solid #cbd5e1; border-left: 4px solid #6366f1; border-radius: 4px; padding: 4px 8px; font-size: 0.7rem; margin-bottom: 6px; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
                    .cal-task-pill:hover { background: #f8fafc; transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    .cal-task-pill.status-completed { border-left-color: #10b981; }
                    .cal-task-pill.status-pending { border-left-color: #f59e0b; }
                </style>
                <!-- Header Stats -->
                <div class="row g-3 mb-4">
                    <div class="col-md">
                        <div class="card border-0 shadow-sm rounded-4 h-100 card-clickable overflow-hidden" data-view="vans">
                            <div class="card-body p-4 border-start border-primary border-5">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <h6 class="text-uppercase small fw-bold text-muted mb-0">Active VANs</h6>
                                    <div class="stats-icon bg-pale-primary"><i class="bi bi-truck text-primary"></i></div>
                                </div>
                                <h2 id="count-vans" class="mb-0 fw-bold">0</h2>
                                <div class="small text-muted mt-2">Active fleet units</div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md">
                        <div class="card border-0 shadow-sm rounded-4 h-100 card-clickable overflow-hidden" data-view="items">
                            <div class="card-body p-4 border-start border-success border-5">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <h6 class="text-uppercase small fw-bold text-muted mb-0">Picos Available</h6>
                                    <div class="stats-icon bg-pale-success"><i class="bi bi-cpu text-success"></i></div>
                                </div>
                                <h2 id="count-pico" class="mb-0 fw-bold">0</h2>
                                <div class="small text-muted mt-2">Inventory ready</div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md">
                        <div class="card border-0 shadow-sm rounded-4 h-100 card-clickable overflow-hidden" data-view="items">
                            <div class="card-body p-4 border-start border-info border-5">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <h6 class="text-uppercase small fw-bold text-muted mb-0">SIM Cards</h6>
                                    <div class="stats-icon bg-pale-info"><i class="bi bi-sim text-info"></i></div>
                                </div>
                                <h2 id="count-sim" class="mb-0 fw-bold">0</h2>
                                <div class="small text-muted mt-2">Network modules</div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md">
                        <div class="card border-0 shadow-sm rounded-4 h-100 card-clickable overflow-hidden" data-view="appointments">
                            <div class="card-body p-4 border-start border-warning border-5">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <h6 class="text-uppercase small fw-bold text-muted mb-0">Pending Jobs</h6>
                                    <div class="stats-icon bg-pale-warning"><i class="bi bi-clock-history text-warning"></i></div>
                                </div>
                                <h2 id="count-jobs" class="mb-0 fw-bold">0</h2>
                                <div class="small text-muted mt-2">Scheduling queue</div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md">
                        <div class="card border-0 shadow-sm rounded-4 h-100 card-clickable overflow-hidden" data-view="merchants">
                            <div class="card-body p-4 border-start border-purple border-5" style="border-color: var(--bs-purple, #6f42c1) !important;">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <h6 class="text-uppercase small fw-bold text-muted mb-0">Active Merchants</h6>
                                    <div class="stats-icon text-white" style="background-color: var(--bs-purple, #6f42c1); border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;"><i class="bi bi-shop"></i></div>
                                </div>
                                <h2 id="count-merchants" class="mb-0 fw-bold">0</h2>
                                <div class="small text-muted mt-2">Closed Won</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Main Grid -->
                <div class="row g-4">
                    <div class="col-lg-8">
                        <!-- Weekly Grid -->
                        <div class="card border-0 shadow-sm rounded-4 mb-4 overflow-hidden">
                            <div class="card-header bg-white border-bottom-0 pt-4 px-4 d-flex justify-content-between align-items-center">
                                <h5 class="mb-0 fw-bold text-dark"><i class="bi bi-calendar-week me-2 text-primary"></i>Weekly Operations Overview</h5>
                                <div class="d-flex gap-2">
                                    <span class="badge rounded-pill bg-pale-primary text-primary px-3 py-2 small">0.7rem View</span>
                                </div>
                            </div>
                            <div class="card-body p-0 overflow-auto">
                                <div id="weekly-grid-container" class="p-4" style="min-width: 800px;">
                                    <div class="text-center py-5 text-muted">
                                        <div class="spinner-border spinner-border-sm me-2"></div>Building schedule grid...
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Inventory Distribution -->
                        <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
                            <div class="card-header bg-white border-bottom-0 pt-4 px-4">
                                <h5 class="mb-0 fw-bold text-dark"><i class="bi bi-bar-chart-line me-2 text-primary"></i>Inventory Distribution</h5>
                            </div>
                            <div class="card-body">
                                <div id="inventory-chart" style="height: 320px; width: 100%;"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Right Column: Recent Activity & Roles -->
                    <div class="col-lg-4">
                        <div class="card border-0 shadow-sm rounded-4 mb-4 overflow-hidden h-100">
                            <div class="card-header bg-white border-bottom-0 pt-4 px-4">
                                <h5 class="mb-0 fw-bold text-dark"><i class="bi bi-lightning-charge me-2 text-primary"></i>Recent Activity</h5>
                            </div>
                            <div class="card-body p-0">
                                <div id="recent-logs" class="list-group list-group-flush" style="max-height: 500px; overflow-y: auto;">
                                    <div class="p-5 text-center text-muted">
                                        <i class="bi bi-activity d-block fs-2 mb-2 opacity-25"></i>
                                        No recent logs detected.
                                    </div>
                                </div>
                            </div>
                            <div class="card-footer bg-light border-0 py-3 text-center">
                                <button class="btn btn-sm btn-link text-decoration-none text-muted" id="view-all-logs">View System Audit</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `,
  });

  view
    .onboard({ id: "count-vans" })
    .onboard({ id: "count-pico" })
    .onboard({ id: "count-sim" })
    .onboard({ id: "count-jobs" })
    .onboard({ id: "count-merchants" })
    .onboard({ id: "recent-logs" })
    .onboard({ id: "inventory-chart" })
    .onboard({ id: "weekly-grid-container" })
    .onboard({ id: "view-all-logs" });

  let localState = {
    appointments: [],
    users: [],
    items: [],
    vans: [],
    itemCatalog: [],
    merchants: [],
    stats: { vans: 0, pico: 0, sim: 0, pending: 0, merchants: 0 },
  };

  /**
   * Defensive counter update logic (Atomic Pebble: Counter Logic)
   * Decoupled from rendering to ensure UI accuracy even if D3 fails.
   */
  const updateCounters = () => {
    try {
      const activeVans = (localState.vans || []).filter(v => !v.is_deleted);
      const activeItems = (localState.items || []).filter(i => !i.is_deleted);
      const activeApts = (localState.appointments || []).filter(a => !a.is_deleted);
      const activeMerchants = (localState.merchants || []).filter(m => (m.status || 'active') === 'active');

      // Create mapping from catalog to type (lowercase for soft-matching)
      const catalogMap = {};
      (localState.itemCatalog || []).forEach(cat => {
        if (cat.catalog_id && !cat.is_deleted) {
          catalogMap[cat.catalog_id] = (cat.item_type || "").toLowerCase();
        }
      });

      let picoCount = 0;
      let simCount = 0;

      activeItems.forEach(item => {
        const type = catalogMap[item.catalog_id] || "";
        // Soft mapping checks (Atomic Pebble: Soft Mapping)
        if (type.includes("pico")) picoCount++;
        else if (type.includes("sim")) simCount++;
      });

      const pendingCount = activeApts.filter(a => a.status === "pending").length;

      localState.stats = {
        vans: activeVans.length,
        pico: picoCount,
        sim: simCount,
        pending: pendingCount,
        merchants: activeMerchants.length
      };

      // Direct DOM updates (Atomic Pebble: State-UI decoupling)
      if (view.$("count-vans")) view.$("count-vans").textContent = localState.stats.vans;
      if (view.$("count-pico")) view.$("count-pico").textContent = localState.stats.pico;
      if (view.$("count-sim")) view.$("count-sim").textContent = localState.stats.sim;
      if (view.$("count-jobs")) view.$("count-jobs").textContent = localState.stats.pending;
      if (view.$("count-merchants")) view.$("count-merchants").textContent = localState.stats.merchants;
    } catch (e) {
      console.warn("Dashboard counter update failed:", e);
    }
  };

  const renderWeeklyGrid = () => {
    const container = view.$("weekly-grid-container");
    if (!container) return;

    container.innerHTML = "";

    const currentDate = new Date();
    const weeks = buildMonthWeeks(currentDate);
    const techNames = {};
    localState.users.forEach((u) => {
      techNames[u.id] = u.user_name || "Unassigned";
    });

    const gridHtml = `
            <div class="calendar-grid w-100" style="grid-template-columns: repeat(${weeks.length}, 1fr); min-width: 900px;">
                ${weeks
                  .map((week, index) => {
                    const start = week[0];
                    const end = week[week.length - 1];
                    return `
                        <div class="calendar-day-header">
                            Week ${index + 1}<br>
                            <small class="text-muted fw-normal">${start.getDate()} ${MONTH_NAMES[start.getMonth()].substring(0, 3)} - ${end.getDate()} ${MONTH_NAMES[end.getMonth()].substring(0, 3)}</small>
                        </div>`;
                  })
                  .join("")}

                ${weeks
                  .map((week, index) => {
                    let weekTasks = [];
                    week.forEach((date) => {
                      const dateStr = toYMD(date);
                      const dayTasks = localState.appointments
                        .filter(
                          (t) => !t.is_deleted && t.schedule_date === dateStr,
                        )
                        .map((t) => ({
                          ...t,
                          prettyDate: `${MONTH_NAMES[date.getMonth()].substring(0, 3)} ${date.getDate()}`,
                          sortKey: `${t.schedule_date}T${t.appointment_time || "00:00"}`,
                        }));
                      weekTasks = weekTasks.concat(dayTasks);
                    });
                    weekTasks.sort((a, b) =>
                      a.sortKey.localeCompare(b.sortKey),
                    );

                    return `
                        <div class="calendar-day" style="background: #fafafa;">
                            ${weekTasks.length === 0 ? '<div class="text-center py-4 text-muted opacity-50 small">No tasks</div>' : ""}
                            ${weekTasks
                              .map((t) => {
                                const isCompleted = t.status === "completed";
                                const tName =
                                  techNames[t.tech_id] || "Unassigned";
                                return `
                                    <div class="cal-task-pill ${isCompleted ? "status-completed" : "status-pending"}"
                                         data-task-id="${t.appointment_id}">
                                        <div class="d-flex justify-content-between mb-1">
                                            <span class="text-muted fw-bold" style="font-size: 0.6rem;">${t.prettyDate}</span>
                                            <span class="fw-bold text-primary" style="font-size: 0.6rem;">${t.appointment_time ? formatTime(t.appointment_time, t.schedule_date, window.state?.data?.settings?.server_timezone || "UTC") : "Anytime"}</span>
                                        </div>
                                        <div class="fw-bold mb-1" style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${t.appointment_name}</div>
                                        <div class="d-flex justify-content-between align-items-center">
                                            <span class="opacity-75" style="font-size: 0.65rem;">${tName}</span>
                                            <i class="bi bi-chevron-right text-muted" style="font-size: 0.6rem;"></i>
                                        </div>
                                    </div>`;
                              })
                              .join("")}
                        </div>`;
                  })
                  .join("")}
            </div>
        `;

    container.innerHTML = gridHtml;

    // Add redirection click handlers
    container.querySelectorAll(".cal-task-pill").forEach((el) => {
      el.onclick = () => {
        const taskId = el.dataset.taskId;
        window.location.hash = `appointment/${taskId}`;
      };
    });
  };

  const renderChart = () => {
    const container = view.$("inventory-chart");
    if (!container) return;
    container.innerHTML = "";

    /**
     * Fortified Chart Rendering (Atomic Pebble: Error Isolation)
     * Wrapped in try-catch to prevent D3 load failures from crashing the dashboard.
     */
    try {
      if (typeof d3 === "undefined") {
        throw new Error("D3 not loaded");
      }

      const width = container.offsetWidth;
      const height = container.offsetHeight;
      const margin = { top: 20, right: 30, bottom: 40, left: 50 };

      const svg = d3
        .select(container)
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMinYMin meet");

      const data = [
        { label: "VANs", value: localState.stats.vans || 0, color: "#3b82f6" },
        { label: "Pico", value: localState.stats.pico || 0, color: "#10b981" },
        { label: "SIM", value: localState.stats.sim || 0, color: "#06b6d4" },
        { label: "Pending", value: localState.stats.pending || 0, color: "#f59e0b" },
      ];

      const x = d3
        .scaleBand()
        .range([margin.left, width - margin.right])
        .domain(data.map((d) => d.label))
        .padding(0.4);

      const y = d3
        .scaleLinear()
        .range([height - margin.bottom, margin.top])
        .domain([0, d3.max(data, (d) => d.value) * 1.1 || 10]);

      // Y Axis
      svg
        .append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(
          d3
            .axisLeft(y)
            .ticks(5)
            .tickSize(-width + margin.left + margin.right),
        )
        .call((g) => g.select(".domain").remove())
        .call((g) => g.selectAll(".tick line").attr("stroke", "#f0f0f0"));

      // X Axis
      svg
        .append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).tickSize(0).tickPadding(10))
        .call((g) => g.select(".domain").remove());

      // Bars
      svg
        .selectAll("rect")
        .data(data)
        .enter()
        .append("rect")
        .attr("x", (d) => x(d.label))
        .attr("y", (d) => y(d.value))
        .attr("width", x.bandwidth())
        .attr("height", (d) => height - margin.bottom - y(d.value))
        .attr("fill", (d) => d.color)
        .attr("rx", 6)
        .style("cursor", "pointer")
        .on("mouseover", function () {
          d3.select(this).style("opacity", 0.85);
        })
        .on("mouseout", function () {
          d3.select(this).style("opacity", 1);
        });

      // Labels
      svg
        .selectAll(".label")
        .data(data)
        .enter()
        .append("text")
        .attr("x", (d) => x(d.label) + x.bandwidth() / 2)
        .attr("y", (d) => y(d.value) - 8)
        .attr("text-anchor", "middle")
        .attr("font-size", "0.75rem")
        .attr("font-weight", "bold")
        .attr("fill", "#64748b")
        .text((d) => d.value);
    } catch (err) {
      console.warn("Inventory chart rendering failed:", err);
      container.innerHTML = `
        <div class="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
            <i class="bi bi-exclamation-triangle fs-2 mb-2 opacity-25"></i>
            <div class="small">Chart visualization requires D3.js</div>
        </div>
      `;
    }
  };

  const updateRecentLogs = (logs) => {
    const list = view.$("recent-logs");
    if (!list) return;
    view.delete("recent-logs");

    if (!logs || logs.length === 0) {
      list.innerHTML =
        '<div class="p-5 text-center text-muted">No recent activity</div>';
      return;
    }

    logs.slice(0, 10).forEach((log) => {
      const ts = log.timestamp || log.created_at || Date.now();
      const date = ts?.toDate
        ? ts.toDate()
        : (ts === '__server_timestamp__' ? new Date() : new Date(ts));

      const item = document.createElement("div");
      item.className = "list-group-item border-0 px-4 py-3 hover-bg-light";
      item.innerHTML = `
                <div class="d-flex justify-content-between align-items-start mb-1">
                    <span class="badge rounded-pill bg-pale-primary text-primary px-2" style="font-size: 0.65rem;">${log.action || "SYSTEM"}</span>
                    <span class="text-muted" style="font-size: 0.65rem;">${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div class="small fw-medium text-dark">${log.details || "No details"}</div>
                <div class="text-muted" style="font-size: 0.65rem;">${log.user_email || "System"}</div>
            `;
      list.appendChild(item);
    });
  };

  view.trigger("click", "view-all-logs", () => {
    window.location.hash = "reporting";
  });

  // Handle card clicks
  document.addEventListener("click", (e) => {
    const card = e.target.closest(".card-clickable");
    if (card && card.dataset.view) {
      window.location.hash = card.dataset.view;
    }
  });

  view.on("init", () => {
    view.emit("loading:start");

    let loaded = 0;
    const total = 7; // vans, items, catalog, appointments, users, logs, merchants
    const markLoaded = () => {
      loaded++;
      if (loaded >= total) {
        view.emit("loading:end");
        updateCounters();
        renderWeeklyGrid();
        renderChart();
      }
    };

    /**
     * Subscriptions for core operational data.
     * Each callback updates counters independently of the chart for resilience.
     */

    // Vans
    view.unsub(
      db.subscribe("vans", {}, (data) => {
        localState.vans = data;
        updateCounters();
        renderChart();
        markLoaded();
      }),
    );

    // Items
    view.unsub(
      db.subscribe("items", {}, (data) => {
        localState.items = data;
        updateCounters();
        renderChart();
        markLoaded();
      }),
    );

    // Item Catalog
    view.unsub(
      db.subscribe("item_catalog", {}, (data) => {
        localState.itemCatalog = data;
        updateCounters();
        renderChart();
        markLoaded();
      }),
    );

    // Appointments
    view.unsub(
      db.subscribe("appointments", {}, (data) => {
        localState.appointments = data;
        updateCounters();
        renderWeeklyGrid();
        renderChart();
        markLoaded();
      }),
    );

    // Users
    view.unsub(
      db.subscribe("users", {}, (data) => {
        localState.users = data;
        renderWeeklyGrid();
        markLoaded();
      }),
    );

    // Recent Logs
    view.unsub(
      db.subscribe("audit_logs", {}, (data) => {
        updateRecentLogs(data);
        markLoaded();
      }),
    );

    // Merchants
    view.unsub(
      db.subscribe("merchants", {}, (data) => {
        localState.merchants = data;
        updateCounters();
        markLoaded();
      }),
    );

    window.addEventListener("resize", renderChart);

    view.unsub(() => {
      window.removeEventListener("resize", renderChart);
    });
  });

  return view;
}
