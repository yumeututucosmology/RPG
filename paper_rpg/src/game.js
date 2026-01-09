import { RenderSystem } from './systems/RenderSystem.js';
import { InputManager } from './systems/InputManager.js';
import { SoundManager } from './systems/SoundManager.js';
import { AssetManager } from './systems/AssetManager.js';
import { DebugSystem } from './systems/DebugSystem.js';
import { MenuSystem } from './systems/MenuSystem.js'; // Import
import { World } from './world/World.js';
import { Player } from './entities/Player.js';
import { NPC } from './entities/NPC.js';
import * as THREE from 'three';

class Game {
    constructor() {
        this.renderSystem = new RenderSystem();
        this.inputManager = new InputManager();
        this.soundManager = new SoundManager();
        this.assetManager = new AssetManager();
        this.debugSystem = new DebugSystem();
        this.menuSystem = new MenuSystem(this.soundManager); // Init Menu

        // Pass anisotropy info to AssetManager
        this.assetManager.setMaxAnisotropy(this.renderSystem.getMaxAnisotropy());

        this.world = new World(this.renderSystem.scene);

        // Double Protagonist Setup
        const p1 = new Player(this.renderSystem.scene, this.inputManager, this.world, this.assetManager, this.soundManager, './src/assets/player_stand.png');
        const p2 = new Player(this.renderSystem.scene, this.inputManager, this.world, this.assetManager, this.soundManager, './src/assets/player2_stand.png');

        // Offset P2 slightly so they don't spawn inside each other
        p2.container.position.x = -2.0;

        this.players = [p1, p2];
        this.activePlayerIndex = 0;
        this.player = this.players[0]; // Current Leader (Alias)

        // Initial Camera Setup (Fixed rotation)
        const offset = new THREE.Vector3(0, 12, 30); // Zoomed in
        const targetPos = this.player.position.clone().add(offset);
        this.renderSystem.camera.position.copy(targetPos);

        // Look ahead to position player lower on screen (approx 80% from top)
        const lookOffset = new THREE.Vector3(0, 0, -25);
        const lookTarget = this.player.position.clone().add(lookOffset);
        this.renderSystem.camera.lookAt(lookTarget);

        // Sample NPC
        this.npc = new NPC(this.renderSystem.scene, new THREE.Vector3(15, 2.25, 15), 0x0000ff);

        this.clock = new THREE.Clock();
        this.cameraTransitionTimer = 0.0;

        this.animate = this.animate.bind(this);
    }

    start() {
        this.animate();
        console.log("Game Started");

        // Audio Resume Hack (Browser Auto-play Policy)
        const resumeAudio = () => {
            this.soundManager.resumeContext();
            window.removeEventListener('click', resumeAudio);
            window.removeEventListener('keydown', resumeAudio);
        };
        window.addEventListener('click', resumeAudio);
        window.addEventListener('keydown', resumeAudio);
    }

    animate() {
        requestAnimationFrame(this.animate);

        // Create a capped delta time to prevent physics tunneling (falling through floor)
        // when returning from a background tab (where delta can be huge).
        const rawDelta = this.clock.getDelta();
        const deltaTime = Math.min(rawDelta, 0.05); // Cap at 20 FPS equivalent steps

        // Frame Start Updates
        this.inputManager.update();

        // Menu Update
        const wasMenuVisible = this.menuSystem.isVisible;
        this.menuSystem.handleInput(this.inputManager, deltaTime);

        // Game Pause Logic
        // Skip update if menu is visible OR was visible at start of frame (just closed)
        if (this.menuSystem.isVisible || wasMenuVisible) {
            // Render only, no update
            this.renderSystem.render();
            return;
        }

        // Game Logic
        // Game Logic
        // Game Logic & Double Protagonist Switching
        if (this.inputManager.isJustPressed('Switch')) {
            this.activePlayerIndex = (this.activePlayerIndex + 1) % this.players.length;
            this.player = this.players[this.activePlayerIndex];
            this.soundManager.playSE('select'); // Feedback sound
            this.cameraTransitionTimer = 0.5;
            console.log("Switched to Player " + (this.activePlayerIndex + 1));
        }

        // Update all players
        this.players.forEach((p, index) => {
            if (index === this.activePlayerIndex) {
                // Leader: Updates with Input
                p.update(deltaTime, this.renderSystem.camera, true);
            } else {
                // Follower: Follows Leader, Updates without Input
                p.follow(this.player);
                p.update(deltaTime, this.renderSystem.camera, false);
            }
        });

        // Camera Follow (AFTER Player Move)
        this.updateCamera(deltaTime);

        // Billboard Update (AFTER Camera Move)
        // Ensure billboard faces the FINAL camera position to prevent rotation lag/jitter
        // Billboard Update (AFTER Camera Move)
        // Ensure billboard faces the FINAL camera position to prevent rotation lag/jitter
        this.players.forEach(p => p.updateBillboard(this.renderSystem.camera));

        this.npc.update(this.renderSystem.camera);

        // Debug Update
        this.debugSystem.update(this.player, this.inputManager);

        // Render
        this.renderSystem.render();
    }

    updateCamera(deltaTime) {
        // Update Transition Timer
        if (this.cameraTransitionTimer > 0) {
            this.cameraTransitionTimer -= deltaTime;
            if (this.cameraTransitionTimer < 0) this.cameraTransitionTimer = 0;
        }

        // Fixed offset camera follow
        const offset = new THREE.Vector3(0, 12, 30);

        // Calculate target X/Z based on player position (Follow horizontal movement)
        const targetX = this.player.position.x + offset.x;
        const targetZ = this.player.position.z + offset.z;

        // Calculate target Y based on PLAYER's detected ground height
        // Use explicit check because 0 is a valid height.
        let groundHeight = this.player.currentGroundHeight;
        if (groundHeight === undefined) {
            groundHeight = this.world.getGroundHeight(this.player.position.x, this.player.position.z);
        }

        // Handle void/pit cases safely if groundHeight is too low (optional, but good practice)
        // For now, assuming standard ground.
        const targetY = groundHeight + offset.y;

        // Smooth Y only to handle stairs without jitter
        const currentY = this.renderSystem.camera.position.y;
        // Exp decay lerp: lerp factor = 1 - exp(-speed * dt)
        // Speed 5.0 gives good smoothing for stairs
        const lerpFactorY = 1.0 - Math.exp(-5.0 * deltaTime);
        const smoothedY = THREE.MathUtils.lerp(currentY, targetY, lerpFactorY);

        // X/Z Logic: Hybrid
        if (this.cameraTransitionTimer > 0) {
            const currentX = this.renderSystem.camera.position.x;
            const currentZ = this.renderSystem.camera.position.z;
            // Use faster lerp for transition (Speed 15.0) to arrive quickly but smoothly
            const lerpFactorXZ = 1.0 - Math.exp(-15.0 * deltaTime);

            const smoothedX = THREE.MathUtils.lerp(currentX, targetX, lerpFactorXZ);
            const smoothedZ = THREE.MathUtils.lerp(currentZ, targetZ, lerpFactorXZ);

            this.renderSystem.camera.position.set(smoothedX, smoothedY, smoothedZ);
        } else {
            // Strict follow (Instant)
            this.renderSystem.camera.position.set(targetX, smoothedY, targetZ);
        }
    }
}

// Init
window.onload = () => {
    const game = new Game();
    game.start();
};
