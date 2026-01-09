export class MessageSystem {
    constructor() {
        this.isVisible = false;
        this.container = null;
        this.textElement = null;

        this.initUI();
    }

    initUI() {
        // Create container for the message window
        this.container = document.createElement('div');
        this.container.id = 'message-window';

        // CSS specific to message window
        // Retro RPG style: dark blue/black background, white border, monospaced font
        this.container.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            width: 80%;
            height: 120px;
            background-color: rgba(0, 0, 0, 0.85);
            border: 4px solid #fff;
            border-radius: 8px;
            color: #fff;
            font-family: 'Courier New', monospace;
            font-size: 24px;
            padding: 20px;
            box-sizing: border-box;
            display: none; /* Hidden by default */
            z-index: 1000; /* On top of everything */
            box-shadow: 0 0 10px rgba(0,0,0,0.5);
            line-height: 1.5;
        `;

        this.textElement = document.createElement('div');
        this.container.appendChild(this.textElement);

        document.body.appendChild(this.container);
    }

    show(text) {
        this.textElement.innerText = text;
        this.container.style.display = 'block';
        this.isVisible = true;
        this.timer = 0; // 表示経過時間をリセット
    }

    update(deltaTime) {
        if (this.isVisible) {
            this.timer += deltaTime;
        }
    }

    canClose() {
        return this.isVisible && this.timer > 0.2; // 0.2秒経過しないと閉じられない
    }

    hide() {
        this.container.style.display = 'none';
        this.isVisible = false;
    }
}
