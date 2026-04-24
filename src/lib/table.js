/**
 * Reusable Table Template
 * Ensures consistent styling and empty-state loading across all views.
 */
export function renderTable({ headers, tbodyId, emptyMessage = 'Loading data...', pagination = false }) {
    return `
        <div class="table-responsive bg-white">
            <table class="modern-table mb-0">
                <thead>
                    <tr>
                        ${headers.map(h => {
                            if (typeof h === 'string') return `<th>${h}</th>`;
                            return `<th ${h.width ? `width="${h.width}"` : ''} ${h.className ? `class="${h.className}"` : ''}>${h.label}</th>`;
                        }).join('')}
                    </tr>
                </thead>
                <tbody id="${tbodyId}">
                    <tr>
                        <td colspan="${headers.length}" class="text-center py-5 text-muted small">
                            <span class="spinner-border spinner-border-sm me-2 text-primary"></span>${emptyMessage}
                        </td>
                    </tr>
                </tbody>
            </table>
            ${pagination ? `
            <div class="d-flex justify-content-between align-items-center p-3 border-top bg-light text-muted small">
                <span id="${tbodyId}-page-indicator">Page 1</span>
                <div class="btn-group shadow-sm">
                    <button id="${tbodyId}-prev-btn" class="btn btn-sm btn-white border px-3" disabled><i class="bi bi-chevron-left me-1"></i>Prev</button>
                    <button id="${tbodyId}-next-btn" class="btn btn-sm btn-white border px-3" disabled>Next<i class="bi bi-chevron-right ms-1"></i></button>
                </div>
            </div>` : ''}
        </div>
    `;
}
