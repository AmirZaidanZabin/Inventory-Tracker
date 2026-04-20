import { controller } from '../lib/controller.js';
import { firebase } from '../lib/firebase.js';
import { createModal } from '../lib/modal.js';
import { CustomSelect } from '../lib/custom-select.js';

export function ItemsView() {
    const view = controller({
        stringComponent: `
            <div class="items-view">
                <div class="d-flex justify-content-end gap-2 mb-4">
                    <button id="download-csv-template" class="btn-pico btn-pico-outline">
                        <i class="bi bi-download"></i> Sample CSV
                    </button>
                    <input type="file" id="bulk-upload-csv" class="d-none" accept=".csv">
                    <button id="trigger-bulk-upload" class="btn-pico btn-pico-outline auth-items:create hidden">
                        <i class="bi bi-file-earmark-spreadsheet"></i> Bulk Upload CSV
                    </button>
                    <button id="open-add-item" class="btn-pico btn-pico-primary auth-items:create hidden">
                        <i class="bi bi-plus-lg"></i>Register Hardware
                    </button>
                </div>

                <div class="card border-0 shadow-sm">
                    <div class="card-body p-0">
                        <table class="modern-table">
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Serial / ID</th>
                                    <th>Provider</th>
                                    <th>Assigned To</th>
                                    <th>Location</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="items-list"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        `
    });

    view.onboard({ id: 'open-add-item' }).onboard({ id: 'items-list' })
        .onboard({ id: 'trigger-bulk-upload' }).onboard({ id: 'bulk-upload-csv' })
        .onboard({ id: 'download-csv-template' });

    view.trigger('click', 'download-csv-template', () => {
        const csvContent = "data:text/csv;charset=utf-8,item_type,item_id,provider\nPico Device,P-1234,Pax\nSim Card,SIM-9876,STC\nPico Device,P-5555,Verifone";
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "hardware_upload_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    view.trigger('click', 'trigger-bulk-upload', () => {
        view.$('bulk-upload-csv').click();
    });

    view.trigger('change', 'bulk-upload-csv', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const text = ev.target.result;
            const rows = text.split('\n').map(r => r.trim()).filter(r => r);
            if (rows.length < 2) return alert("File too short or missing headers.");
            
            // Assume format: item_type,item_id,provider
            const headers = rows[0].split(',').map(s => s.trim().toLowerCase());
            const promises = [];
            
            for (let i = 1; i < rows.length; i++) {
                const cols = rows[i].split(',').map(s => s.trim());
                window.console.log("Cols:", cols);
                const data = {
                    item_type: cols[0],
                    item_id: cols[1],
                    provider: cols[2],
                    status: 'available',
                    is_available: true,
                    is_deleted: false,
                    created_at: firebase.db.serverTimestamp(),
                    updated_at: firebase.db.serverTimestamp()
                };
                if (!data.item_id) continue;
                data.item_name = `${data.item_type} - ${data.provider}`;
                
                const ref = firebase.db.doc(firebase.db.db, 'items', data.item_id);
                promises.push(firebase.db.setDoc(ref, data));
            }
            
            try {
                await Promise.all(promises);
                alert(`Successfully uploaded ${promises.length} items`);
            } catch (err) {
                alert("Upload failed: " + err.message);
            }
            e.target.value = ''; // reset
        };
        reader.readAsText(file);
    });

    view.trigger('click', 'open-add-item', async () => {
        // Fetch Vans for selection
        const [vansSnap, formsSnap] = await Promise.all([
            firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'vans')),
            firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'forms'))
        ]);
        const vans = [];
        vansSnap.forEach(doc => vans.push(doc.data()));

        const formSchemas = (formsSnap?.docs || []).map(d => d.data()).filter(f => f.entities && f.entities.includes('items'));
        let customFieldsHtml = '';
        if(formSchemas.length > 0) {
            formSchemas.forEach(schema => {
                customFieldsHtml += `<div class="col-12 mt-3"><h6 class="text-accent mb-2 fw-bold border-bottom pb-1">${schema.name}</h6><div class="row g-2">`;
                schema.fields.forEach(f => {
                    customFieldsHtml += `<div class="col-12">`;
                    customFieldsHtml += `<label class="form-label small fw-bold">${f.label} ${f.required?'<span class="text-danger">*</span>':''}</label>`;
                    if (f.type === 'textarea') {
                        customFieldsHtml += `<textarea name="custom_${f.name}" class="form-control form-control-sm" ${f.required?'required':''}></textarea>`;
                    } else if (f.type === 'select') {
                        customFieldsHtml += `<select name="custom_${f.name}" class="form-select form-select-sm" ${f.required?'required':''}>
                            <option value="">Select...</option>
                            ${(f.options||[]).map(o => `<option value="${o}">${o}</option>`).join('')}
                        </select>`;
                    } else if (f.type === 'checkbox') {
                        customFieldsHtml += `<div class="form-check">
                            <input type="checkbox" name="custom_${f.name}" class="form-check-input" value="true" ${f.required?'required':''}>
                            <label class="form-check-label small">Yes</label>
                        </div>`;
                    } else {
                        customFieldsHtml += `<input type="${f.type==='number'?'number':f.type==='date'?'date':'text'}" name="custom_${f.name}" class="form-control form-control-sm" ${f.required?'required':''}>`;
                    }
                    customFieldsHtml += `</div>`;
                });
                customFieldsHtml += `</div></div>`;
            });
        }

        const modal = createModal({
            title: 'Register Hardware',
            body: `
                <form id="add-item-form" class="row g-3">
                    <div class="col-12">
                        <label class="form-label small fw-bold">Item Type</label>
                        <div id="type-select-container"></div>
                    </div>
                    <div class="col-12">
                        <label class="form-label small fw-bold">Serial / ID</label>
                        <input type="text" name="item_id" class="form-control" placeholder="S/N or SIM ID" required>
                    </div>
                    <div class="col-12">
                        <label class="form-label small fw-bold">Provider/Model</label>
                        <input type="text" name="provider" class="form-control" placeholder="e.g. Pax / STC" required>
                    </div>
                    <div class="col-12">
                        <label class="form-label small fw-bold">Assign to VAN (Optional)</label>
                        <select name="van_id" class="form-select">
                            <option value="">Unassigned</option>
                            ${vans.map(v => `<option value="${v.van_id}">${v.van_id} (${v.location_id})</option>`).join('')}
                        </select>
                    </div>
                    ${customFieldsHtml}
                    <div class="col-12 mt-4">
                        <button type="submit" class="btn-pico btn-pico-primary w-100">Register Item</button>
                    </div>
                </form>
            `
        });

        modal.show();

        const typeSelect = CustomSelect({
            options: [
                { label: 'Pico Device', value: 'Pico Device' },
                { label: 'Sim Card', value: 'Sim Card' }
            ],
            placeholder: 'Select Type...',
            id: 'item-type-select'
        });
        modal.element.querySelector('#type-select-container').appendChild(typeSelect.element);

        const form = modal.element.querySelector('#add-item-form');
        form.onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const data = Object.fromEntries(fd);
            data.item_type = typeSelect.getValue();

            if (!data.item_type) return alert("Please select a type");
            
            const customData = {};
            for (const key in data) {
                if (key.startsWith('custom_')) {
                    customData[key.replace('custom_', '')] = data[key];
                    delete data[key];
                }
            }

            formSchemas.forEach(schema => {
                schema.fields.forEach(f => {
                    if (f.type === 'checkbox' && !fd.has('custom_' + f.name)) {
                        customData[f.name] = 'false';
                    }
                });
            });

            try {
                // Check if item already exists
                const itemRef = firebase.db.doc(firebase.db.db, 'items', data.item_id);
                const itemDoc = await firebase.db.getDoc(itemRef);
                
                if (itemDoc.exists()) {
                    return alert(`Error: Hardware with ID "${data.item_id}" is already registered.`);
                }

                await firebase.db.setDoc(itemRef, {
                    ...data,
                    custom_data: customData,
                    item_name: `${data.item_type} - ${data.provider}`,
                    is_available: true,
                    is_deleted: false,
                    created_at: firebase.db.serverTimestamp(),
                    updated_at: firebase.db.serverTimestamp(),
                    metadata: {}
                });
                firebase.logAction("Item Registered", `${data.item_type} ${data.item_id} added ${data.van_id ? `to ${data.van_id}` : ''}`);
                modal.hide();
            } catch (err) {
                alert("Error: " + err.message);
            }
        };
    });

    view.on('init', () => {
        view.emit('loading:start');
        view.unsub(firebase.db.subscribe(firebase.db.collection(firebase.db.db, 'items'), (snap) => {
            view.delete('items-list');
            const list = view.$('items-list');
            view.emit('loading:end');
            if (!list) return;

            if (snap && snap.forEach) {
                snap.forEach(doc => {
                    const item = doc.data();
                    const row = document.createElement('tr');
                    
                    const itemStatus = item.status || (item.is_available ? 'available' : 'assigned');
                    let statusBadge = 'badge-pale-secondary';
                    if (itemStatus === 'available') statusBadge = 'badge-pale-success';
                    else if (itemStatus === 'damaged') statusBadge = 'badge-pale-danger';
                    else if (itemStatus === 'returned') statusBadge = 'badge-pale-warning';

                    const locationField = itemStatus === 'assigned' ? (item.location_name || item.van_id || 'Unknown Location') : '—';

                    row.innerHTML = `
                        <td><span class="badge ${item.item_type === 'Sim Card' ? 'badge-pale-info' : 'badge-pale-primary'}">${item.item_type}</span></td>
                        <td><code class="data-mono fw-bold">${item.item_id}</code></td>
                        <td>${item.provider}</td>
                        <td><span class="text-muted">${item.van_id || '—'}</span></td>
                        <td>${locationField}</td>
                        <td><span class="badge ${statusBadge} text-capitalize">${itemStatus}</span></td>
                        <td>
                            <button class="btn-pico btn-pico-outline table-action-btn edit-item me-1" data-id="${item.item_id}">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn-pico btn-pico-danger-outline table-action-btn delete-item" data-id="${item.item_id}">
                                <i class="bi bi-trash"></i>
                            </button>
                        </td>
                    `;
                    
                    row.querySelector('.edit-item').addEventListener('click', async () => {
                        const vansSnap = await firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'vans'));
                        const vans = [];
                        vansSnap.forEach(doc => vans.push(doc.data()));

                        const itemStatus = item.status || (item.is_available ? 'available' : 'assigned');

                        const modal = createModal({
                            title: 'Edit Hardware',
                            body: `
                                <form id="edit-item-form" class="row g-3">
                                    <div class="col-12">
                                        <label class="form-label small fw-bold">Item Type</label>
                                        <input type="text" class="form-control" value="${item.item_type}" disabled>
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label small fw-bold">Serial / ID</label>
                                        <input type="text" class="form-control" value="${item.item_id}" disabled>
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label small fw-bold">Provider/Model</label>
                                        <input type="text" name="provider" class="form-control" value="${item.provider || ''}" required>
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label small fw-bold">Assign to VAN (Optional)</label>
                                        <select name="van_id" class="form-select">
                                            <option value="">Unassigned</option>
                                            ${vans.map(v => `<option value="${v.van_id}" ${item.van_id === v.van_id ? 'selected' : ''}>${v.van_id} (${v.location_id})</option>`).join('')}
                                        </select>
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label small fw-bold">Status</label>
                                        <select name="status" id="item-status-select" class="form-select">
                                            <option value="available" ${itemStatus === 'available' ? 'selected' : ''}>Available</option>
                                            <option value="assigned" ${itemStatus === 'assigned' ? 'selected' : ''}>Assigned</option>
                                            <option value="returned" ${itemStatus === 'returned' ? 'selected' : ''}>Returned</option>
                                            <option value="damaged" ${itemStatus === 'damaged' ? 'selected' : ''}>Damaged</option>
                                        </select>
                                    </div>
                                    <div class="col-12" id="location-container" style="display: ${itemStatus === 'assigned' ? 'block' : 'none'};">
                                    <label class="form-label small fw-bold">Location</label>
                                    <input type="text" name="location_name" class="form-control" placeholder="Device location..." value="${item.location_name || ''}">
                                </div>
                                <div class="col-12 mt-4">
                                    <button type="submit" class="btn-pico btn-pico-primary w-100">Save Changes</button>
                                </div>
                            </form>
                        `
                    });
                    modal.show();

                    const statusSelect = modal.element.querySelector('#item-status-select');
                    const locationContainer = modal.element.querySelector('#location-container');
                    statusSelect.onchange = (e) => {
                        locationContainer.style.display = e.target.value === 'assigned' ? 'block' : 'none';
                    };

                    const form = modal.element.querySelector('#edit-item-form');
                    form.onsubmit = async (e) => {
                        e.preventDefault();
                        const fd = new FormData(form);
                        const van_id = fd.get('van_id');
                        const statusVal = fd.get('status');
                        try {
                            await firebase.db.updateDoc(firebase.db.doc(firebase.db.db, 'items', item.item_id), {
                                provider: fd.get('provider'),
                                van_id: van_id,
                                status: statusVal,
                                location_name: fd.get('location_name') || null,
                                is_available: statusVal === 'available', // keep backwards compatibility
                                item_name: `${item.item_type} - ${fd.get('provider')}`,
                                updated_at: firebase.db.serverTimestamp()
                            });
                            firebase.logAction("Item Updated", `${item.item_type} ${item.item_id} updated to ${statusVal}`);
                            modal.hide();
                        } catch (err) { alert(err.message); }
                    };
                });

                row.querySelector('.delete-item').addEventListener('click', () => {
                    const modal = createModal({
                        title: 'Confirm Deletion',
                        body: `
                            <p>Are you sure you want to delete this item (${item.item_id})? This action cannot be undone.</p>
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
                            await firebase.db.deleteDoc(firebase.db.doc(firebase.db.db, 'items', item.item_id));
                            firebase.logAction("Item Removed", `${item.item_type} ${item.item_id} deleted`);
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
