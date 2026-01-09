export class InputManager {
    constructor() {
        this.liveKeys = {}; // Updates immediately via events

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
            'Escape': 'Select',
            'Backspace': 'Start',
            'KeyE': 'Switch'
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
        // Merge keyboard keys and gamepad input
        // First get latest keys
        const currentKeys = { ...this.liveKeys };

        // Then poll gamepad
        this.updateGamepad(currentKeys);

        this.keys = currentKeys;
    }

    updateGamepad(keysObj) {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let i = 0; i < gamepads.length; i++) {
            const gp = gamepads[i];
            if (!gp) continue;

            // Simple standard mapping (XInput style)
            // 0: A, 1: B, 2: X, 3: Y
            // 4: LB, 5: RB, 6: LT, 7: RT
            // 8: Back/Select, 9: Start
            // 10: LS Click, 11: RS Click
            // 12: Up, 13: Down, 14: Left, 15: Right (D-Pad)

            // Map to our action names (using code-like strings for keysObj)
            // We use a prefix 'GP_' to avoid collision if needed, but here we construct logical keys
            // or just set the action flag directly?
            // InputManager.isDown checks `this.mapping`. We need to register "virtual keys" for gamepad buttons 
            // OR we hack `keysObj` to inject mapped actions directly?
            // `isDown` iterates `this.mapping`. If we map 'GP_0' -> 'A', then setting keysObj['GP_0']=true works.

            // Let's add default mappings for gamepad buttons if they don't exist.
            // For now, let's inject "virtual" key codes that we will ensure are in standard mapping.

            const buttonMap = [
                { idx: 0, code: 'Gamepad_A', action: 'A' },
                { idx: 1, code: 'Gamepad_B', action: 'B' },
                { idx: 12, code: 'Gamepad_Up', action: 'Up' },
                { idx: 13, code: 'Gamepad_Down', action: 'Down' },
                { idx: 14, code: 'Gamepad_Left', action: 'Left' },
                { idx: 15, code: 'Gamepad_Right', action: 'Right' },
                { idx: 9, code: 'Gamepad_Start', action: 'Start' },
                { idx: 8, code: 'Gamepad_Select', action: 'Select' },
                { idx: 4, code: 'Gamepad_L', action: 'L' },
                { idx: 5, code: 'Gamepad_R', action: 'Switch' }, // R triggers Switch
                // Add analog stick support as D-pad?
            ];

            buttonMap.forEach(map => {
                if (gp.buttons[map.idx] && gp.buttons[map.idx].pressed) {
                    keysObj[map.code] = true;
                    // Ensure mapping exists dynamically if not present (hacky but works for zero-config)
                    if (!this.mapping[map.code]) {
                        this.mapping[map.code] = map.action;
                    }
                }
            });

            // Analog Stick Threshold
            const axisThreshold = 0.5;
            if (gp.axes[1] < -axisThreshold) { keysObj['Gamepad_Up'] = true; if (!this.mapping['Gamepad_Up']) this.mapping['Gamepad_Up'] = 'Up'; }
            if (gp.axes[1] > axisThreshold) { keysObj['Gamepad_Down'] = true; if (!this.mapping['Gamepad_Down']) this.mapping['Gamepad_Down'] = 'Down'; }
            if (gp.axes[0] < -axisThreshold) { keysObj['Gamepad_Left'] = true; if (!this.mapping['Gamepad_Left']) this.mapping['Gamepad_Left'] = 'Left'; }
            if (gp.axes[0] > axisThreshold) { keysObj['Gamepad_Right'] = true; if (!this.mapping['Gamepad_Right']) this.mapping['Gamepad_Right'] = 'Right'; }
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
}
