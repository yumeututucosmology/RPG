export class MenuSystem {
    constructor(soundManager) {
        this.soundManager = soundManager;
        this.isVisible = false;
        this.currentState = 'top'; // 'top', 'sound', 'keyconfig', 'title'
        this.selectedIndex = 0;
        this.sliderHoldTimer = 0;

        // Menu Structure Definition
        this.menus = {
            'top': {
                title: 'MENU',
                items: [
                    { label: 'Sound', action: () => this.changeState('sound') },
                    { label: 'Key Config', action: () => console.log('Key Config Not Implemented') },
                    { label: 'Title', action: () => console.log('Title Not Implemented') },
                    { label: 'Close', action: () => this.toggle(), suppressSelectSound: true }
                ]
            },
            'sound': {
                title: 'SOUND CONFIG',
                items: [
                    { label: 'Master', type: 'slider', param: 'master' },
                    { label: 'SE', type: 'slider', param: 'se' },
                    { label: 'BGM', type: 'slider', param: 'bgm' },
                    {
                        label: 'Back',
                        action: () => {
                            if (this.soundManager) this.soundManager.playSE('cancel');
                            this.changeState('top');
                        },
                        suppressSelectSound: true
                    }
                ]
            }
        };

        this.initUI();
    }

    initUI() {
        // 1. Create Container
        this.container = document.createElement('div');
        this.container.id = 'menu-system';
        this.container.style.display = 'none';

        // 2. Add Styles
        const style = document.createElement('style');
        style.textContent = `
            #menu-system {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.7);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
                font-family: 'Courier New', Courier, monospace;
                color: white;
            }
            .menu-box {
                width: 400px;
                background-color: #00008b; /* Dark Blue */
                border: 4px solid white;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 0 20px rgba(0,0,0,0.5);
            }
            .menu-title {
                text-align: center;
                font-size: 32px;
                margin-bottom: 20px;
                border-bottom: 2px solid white;
                padding-bottom: 10px;
            }
            .menu-item {
                font-size: 24px;
                margin: 10px 0;
                padding: 5px 10px;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
            }
            .menu-item.selected {
                background-color: rgba(255, 255, 255, 0.2);
                color: #ffff00; /* Yellow */
            }
            .menu-item.selected::before {
                content: '▶';
                margin-right: 10px;
            }
            .slider-value {
                font-family: monospace;
            }
        `;
        document.head.appendChild(style);

        // 3. Create Content Structure
        this.menuBox = document.createElement('div');
        this.menuBox.className = 'menu-box';
        this.container.appendChild(this.menuBox);

        document.body.appendChild(this.container);
        this.render();
    }

    toggle() {
        this.isVisible = !this.isVisible;
        this.container.style.display = this.isVisible ? 'flex' : 'none';

        if (this.isVisible) {
            this.changeState('top'); // Reset to top when opening
            if (this.soundManager) this.soundManager.playSE('menu_open');
        } else {
            if (this.soundManager) this.soundManager.playSE('cancel');
        }
    }

    changeState(newState) {
        this.currentState = newState;
        this.selectedIndex = 0;
        this.render();
    }

    render() {
        if (!this.menus[this.currentState]) return;

        const menuData = this.menus[this.currentState];
        let html = `<div class="menu-title">${menuData.title}</div>`;

        menuData.items.forEach((item, index) => {
            const isSelected = index === this.selectedIndex;
            const selectedClass = isSelected ? 'selected' : '';

            let valueDisplay = '';
            let icon = '';

            if (item.type === 'slider' && this.soundManager) {
                const vol = Math.floor(this.soundManager.volume[item.param] * 100);
                const bar = '|'.repeat(Math.floor(vol / 10)).padEnd(10, '.');
                valueDisplay = `<span class="slider-value">< ${bar} > ${vol}%</span>`;

                icon = this.soundManager.isMuted(item.param) ? ' 🔇' : ' 🔊';
            }

            html += `
                <div class="menu-item ${selectedClass}">
                    <span>${item.label}${icon}</span>
                    ${valueDisplay}
                </div>
            `;
        });

        this.menuBox.innerHTML = html;
    }

    handleInput(inputManager, deltaTime) {
        if (!this.isVisible) {
            // Open Menu
            if (inputManager.isJustPressed('Select')) {
                this.toggle();
            }
            return; // Game continues
        }

        // --- Menu Navigation ---

        // Close Menu
        if (inputManager.isJustPressed('Select') || (inputManager.isJustPressed('B') && this.currentState === 'top')) {
            this.toggle();
            return;
        }

        // Back
        if (inputManager.isJustPressed('B') && this.currentState !== 'top') {
            if (this.soundManager) this.soundManager.playSE('cancel');
            this.changeState('top');
            return;
        }

        const menuData = this.menus[this.currentState];
        if (!menuData) return;

        // Cursor Move
        if (inputManager.isJustPressed('Up')) {
            if (this.soundManager) this.soundManager.playSE('cursor');
            this.selectedIndex = (this.selectedIndex - 1 + menuData.items.length) % menuData.items.length;
            this.render();
        }
        if (inputManager.isJustPressed('Down')) {
            if (this.soundManager) this.soundManager.playSE('cursor');
            this.selectedIndex = (this.selectedIndex + 1) % menuData.items.length;
            this.render();
        }

        const currentItem = menuData.items[this.selectedIndex];

        // Action / Slider Control
        if (currentItem.type === 'slider') {
            const isLeft = inputManager.isDown('Left');
            const isRight = inputManager.isDown('Right');

            // --- Mute Toggle ---
            if (inputManager.isJustPressed('A')) {
                if (this.soundManager) {
                    this.soundManager.toggleMute(currentItem.param);
                    this.soundManager.playSE('select'); // Feedback
                    this.render();
                }
            }

            if (isLeft || isRight) {
                // Initialize timer if just pressed or accumulate if holding
                if (inputManager.isJustPressed('Left') || inputManager.isJustPressed('Right')) {
                    this.sliderHoldTimer = 0;
                }

                // Add default deltaTime fallback if undefined (safety)
                const dt = deltaTime || 0.016;
                this.sliderHoldTimer += dt;

                let changeAmount = 0;

                // Initial Tap: Immediate small change
                if (inputManager.isJustPressed('Left') || inputManager.isJustPressed('Right')) {
                    changeAmount = 0.01;
                }
                // Hold > 0.5s: Fast continuous change
                else if (this.sliderHoldTimer > 0.5) {
                    changeAmount = 0.005; // User requested "0.5" (Likely 0.005 aka 0.5%)
                }

                if (changeAmount > 0) {
                    const param = currentItem.param;
                    let currentVol = this.soundManager.volume[param];

                    if (isLeft) currentVol -= changeAmount;
                    if (isRight) currentVol += changeAmount;

                    this.soundManager.setVolume(param, currentVol);
                    this.render();
                }
            } else {
                this.sliderHoldTimer = 0;
            }
        } else {
            // Normal Item
            if (inputManager.isJustPressed('A')) {
                if (this.soundManager && !currentItem.suppressSelectSound) {
                    this.soundManager.playSE('select');
                }
                if (currentItem.action) currentItem.action();
            }
        }
    }
}
