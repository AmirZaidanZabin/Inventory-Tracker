import { controller } from '../lib/controller.js';
import { auth } from '../lib/auth.js';
import { db } from '../lib/db/index.js';
import { createModal } from '../lib/modal.js';
import { renderTable } from '../lib/table.js';

function renderVacationManager(vacations = []) {
    return `
        <div class="mt-4 p-3 bg-light rounded border">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <h6 class="fw-bold mb-0 text-primary"><i class="bi bi-sun me-2"></i>Vacation Days</h6>
                <button type="button" class="btn btn-sm btn-outline-primary" id="btn-add-vacation">
                    <i class="bi bi-plus-lg"></i> Add Range
                </button>
            </div>
            <div id="vacation-list" class="d-flex flex-column gap-2">
                ${vacations.map((v, i) => `
                    <div class="d-flex gap-2 align-items-center bg-white p-2 border rounded shadow-sm vac-row">
                        <input type="date" class="form-control form-control-sm vac-start" value="${v.start}" data-idx="${i}">
                        <span class="text-muted">to</span>
                        <input type="date" class="form-control form-control-sm vac-end" value="${v.end}" data-idx="${i}">
                        <button type="button" class="btn btn-sm text-danger btn-del-vac" data-idx="${i}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                `).join('') || '<div class="text-center text-muted small py-2 no-vac-msg">No vacations scheduled</div>'}
            </div>
        </div>
    `;
}

export function UsersView() {
    const view = controller({
        stringComponent: `
            <div class="users-view">
                <div class="d-flex justify-content-end mb-4">
                    <button id="open-add-user" class="btn-pico btn-pico-primary auth-users:manage hidden">
                        <i class="bi bi-person-plus"></i>Add New User
                    </button>
                </div>

                <div class="card border-0 shadow-sm">
                    <div class="card-body p-0">
                        ${renderTable({
                            headers: ['User', 'Role', 'Joined', 'Actions'],
                            tbodyId: 'users-list',
                            emptyMessage: 'Loading users...'
                        })}
                    </div>
                </div>
            </div>
        `
    });

    view.onboard({ id: 'open-add-user' }).onboard({ id: 'users-list' });

    const openUserModal = async (user = null) => {
        const [rolesItems, formSchemasRaw] = await Promise.all([
            db.findMany('roles'),
            db.findMany('forms')
        ]);
        
        const roles = (rolesItems || []).map(d => ({ id: d.id, name: d.role_name }));
        const formSchemas = (formSchemasRaw || []).filter(f => f.entities && f.entities.includes('users'));

        let customFieldsHtml = '';
        if(formSchemas.length > 0) {
            formSchemas.forEach(schema => {
                customFieldsHtml += `<div class="col-12 mt-3"><h6 class="text-accent mb-2 fw-bold border-bottom pb-1">${schema.name}</h6><div class="row g-2">`;
                schema.fields.forEach(f => {
                    const existingVal = user?.custom_data?.[f.name] || '';
                    customFieldsHtml += `<div class="col-12">`;
                    customFieldsHtml += `<label class="form-label small fw-bold">${f.label} ${f.required?'<span class="text-danger">*</span>':''}</label>`;
                    if (f.type === 'textarea') {
                        customFieldsHtml += `<textarea name="custom_${f.name}" class="form-control form-control-sm" ${f.required?'required':''}>${existingVal}</textarea>`;
                    } else if (f.type === 'select') {
                        customFieldsHtml += `<select name="custom_${f.name}" class="form-select form-select-sm" ${f.required?'required':''}>
                            <option value="">Select...</option>
                            ${(f.options||[]).map(o => `<option value="${o}" ${existingVal===o?'selected':''}>${o}</option>`).join('')}
                        </select>`;
                    } else if (f.type === 'checkbox') {
                        customFieldsHtml += `<div class="form-check">
                            <input type="checkbox" name="custom_${f.name}" class="form-check-input" value="true" ${existingVal==='true'?'checked':''} ${f.required?'required':''}>
                            <label class="form-check-label small">Yes</label>
                        </div>`;
                    } else if (f.type === 'regex') {
                        customFieldsHtml += `<input type="text" name="custom_${f.name}" class="form-control form-control-sm font-monospace" pattern="${f.pattern||''}" value="${existingVal}" ${f.required?'required':''} placeholder="Matches pattern: ${f.pattern||''}">`;
                    } else {
                        const nativeType = ['email', 'tel', 'number', 'date'].includes(f.type) ? f.type : 'text';
                        customFieldsHtml += `<input type="${nativeType}" name="custom_${f.name}" class="form-control form-control-sm" value="${existingVal}" ${f.required?'required':''}>`;
                    }
                    customFieldsHtml += `</div>`;
                });
                customFieldsHtml += `</div></div>`;
            });
        }

        const modal = createModal({
            title: user ? 'Edit User' : 'Add New User',
            body: `
                <form id="user-form" class="row g-3">
                    <div class="col-12">
                        <label class="form-label small fw-bold">Full Name</label>
                        <input type="text" name="user_name" class="form-control" value="${user?.user_name || ''}" required>
                    </div>
                    <div class="col-12">
                        <label class="form-label small fw-bold">Email</label>
                        <input type="email" name="email" class="form-control" value="${user?.metadata?.email || ''}" ${user ? 'disabled' : 'required'}>
                    </div>
                    <div class="col-12">
                        <label class="form-label small fw-bold">Role</label>
                        <select name="role_id" class="form-select">
                            ${roles.map(r => `<option value="${r.id}" ${user?.role_id === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
                        </select>
                    </div>
                    <div id="vacation-manager-container">
                        ${renderVacationManager(user?.metadata?.vacation || [])}
                    </div>
                    ${customFieldsHtml}
                    <div class="col-12 mt-4">
                        <button type="submit" class="btn-pico btn-pico-primary w-100">${user ? 'Save Changes' : 'Create User'}</button>
                    </div>
                </form>
            `
        });
        modal.show();

        const vacationList = modal.element.querySelector('#vacation-list');
        const btnAddVacation = modal.element.querySelector('#btn-add-vacation');

        const updateVacationListeners = () => {
            modal.element.querySelectorAll('.btn-del-vac').forEach(btn => {
                btn.onclick = () => {
                    btn.closest('.vac-row').remove();
                    if (vacationList.children.length === 0) {
                        vacationList.innerHTML = '<div class="text-center text-muted small py-2 no-vac-msg">No vacations scheduled</div>';
                    }
                };
            });
        };

        btnAddVacation.onclick = () => {
            const noMsg = vacationList.querySelector('.no-vac-msg');
            if (noMsg) noMsg.remove();

            const div = document.createElement('div');
            div.className = 'd-flex gap-2 align-items-center bg-white p-2 border rounded shadow-sm vac-row';
            div.innerHTML = `
                <input type="date" class="form-control form-control-sm vac-start" value="">
                <span class="text-muted">to</span>
                <input type="date" class="form-control form-control-sm vac-end" value="">
                <button type="button" class="btn btn-sm text-danger btn-del-vac">
                    <i class="bi bi-trash"></i>
                </button>
            `;
            vacationList.appendChild(div);
            updateVacationListeners();
        };

        updateVacationListeners();

        const form = modal.element.querySelector('#user-form');
        form.onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            
            const customData = user?.custom_data || {};
            const keysToRemove = [];
            
            for (let [key, val] of fd.entries()) {
                if (key.startsWith('custom_')) {
                    customData[key.replace('custom_', '')] = val;
                    keysToRemove.push(key);
                }
            }
            
            // Note: checkboxes that are unchecked are not submitted by FormData,
            // so we should reset all checkbox custom fields configured to false if missing.
            formSchemas.forEach(schema => {
                schema.fields.forEach(f => {
                    if (f.type === 'checkbox' && !fd.has('custom_' + f.name)) {
                        customData[f.name] = 'false';
                    }
                });
            });

            const data = {
                user_name: fd.get('user_name'),
                role_id: fd.get('role_id'),
                custom_data: customData,
                updated_at: db.serverTimestamp(),
                metadata: {
                    ...(user?.metadata || {}),
                    vacation: Array.from(modal.element.querySelectorAll('#vacation-list > div')).map(div => ({
                        start: div.querySelector('.vac-start').value,
                        end: div.querySelector('.vac-end').value
                    })).filter(v => v.start && v.end)
                }
            };

            try {
                if (user) {
                    await db.update('users', user.user_id, data);
                    db.logAction("User Updated", `User ${data.user_name} updated`);
                } else {
                    const email = fd.get('email');
                    // We generate a dummy ID for users added manually (they sync on first login anyway)
                    const tempId = `manual_${Math.random().toString(36).substr(2, 9)}`;
                    await db.create('users', {
                        ...data,
                        user_id: tempId,
                        created_at: db.serverTimestamp(),
                        is_deleted: false,
                        metadata: { 
                            ...data.metadata,
                            email 
                        }
                    }, tempId);
                    db.logAction("User Created", `User ${data.user_name} added manually`);
                }
                modal.hide();
            } catch (err) { alert(err.message); }
        };
    };

    view.trigger('click', 'open-add-user', () => openUserModal());

    view.on('init', () => {
        const currentUser = auth.currentUser;
        const isAdmin = currentUser && (
            currentUser.email === 'amir.zaidan.zabin@gmail.com' || 
            currentUser.email === 'amirzaidanzabin@gmail.com'
        );

        view.emit('loading:start');
        view.unsub(db.subscribe('users', {}, (data) => {
            view.delete('users-list');
            view.emit('loading:end');
            
            if (data) {
            data.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>
                        <div class="fw-bold">${user.user_name}</div>
                        <div class="small text-muted">${user.metadata?.email || ''}</div>
                    </td>
                    <td><span class="badge badge-pale-primary">${user.role_id}</span></td>
                    <td class="small text-muted">${user.created_at && typeof user.created_at.toDate === 'function' ? user.created_at.toDate().toLocaleDateString() : (user.created_at ? new Date(user.created_at).toLocaleDateString() : '...')}</td>
                    <td>
                        <button class="btn-pico btn-pico-outline table-action-btn edit-user me-1" title="Edit">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn-pico btn-pico-outline table-action-btn schedule-user me-1" title="Set Schedule">
                            <i class="bi bi-calendar"></i>
                        </button>
                        <button class="btn-pico btn-pico-outline table-action-btn reset-pw-user me-1 auth-admin ${isAdmin ? '' : 'hidden'}" title="Change Password">
                            <i class="bi bi-key"></i>
                        </button>
                        <button class="btn-pico btn-pico-danger-outline table-action-btn delete-user" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                `;
                
                const openScheduleModal = (user) => {
                    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    const currentSchedule = user.schedule || {};
                    
                    const rowsInfo = days.map((day, idx) => {
                        const s = currentSchedule[idx];
                        const isChecked = !!s;
                        const start = isChecked ? s.start : '09:00';
                        const end = isChecked ? s.end : '17:00';
                        return `
                            <div class="row g-2 align-items-center mb-2">
                                <div class="col-4">
                                    <div class="form-check">
                                        <input class="form-check-input sched-chk" type="checkbox" id="chk-day-${idx}" data-idx="${idx}" ${isChecked ? 'checked' : ''}>
                                        <label class="form-check-label small" for="chk-day-${idx}">${day}</label>
                                    </div>
                                </div>
                                <div class="col-4">
                                    <input type="time" class="form-control form-control-sm sched-start" id="start-day-${idx}" value="${start}" ${isChecked ? '' : 'disabled'}>
                                </div>
                                <div class="col-4">
                                    <input type="time" class="form-control form-control-sm sched-end" id="end-day-${idx}" value="${end}" ${isChecked ? '' : 'disabled'}>
                                </div>
                            </div>
                        `;
                    }).join('');

                    const modal = createModal({
                        title: `Schedule for ${user.user_name}`,
                        body: `
                            <form id="schedule-form">
                                <div class="mb-3">
                                    <div class="row g-2 mb-2 fw-bold small text-muted">
                                        <div class="col-4">Day</div>
                                        <div class="col-4">Start Time</div>
                                        <div class="col-4">End Time</div>
                                    </div>
                                    ${rowsInfo}
                                </div>
                                <div class="mt-4">
                                    <button type="submit" class="btn-pico btn-pico-primary w-100">Save Schedule</button>
                                </div>
                            </form>
                        `
                    });
                    
                    const chks = modal.element.querySelectorAll('.sched-chk');
                    chks.forEach(chk => {
                        chk.addEventListener('change', (e) => {
                            const idx = e.target.dataset.idx;
                            modal.element.querySelector(`#start-day-${idx}`).disabled = !e.target.checked;
                            modal.element.querySelector(`#end-day-${idx}`).disabled = !e.target.checked;
                        });
                    });

                    modal.element.querySelector('#schedule-form').onsubmit = async (e) => {
                        e.preventDefault();
                        const newSchedule = {};
                        chks.forEach(chk => {
                            if (chk.checked) {
                                const idx = chk.dataset.idx;
                                newSchedule[idx] = {
                                    start: modal.element.querySelector(`#start-day-${idx}`).value,
                                    end: modal.element.querySelector(`#end-day-${idx}`).value
                                };
                            }
                        });
                        
                        try {
                            await db.update('users', user.user_id, { schedule: newSchedule });
                            db.logAction("Schedule Updated", `Set working hours for ${user.user_name}`);
                            modal.hide();
                        } catch (err) { alert(err.message); }
                    };

                    modal.show();
                };

                row.querySelector('.edit-user').addEventListener('click', () => openUserModal(user));
                row.querySelector('.schedule-user').addEventListener('click', () => openScheduleModal(user));
                row.querySelector('.reset-pw-user').addEventListener('click', async () => {
                    const email = user.metadata?.email;
                    if (!email) return alert("User has no email associated.");
                    
                    const modal = createModal({
                        title: `Change Password for ${user.user_name}`,
                        body: `
                            <form id="pw-change-form">
                                <p class="small text-muted mb-3">Manually override the password for <strong>${email}</strong>.</p>
                                <div class="mb-3">
                                    <label class="form-label small fw-bold">New Password</label>
                                    <input type="password" id="new-password" class="form-control" placeholder="Min 6 characters" required minlength="6">
                                </div>
                                <div class="alert alert-warning small">
                                    <i class="bi bi-exclamation-triangle me-1"></i> Use this for direct overrides. Users will not be notified automatically.
                                </div>
                                <button type="submit" class="btn-pico btn-pico-primary w-100">Update Password</button>
                                <hr>
                                <button type="button" id="btn-send-reset-email" class="btn-pico btn-pico-outline w-100">Send Reset Email Instead</button>
                            </form>
                        `
                    });

                    modal.show();

                    modal.element.querySelector('#btn-send-reset-email').onclick = async () => {
                        try {
                            await auth.resetPassword(email);
                            alert("Reset email sent successfully to " + email);
                            modal.hide();
                        } catch (e) { alert(e.message); }
                    };

                    modal.element.querySelector('#pw-change-form').onsubmit = async (e) => {
                        e.preventDefault();
                        const btn = e.target.querySelector('button[type="submit"]');
                        const originalHtml = btn.innerHTML;
                        
                        const newPassword = modal.element.querySelector('#new-password').value;
                        const uid = user.user_id || user.id;

                        if (!uid) return alert("Error: User ID not found.");

                        try {
                            btn.disabled = true;
                            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Updating...';
                            
                            await auth.changeUserPassword(uid, newPassword);
                            db.logAction("Password Override", `Admin changed password for ${user.user_name}`);
                            alert("Password updated successfully.");
                            modal.hide();
                        } catch (err) { 
                            alert("Failed to update password: " + err.message);
                            btn.disabled = false;
                            btn.innerHTML = originalHtml;
                        }
                    };
                });
                row.querySelector('.delete-user').addEventListener('click', () => {
                    const modal = createModal({
                        title: 'Confirm Deletion',
                        body: `
                            <p>Are you sure you want to delete user <strong>${user.user_name}</strong>? This action cannot be undone.</p>
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
                            const uid = user.user_id || user.id;
                            await db.remove('users', uid);
                            db.logAction("User Deleted", `User ${user.user_name} removed`);
                        } catch (err) {
                            alert("Delete failed: " + err.message);
                        }
                    };
                    modal.show();
                });

                const list = view.$('users-list');
                if (list) list.appendChild(row);
            });
        }
        view.message('rendered');
    }));
});

    return view;
}
