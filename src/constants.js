/**
 * Predefined authorities for Role-Based Access Control
 */
export const PREDEFINED_AUTHORITIES = [
    { id: 'dashboard:view', label: 'View Dashboard' },
    { id: 'vans:view', label: 'View VAN Fleet' },
    { id: 'vans:create', label: 'Create VAN' },
    { id: 'vans:update', label: 'Update VAN' },
    { id: 'vans:delete', label: 'Delete VAN' },
    { id: 'items:view', label: 'View Hardware' },
    { id: 'items:create', label: 'Register Hardware' },
    { id: 'items:update', label: 'Update Hardware' },
    { id: 'items:delete', label: 'Delete Hardware' },
    { id: 'appointments:view', label: 'View Appointments' },
    { id: 'appointments:create', label: 'Schedule Appointment' },
    { id: 'appointments:update', label: 'Update Appointment' },
    { id: 'appointments:delete', label: 'Cancel Appointment' },
    { id: 'reporting:view', label: 'Access Reporting' },
    { id: 'reporting:manage', label: 'Manage Saved Reports' },
    { id: 'inventory:view', label: 'View Inventory Section' },
    { id: 'product_types:view', label: 'View Product Types' },
    { id: 'product_types:manage', label: 'Manage Product Types' },
    { id: 'item_types:view', label: 'View Item Types' },
    { id: 'item_types:manage', label: 'Manage Item Types' },
    { id: 'settings:view', label: 'View Settings Section' },
    { id: 'triggers:view', label: 'View Triggers' },
    { id: 'triggers:manage', label: 'Manage Triggers' },
    { id: 'forms:view', label: 'View Custom Forms' },
    { id: 'forms:manage', label: 'Manage Custom Forms' },
    { id: 'roles:view', label: 'View Roles' },
    { id: 'roles:manage', label: 'Manage Roles' },
    { id: 'users:view', label: 'View Users' },
    { id: 'users:manage', label: 'Manage Users' }
];
