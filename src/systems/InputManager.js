export class InputManager {
    constructor() {
        this.liveKeys = {}; // Updates immediately via events
        this.pressTimes = {}; // Track when keys were pressed

        this.keys = {}; // Snapshot for current frame
        this.prevKeys = {}; // Snapshot from previous frame

        // Default mapping
        this.defaultMapping = {
            'ArrowUp': 'Up', 'KeyW': 'Up',
            'ArrowDown': 'Down', 'KeyS': 'Down',
            'ArrowLeft': 'Left', 'KeyA': 'Left',
            'ArrowRight': 'Right', 'KeyD': 'Right',
            'KeyQ': 'L',
            'Enter': 'A',
            'ShiftLeft': 'B', 'ShiftRight': 'B', 'Shift': 'B',
            'Backspace': 'Start',
            'KeyE': 'Switch',
            'Escape': 'Select'
        };

        this.mapping = { ...this.defaultMapping };
        this.loadConfig(); // Load saved config if exists

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
        this.pollGamepads();
        this.updatePressState();
    }

    updatePressState() {
        const now = performance.now();
        // Check all mapped keys to update pressTimes
        // We iterate mapping so we cover all actions we care about
        const checkedCodes = new Set();

        for (const code of Object.keys(this.mapping)) {
            if (checkedCodes.has(code)) continue;
            checkedCodes.add(code);

            const pressed = this.keys[code];
            const prevPressed = this.prevKeys[code];

            if (pressed && !prevPressed) {
                this.pressTimes[code] = now;
            } else if (!pressed && prevPressed) {
                delete this.pressTimes[code];
            }
        }
    }

    isDown(action) {
        // check all keys mapped to this action
        for (const [code, mappedAction] of Object.entries(this.mapping)) {
            if (mappedAction === action && (this.keys[code] || this.keys[this.getCodeFromKey(code)])) return true;
        }
        return false;
    }

    isJustPressed(action) {
        for (const [code, mappedAction] of Object.entries(this.mapping)) {
            if (mappedAction === action) {
                // Check both raw code and processed key if needed, mostly code is enough
                if (this.keys[code] && !this.prevKeys[code]) {
                    return true;
                }
            }
        }
        return false;
    }

    isJustReleased(action) {
        for (const [code, mappedAction] of Object.entries(this.mapping)) {
            if (mappedAction === action) {
                if (!this.keys[code] && this.prevKeys[code]) return true;
            }
        }
        return false;
    }

    getHoldDuration(action) {
        const now = performance.now();
        for (const [code, mappedAction] of Object.entries(this.mapping)) {
            if (mappedAction === action && (this.keys[code] || this.keys[this.getCodeFromKey(code)])) {
                if (this.pressTimes[code]) {
                    return now - this.pressTimes[code];
                }
            }
        }
        return 0;
    }

    consumeAction(action) {
        for (const [code, mappedAction] of Object.entries(this.mapping)) {
            if (mappedAction === action) {
                this.keys[code] = false;
            }
        }
    }

    // --- Key Config Methods ---

    rebind(action, code) {
        // Remove existing bindings for this action (optional: allows multiple keys per action if we don't clear)
        // For simple config, let's clear old bindings for this action to avoid clutter?
        // Or maybe just add/overwrite specific key?
        // Let's go with: "One primary key per action" approach is hard with defaults like Arrows + WASD.
        // So we will just add/overwrite the mapping for the *specific code*.

        // Strategy: We want to allow binding a KEY to an ACTION.
        // If that key was bound to something else, overwrite it.
        this.mapping[code] = action;
        this.saveConfig();
        console.log(`[Input] Rebound ${code} to ${action}`);
    }

    resetToDefault() {
        this.mapping = { ...this.defaultMapping };
        this.saveConfig();
    }

    saveConfig() {
        localStorage.setItem('paperrpg_key_config', JSON.stringify(this.mapping));
    }

    loadConfig() {
        const saved = localStorage.getItem('paperrpg_key_config');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Merge with defaults or replace?
                // Replacing allows user to unbind defaults if they want (by not having them in saved)
                // But for safety, maybe we should ensure defaults exist?
                // For now, let's trust the saved object.
                this.mapping = parsed;
            } catch (e) {
                console.error("Failed to load key config", e);
            }
        }
    }

    /**
     * Helper to get action name for a given code (reverse lookup)
     * Note: Multiple keys might map to same action.
     */
    getActionForKey(code) {
        return this.mapping[code];
    }

    /**
     * Helper to get primary key name for an action (for display UI)
     * Returns the first found key code mapped to this action.
     */
    getKeyForAction(action) {
        // Prioritize common keys for display (e.g. KeyZ over generic)
        const priorities = ['Key', 'Arrow', 'Enter', 'Shift'];
        const codes = Object.entries(this.mapping)
            .filter(([_, act]) => act === action)
            .map(([code, _]) => code);

        if (codes.length === 0) return '---';

        // Sort by priority if needed, or just return first
        return codes[0].replace('Key', '');
    }

    // Helper for legacy support if needed
    getCodeFromKey(key) {
        return key;
    }

    /**
     * Poll Gamepad API and merge inputs into this.keys
     */
    pollGamepads() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const gp of gamepads) {
            if (!gp) continue;

            // Standard Gamepad Mapping (XInput Style)
            // 0: A (Bottom) -> Enter (Action A)
            // 1: B (Right) -> Shift (Action B / Attack)
            // 2: X (Left) -> Q (Action L / Attack Mode)
            // 3: Y (Top) -> E (Action Switch)
            // 4: LB -> Q
            // 5: RB -> E
            // 8: Back -> Escape (Menu)
            // 9: Start -> Backspace (Pause)
            // 12: D-Pad Up -> ArrowUp
            // 13: D-Pad Down -> ArrowDown
            // 14: D-Pad Left -> ArrowLeft
            // 15: D-Pad Right -> ArrowRight

            const buttonMap = {
                0: 'ShiftLeft', // A Button (Bottom) -> Action B (Attack)
                1: 'Enter',     // B Button (Right)  -> Action A (Decide/Interact)
                2: 'KeyQ',
                3: 'KeyE',
                4: 'KeyQ',
                5: 'KeyE',
                8: 'Escape',
                9: 'Backspace',
                12: 'ArrowUp',
                13: 'ArrowDown',
                14: 'ArrowLeft',
                15: 'ArrowRight'
            };

            // Buttons
            for (const [btnIndex, keyName] of Object.entries(buttonMap)) {
                if (gp.buttons[btnIndex] && gp.buttons[btnIndex].pressed) {
                    this.keys[keyName] = true;
                }
            }

            // Axes (Left Stick)
            // Axis 0: Horizontal (-1 Left, 1 Right)
            // Axis 1: Vertical (-1 Up, 1 Down)
            const deadzone = 0.5;
            if (gp.axes[0] < -deadzone) this.keys['ArrowLeft'] = true;
            if (gp.axes[0] > deadzone) this.keys['ArrowRight'] = true;
            if (gp.axes[1] < -deadzone) this.keys['ArrowUp'] = true;
            if (gp.axes[1] > deadzone) this.keys['ArrowDown'] = true;
        }
    }
}
