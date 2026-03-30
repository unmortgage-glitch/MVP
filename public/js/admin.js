document.addEventListener('DOMContentLoaded', function() {
    const container = document.getElementById('content-blocks-container');
    
    // Initialize Materialize
    M.FormSelect.init(document.querySelectorAll('select'));
    M.updateTextFields();

    // 1. Add Block Logic
    document.querySelectorAll('.add-block-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.target.dataset.type;
            const template = document.getElementById(`template-block-${type}`);
            const clone = template.content.cloneNode(true);
            
            container.appendChild(clone);
            
            const newBlock = container.lastElementChild;
            M.FormSelect.init(newBlock.querySelectorAll('select'));
            M.updateTextFields();
            newBlock.scrollIntoView({ behavior: 'smooth' });
            updateBlockIndices();
        });
    });

    // 2. Event Delegation (Delete & Collapse)
    container.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-block')) {
            if(confirm('Delete this content block?')) {
                e.target.closest('.block-item').remove();
                updateBlockIndices();
            }
        }
        if (e.target.classList.contains('collapse-btn')) {
            const card = e.target.closest('.card-content');
            const fields = card.querySelector('.block-fields');
            if (fields.style.display === 'none') {
                fields.style.display = 'block';
                e.target.innerText = 'expand_less';
            } else {
                fields.style.display = 'none';
                e.target.innerText = 'expand_more';
            }
        }
    });

    // 3. SMARTER Drag and Drop Logic
    // Only enable dragging when holding the handle
    container.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('drag-handle')) {
            const block = e.target.closest('.block-item');
            block.setAttribute('draggable', 'true');
        }
    });

    container.addEventListener('mouseup', (e) => {
        const block = e.target.closest('.block-item');
        if (block) block.setAttribute('draggable', 'false');
    });

    // Standard Drag Events
    let draggedItem = null;
    container.addEventListener('dragstart', (e) => {
        if (!e.target.closest('.block-item')) return;
        draggedItem = e.target.closest('.block-item');
        draggedItem.style.opacity = '0.5';
        e.dataTransfer.effectAllowed = 'move';
    });

    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        const target = e.target.closest('.block-item');
        if (target && target !== draggedItem) {
            const rect = target.getBoundingClientRect();
            const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
            container.insertBefore(draggedItem, next ? target.nextSibling : target);
        }
    });

    container.addEventListener('dragend', (e) => {
        if (draggedItem) {
            draggedItem.style.opacity = '1';
            draggedItem.setAttribute('draggable', 'false'); // Disable drag after drop
            draggedItem = null;
            updateBlockIndices();
        }
    });

    function updateBlockIndices() {
        const blocks = container.querySelectorAll('.block-item');
        blocks.forEach((block, index) => {
            const typeInput = block.querySelector('.block-type-input');
            if(typeInput) typeInput.name = `blocks[${index}][type]`;

            block.querySelectorAll('input, select, textarea').forEach(input => {
                if (input.classList.contains('block-type-input')) return;
                const name = input.getAttribute('name');
                if (name) {
                    const newName = name.replace(/blocks\[\d+\]/, `blocks[${index}]`);
                    input.setAttribute('name', newName);
                }
            });
        });
    }
});
