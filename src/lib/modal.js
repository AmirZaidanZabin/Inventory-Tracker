/**
 * Modal Utility
 * Simple wrapper for Bootstrap modals with custom styling.
 */
export function createModal({ title, body, footer, id, width }) {
    const modalId = id || `modal-${Math.random().toString(36).substr(2, 9)}`;
    const html = `
        <div class="modal-overlay" id="${modalId}">
            <div class="modal-content-custom" style="max-height: 90vh; overflow-y: auto; ${width ? `max-width: ${width}; width: 95%;` : ''}">
                <div class="d-flex justify-content-between align-items-center mb-4 sticky-top bg-white pt-1 pb-2" style="z-index: 10;">
                    <h5 class="fw-bold mb-0">${title}</h5>
                    <button type="button" class="btn-close close-modal"></button>
                </div>
                <div class="modal-body-custom">
                    ${body}
                </div>
                ${footer ? `<div class="mt-4 pt-3 border-top d-flex justify-content-end">${footer}</div>` : ''}
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    const element = document.getElementById(modalId);
    
    const show = () => {
        element.classList.add('show');
    };

    const hide = (callback) => {
        element.classList.add('modal-fade-out');
        setTimeout(() => {
            element.classList.remove('show');
            element.remove();
            if (callback) callback();
        }, 300);
    };

    const closeBtns = element.querySelectorAll('.close-modal');
    closeBtns.forEach(btn => btn.addEventListener('click', () => hide()));

    element.addEventListener('click', (e) => {
        if (e.target === element) hide();
    });

    return {
        show,
        hide,
        element
    };
}
