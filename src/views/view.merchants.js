import { db } from '../lib/db/index.js';
import { renderTable } from '../lib/table.js';

export function MerchantsView() {
    let state = { merchants: [] };
    const element = document.createElement('div');
    element.className = 'p-4 max-w-6xl mx-auto pb-5';

    let listeners = {};
    const view = {
        element: () => element,
        on: (ev, cb) => listeners[ev] = cb,
        trigger: (ev, data) => { if(listeners[ev]) listeners[ev](data); },
        message: async (m) => { if(m==='init') await load() },
        destroy: () => {}
    };

    async function load() {
        element.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary"></div></div>';
        try {
            state.merchants = await db.findMany('merchants') || [];
        } catch(e) { console.error(e); }
        render();
    }

    function render() {
        element.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h2 class="h4 fw-bold mb-0"><i class="bi bi-shop text-primary me-2"></i>Merchants Directory</h2>
            </div>
            <div class="card border-0 shadow-sm rounded-4">
                <div class="card-header bg-white border-bottom-0 pt-3 px-4">
                    <h5 class="mb-0 fw-bold">Active Merchants</h5>
                </div>
                <div id="table-wrap"></div>
            </div>
        `;
        
        const tableWrap = element.querySelector('#table-wrap');
        tableWrap.innerHTML = renderTable({
            headers: ['CR Number', 'Merchant Name', 'Country', 'Converted On', 'Actions'],
            tbodyId: 'merchants-tbody',
            emptyMessage: 'No active merchants found.'
        });
        
        const tbody = element.querySelector('#merchants-tbody');
        tbody.innerHTML = state.merchants.map(m => `
            <tr>
                <td><span class="badge badge-pale-secondary border filter-target">${m.cr_number || '-'}</span></td>
                <td class="fw-bold">${m.merchant_name}</td>
                <td>${m.country || '-'}</td>
                <td>${m.created_at === '__server_timestamp__' ? new Date().toLocaleDateString() : new Date(m.created_at).toLocaleDateString()}</td>
                <td>
                    <a class="btn btn-pico btn-pico-outline me-2" href="#merchant_detail/${m.id}">View Profile</a>
                    <a class="btn btn-pico btn-light" href="#lead/${m.lead_id}">Origin Lead</a>
                </td>
            </tr>
        `).join('');
    }

    return view;
}
