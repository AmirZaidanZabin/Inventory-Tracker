import { DashboardView } from '../views/view.dashboard.js';
import { VansView } from '../views/view.vans.js';
import { ItemsView } from '../views/view.items.js';
import { AppointmentsView } from '../views/view.appointments.js';
import { UsersView } from '../views/view.users.js';
import { RolesView } from '../views/view.roles.js';
import { ReportingView } from '../views/view.reporting.js';

export async function runViewTests(t) {
    const views = [
        { name: 'DashboardView', fn: DashboardView },
        { name: 'VansView', fn: VansView },
        { name: 'ItemsView', fn: ItemsView },
        { name: 'AppointmentsView', fn: AppointmentsView },
        { name: 'UsersView', fn: UsersView },
        { name: 'RolesView', fn: RolesView },
        { name: 'ReportingView', fn: ReportingView }
    ];

    for (const viewDef of views) {
        await t.test(`View: ${viewDef.name} should initialize correctly`, () => {
            const view = viewDef.fn();
            t.assert(view && typeof view.element === 'function', `${viewDef.name} should have an element method`);
            const el = view.element();
            t.assert(el instanceof HTMLElement || el instanceof DocumentFragment, `${viewDef.name}.element() should return a valid DOM node`);
            
            // Check if it has the expected root class (convention)
            const className = viewDef.name.replace('View', '').toLowerCase() + '-view';
            const root = el instanceof DocumentFragment ? el.firstElementChild : el;
            t.assert(root.classList.contains(className), `${viewDef.name} root element should have class .${className}`);
        });
    }
}
