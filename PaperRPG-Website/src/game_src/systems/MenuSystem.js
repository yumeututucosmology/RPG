export class MenuSystem {
    constructor(soundManager, renderSystem, inputManager, game) {
        this.soundManager = soundManager;
        this.renderSystem = renderSystem;
        this.inputManager = inputManager;
        this.game = game;
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
                    {
                        label: 'Title',
                        action: () => {
                            this.toggle();
                            if (this.game && this.game.returnToTitle) {
                                this.game.returnToTitle();
                            } else {
                                console.log('Title: Game instance not found');
                            }
                        }
                    },
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
            /* ... (existing styles) ... */
            #menu-system {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background-color: rgba(0, 0, 0, 0.5); /* Semi-transparent overlay */
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
                font-family: 'M PLUS Rounded 1c', sans-serif;
                color: #5d4037;
            }
            .menu-box {
                background-color: #fff9c4; /* Parchment color */
                border: 4px solid #8d6e63;
                border-radius: 15px;
                padding: 20px;
                min-width: 300px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                position: relative;
                transform-origin: center center; /* For safe scaling */
            }
            .menu-title {
                font-size: 24px;
                font-weight: bold;
                text-align: center;
                margin-bottom: 20px;
                border-bottom: 2px dashed #bcaaa4;
                padding-bottom: 10px;
                color: #3e2723;
            }
            .menu-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 15px;
                margin-bottom: 5px;
                border-radius: 8px;
                background-color: rgba(255,255,255,0.5);
                cursor: pointer;
                transition: all 0.2s;
            }
            .menu-item.selected {
                background-color: #ffeb3b;
                color: #e65100;
                transform: scale(1.02);
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            }
            .icon-marker {
                display: none;
                margin-right: 10px;
            }
            .menu-item.selected .icon-marker {
                display: inline-block;
            }
            .slider-value {
                font-weight: bold;
                color: #1a237e;
            }
            
            /* --- Game Controller CSS --- */
            .gba-container {
                position: relative;
                width: 600px;
                height: 350px;
                background-color: #e0e0e0; /* GBA White/Grey */
                border-radius: 40px 40px 60px 60px;
                border: 4px solid #bdc3c7;
                box-shadow: 0 10px 20px rgba(0,0,0,0.2), inset 0 -10px 20px rgba(0,0,0,0.1);
                margin: 0 auto;
            }
            .gba-screen-area {
                position: absolute;
                top: 40px;
                left: 50%;
                transform: translateX(-50%);
                width: 320px;
                height: 200px;
                background-color: #555;
                border-radius: 15px 15px 40px 40px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                color: #fff;
                box-shadow: inset 0 5px 10px rgba(0,0,0,0.5);
            }
            .gba-screen {
                width: 240px;
                height: 160px;
                background-color: #9ead86; /* Retro LCD green-ish */
                border: 2px solid #333;
                display: flex;
                justify-content: center;
                align-items: center;
                color: #000;
                font-family: monospace;
                font-weight: bold;
                text-align: center;
                padding: 10px;
            }
            
            /* Buttons */
            .btn {
                position: absolute;
                cursor: pointer;
                transition: transform 0.1s;
                display: flex;
                justify-content: center;
                align-items: center;
                font-weight: bold;
                color: #fff;
                text-shadow: 1px 1px 0 rgba(0,0,0,0.5);
                box-shadow: 0 4px 0 #bbb, 0 5px 5px rgba(0,0,0,0.3);
            }
            .btn:active {
                transform: translateY(4px);
                box-shadow: 0 0 0 #bbb, 0 1px 2px rgba(0,0,0,0.3);
            }
            .btn.selected {
                outline: 4px solid #ffcc00; /* Selection highlight */
                animation: pulse 1s infinite;
            }
            @keyframes pulse {
                0% { box-shadow: 0 0 0 0 rgba(255, 204, 0, 0.7); }
                70% { box-shadow: 0 0 0 10px rgba(255, 204, 0, 0); }
                100% { box-shadow: 0 0 0 0 rgba(255, 204, 0, 0); }
            }

            /* D-Pad */
            .dpad {
                position: absolute;
                top: 100px;
                left: 40px;
                width: 120px;
                height: 120px;
            }
            .dpad-btn {
                position: absolute;
                background-color: #555;
                border: 1px solid #444;
            }
            .dpad-up { top: 0; left: 40px; width: 40px; height: 40px; border-radius: 5px 5px 0 0; }
            .dpad-down { bottom: 0; left: 40px; width: 40px; height: 40px; border-radius: 0 0 5px 5px; }
            .dpad-left { top: 40px; left: 0; width: 40px; height: 40px; border-radius: 5px 0 0 5px; }
            .dpad-right { top: 40px; right: 0; width: 40px; height: 40px; border-radius: 0 5px 5px 0; }
            .dpad-center { top: 40px; left: 40px; width: 40px; height: 40px; background-color: #555; z-index: 1;}

            /* AB Buttons */
            .btn-round {
                width: 50px;
                height: 50px;
                border-radius: 50%;
                background-color: #a0a0a0; /* Default Grey */
            }
            .btn-a { top: 80px; right: 30px; background-color: #e74c3c; /* Redish A */ }
            .btn-b { top: 110px; right: 90px; background-color: #e74c3c; /* Redish B */ }

            /* Start/Select */
            .btn-pill {
                width: 60px;
                height: 20px;
                border-radius: 10px;
                background-color: #7f8c8d;
                transform: rotate(-20deg);
                font-size: 10px;
                color: #ccc;
            }
            .btn-select { bottom: 40px; left: 200px; }
            .btn-start { bottom: 40px; left: 280px; }

            /* Shoulder Buttons */
            .btn-shoulder {
                width: 120px;
                height: 30px;
                background-color: #bdc3c7;
                border-radius: 15px 15px 0 0;
                top: -15px;
                z-index: -1;
            }
            .btn-l { left: 40px; }
            .btn-r { right: 40px; }

            .key-label {
                font-size: 14px;
                color: #fff;
                background: rgba(0,0,0,0.7);
                padding: 2px 5px;
                border-radius: 4px;
                position: absolute;
                white-space: nowrap;
                pointer-events: none;
            }
        `;
        // ... (rest of style appending)

        document.head.appendChild(style);

        // 4. メニューボックス生成
        this.menuBox = document.createElement('div');
        this.menuBox.className = 'menu-box';
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
        // HACK: inputManager is needed for key labels. 
        // We will assume it's passed or available. 
        // Since render is called from handleInput where inputManager is present, we can pass it.
        // Or we can attach it to this instance if needed.
        // For now let's hope we can get it or just render generic if missing.

        const menuData = this.menus[this.currentState];
        if (!menuData) return;

        let html = '';

        if (this.currentState === 'key_config') {
            // Visual Controller Rendering
            html = `
                <div class="menu-title">${menuData.title}</div>
                <div class="gba-container">
                    <div class="btn btn-shoulder btn-l ${this.selectedIndex === 9 ? 'selected' : ''}">L: BACK</div>
                    <div class="btn btn-shoulder btn-r ${this.selectedIndex === 6 ? 'selected' : ''}">R</div>
                    
                    <div class="gba-screen-area">
                        <div class="gba-screen">
                            ${this.bindingAction ? 'PRESS KEY...' : (menuData ? (menuData.items[this.selectedIndex].label || 'CONFIG') : 'CONFIG')}
                        </div>
                        <div style="margin-top:5px;font-size:12px;color:#aaa;">Nintendo Game Boy Advance Style</div>
                    </div>

                    <div class="dpad">
                        <div class="dpad-center"></div>
                        <div class="dpad-btn dpad-up ${this.selectedIndex === 0 ? 'selected' : ''}"><span style="margin-top:-5px">▲</span></div>
                        <div class="dpad-btn dpad-down ${this.selectedIndex === 1 ? 'selected' : ''}"><span style="margin-bottom:-5px">▼</span></div>
                        <div class="dpad-btn dpad-left ${this.selectedIndex === 2 ? 'selected' : ''}"><span style="margin-left:-5px">◀</span></div>
                        <div class="dpad-btn dpad-right ${this.selectedIndex === 3 ? 'selected' : ''}"><span style="margin-right:-5px">▶</span></div>
                    </div>

                    <div class="btn btn-round btn-a ${this.selectedIndex === 4 ? 'selected' : ''}">A</div>
                    <div class="btn btn-round btn-b ${this.selectedIndex === 5 ? 'selected' : ''}">B</div>

                    <div class="btn btn-pill btn-select ${this.selectedIndex === 7 ? 'selected' : ''}">SELECT</div>
                    <div class="btn btn-pill btn-start ${this.selectedIndex === 8 ? 'selected' : ''}">START</div>
            `;

            // Overlay Key Labels and Hit targets
            // Loop through items to get key bindings
            menuData.items.forEach((item, index) => {
                if (item.actionName) {
                    let keyLabel = '???';
                    if (this.bindingAction === item.actionName) {
                        keyLabel = '...';
                    } else if (inputManager || this.inputManager) {
                        const manager = inputManager || this.inputManager;
                        keyLabel = manager.getKeyForAction(item.actionName);
                    }

                    // Position labels near buttons? 
                    // Simple hack: append label span to specific button div if I could target it.
                    // But here I'm generating HTML string.
                    // I'll add separate label elements absolutely positioned corresponding to buttons.

                    let posStyle = '';
                    switch (index) {
                        case 0: posStyle = 'top: 80px; left: 85px;'; break; // Up
                        case 1: posStyle = 'top: 230px; left: 85px;'; break; // Down
                        case 2: posStyle = 'top: 150px; left: 10px;'; break; // Left
                        case 3: posStyle = 'top: 150px; left: 170px;'; break; // Right
                        case 4: posStyle = 'top: 60px; right: 20px;'; break; // A
                        case 5: posStyle = 'top: 90px; right: 150px;'; break; // B
                        case 6: posStyle = 'top: -35px; right: 40px;'; break; // R (Switch)
                        case 7: posStyle = 'bottom: 20px; left: 200px;'; break; // Select
                        case 8: posStyle = 'bottom: 20px; left: 280px;'; break; // Start (Reset)
                        case 9: posStyle = 'top: -35px; left: 40px;'; break; // L (Back)
                    }

                    if (item.label === 'RESET') keyLabel = 'RESET'; // Special case

                    html += `<div class="key-label" style="${posStyle}">${keyLabel}</div>`;
                } else {
                    // Back / Reset labels
                    if (index === 8) html += `<div class="key-label" style="bottom: 20px; left: 280px;">RESET</div>`;
                }
            });

            html += `</div>`; // Close container
            this.menuBox.innerHTML = html;
            return;
        }

        // Standard List Rendering (for other menus)
        html = `<div class="menu-title">${menuData.title}</div>`;

        menuData.items.forEach((item, index) => {
            // ... (existing list rendering logic) ...
            const isSelected = index === this.selectedIndex;
            const selectedClass = isSelected ? 'selected' : '';

            let valueDisplay = '';
            let icon = '';

            let label = item.dynamicLabel ? item.dynamicLabel() : item.label;

            // スライダー表示
            if (item.type === 'slider' && this.soundManager) {
                const vol = Math.floor(this.soundManager.volume[item.param] * 100);
                valueDisplay = `<span class="slider-value">♪ ${vol}%</span>`;
                icon = this.soundManager.isMuted(item.param) ? ' 🔇' : '';
            }

            html += `
                <div class="menu-item ${selectedClass}">
                    <div style="display: flex; align-items: center;">
                        <span class="icon-marker">✨</span>
                        <span>${label}${icon}</span>
                    </div>
                    ${valueDisplay}
                </div>
            `;
        });

        this.menuBox.innerHTML = html;
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
