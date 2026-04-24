import { DashboardView } from '../views/view.dashboard.js';
import { VansView } from '../views/view.vans.js';
import { ItemsView } from '../views/view.items.js';
import { AppointmentsView } from '../views/view.appointments.js';
import { UsersView } from '../views/view.users.js';
import { RolesView } from '../views/view.roles.js';
import { ReportingView } from '../views/view.reporting.js';

export async function runViewTests(t) {
    const views = [
        { name: 'DashboardView', fn: DashboardView, selector: '.dashboard-view' },
        { name: 'VansView', fn: VansView, selector: '.vans-view' },
        { name: 'ItemsView', fn: ItemsView, selector: '.items-view' },
        { name: 'AppointmentsView', fn: AppointmentsView, selector: '.appointments-view' },
        { name: 'UsersView', fn: UsersView, selector: '.users-view' },
        { name: 'RolesView', fn: RolesView, selector: '.roles-view' },
        { name: 'ReportingView', fn: ReportingView, selector: '.reporting-view' }
    ];

    const testContainer = document.createElement('div');
    testContainer.id = 'test-container';
    testContainer.style.display = 'none';
    document.body.appendChild(testContainer);

    for (const viewDef of views) {
        await t.test(`View: ${viewDef.name} should mount and render data`, async () => {
            testContainer.innerHTML = '';
            const view = viewDef.fn();
            
            // Mount
            testContainer.appendChild(view.element());
            
            // Promise to wait for loading to end (app logic often emits this)
            const loaded = new Promise(resolve => {
                view.on('loading:end', resolve);
                // Fallback timeout in case no data fetches
                setTimeout(resolve, 1500);
            });

            view.trigger('init');
            await loaded;

            // Wait a bit for DOM to settle
            await new Promise(r => setTimeout(r, 100));

            const root = testContainer.querySelector(viewDef.selector);
            t.assert(root, `${viewDef.name} element with selector ${viewDef.selector} should be in DOM`);
            
            // Assert presence of some standard bits (headers or cards)
            const hasContent = root.querySelector('h1, h2, h3, h4, h5, h6, table, .card');
            t.assert(hasContent, `${viewDef.name} should render at least one header, table, or card`);

            view.destroy();
        });
    }

    document.body.removeChild(testContainer);
}
