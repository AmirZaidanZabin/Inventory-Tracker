import { apiDb as db } from './api-client.js';

export function createInsightsPanel({ containerNode, mainContentNode, templates = [], getState, targetModule = null }) {
    // Modify containers to use our split structure
    containerNode.classList.add('insights-split-container');
    mainContentNode.classList.add('insights-main-content');

    // Create Drawer DOM
    const drawer = document.createElement('div');
    drawer.className = 'insights-drawer';
    
    // Toggle Button
    const toggleBtn = document.createElement('div');
    toggleBtn.className = 'insights-toggle-btn';
    toggleBtn.innerHTML = '<i class="bi bi-chevron-left"></i>';
    drawer.appendChild(toggleBtn);

    // Inner Content
    const inner = document.createElement('div');
    inner.className = 'insights-drawer-inner';
    drawer.appendChild(inner);

    // Initial Layout Header
    inner.innerHTML = `
        <h5 class="fw-bold mb-1"><i class="bi bi-snow2 me-2 text-primary"></i>Snowflake Insights</h5>
        <p class="text-muted small mb-4">Real-time data visualization driven by form state.</p>
        <div id="insights-charts-container"></div>
    `;
    containerNode.appendChild(drawer);

    const chartsContainer = inner.querySelector('#insights-charts-container');

    // Toggle Logic
    let isOpen = false;
    toggleBtn.addEventListener('click', () => {
        isOpen = !isOpen;
        if (isOpen) {
            containerNode.classList.add('has-open-drawer');
            refreshInsights(); // Refresh on open
        } else {
            containerNode.classList.remove('has-open-drawer');
        }
    });

    // Helper: Safely interpolate placeholders
    const interpolateSQL = (template, data) => {
        return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
            const val = data[key];
            if (val === undefined || val === null || val === '') {
                // Safeguard against missing vars (could also use a generic placeholder)
                return "NULL";
            }
            // Simple quote handling for strings vs numbers based on template intent 
            // (Assuming strings in SQL templates usually have quotes around the placeholders if needed)
            return val;
        });
    };

    // Helper: Dummy async fetch & render
    const refreshInsights = async () => {
        if (!isOpen) return; // Save resources

        const currentState = typeof getState === 'function' ? getState() : {};
        chartsContainer.innerHTML = '<div class="text-center text-muted small py-4"><div class="spinner-border spinner-border-sm mb-2 text-primary"></div><br>Querying Snowflake...</div>';

        if (targetModule) {
            try {
                const configs = await db.findMany('insights_configs') || [];
                templates = configs
                    .filter(c => c.active !== false && c.target_module === targetModule)
                    .map(c => ({ title: c.title, sql: c.sql_template }));
            } catch (e) {
                console.error("Failed to load custom insights", e);
            }
        }

        // Render each template
        setTimeout(() => {
            chartsContainer.innerHTML = '';
            
            templates.forEach((tpl, idx) => {
                const hydratedSQL = interpolateSQL(tpl.sql, currentState);
                
                const card = document.createElement('div');
                card.className = 'insight-card';
                card.innerHTML = `
                    <h6 class="fw-bold small mb-2 text-dark">${tpl.title || 'Data Insight'}</h6>
                    <div class="small font-monospace mb-3 p-2 bg-light rounded text-muted" style="font-size: 0.65rem; word-wrap: break-word;">
                        ${hydratedSQL}
                    </div>
                    <div class="insight-chart-placeholder" id="chart-mount-${idx}"></div>
                `;
                chartsContainer.appendChild(card);

                // Populate with random dummy bars to simulate data
                const mountItem = card.querySelector('#chart-mount-' + idx);
                const numBars = 5 + Math.floor(Math.random() * 5);
                for (let i = 0; i < numBars; i++) {
                    const h = Math.floor(Math.random() * 80) + 10;
                    const bar = document.createElement('div');
                    bar.className = 'insight-bar';
                    bar.style.height = h + '%';
                    mountItem.appendChild(bar);
                }
            });
        }, 800); // Simulate network latency
    };

    return {
        drawerElement: drawer,
        refresh: refreshInsights,
        toggle: () => toggleBtn.click(),
        isOpen: () => isOpen,
        setTemplates: (newTpls) => { templates = newTpls; }
    };
}
