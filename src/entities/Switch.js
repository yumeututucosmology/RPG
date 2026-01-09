import * as THREE from 'three';

/**
 * Floor Switch Class
 * A 3D dome-shaped button that players can step on.
 */
export class Switch {
    constructor(scene, position, soundManager, color = 0xff0000) {
        this.scene = scene;
        this.soundManager = soundManager;
        this.position = position.clone();

        // Settings
        this.radius = 0.8;
        this.isPressed = false;

        // Group
        this.container = new THREE.Group();
        this.container.position.copy(this.position);
        this.scene.add(this.container);

        // Visuals
        // Visuals
        // Base (Box) - Minimal height (0.1)
        const baseHeight = 0.1;
        const baseGeo = new THREE.BoxGeometry(1.6, baseHeight, 1.6);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
        this.base = new THREE.Mesh(baseGeo, baseMat);
        this.base.position.y = baseHeight / 2; // Center at 0.05
        this.base.receiveShadow = true;
        this.container.add(this.base);

        // Button (Box) - Large (1.3)
        const buttonHeight = 1.3;
        const buttonGeo = new THREE.BoxGeometry(1.2, buttonHeight, 1.2);
        const buttonMat = new THREE.MeshStandardMaterial({ color: color });
        this.dome = new THREE.Mesh(buttonGeo, buttonMat); // Calling it 'dome' for code compatibility

        this.originalDomeY = baseHeight + (buttonHeight / 2); // 0.1 + 0.65 = 0.75
        // Fix for floating: When scaled to 0.3, height is 0.39. Half is 0.195.
        // Base top is 0.1. Center should be 0.1 + 0.195 = 0.295.
        this.pressedDomeY = baseHeight + (buttonHeight * 0.3 / 2);

        this.dome.position.y = this.originalDomeY;
        this.dome.castShadow = true;
        this.container.add(this.dome);
    }

    update(players, projectiles = []) {
        let steppedOn = false;

        // 1. Check Player Impact (Landing on switch)
        for (const player of players) {
            // Simple XZ distance check
            const dx = player.position.x - this.container.position.x;
            const dz = player.position.z - this.container.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            // Activation Condition:
            // 1. Player is within radius
            // 2. Player just landed (was NOT grounded, IS grounded now)
            // 3. Player is roughly at switch height
            const justLanded = !player.wasGrounded && player.isGrounded;

            // Relaxed radius to 1.5 to allow corner activation (Square switch 1.6x1.6, corner dist ~1.13)
            // Also keep Y check wide for 1.4m height
            if (dist < 1.5 && justLanded && Math.abs(player.position.y - this.position.y) < 2.0) {
                steppedOn = true;
                console.log("Switch activated by Player Impact!");
                break;
            }

            // Check for Melee Attack (Shinai)
            // Radius extended to 4.5 to cover visual discrepancies (Left/Right asymmetry)
            if (player.isAttacking && dist < 4.5 && Math.abs(player.position.y - this.position.y) < 2.0) {
                steppedOn = true;
                console.log("Switch activated by Shinai Attack!");
                break;
            }
        }

        // 2. Check Projectile Collision (Arrows)
        if (!steppedOn && projectiles.length > 0) {
            for (const proj of projectiles) {
                if (!proj.isActive) continue;

                const dx = proj.mesh.position.x - this.container.position.x;
                const dz = proj.mesh.position.z - this.container.position.z;
                const dy = proj.mesh.position.y - (this.container.position.y + 0.2); // Check against dome height
                const dist = Math.sqrt(dx * dx + dz * dz + dy * dy);

                // Hit radius - Increased to 2.0 to ensure reliable arrow hits on the box volume
                if (dist < 2.0) {
                    steppedOn = true;
                    console.log("Switch activated by Arrow!");
                    proj.velocity.set(0, 5, 0); // Bounce up slightly?
                    break;
                }
            }
        }

        // Return activation signal triggers
        if (steppedOn && !this.isPressed) {
            this.press();
            return true; // Signal change
        }

        return false;
    }

    press() {
        this.isPressed = true;
        this.dome.position.y = this.pressedDomeY;
        this.dome.scale.y = 0.3; // Flatten
        if (this.soundManager) this.soundManager.playSE('select');
        console.log("Switch Pressed!");
    }

    release() {
        this.isPressed = false;
        this.dome.position.y = this.originalDomeY;
        this.dome.scale.y = 1.0;
        console.log("Switch Released!");
    }

    setPressed(pressed) {
        this.isPressed = pressed;
        if (pressed) {
            this.dome.position.y = this.pressedDomeY;
            this.dome.scale.y = 0.3;
        } else {
            this.dome.position.y = this.originalDomeY;
            this.dome.scale.y = 1.0;
        }
    }
}
