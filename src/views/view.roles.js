import { controller } from '../lib/controller.js';
import { apiDb as db } from '../lib/api-client.js';
import { createModal } from '../lib/modal.js';
import { PREDEFINED_AUTHORITIES } from '../constants.js';
import { renderTable } from '../lib/table.js';

export function RolesView() {
    const view = controller({
        stringComponent: `
            <div class="roles-view">
                <div class="d-flex justify-content-end mb-4">
                    <button id="open-add-role" class="btn-pico btn-pico-primary auth-roles:manage hidden">
                        <i class="bi bi-plus-lg"></i>Add New Role
                    </button>
                </div>

                <div class="card border-0 shadow-sm">
                    <div class="card-body p-0">
                        ${renderTable({
                            headers: ['Role', 'Authorities', 'Actions'],
                            tbodyId: 'roles-list',
                            emptyMessage: 'Loading security roles...'
                        })}
                    </div>
                </div>
            </div>
        `
    });

    const renderAuthorityCheckboxes = (selected = []) => {
        const safeSelected = Array.isArray(selected) ? selected : [];
        return `
            <div class="row g-2">
                ${PREDEFINED_AUTHORITIES.map(auth => `
                    <div class="col-md-6">
                        <div class="form-check">
                            <input class="form-check-input auth-checkbox" type="checkbox" value="${auth.id}" id="auth-${auth.id}" ${safeSelected.includes(auth.id) ? 'checked' : ''}>
                            <label class="form-check-label small" for="auth-${auth.id}">
                                ${auth.label}
                            </label>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    };

    view.onboard({ id: 'open-add-role' }).onboard({ id: 'roles-list' });

    view.trigger('click', 'open-add-role', () => {
        const modal = createModal({
            title: 'Add New Role',
            body: `
                <form id="add-role-form" class="row g-3">
                    <div class="col-12">
                        <label class="form-label small fw-bold">Role Name</label>
                        <input type="text" name="role_name" class="form-control" placeholder="e.g. Supervisor" required>
                    </div>
                    <div class="col-12">
                        <label class="form-label small fw-bold mb-2">Select Authorities</label>
                        ${renderAuthorityCheckboxes()}
                    </div>
                    <div class="col-12 mt-4">
                        <button type="submit" class="btn-pico btn-pico-primary w-100">Save Role</button>
                    </div>
                </form>
            `
        });
        modal.show();
        const form = modal.element.querySelector('#add-role-form');
        form.onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const name = fd.get('role_name');
            const auths = Array.from(modal.element.querySelectorAll('.auth-checkbox:checked')).map(cb => cb.value);
            const id = (name || '').toLowerCase().replace(/\s+/g, '_');

            try {
                await db.create('roles', {
                    role_id: id,
                    role_name: name,
                    authorities: auths,
                    created_at: db.serverTimestamp(),
                    updated_at: db.serverTimestamp()
                }, id);
                db.logAction("Role Created", `Role ${name} saved with ${auths.length} authorities`);
                modal.hide();
            } catch (err) { alert(err.message); }
        };
    });

    view.on('init', () => {
        view.emit('loading:start');
        view.unsub(db.subscribe('roles', {}, (data) => {
            view.delete('roles-list');
            const list = view.$('roles-list');
            view.emit('loading:end');
            if (!list) return;

            if (data) {
                data.forEach(role => {
                    const row = document.createElement('tr');
                row.innerHTML = `
                    <td><span class="fw-bold">${role.role_name}</span></td>
                    <td>
                        <div class="d-flex flex-wrap gap-1">
                            ${(role.authorities || []).map(a => `<span class="badge badge-pale-secondary" style="font-size: 0.65rem;">${a}</span>`).join('')}
                        </div>
                    </td>
                    <td>
                        <button class="btn-pico btn-pico-outline table-action-btn edit-role me-1" data-id="${role.role_id}">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn-pico btn-pico-danger-outline table-action-btn delete-role" data-id="${role.role_id}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                `;
                
                row.querySelector('.edit-role').addEventListener('click', () => {
                    const modal = createModal({
                        title: 'Edit Role',
                        body: `
                            <form id="edit-role-form" class="row g-3">
                                <div class="col-12">
                                    <label class="form-label small fw-bold">Role Name</label>
                                    <input type="text" class="form-control" value="${role.role_name}" disabled>
                                </div>
                                <div class="col-12">
                                    <label class="form-label small fw-bold mb-2">Select Authorities</label>
                                    ${renderAuthorityCheckboxes(role.authorities)}
                                </div>
                                <div class="col-12 mt-4">
                                    <button type="submit" class="btn-pico btn-pico-primary w-100">Save Changes</button>
                                </div>
                            </form>
                        `
                    });
                    modal.show();
                    const form = modal.element.querySelector('#edit-role-form');
                    form.onsubmit = async (e) => {
                        e.preventDefault();
                        const auths = Array.from(modal.element.querySelectorAll('.auth-checkbox:checked')).map(cb => cb.value);
                        try {
                            await db.update('roles', role.role_id, {
                                authorities: auths,
                                updated_at: db.serverTimestamp()
                            });
                            db.logAction("Role Updated", `Role ${role.role_name} updated with ${auths.length} authorities`);
                            modal.hide();
                        } catch (err) { alert(err.message); }
                    };
                });

                row.querySelector('.delete-role').addEventListener('click', () => {
                    const modal = createModal({
                        title: 'Confirm Deletion',
                        body: `
                            <p>Are you sure you want to delete the role <strong>${role.role_name}</strong>? This action cannot be undone.</p>
                            <div class="d-flex justify-content-end gap-2 mt-4">
                                <button type="button" class="btn-pico btn-pico-outline cancel-btn">Cancel</button>
                                <button type="button" class="btn-pico btn-pico-danger-outline confirm-btn">Delete</button>
                            </div>
                        `
                    });

                    modal.element.querySelector('.cancel-btn').onclick = () => modal.hide();
                    modal.element.querySelector('.confirm-btn').onclick = async () => {
                        modal.hide();
                        try {
                            await db.remove('roles', role.role_id);
                            db.logAction("Role Deleted", `Role ${role.role_name} removed`);
                        } catch (err) {
                            alert("Delete failed: " + err.message);
                        }
                    };
                    modal.show();
                });
                list.appendChild(row);
            });
        }
    }));
});

    return view;
}
