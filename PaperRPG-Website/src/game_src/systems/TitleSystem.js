export class TitleSystem {
    constructor(startCallback) {
        this.startCallback = startCallback;
        this.isVisible = false;
        this.initUI();
    }

    initUI() {
        this.container = document.createElement('div');
        this.container.id = 'title-screen';
        this.container.style.position = 'fixed';
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.width = '100vw';
        this.container.style.height = '100vh';
        this.container.style.backgroundImage = 'url("./assets/title_bg.png")';
        this.container.style.backgroundSize = 'cover';
        this.container.style.backgroundPosition = 'center';
        this.container.style.display = 'none';
        this.container.style.flexDirection = 'column';
        this.container.style.justifyContent = 'center';
        this.container.style.alignItems = 'center';
        this.container.style.zIndex = '2000'; // Higher than game UI
        this.container.style.transition = 'opacity 0.5s';

        // Title Text
        const title = document.createElement('h1');
        title.innerText = 'PaperRPG';
        title.style.fontSize = '8rem';
        title.style.color = '#fff';
        title.style.textShadow = '4px 4px 0 #3e2723, 0 0 20px rgba(0,0,0,0.5)';
        title.style.fontFamily = "'M PLUS Rounded 1c', sans-serif";
        title.style.marginBottom = '20px';
        title.style.animation = 'float 3s ease-in-out infinite';

        // Press Start Text
        const startText = document.createElement('div');
        startText.innerText = 'PRESS START';
        startText.className = 'blinking-text';
        startText.style.fontSize = '2rem';
        startText.style.color = '#fff';
        startText.style.textShadow = '2px 2px 0 #000';
        startText.style.fontFamily = "'M PLUS Rounded 1c', sans-serif";
        startText.style.marginTop = '200px';

        // Style for animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes float {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
            }
            .blinking-text {
                animation: blink 1s step-end infinite;
            }
            @keyframes blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0; }
            }
        `;
        document.head.appendChild(style);

        this.container.appendChild(title);
        this.container.appendChild(startText);
        document.body.appendChild(this.container);
    }

    show() {
        this.isVisible = true;
        this.container.style.display = 'flex';
        // Fade in effect could be added here
        setTimeout(() => this.container.style.opacity = '1', 10);
    }

    hide() {
        this.isVisible = false;
        this.container.style.opacity = '0';
        setTimeout(() => this.container.style.display = 'none', 500);
    }

    handleInput(inputManager) {
        if (!this.isVisible) return;

        // Start game on generic confirm or Start button
        // Assuming 'Start' or 'A' is mapped to primary actions
        // Use raw keys or input manager actions
        if (inputManager.isJustPressed('A') || inputManager.isJustPressed('Start') || inputManager.isJustPressed('B')) {
            // Also support Enter key directly just in case binding is missing
            this.startGame();
        }
    }

    startGame() {
        if (this.startCallback) {
            this.startCallback();
        }
    }
}
