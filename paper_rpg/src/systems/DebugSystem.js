export class DebugSystem {
    constructor() {
        this.container = document.createElement('div');
        this.container.style.position = 'absolute';
        this.container.style.bottom = '0px';
        this.container.style.left = '0px';
        this.container.style.transform = 'scale(0.25)';
        this.container.style.transformOrigin = 'bottom left';
        this.container.style.color = 'white';
        this.container.style.fontFamily = 'monospace';
        this.container.style.fontSize = '12px';
        this.container.style.pointerEvents = 'none';
        this.container.style.userSelect = 'none';
        this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.container.style.padding = '5px';
        this.container.style.borderRadius = '4px';

        document.body.appendChild(this.container);

        // Coordinate Display
        this.coordDisplay = document.createElement('div');
        this.coordDisplay.style.marginBottom = '5px';
        this.container.appendChild(this.coordDisplay);

        // Input Visualizer Container
        this.inputContainer = document.createElement('div');
        this.inputContainer.style.display = 'grid';
        this.inputContainer.style.gridTemplateColumns = 'repeat(6, 20px)'; // 6 cols (with spacer)
        this.inputContainer.style.gap = '2px';
        this.container.appendChild(this.inputContainer);

        // Key Map Definition (Label, mappedAction)
        // Row 1: Q(L), W(Up), E(R), [Spacer], Esc(Select), BS(Start)
        // Row 2: A(Left), S(Down), D(Right), [Spacer], Sft(B), Ent(A)
        this.keys = [
            { label: 'L', action: 'L' }, // Q -> L
            { label: '▲', action: 'Up' }, // W -> Up Arrow
            { label: 'R', action: 'R' }, // E -> R
            null, // Spacer
            { label: 'Sl', action: 'Select' },
            { label: 'St', action: 'Start' },

            { label: '◀', action: 'Left' }, // A -> Left Arrow
            { label: '▼', action: 'Down' }, // S -> Down Arrow
            { label: '▶', action: 'Right' }, // D -> Right Arrow
            null, // Spacer
            { label: 'B', action: 'B' }, // Shift
            { label: 'A', action: 'A' }, // Enter/Space
        ];

        this.keyElements = [];

        this.keys.forEach(k => {
            const el = document.createElement('div');

            if (k === null) {
                // Spacer
                this.inputContainer.appendChild(el); // Empty div
                return;
            }

            el.textContent = k.label;
            el.style.width = '20px';
            el.style.height = '20px';
            el.style.border = '1px solid #fff';
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.style.fontSize = '10px';
            el.style.backgroundColor = '#222';

            this.inputContainer.appendChild(el);
            this.keyElements.push({ element: el, action: k.action });
        });
    }

    update(player, inputManager) {
        // Update Coordinates
        const p = player.position;
        this.coordDisplay.textContent = `X:${p.x.toFixed(2)} Y:${p.y.toFixed(2)} Z:${p.z.toFixed(2)}`;

        // Update Keys
        this.keyElements.forEach(item => {
            if (inputManager.isDown(item.action)) {
                item.element.style.backgroundColor = 'yellow';
                item.element.style.color = 'black';
            } else {
                item.element.style.backgroundColor = '#222';
                item.element.style.color = 'white';
            }
        });
    }
}
