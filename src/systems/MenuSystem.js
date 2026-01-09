export class MenuSystem {
    constructor(soundManager, renderSystem, inputManager) {
        this.soundManager = soundManager;
        this.renderSystem = renderSystem;
        this.inputManager = inputManager;
        this.isVisible = false;
        // 現在のメニュー状態 ('top', 'sound', 'graphics', etc.)
        this.currentState = 'top';
        this.selectedIndex = 0;
        this.sliderHoldTimer = 0;

        // リサイズハンドラをバインド
        this.updateLayout = this.updateLayout.bind(this);
        window.addEventListener('resize', this.updateLayout);

        // 解像度設定モード
        this.resModes = ['native', 'fhd', 'hd', 'sd'];
        this.resLabels = { 'native': 'Native', 'fhd': 'FHD (1080p)', 'hd': 'HD (720p)', 'sd': 'SD (480p)' };

        // ウィンドウモード（ローカルストレージ設定読み込み）
        this.windowMode = localStorage.getItem('paperrpg_window_mode') || 'windowed';

        // キーバインド待機状態
        this.bindingAction = null;

        // --- メニュー構成定義 ---
        this.menus = {
            'top': {
                title: 'MENU',
                items: [
                    { label: 'Sound', action: () => this.changeState('sound') },
                    { label: 'Graphics', action: () => this.changeState('graphics') },
                    { label: 'Key Config', action: () => this.changeState('key_config') },
                    { label: 'Title', action: () => console.log('Title: 未実装') },
                    { label: 'Close', action: () => this.toggle(), suppressSelectSound: true }
                ]
            },
            'key_config': {
                title: 'KEY CONFIG',
                items: [
                    // Actions to configure
                    { actionName: 'Up', label: 'Up', buttonClass: 'dpad-btn dpad-up' },
                    { actionName: 'Down', label: 'Down', buttonClass: 'dpad-btn dpad-down' },
                    { actionName: 'Left', label: 'Left', buttonClass: 'dpad-btn dpad-left' },
                    { actionName: 'Right', label: 'Right', buttonClass: 'dpad-btn dpad-right' },
                    { actionName: 'A', label: 'A (Jump)', buttonClass: 'btn btn-round btn-a' },
                    { actionName: 'B', label: 'B (Dash)', buttonClass: 'btn btn-round btn-b' },
                    // Switch to R button
                    { actionName: 'Switch', label: 'R (Switch)', buttonClass: 'btn btn-shoulder btn-r' },
                    // Select to Select button
                    { actionName: 'Select', label: 'Select (Menu)', buttonClass: 'btn btn-pill btn-select' },
                    // Reset and Back need special handling or distinct buttons
                    {
                        label: 'RESET',
                        action: (inputManager) => {
                            if (inputManager) {
                                inputManager.resetToDefault();
                                this.render();
                            }
                        },
                        buttonClass: 'btn btn-pill btn-start' // Map Reset to Start for now? Or render separately
                    },
                    {
                        label: 'BACK',
                        action: () => {
                            if (this.soundManager) this.soundManager.playSE('cancel');
                            this.changeState('top');
                        },
                        suppressSelectSound: true,
                        buttonClass: 'btn btn-shoulder btn-l' // Map Back to L button
                    }
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
            },
            'graphics': {
                title: 'GRAPHICS',
                items: [
                    {
                        label: 'Resolution',
                        action: () => {
                            if (!this.renderSystem) return;
                            const currentMode = this.renderSystem.resolutionMode;
                            const idx = this.resModes.indexOf(currentMode);
                            const nextIdx = (idx + 1) % this.resModes.length;
                            const nextMode = this.resModes[nextIdx];
                            this.renderSystem.setResolutionMode(nextMode);
                            this.render(); // ラベル更新のために再描画
                        },
                        dynamicLabel: () => {
                            if (!this.renderSystem) return 'Resolution: ???';
                            const mode = this.renderSystem.resolutionMode;
                            return `Resolution: ${this.resLabels[mode]}`;
                        }
                    },
                    {
                        label: 'Shadows',
                        action: () => {
                            if (!this.renderSystem) return;
                            const current = this.renderSystem.shadowsEnabled;
                            this.renderSystem.setShadowsEnabled(!current);
                            this.render();
                        },
                        dynamicLabel: () => {
                            if (!this.renderSystem) return 'Shadows: ???';
                            return `Shadows: ${this.renderSystem.shadowsEnabled ? 'ON' : 'OFF'}`;
                        }
                    },
                    {
                        label: 'Window Mode',
                        action: () => {
                            this.windowMode = this.windowMode === 'windowed' ? 'fullscreen' : 'windowed';
                            localStorage.setItem('paperrpg_window_mode', this.windowMode);
                            this.showRestartMessage();
                            this.render();
                        },
                        dynamicLabel: () => {
                            return `Window Mode: ${this.windowMode === 'fullscreen' ? 'Fullscreen' : 'Windowed'}`;
                        }
                    },
                    {
                        label: 'Back',
                        action: () => {
                            if (this.soundManager) this.soundManager.playSE('cancel');
                            this.changeState('top');
                            this.hideRestartMessage(); // グラフィックメニューを抜けるときに警告を消す（任意）
                        },
                        suppressSelectSound: true
                    }
                ]
            }
        };

        this.initUI();
    }

    /**
         * UI初期化（DOM要素の生成）
         */
    initUI() {
        // 1. Google Fonts読み込み
        const fontLink = document.createElement('link');
        fontLink.href = 'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;700&display=swap';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);

        // 2. コンテナ生成
        this.container = document.createElement('div');
        this.container.id = 'menu-system';
        this.container.style.display = 'none';

        // ... (previous code)

        // 3. スタイル定義（ファンタジー風テーマ + コントローラー）
        const style = document.createElement('style');
        style.textContent = `
            #menu-system {
                position: absolute;
                top: 0;
                left: 0;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 2000;
                font-family: 'M PLUS Rounded 1c', sans-serif;
                color: #5d4037;
                pointer-events: auto;
            }
            .menu-window {
                position: relative;
                background-color: #fdfbf7;
                border: 4px solid #5d4037;
                border-radius: 8px;
                padding: 20px;
                min-width: 320px;
                max-width: 90%;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                display: flex;
                flex-direction: column;
                gap: 5px;
            }
            .menu-title {
                font-size: 24px;
                font-weight: bold;
                border-bottom: 2px dashed #bdc3c7;
                margin-bottom: 10px;
                text-align: center;
                color: #d35400;
            }
            .menu-item {
                font-size: 18px;
                padding: 8px 12px;
                cursor: pointer;
                border-radius: 4px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background-color: rgba(255,255,255,0.5);
                transition: all 0.2s;
            }
            .menu-item.selected {
                background-color: #d35400;
                color: white;
                transform: translateX(10px);
                box-shadow: 2px 2px 5px rgba(0,0,0,0.2);
            }
            .menu-item .marker {
                display: none;
                margin-right: 5px;
            }
            .menu-item.selected .marker {
                display: inline;
            }
            .value {
                font-weight: bold;
                margin-left: 10px;
            }
            .restart-warning {
                color: red;
                font-size: 14px;
                margin-top: 10px;
                text-align: center;
                display: none;
            }
        `;

        document.head.appendChild(style);

        // 4. メニューウィンドウ生成
        this.menuBox = document.createElement('div');
        this.menuBox.className = 'menu-window';
        this.container.appendChild(this.menuBox);

        // 再起動警告メッセージ
        this.restartMessage = document.createElement('div');
        this.restartMessage.className = 'restart-warning';
        this.restartMessage.innerText = "⚠ Restart Required to Apply Changes ⚠";
        this.menuBox.appendChild(this.restartMessage);

        document.body.appendChild(this.container);
        this.updateLayout(); // 初期サイジング
        this.render();
    }

    /**
     * レイアウト更新（リサイズ時）
     * 画面解像度に合わせてメニューコンテナのサイズとスケールを調整
     */
    updateLayout() {
        if (this.renderSystem && this.container) {
            const width = this.renderSystem.width;
            const height = this.renderSystem.height;

            this.container.style.width = width + 'px';
            this.container.style.height = height + 'px';

            // Center menu container to match canvas
            this.container.style.left = `${(window.innerWidth - width) / 2} px`;
            this.container.style.top = `${(window.innerHeight - height) / 2} px`;

            // 高さ基準のスケーリング (基準: 1080p)
            if (this.menuBox) {
                const baseHeight = 1080;
                let scale = height / baseHeight;
                // 必要ならスケールの最小/最大制限をここで入れる
                this.menuBox.style.transform = `scale(${scale})`;
            }
        }
    }

    showRestartMessage() {
        if (this.restartMessage) {
            this.restartMessage.style.display = 'block';
        }
    }

    hideRestartMessage() {
        if (this.restartMessage) {
            this.restartMessage.style.display = 'none';
        }
    }

    /**
     * メニューの表示切替
     */
    toggle() {
        this.isVisible = !this.isVisible;
        this.container.style.display = this.isVisible ? 'flex' : 'none';

        if (this.isVisible) {
            this.changeState('top'); // 開くときは常にトップから
            this.hideRestartMessage();
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

    /**
     * 描画処理（DOM更新）
     */
    render(inputManager) {
        const menuData = this.menus[this.currentState];
        if (!menuData) return;

        // Use supplied inputManager or fallback to instance property
        const mgr = inputManager || this.inputManager;

        let html = `<div class="menu-title">${menuData.title}</div>`;

        menuData.items.forEach((item, index) => {
            const isSelected = index === this.selectedIndex;
            const selectedClass = isSelected ? 'selected' : '';

            let valueDisplay = '';

            // Slider display
            if (item.type === 'slider' && this.soundManager) {
                const vol = Math.floor(this.soundManager.volume[item.param] * 100);
                const icon = this.soundManager.isMuted(item.param) ? ' 🔇' : '';
                valueDisplay = `<span class="value">♪ ${vol}%${icon}</span>`;
            }
            // Key config display
            else if (item.actionName && mgr && mgr.mapping) {
                // Find key code for action
                let keyCode = '---';
                if (this.bindingAction === item.actionName) {
                    keyCode = 'PRESS KEY...';
                } else {
                    const foundEntry = Object.entries(mgr.mapping).find(([k, v]) => v === item.actionName);
                    if (foundEntry) keyCode = foundEntry[0];
                }
                valueDisplay = `<span class="value">[${keyCode}]</span>`;
            }
            // Dynamic Label (e.g. Resolution)
            else if (item.dynamicLabel) {
                // Dynamic label replaces the main label usually, or appended?
                // Current logic supports item.dynamicLabel() returning full string
                // But in the loop below we use item.label.
                // Let's use dynamic label if available as the Label
            }

            let label = item.dynamicLabel ? item.dynamicLabel() : item.label;

            html += `
                <div class="menu-item ${selectedClass}">
                    <div style="display: flex; align-items: center;">
                        <span class="marker">▶</span>
                        <span>${label}</span>
                    </div>
                    ${valueDisplay}
                </div>
            `;
        });

        this.menuBox.innerHTML = html;

        // Re-append restart message if needed logic (it was child of menuBox previously)
        // Actually initUI appended restartMessage to menuBox.
        // overwrite innerHTML kills it.
        // We should append it again or keep it outside.
        // Simplified: just append it to menuBox after html
        if (this.restartMessage) {
            this.menuBox.appendChild(this.restartMessage);
        }
    }

    /**
     * 入力ハンドリング
     */
    handleInput(inputManager, deltaTime) {
        if (!this.isVisible) {
            // メニューを開く
            if (inputManager.isJustPressed('Select')) {
                this.toggle();
            }
            return;
        }

        // --- キーリバインド待ち状態 ---
        if (this.bindingAction) {
            // どのキーが押されたかチェック
            // inputManager.liveKeys has all keys currently down.
            // We need a "just pressed" generic check or just iterate all keys.
            // Since inputManager doesn't expose "getLastPressedKey", we might need to check standard window events 
            // OR iterate inputManager.keys if we want to respect its lifecycle.
            // For simplicity/robustness, let's use a one-off event listener approach or scan inputManager.

            // Let's scan inputManager.keys for any pressed key that wasn't pressed before?
            // Actually InputManager abstraction hides raw codes a bit. 
            // Let's use the raw keys from InputManager if we exposed them, specifically 'liveKeys' or 'keys'.

            for (const code in inputManager.keys) {
                if (inputManager.keys[code]) {
                    // Check if it's a valid key to bind (ignore 'Select' if that's the only way to close?)
                    // Prevent binding 'Escape' if it's hardcoded to Menu?

                    // Actually, let's allow binding anything.
                    // But wait, we need to ensure we don't catch the 'A' press that started this mode.
                    // Simple debounce: ensure key was NOT down last frame? 
                    // InputManager.isJustPressed is for Actions. We need raw keys.

                    // Let's assume inputManager has liveKeys.
                    if (!inputManager.prevKeys[code]) {
                        // Found a new key press!
                        inputManager.rebind(this.bindingAction, code);
                        if (this.soundManager) this.soundManager.playSE('select');
                        this.bindingAction = null;
                        this.render(inputManager);
                        return;
                    }
                }
            }
            return; // Waiting for input
        }

        // --- メニュー操作 ---

        // 閉じる（Selectボタン）または トップでのBボタン（閉じる）
        if (inputManager.isJustPressed('Select') || (inputManager.isJustPressed('B') && this.currentState === 'top')) {
            this.toggle();
            return;
        }

        // 戻る（サブメニューでのBボタン）
        if (inputManager.isJustPressed('B') && this.currentState !== 'top') {
            if (this.soundManager) this.soundManager.playSE('cancel');
            this.changeState('top');
            return;
        }

        const menuData = this.menus[this.currentState];
        if (!menuData) return;

        // カーソル移動
        if (inputManager.isJustPressed('Up')) {
            if (this.soundManager) this.soundManager.playSE('cursor');
            this.selectedIndex = (this.selectedIndex - 1 + menuData.items.length) % menuData.items.length;
            this.render(inputManager);
        }
        if (inputManager.isJustPressed('Down')) {
            if (this.soundManager) this.soundManager.playSE('cursor');
            this.selectedIndex = (this.selectedIndex + 1) % menuData.items.length;
            this.render(inputManager);
        }

        const currentItem = menuData.items[this.selectedIndex];

        // スライダー操作 / 決定
        if (currentItem.type === 'slider') {
            const isLeft = inputManager.isDown('Left');
            const isRight = inputManager.isDown('Right');

            // ミュート切替
            if (inputManager.isJustPressed('A')) {
                if (this.soundManager) {
                    this.soundManager.toggleMute(currentItem.param);
                    this.soundManager.playSE('select');
                    this.render(inputManager);
                }
            }

            // 音量調整
            if (isLeft || isRight) {
                if (inputManager.isJustPressed('Left') || inputManager.isJustPressed('Right')) {
                    this.sliderHoldTimer = 0;
                }

                const dt = deltaTime || 0.016;
                this.sliderHoldTimer += dt;
                let changeAmount = 0;

                // 単発押し
                if (inputManager.isJustPressed('Left') || inputManager.isJustPressed('Right')) {
                    changeAmount = 0.01;
                }
                // 長押し
                else if (this.sliderHoldTimer > 0.5) {
                    changeAmount = 0.005;
                }

                if (changeAmount > 0) {
                    const param = currentItem.param;
                    let currentVol = this.soundManager.volume[param];

                    if (isLeft) currentVol -= changeAmount;
                    if (isRight) currentVol += changeAmount;

                    this.soundManager.setVolume(param, currentVol);
                    this.render(inputManager);
                }
            } else {
                this.sliderHoldTimer = 0;
            }
        } else {
            // 通常アイテム選択
            if (inputManager.isJustPressed('A')) {
                if (this.soundManager && !currentItem.suppressSelectSound) {
                    this.soundManager.playSE('select');
                }

                if (this.currentState === 'key_config' && currentItem.actionName) {
                    // Enter binding mode
                    this.bindingAction = currentItem.actionName;
                    this.render(inputManager);
                } else if (currentItem.action) {
                    currentItem.action(inputManager); // Pass inputManager for reset action
                }
            }
        }
    }
}
