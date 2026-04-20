/**
 * CustomSelect Component
 * A modern, accessible dropdown replacement.
 */
export function CustomSelect({ options = [], placeholder, onChange, id }) {
    const container = document.createElement('div');
    container.className = 'custom-select-container';
    container.id = id || `select-${Math.random().toString(36).substr(2, 9)}`;

    let isOpen = false;
    let selectedValue = null;

    const render = () => {
        const safeOptions = Array.isArray(options) ? options : [];
        const selectedOption = safeOptions.find(o => o.value === selectedValue);
        container.innerHTML = `
            <div class="select-trigger">
                <span>${selectedOption ? selectedOption.label : placeholder || 'Select...'}</span>
                <i class="bi bi-chevron-down"></i>
            </div>
            <div class="select-options ${isOpen ? 'show' : ''}">
                ${safeOptions.map(opt => `
                    <div class="select-option ${selectedValue === opt.value ? 'selected' : ''}" data-value="${opt.value}">
                        ${opt.label}
                    </div>
                `).join('')}
            </div>
        `;

        container.querySelector('.select-trigger').onclick = (e) => {
            e.stopPropagation();
            isOpen = !isOpen;
            render();
        };

        container.querySelectorAll('.select-option').forEach(el => {
            el.onclick = () => {
                selectedValue = el.dataset.value;
                isOpen = false;
                render();
                if (onChange) onChange(selectedValue);
            };
        });
    };

    // Global click to close
    const handleGlobalClick = () => {
        if (isOpen) {
            isOpen = false;
            render();
        }
    };
    document.addEventListener('click', handleGlobalClick);

    render();

    return {
        element: container,
        getValue: () => selectedValue,
        setValue: (val) => {
            selectedValue = val;
            render();
        },
        destroy: () => {
            document.removeEventListener('click', handleGlobalClick);
        }
    };
}

// Add styles
const style = document.createElement('style');
style.textContent = `
    .custom-select-container {
        position: relative;
        width: 100%;
        user-select: none;
    }
    .select-trigger {
        background: #fff;
        border: 1px solid #e5e7eb;
        padding: 0.6rem 1rem;
        border-radius: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        font-size: 0.9rem;
    }
    .select-trigger:hover { border-color: #3b82f6; }
    .select-options {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        display: none;
        max-height: 200px;
        overflow-y: auto;
    }
    .select-options.show { display: block; }
    .select-option {
        padding: 0.6rem 1rem;
        cursor: pointer;
        font-size: 0.9rem;
        transition: background 0.2s;
    }
    .select-option:hover { background: #f3f4f6; }
    .select-option.selected {
        background: #eff6ff;
        color: #3b82f6;
        font-weight: 600;
    }
`;
document.head.appendChild(style);
