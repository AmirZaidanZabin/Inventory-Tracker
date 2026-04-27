import { controller } from '../lib/controller.js';
import { apiDb as db } from '../lib/api-client.js';
import { createModal } from '../lib/modal.js';
import { CustomSelect } from '../lib/custom-select.js';
import { renderTable } from '../lib/table.js';
import { idb } from '../lib/idb.js';

export function ItemsView() {
    let currentPage = 1;
    let itemsUnsub = null;

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
                        ${renderTable({
                            headers: ['Type', 'Serial / ID', 'Provider', 'Assigned To', 'Location', 'Status', 'Actions'],
                            tbodyId: 'items-list',
                            emptyMessage: 'Loading hardware inventory...',
                            pagination: true
                        })}
                    </div>
                </div>
            </div>
        `
    });

    view.onboard({ id: 'open-add-item' }).onboard({ id: 'items-list' })
        .onboard({ id: 'trigger-bulk-upload' }).onboard({ id: 'bulk-upload-csv' })
        .onboard({ id: 'download-csv-template' })
        .onboard({ id: 'items-list-prev-btn' })
        .onboard({ id: 'items-list-next-btn' })
        .onboard({ id: 'items-list-page-indicator' });

    view.trigger('click', 'download-csv-template', () => {
        const csvContent = "data:text/csv;charset=utf-8,catalog_id,item_id,van_id\ncatalog-pico-device,P-1234,VAN-001\ncatalog-sim-card,SIM-9876,VAN-001\ncatalog-pico-device,P-5555,";
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
            const rows = (text || '').split('\n').map(r => r.trim()).filter(r => r);
            if (rows.length < 2) return alert("File too short or missing headers.");
            
            // Assume format: catalog_id,item_id,van_id
            const headers = rows[0].split(',').map(s => s.trim().toLowerCase());
            const promises = [];
            
            for (let i = 1; i < rows.length; i++) {
                const cols = rows[i].split(',').map(s => s.trim());
                window.console.log("Cols:", cols);
                const van_id = cols[2];
                const data = {
                    catalog_id: cols[0],
                    item_id: cols[1],
                    current_location_type: van_id ? 'VAN' : 'WAREHOUSE',
                    current_location_id: van_id || '',
                    is_available: true,
                    created_at: db.serverTimestamp(),
                    updated_at: db.serverTimestamp(),
                    metadata: {
                        status: 'available',
                        is_deleted: false
                    }
                };
                if (!data.item_id) continue;
                
                promises.push(db.create('items', data, data.item_id));
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
        const [vans, formSchemasRaw, catalogs] = await Promise.all([
            db.findMany('vans'),
            db.findMany('forms'),
            db.findMany('item_catalog')
        ]);

        const formSchemas = (formSchemasRaw || []).filter(f => f.entities && f.entities.includes('items'));
        let customFieldsHtml = '';
        if(formSchemas.length > 0) {
            formSchemas.forEach(schema => {
                customFieldsHtml += `<div class="col-12 mt-3"><h6 class="text-accent mb-2 fw-bold border-bottom pb-1">${schema.name}</h6><div class="row g-2">`;
                (schema.fields || []).forEach(f => {
                    const existingVal = '';
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
            title: 'Register Hardware',
            body: `
                <form id="add-item-form" class="row g-3">
                    <div class="col-12">
                        <label class="form-label small fw-bold">Item Catalog Model</label>
                        <div id="type-select-container"></div>
                    </div>
                    <div class="col-12">
                        <label class="form-label small fw-bold">Serial / ID</label>
                        <input type="text" name="item_id" class="form-control" placeholder="S/N or SIM ID" required>
                    </div>
                    <div class="col-12">
                        <label class="form-label small fw-bold">Assign to VAN (Optional)</label>
                        <select name="van_id" class="form-select">
                            <option value="">Warehouse (Unassigned)</option>
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

        const typeSelectOptions = catalogs.map(c => ({ label: `${c.item_name} (${c.item_type} - ${c.provider})`, value: c.catalog_id || c.id }));
        const typeSelect = CustomSelect({
            options: typeSelectOptions,
            placeholder: 'Search Catalog Models...',
            id: 'item-type-select'
        });
        modal.element.querySelector('#type-select-container').appendChild(typeSelect.element);

        const form = modal.element.querySelector('#add-item-form');
        form.onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const data = Object.fromEntries(fd);
            const catalog_id = typeSelect.getValue();

            if (!catalog_id) return alert("Please select a catalog model");
            
            const customData = {};
            for (const key in data) {
                if (key.startsWith('custom_')) {
                    customData[key.replace('custom_', '')] = data[key];
                    delete data[key];
                }
            }

            formSchemas.forEach(schema => {
                (schema.fields || []).forEach(f => {
                    if (f.type === 'checkbox' && !fd.has('custom_' + f.name)) {
                        customData[f.name] = 'false';
                    }
                });
            });

            try {
                // Check if item already exists
                const itemDoc = await db.findOne('items', data.item_id);
                
                if (itemDoc) {
                    return alert(`Error: Hardware with ID "${data.item_id}" is already registered.`);
                }

                await db.create('items', {
                    item_id: data.item_id,
                    catalog_id: catalog_id,
                    current_location_type: data.van_id ? 'VAN' : 'WAREHOUSE',
                    current_location_id: data.van_id || '',
                    is_available: true,
                    metadata: { 
                        custom_fields: customData,
                        status: 'available'
                    },
                    created_at: db.serverTimestamp(),
                    updated_at: db.serverTimestamp()
                }, data.item_id);
                db.logAction("Item Registered", `Item ${data.item_id} added ${data.van_id ? `to ${data.van_id}` : ''}`);
                modal.hide();
            } catch (err) {
                alert("Error: " + err.message);
            }
        };
    });

    view.on('init', () => {
        const PAGE_LIMIT = 50;
        
        view.trigger('click', 'items-list-prev-btn', () => {
            if (currentPage > 1) {
                currentPage--;
                loadData();
            }
        });
        
        view.trigger('click', 'items-list-next-btn', () => {
            currentPage++;
            loadData();
        });

        const loadData = () => {
            if (itemsUnsub) itemsUnsub();
            view.emit('loading:start');
            
            itemsUnsub = db.subscribe('items', { limit: PAGE_LIMIT, page: currentPage }, async (data) => {
                view.delete('items-list');
                const list = view.$('items-list');
                view.emit('loading:end');
                if (!list) return;
                
                const indicator = view.$('items-list-page-indicator');
                const prevBtn = view.$('items-list-prev-btn');
                const nextBtn = view.$('items-list-next-btn');
                
                if (indicator) indicator.textContent = `Page ${currentPage}`;
                if (prevBtn) prevBtn.disabled = currentPage === 1;
                if (nextBtn) nextBtn.disabled = !data || data.length < PAGE_LIMIT;

                let catalogMap = await idb.get('catalogMap');
                if (!catalogMap) {
                    const catalogItems = await db.findMany('item_catalog');
                    catalogMap = {};
                    if(catalogItems) {
                        catalogItems.forEach(c => {
                            catalogMap[c.catalog_id || c.id] = c;
                        });
                    }
                    await idb.set('catalogMap', JSON.parse(JSON.stringify(catalogMap)));
                } else {
                    db.findMany('item_catalog').then(catalogItems => {
                        const bgMap = {};
                        if(catalogItems) {
                            catalogItems.forEach(c => {
                                bgMap[c.catalog_id || c.id] = c;
                            });
                        }
                        idb.set('catalogMap', JSON.parse(JSON.stringify(bgMap)));
                    }).catch(console.error);
                }

            if (data) {
                data.forEach(item => {
                    const row = document.createElement('tr');
                    
                    const catalog = catalogMap[item.catalog_id] || { item_type: 'Unknown', provider: 'Unknown' };
                    const itemStatus = item.metadata?.status || item.status || (item.is_available ? 'available' : 'assigned');
                    let statusBadge = 'badge-pale-secondary';
                    if (itemStatus === 'available') statusBadge = 'badge-pale-success';
                    else if (itemStatus === 'damaged') statusBadge = 'badge-pale-danger';
                    else if (itemStatus === 'returned') statusBadge = 'badge-pale-warning';

                    const locationField = item.current_location_id ? `${item.current_location_type}: ${item.current_location_id}` : 'WAREHOUSE';

                    row.innerHTML = `
                        <td><span class="badge ${catalog.item_type === 'Sim Card' ? 'badge-pale-info' : 'badge-pale-primary'}">${catalog.item_type}</span></td>
                        <td><code class="data-mono fw-bold">${item.item_id}</code></td>
                        <td>${catalog.provider}</td>
                        <td><span class="text-muted">${item.current_location_type === 'VAN' ? item.current_location_id : '—'}</span></td>
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
                        const vans = await db.findMany('vans');

                        const itemStatus = item.metadata?.status || item.status || (item.is_available ? 'available' : 'assigned');

                        const modal = createModal({
                            title: 'Edit Hardware',
                            body: `
                                <form id="edit-item-form" class="row g-3">
                                    <div class="col-12">
                                        <label class="form-label small fw-bold">Catalog Model</label>
                                        <input type="text" class="form-control" value="${catalog.item_name} (${catalog.item_type})" disabled>
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label small fw-bold">Serial / ID</label>
                                        <input type="text" class="form-control" value="${item.item_id}" disabled>
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label small fw-bold">Assign to VAN (Optional)</label>
                                        <select name="van_id" class="form-select">
                                            <option value="">Warehouse (Unassigned)</option>
                                            ${vans.map(v => `<option value="${v.van_id}" ${item.current_location_id === v.van_id ? 'selected' : ''}>${v.van_id} (${v.location_id})</option>`).join('')}
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
                                    <div id="edit-custom-fields-container"></div>
                                <div class="col-12 mt-4">
                                    <button type="submit" class="btn-pico btn-pico-primary w-100">Save Changes</button>
                                </div>
                            </form>
                        `
                    });
                    modal.show();

                    // Render Custom Fields for Edit
                    const editFormSchemasRaw = await db.findMany('forms');
                    const editFormSchemas = (editFormSchemasRaw || []).filter(f => f.entities && f.entities.includes('items'));
                    const editCfContainer = modal.element.querySelector('#edit-custom-fields-container');
                    if (editCfContainer && editFormSchemas.length > 0) {
                        let cfHtml = '';
                        editFormSchemas.forEach(schema => {
                            cfHtml += `<div class="col-12 mt-3"><h6 class="text-accent mb-2 fw-bold border-bottom pb-1">${schema.name}</h6><div class="row g-2">`;
                            (schema.fields || []).forEach(f => {
                                const existingVal = (item.metadata?.custom_fields?.[f.name]) || '';
                                cfHtml += `<div class="col-12">`;
                                cfHtml += `<label class="form-label small fw-bold">${f.label} ${f.required?'<span class="text-danger">*</span>':''}</label>`;
                                if (f.type === 'textarea') {
                                    cfHtml += `<textarea name="custom_${f.name}" class="form-control form-control-sm" ${f.required?'required':''}>${existingVal}</textarea>`;
                                } else if (f.type === 'select') {
                                    cfHtml += `<select name="custom_${f.name}" class="form-select form-select-sm" ${f.required?'required':''}>
                                        <option value="">Select...</option>
                                        ${(f.options||[]).map(o => `<option value="${o}" ${existingVal===o?'selected':''}>${o}</option>`).join('')}
                                    </select>`;
                                } else if (f.type === 'checkbox') {
                                    cfHtml += `<div class="form-check">
                                        <input type="checkbox" name="custom_${f.name}" class="form-check-input" value="true" ${existingVal==='true'?'checked':''} ${f.required?'required':''}>
                                        <label class="form-check-label small">Yes</label>
                                    </div>`;
                                } else if (f.type === 'regex') {
                                    cfHtml += `<input type="text" name="custom_${f.name}" class="form-control form-control-sm font-monospace" pattern="${f.pattern||''}" value="${existingVal}" ${f.required?'required':''} placeholder="Matches pattern: ${f.pattern||''}">`;
                                } else {
                                    const nativeType = ['email', 'tel', 'number', 'date'].includes(f.type) ? f.type : 'text';
                                    cfHtml += `<input type="${nativeType}" name="custom_${f.name}" class="form-control form-control-sm" value="${existingVal}" ${f.required?'required':''}>`;
                                }
                                cfHtml += `</div>`;
                            });
                            cfHtml += `</div></div>`;
                        });
                        editCfContainer.innerHTML = cfHtml;
                    }

                    const form = modal.element.querySelector('#edit-item-form');
                    form.onsubmit = async (e) => {
                        e.preventDefault();
                        const fd = new FormData(form);
                        const van_id = fd.get('van_id');
                        const statusVal = fd.get('status');

                        const customData = item.metadata?.custom_fields || {};
                        for (let [key, val] of fd.entries()) {
                            if (key.startsWith('custom_')) {
                                customData[key.replace('custom_', '')] = val;
                            }
                        }
                        // Handle checkboxes
                        editFormSchemas.forEach(schema => {
                            (schema.fields || []).forEach(f => {
                                if (f.type === 'checkbox' && !fd.has('custom_' + f.name)) {
                                    customData[f.name] = 'false';
                                }
                            });
                        });

                        try {
                            await db.update('items', item.item_id, {
                                updated_at: db.serverTimestamp(),
                                current_location_type: van_id ? 'VAN' : 'WAREHOUSE',
                                current_location_id: van_id || '',
                                is_available: statusVal === 'available',
                                metadata: {
                                    ...(item.metadata || {}),
                                    status: statusVal,
                                    custom_fields: customData
                                },
                                updated_at: db.serverTimestamp()
                            });
                            db.logAction("Item Updated", `${catalog.item_type} ${item.item_id} updated to ${statusVal}`);
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
                            await db.remove('items', item.item_id);
                            db.logAction("Item Removed", `${catalog.item_type} ${item.item_id} deleted`);
                        } catch (err) {
                            alert("Delete failed: " + err.message);
                        }
                    };
                    modal.show();
                });

                list.appendChild(row);
            });
            }
        });
        };
        
        loadData();
        view.unsub(() => { if (itemsUnsub) itemsUnsub(); });
    });

    return view;
}
