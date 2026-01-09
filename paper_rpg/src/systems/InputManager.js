export class InputManager {
    constructor() {
        this.liveKeys = {}; // Updates immediately via events

        this.keys = {}; // Snapshot for current frame
        this.prevKeys = {}; // Snapshot from previous frame

        this.mapping = {
            'ArrowUp': 'Up', 'KeyW': 'Up',
            'ArrowDown': 'Down', 'KeyS': 'Down',
            'ArrowLeft': 'Left', 'KeyA': 'Left',
            'ArrowRight': 'Right', 'KeyD': 'Right',
            'Enter': 'A', // Space key disabled
            'ShiftLeft': 'B', 'ShiftRight': 'B', 'Shift': 'B', // Support Right Shift via code and key
            'Escape': 'Select',
            'Backspace': 'Start',
            'KeyE': 'Switch' // "R button" (E key) switches character
            // 'KeyR': 'Switch', // Removed per user request to use E
        };

        window.addEventListener('keydown', (e) => {
            this.liveKeys[e.code] = true;
            this.liveKeys[e.key] = true; // Also track logical key
        });
        window.addEventListener('keyup', (e) => {
            this.liveKeys[e.code] = false;
            this.liveKeys[e.key] = false;
        });
    }

    update() {
        this.prevKeys = { ...this.keys };
        this.keys = { ...this.liveKeys };
    }

    isDown(action) {
        // check all keys mapped to this action
        for (const [code, mappedAction] of Object.entries(this.mapping)) {
            if (mappedAction === action && this.keys[code]) return true;
        }
        return false;
    }

    isJustPressed(action) {
        for (const [code, mappedAction] of Object.entries(this.mapping)) {
            if (mappedAction === action) {
                if (this.keys[code] && !this.prevKeys[code]) return true;
            }
        }
        return false;
    }

    consumeAction(action) {
        for (const [code, mappedAction] of Object.entries(this.mapping)) {
            if (mappedAction === action) {
                this.keys[code] = false;
            }
        }
    }
}
