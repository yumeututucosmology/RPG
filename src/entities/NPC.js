import * as THREE from 'three';

export class NPC {
    constructor(scene, world, position = new THREE.Vector3(0, 2.25, 0), assetManager, texturePath) {
        this.scene = scene;
        this.world = world;
        this.assetManager = assetManager;

        // Container Group
        this.mesh = new THREE.Group();
        this.mesh.position.copy(position);
        this.scene.add(this.mesh);

        if (texturePath) {
            // If texturePath is provided, create a sprite (Mob)
            this.assetManager.loadTexture(texturePath).then(texture => {
                // Determine aspect ratio from texture
                const aspect = texture.image.width / texture.image.height;
                const displayHeight = 4.5; // Match Player height
                const displayWidth = displayHeight * aspect;

                const spriteGeo = new THREE.PlaneGeometry(displayWidth, displayHeight);
                const spriteMat = new THREE.MeshStandardMaterial({
                    map: texture,
                    transparent: true,
                    alphaTest: 0.5,
                    side: THREE.DoubleSide
                });
                const sprite = new THREE.Mesh(spriteGeo, spriteMat);
                sprite.position.y = displayHeight / 2; // Adjust Y to stand on ground
                sprite.castShadow = true;
                this.mesh.add(sprite);
                this.sprite = sprite;
            });
        } else {
            // Default: Signboard (3D Object)
            // 1. Post (Cylinder)
            const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.5, 8);
            const postMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // SaddleBrown
            const post = new THREE.Mesh(postGeo, postMat);
            post.position.set(0, 1.75, 0); // Center of post is at height 1.75 (3.5/2)
            post.castShadow = true;
            this.mesh.add(post);

            // 2. Board (Box)
            // Size: Width 3, Height 2, Depth 0.2
            const boardGeo = new THREE.BoxGeometry(3, 2, 0.2);

            // Materials: Single wood color
            const woodColorMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
            const board = new THREE.Mesh(boardGeo, woodColorMat);
            board.position.set(0, 2.75, 0); // Position board near top of post
            board.castShadow = true;
            this.mesh.add(board);
        }

        // AI properties
        this.origin = position.clone(); // Spawn point as center of wander area
        this.wanderRadius = 5.0; // 10x10 area means +/- 5 from center
        this.moveSpeed = 2.0;

        this.currentState = 'IDLE'; // 'IDLE' or 'WALK'
        this.stateTimer = 0;
        this.moveDirection = new THREE.Vector3(0, 0, 0);

        // Initialize first state duration
        this.resetState();
    }

    resetState() {
        // Randomly choose next state
        this.currentState = Math.random() < 0.5 ? 'IDLE' : 'WALK';

        // Random duration: 1.0 to 4.0 seconds
        this.stateTimer = 1.0 + Math.random() * 3.0;

        if (this.currentState === 'WALK') {
            // Pick random direction
            const angle = Math.random() * Math.PI * 2;
            this.moveDirection.set(Math.cos(angle), 0, Math.sin(angle));

            // Check if walking would immediately hit boundary, if so, turn towards center
            const futurePos = this.mesh.position.clone().add(this.moveDirection);
            if (Math.abs(futurePos.x - this.origin.x) > this.wanderRadius ||
                Math.abs(futurePos.z - this.origin.z) > this.wanderRadius) {
                // Too far, walk back to origin
                this.moveDirection.copy(this.origin).sub(this.mesh.position).normalize();
            }
        }
    }



    update(camera, deltaTime = 0.016) {
        if (camera && this.sprite) {
            this.mesh.quaternion.copy(camera.quaternion);
        }

        // AI Logic (Only if it's a mob/sprite)
        if (this.sprite) {
            this.stateTimer -= deltaTime;
            if (this.stateTimer <= 0) {
                this.resetState();
            }

            if (this.currentState === 'WALK') {
                const moveStep = this.moveDirection.clone().multiplyScalar(this.moveSpeed * deltaTime);
                const nextPos = this.mesh.position.clone().add(moveStep);

                // Check for Collisions
                let collision = false;
                if (this.world && this.world.colliders) {
                    for (const c of this.world.colliders) {
                        // Only check colliders taller than 0.5 to prevent getting stuck on small steps if any, 
                        // mostly to avoid floor which is height 0, but steps are height > 0.75.
                        // But we want to avoid the floor collider which is usually the whole map.
                        // World.js floor collider height is 0.
                        if (c.height > 0.1) {
                            const margin = 0.5; // Collision margin (body radius approx)
                            if (nextPos.x >= c.minX - margin && nextPos.x <= c.maxX + margin &&
                                nextPos.z >= c.minZ - margin && nextPos.z <= c.maxZ + margin) {
                                collision = true;
                                break;
                            }
                        }
                    }
                }

                // Boundary Check (10x10 Area around origin) + Collision Check
                if (!collision &&
                    Math.abs(nextPos.x - this.origin.x) <= this.wanderRadius &&
                    Math.abs(nextPos.z - this.origin.z) <= this.wanderRadius) {

                    this.mesh.position.copy(nextPos);

                    // Update facing direction
                    if (this.moveDirection.x > 0) {
                        this.sprite.scale.x = Math.abs(this.sprite.scale.x);
                    } else if (this.moveDirection.x < 0) {
                        this.sprite.scale.x = -Math.abs(this.sprite.scale.x);
                    }
                } else {
                    // Hit boundary, switch to IDLE early or pick new direction
                    this.currentState = 'IDLE';
                    this.stateTimer = 1.0 + Math.random() * 2.0;
                }
            }
        }
    }

    /**
     * 対話インタラクションのチェック
     * @param {Player} player - プレイヤー
     * @param {InputManager} inputManager - 入力マネージャー
     * @param {MessageSystem} messageSystem - メッセージシステム
     * @param {SoundManager} soundManager - サウンドマネージャー
     */
    checkInteraction(player, inputManager, messageSystem, soundManager, isSeparated, activePlayerIndex) {
        // 1. 距離判定
        const dist = player.position.distanceTo(this.mesh.position);
        if (dist > 3.0) return;

        // 2. 入力判定
        if (inputManager.isJustPressed('A')) {
            // スプライトがあればプレイヤーの方を向く
            if (this.sprite) {
                const dx = player.position.x - this.mesh.position.x;
                // 右(dx > 0)なら正、左(dx < 0)なら負にする。
                if (dx > 0) {
                    this.sprite.scale.x = Math.abs(this.sprite.scale.x);
                } else {
                    this.sprite.scale.x = -Math.abs(this.sprite.scale.x);
                }
            }

            // メッセージ表示
            // メッセージ分岐
            let message = "こんにちは、二人とも"; // Default (Together)

            if (isSeparated) {
                if (activePlayerIndex === 0) {
                    message = "あかねちゃん、こんにちは";
                } else if (activePlayerIndex === 1) {
                    message = "れいこちゃん、こんにちは";
                }
            }

            // メッセージ表示
            messageSystem.show(message);
            if (soundManager) soundManager.playSE('select');

            // ジャンプ暴発防止
            inputManager.consumeAction('A');
        }
    }
}
