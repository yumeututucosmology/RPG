import * as THREE from 'three';

export class Player {
    constructor(scene, inputManager, world, assetManager, soundManager, texturePath = './src/assets/player_stand.png') {
        this.scene = scene;
        this.inputManager = inputManager;
        this.world = world;
        this.assetManager = assetManager;
        this.soundManager = soundManager;
        this.texturePath = texturePath; // Store path

        // Container (Represents logical position at feet)
        this.container = new THREE.Group();
        this.container.position.set(0, 0, 0); // Start at center
        this.scene.add(this.container);

        // Mesh Setup (Paper Mario style: 2D Plane)
        const geometry = new THREE.PlaneGeometry(1, 1.5);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff, // White to show texture
            side: THREE.DoubleSide,
            transparent: true
            // alphaTest removed for smooth blending
        });
        this.mesh = new THREE.Mesh(geometry, material);
        // Offset mesh so its bottom edge is at container's origin (0,0,0)
        // Height will be 4.5 (Scale 3). Half height 2.25.
        this.mesh.position.set(0, 2.25, 0);
        this.mesh.castShadow = true;
        this.container.add(this.mesh); // Add to container instead of scene

        // Load Texture
        this.loadTexture();

        // Movement Props
        this.position = this.container.position; // Use container as logical position
        this.velocity = new THREE.Vector3();

        // Jump Physics
        // Converted to Units/Second (Assuming target 60 FPS for previous values)
        this.gravity = 150.0;   // 50.0 * 3
        // Height = v^2 / 2g. Target 1.5 * 3 = 4.5 units.
        // 4.5 = v^2 / 300 -> v = sqrt(1350) = 36.74... -> 36.75
        this.jumpForce = 36.75;
        this.isGrounded = false;
        this.isGrounded = false;
        this.currentGroundHeight = 0.0; // Initialize for camera tracking

        // Speed units/sec
        this.speed = 18.0;      // 6.0 * 3
        this.dashSpeed = 54.0; // 18.0 * 3

        this.isDashing = false;
        // Dash Internal State
        this.lastTapTime = 0;
        this.lastTapKey = null;
        this.dashThreshold = 250; // ms

        // Footstep System
        this.stepTimer = 0;
        this.baseStepInterval = 0.45;
        // Sword Mesh (Simple White Stick for now)
        const swordGeo = new THREE.BoxGeometry(0.2, 2.0, 0.1); // Long stick
        const swordMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
        this.swordMesh = new THREE.Mesh(swordGeo, swordMat);
        // Position relative to player center: slightly forward and right
        this.swordMesh.position.set(0.8, 2.5, 0.5);
        this.swordMesh.visible = false;
        this.container.add(this.swordMesh);

        // Attack State
        this.isAttacking = false;
        this.attackTimer = 0;
        this.ATTACK_DURATION = 0.3; // Seconds
    }

    loadTexture() {
        if (!this.assetManager) return;
        this.assetManager.loadTexture(this.texturePath)
            .then(texture => {
                // 1. Adjust Aspect Ratio
                const aspect = texture.image.width / texture.image.height;

                // Target Height = 4.5
                this.mesh.scale.set(4.5 * aspect, 3, 1);

                // 2. High Quality Settings for 1024x1024
                texture.generateMipmaps = true;
                texture.minFilter = THREE.LinearMipmapLinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.anisotropy = this.assetManager.maxAnisotropy || 16;
                texture.colorSpace = THREE.SRGBColorSpace;

                this.mesh.material.map = texture;

                // PNG with alpha transparency settings
                this.mesh.material.transparent = true;
                this.mesh.material.alphaTest = 0.5; // Cutout for sharp edges
                this.mesh.material.needsUpdate = true;

                console.log(`Player texture loaded (New): ${texture.image.width}x${texture.image.height}, Aspect: ${aspect}`);
            })
            .catch(err => console.error("Could not load player texture:", err));
    }

    follow(target) {
        // Simple follow logic
        const dist = this.position.distanceTo(target.position);
        const stopDist = 2.0;

        if (dist > stopDist) {
            const dir = target.position.clone().sub(this.position);
            dir.y = 0; // Ignore vertical difference for horizontal move
            if (dir.lengthSq() > 0) dir.normalize();

            // Match speed or catch up
            const moveSpeed = (dist > 5.0) ? this.dashSpeed : this.speed;
            this.isDashing = (dist > 5.0);

            this.velocity.x = dir.x * moveSpeed;
            this.velocity.z = dir.z * moveSpeed;

            // Visual Flip
            if (dir.x < 0) this.mesh.scale.x = -Math.abs(this.mesh.scale.x);
            if (dir.x > 0) this.mesh.scale.x = Math.abs(this.mesh.scale.x);
        } else {
            this.velocity.x = 0;
            this.velocity.z = 0;
            this.isDashing = false;
        }
    }

    update(deltaTime, camera, processInput = true) {
        this.updateAttack(deltaTime);
        if (processInput) {
            this.handleInput(deltaTime);
        }
        this.updatePhysics(deltaTime);
        this.updateBillboard(camera);
        this.handleFootsteps(deltaTime);
    }

    handleFootsteps(deltaTime) {
        // Only play sound if grounded and moving
        if (this.isGrounded && (Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1)) {
            this.stepTimer += deltaTime;

            const currentInterval = this.isDashing ? 0.25 : this.baseStepInterval;

            if (this.stepTimer >= currentInterval) {
                this.stepTimer = 0;
                if (this.soundManager) {
                    this.soundManager.playSE('walk');
                }
            }
        }
    }

    startAttack() {
        if (this.isAttacking) return;
        this.isAttacking = true;
        this.attackTimer = 0;
        this.swordMesh.visible = true;

        if (this.soundManager) {
            this.soundManager.playSE('sword');
        }
    }

    updateAttack(deltaTime) {
        if (!this.isAttacking) return;

        this.attackTimer += deltaTime;

        // Simple Swing Animation
        const progress = Math.min(this.attackTimer / this.ATTACK_DURATION, 1.0);

        // Rotate sword: Start high, swing down-forward
        // Z-axis rotation for 2D feel swing
        const startAngle = Math.PI / 4; // 45 deg
        const endAngle = -Math.PI / 2; // -90 deg
        const currentAngle = startAngle + (endAngle - startAngle) * progress;

        this.swordMesh.rotation.z = currentAngle;

        // End Attack
        if (progress >= 1.0) {
            this.isAttacking = false;
            this.swordMesh.visible = false;
        }
    }

    handleInput(deltaTime) {
        // Attack Trigger (B button)
        if (this.inputManager.isJustPressed('B') && this.isGrounded && !this.isAttacking) {
            this.startAttack();
        }

        // Lock movement while attacking
        if (this.isAttacking && this.isGrounded) {
            this.velocity.x = 0;
            this.velocity.z = 0;
            return; // Skip movement processing
        }

        // Reset per-frame input flags if needed, or just process straightforwardly

        // 1. Dash State Update (Must happen before movement calculation to determine speed)
        this.processDashInput();

        // 2. Movement Vector Calculation
        const moveDir = this.processMovementInput();

        // 3. Jump Action
        this.processJumpInput();

        // 4. Apply calculated movement to velocity (Horizontal only)
        const currentSpeed = this.isDashing ? this.dashSpeed : this.speed;

        if (moveDir.lengthSq() > 0) {
            this.velocity.x = moveDir.x * currentSpeed;
            this.velocity.z = moveDir.z * currentSpeed;

            // Visual Flip
            if (moveDir.x < 0) this.mesh.scale.x = -Math.abs(this.mesh.scale.x);
            if (moveDir.x > 0) this.mesh.scale.x = Math.abs(this.mesh.scale.x);
        } else {
            this.velocity.x = 0;
            this.velocity.z = 0;
        }
    }

    processMovementInput() {
        let dx = 0;
        let dz = 0;

        const up = this.inputManager.isDown('Up');
        const down = this.inputManager.isDown('Down');
        const left = this.inputManager.isDown('Left');
        const right = this.inputManager.isDown('Right');

        if (up) dz -= 1;
        if (down) dz += 1;
        if (left) dx -= 1;
        if (right) dx += 1;

        return new THREE.Vector3(dx, 0, dz).normalize();
    }

    processJumpInput() {
        const jump = this.inputManager.isJustPressed('A');
        if (jump && this.isGrounded) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;

            // Play Jump Sound
            if (this.soundManager) {
                this.soundManager.playSE('jump');
            }
        }
    }

    processDashInput() {
        // Did we move? (We need to check raw input or use the result from processMovementInput)
        // Redundant check, but cleaner to separate logic. 
        // Or we can check if keys are pressed.
        const up = this.inputManager.isDown('Up');
        const down = this.inputManager.isDown('Down');
        const left = this.inputManager.isDown('Left');
        const right = this.inputManager.isDown('Right');
        const isMoving = up || down || left || right;

        if (!isMoving) {
            this.isDashing = false;
            return;
        }

        // Logic for double-tap
        ['Up', 'Down', 'Left', 'Right'].forEach(dir => {
            if (this.inputManager.isJustPressed(dir)) {
                const now = performance.now();
                if (this.lastTapKey === dir && (now - this.lastTapTime < this.dashThreshold)) {
                    this.isDashing = true;
                }
                this.lastTapTime = now;
                this.lastTapKey = dir;
            }
        });
    }

    updatePhysics(deltaTime) {
        // --- 1. Horizontal Movement (Wall Sliding & Body Collision) ---
        const moveStep = this.velocity.clone().multiplyScalar(deltaTime);
        const currentFeetY = this.position.y;
        const maxStepHeight = 0.9; // 0.3 * 3
        const bodyRadius = 1.05; // Radius 1.05 (Diameter 2.1) per user request

        // Helper to check if a position is valid (not a wall)
        const isSafe = (x, z) => {
            // Check 4 corners
            const corners = [
                { x: x + bodyRadius, z: z + bodyRadius },
                { x: x + bodyRadius, z: z - bodyRadius },
                { x: x - bodyRadius, z: z + bodyRadius },
                { x: x - bodyRadius, z: z - bodyRadius }
            ];

            for (const c of corners) {
                const h = this.world.getGroundHeight(c.x, c.z);
                if (h > currentFeetY + maxStepHeight) {
                    return false; // Wall detected
                }
            }
            return true;
        };

        // Attempt X Move
        if (moveStep.x !== 0) {
            const nextX = this.position.x + moveStep.x;
            if (isSafe(nextX, this.position.z)) {
                this.position.x = nextX;
            } else {
                this.velocity.x = 0; // Hit wall
            }
        }

        // Attempt Z Move
        if (moveStep.z !== 0) {
            const nextZ = this.position.z + moveStep.z;
            if (isSafe(this.position.x, nextZ)) {
                this.position.z = nextZ;
            } else {
                this.velocity.z = 0; // Hit wall
            }
        }

        // --- 2. Vertical Movement & Gravity ---
        this.velocity.y -= this.gravity * deltaTime;
        const yStep = this.velocity.y * deltaTime;
        this.position.y += yStep;

        // --- 3. Ground Collision / Landing ---
        // Multi-point ground check to prevent sinking into stairs when center is off-edge
        // Sample 5 points: Center, and 4 surrounding points at bodyRadius
        const getH = (ox, oz) => this.world.getGroundHeight(this.position.x + ox, this.position.z + oz);

        // Use slightly smaller radius for ground check to avoid snapping to walls we are touching
        const checkRadius = bodyRadius * 0.8;
        const hC = getH(0, 0);
        const hL = getH(-checkRadius, 0);
        const hR = getH(checkRadius, 0);
        const hF = getH(0, -checkRadius); // Up (-Z)
        const hB = getH(0, checkRadius);  // Down (+Z)

        // Take the highest ground point relevant to the player's footprint
        // This ensures if one foot is on a step, we stand on it.
        const floorHeight = Math.max(hC, hL, hR, hF, hB);

        const targetGroundY = floorHeight;

        // Check if we are at or below target Y and falling
        // NOTE: We use center for targetGroundY. If we walk into a steep slope, X/Z check blocked us.
        // If we jump onto it, we land.

        if (this.position.y <= targetGroundY && this.velocity.y <= 0) {
            // Snap if within tolerance 
            if (this.position.y > targetGroundY - maxStepHeight) {
                this.position.y = targetGroundY;
                this.velocity.y = 0;
                this.isGrounded = true;
            }
        } else {
            this.isGrounded = false;
        }

        // Camera Vertical Tracking Logic
        if (this.isGrounded) {
            // If grounded, strictly follow feet (handles standing on edges)
            this.currentGroundHeight = this.position.y;
        } else {
            // If airborne, check proximity to ground
            // Use floorHeight (5-point check) to match physics, preventing edge-drop issues.
            const groundBelow = floorHeight;
            const dist = this.position.y - groundBelow;

            // If ground is reasonably close (stairs, slopes, small jumps), follow it.
            // If ground is far (void, cliff), lock camera height.
            if (dist < 10.0 && groundBelow > -50) {
                this.currentGroundHeight = groundBelow;
            }
        }

        // Void Respawn
        if (this.position.y < -30) {
            this.respawn();
        }
    }

    respawn() {
        this.position.set(0, 0, 0); // Respawn at Y=0
        this.velocity.set(0, 0, 0);
        console.log("Respawned!");
    }

    updateBillboard(camera) {
        if (camera) {
            this.mesh.quaternion.copy(camera.quaternion);
        }
    }
}
