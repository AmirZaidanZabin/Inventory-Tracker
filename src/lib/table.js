/**
 * Reusable Table Template
 * Ensures consistent styling and empty-state loading across all views.
 */
export function renderTable({ headers, tbodyId, emptyMessage = 'Loading data...' }) {
    return `
        <div class="table-responsive">
            <table class="modern-table">
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
        </div>
    `;
}
