document.addEventListener('DOMContentLoaded', () => {
    const playBtn = document.getElementById('start-game-btn');
    const overlay = document.getElementById('game-overlay');
    const closeBtn = document.getElementById('close-game-btn');
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');

    let gameLoopId;
    let isPlaying = false;
    
    // Game State
    const player = {
        x: 100,
        y: 400,
        vy: 0,
        isJumping: false,
        speed: 5,
        type: 'akane' // 'akane' or 'reiko'
    };
    
    const keys = {
        ArrowLeft: false,
        ArrowRight: false,
        Space: false,
        KeyR: false
    };

    const gravity = 0.8;
    const jumpForce = -15;
    const groundY = 500;

    // Assets
    const imgAkane = new Image(); imgAkane.src = 'public/assets/player_stand.png';
    const imgReiko = new Image(); imgReiko.src = 'public/assets/player2_stand.png';
    const bgPattern = '#fdfbf7'; // Paper color

    // Event Listeners
    playBtn.addEventListener('click', (e) => {
        e.preventDefault();
        startGame();
    });

    closeBtn.addEventListener('click', stopGame);

    window.addEventListener('keydown', (e) => {
        if(e.code === 'Space') keys.Space = true;
        if(e.code === 'ArrowLeft') keys.ArrowLeft = true;
        if(e.code === 'ArrowRight') keys.ArrowRight = true;
        if(e.code === 'KeyR') toggleCharacter();
    });

    window.addEventListener('keyup', (e) => {
        if(e.code === 'Space') keys.Space = false;
        if(e.code === 'ArrowLeft') keys.ArrowLeft = false;
        if(e.code === 'ArrowRight') keys.ArrowRight = false;
    });

    window.addEventListener('resize', resizeCanvas);

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function toggleCharacter() {
        if (!isPlaying) return;
        player.type = player.type === 'akane' ? 'reiko' : 'akane';
    }

    function startGame() {
        overlay.classList.remove('hidden');
        isPlaying = true;
        resizeCanvas();
        gameLoop();
    }

    function stopGame() {
        overlay.classList.add('hidden');
        isPlaying = false;
        cancelAnimationFrame(gameLoopId);
    }

    function update() {
        // Movement
        if (keys.ArrowRight) player.x += player.speed;
        if (keys.ArrowLeft) player.x -= player.speed;

        // Jump
        if (keys.Space && !player.isJumping) {
            player.vy = jumpForce;
            player.isJumping = true;
        }

        // Physics
        player.y += player.vy;
        player.vy += gravity;

        // Ground Collision
        if (player.y > groundY) {
            player.y = groundY;
            player.vy = 0;
            player.isJumping = false;
        }

        // Boundaries
        if (player.x < 0) player.x = 0;
        if (player.x > canvas.width) player.x = canvas.width;
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Background (Paper style)
        ctx.fillStyle = bgPattern;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#bdc3c7';
        ctx.fillRect(0, groundY + 120, canvas.width, 10); // Floor line reference (offset)

        // Instructions
        ctx.fillStyle = '#2c3e50';
        ctx.font = '24px "Zen Kurenaido"';
        ctx.fillText("← → Move | Space: Jump | R: Swap Character", 50, 50);
        ctx.fillText("Current: " + (player.type === 'akane' ? "明音 (Akane)" : "麗湖 (Reiko)"), 50, 90);

        // Draw Player (Simple Sprite)
        const img = player.type === 'akane' ? imgAkane : imgReiko;
        const width = 150;
        const height = 200; // Approx aspect
        
        ctx.save();
        ctx.translate(player.x, player.y);
        // Bobbing animation if moving
        if (keys.ArrowLeft || keys.ArrowRight) {
            ctx.rotate(Math.sin(Date.now() / 100) * 0.1);
        }
        
        // Draw image
        // Check if loaded, otherwise draw placeholder
        if (img.complete) {
            ctx.drawImage(img, -width/2, -height, width, height);
        } else {
            ctx.fillStyle = player.type === 'akane' ? '#e74c3c' : '#3498db';
            ctx.fillRect(-25, -100, 50, 100);
        }
        ctx.restore();
    }

    function gameLoop() {
        if (!isPlaying) return;
        update();
        draw();
        gameLoopId = requestAnimationFrame(gameLoop);
    }
});
