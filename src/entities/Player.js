import * as THREE from 'three';

/**
 * プレイヤークラス
 * マリオ風の2Dビルボードキャラクターを管理し、移動・物理演算・入力処理を行うクラス。
 */
export class Player {
    constructor(scene, inputManager, world, assetManager, soundManager, texturePath = './assets/player_stand.png', jumpTexturePath = './assets/player_jump.png', walkTexturePaths = [], weaponTexturePath = null, arrowTexturePath = null, weaponType = 'sword', onShoot = null) {
        this.scene = scene;
        this.inputManager = inputManager;
        this.world = world;
        this.assetManager = assetManager;
        this.soundManager = soundManager;
        this.texturePath = texturePath;
        this.jumpTexturePath = jumpTexturePath;
        this.walkTexturePaths = walkTexturePaths;
        this.weaponTexturePath = weaponTexturePath;
        this.arrowTexturePath = arrowTexturePath;
        this.weaponType = weaponType; // 'sword' or 'bow'
        this.onShoot = onShoot;
        this.canAttack = (weaponType !== 'none');

        // --- プレイヤーコンテナの初期化 ---
        // 3D空間上の論理的な足元位置を表すコンテナ
        this.container = new THREE.Group();
        this.container.position.set(0, 0, 0);
        this.scene.add(this.container);

        // --- メッシュ（見た目）のセットアップ ---
        // ペーパーマリオ風の2D平面ジオメトリ
        const geometry = new THREE.PlaneGeometry(1, 1.5);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide,
            transparent: true
        });
        this.mesh = new THREE.Mesh(geometry, material);

        // メッシュの原点を足元に合わせるためのオフセット（スケール後の高さ4.5の半分2.25）
        this.mesh.position.set(0, 2.25, 0);
        this.mesh.castShadow = true;
        this.container.add(this.mesh);

        // テクスチャ読み込みはコンストラクタ末尾で行うため削除
        // this.loadTexture();

        // --- 物理演算・移動パラメータ ---
        this.position = this.container.position;
        this.velocity = new THREE.Vector3();

        // ジャンプ物理（元の値を60FPS基準で調整）
        this.gravity = 150.0;
        this.jumpForce = 36.75; // 高さ4.5mに到達するための初速
        this.isGrounded = false;
        this.wasGrounded = false;

        // カメラ追従用の地面高さキャッシュ
        this.currentGroundHeight = 0.0;

        // 移動速度
        this.speed = 18.0;
        this.dashSpeed = 54.0;
        this.isDashing = false;

        // ダッシュ判定用（ダブルタップ）
        this.lastTapTime = 0;
        this.lastTapKey = null;
        this.dashThreshold = 250; // ms

        // 足音関連
        this.stepTimer = 0;
        this.baseStepInterval = 0.45;

        // --- 攻撃（剣）セットアップ ---
        // --- 攻撃（剣）セットアップ ---
        // 剣のホルダー（ビルボード用）
        this.swordHolder = new THREE.Group();
        this.swordHolder.position.copy(this.mesh.position); // メッシュと同じ位置（中心）
        this.container.add(this.swordHolder);

        // 剣のピボット（回転軸）を作成
        this.swordPivot = new THREE.Group();
        this.swordPivot.position.set(0.8, -0.3, 0.1); // Adjusted to hand position (pivot at handle)
        this.swordPivot.rotation.z = Math.PI / 4; // 初期角度（構え）
        this.swordPivot.visible = false;
        this.swordHolder.add(this.swordPivot);

        // 剣の本体（見た目）
        // ピボットの中心から上に伸びるように配置
        const swordGeo = new THREE.PlaneGeometry(0.5, 2.0);
        const swordMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide,
            transparent: true
        });
        this.swordMesh = new THREE.Mesh(swordGeo, swordMat);
        this.swordMesh.position.set(0, 1.0, 0); // 中心を(0,0)から(0,1.0)にずらすことで、ピボットが持ち手になる
        this.swordPivot.add(this.swordMesh);

        // 攻撃ステート
        this.isAttacking = false;
        this.attackTimer = 0;
        this.ATTACK_DURATION = 0.3;

        // --- 自動リスポーン設定 ---
        this.autoRespawnDistance = 15.0; // リスポーン判定距離（水平）
        this.autoRespawnHeight = 10.0;   // リスポーン判定距離（垂直）
        this.autoRespawnTimer = 0;       // 計測用タイマー
        this.AUTO_RESPAWN_DELAY = 3.0;   // リスポーンまでの猶予時間

        // --- 追従ジャンプ設定 ---
        this.jumpDelayTimer = 0;
        this.JUMP_DELAY = 0.2; // ジャンプ遅延時間

        // --- アニメーション用 ---
        this.textures = {};
        this.currentTextureKey = null;

        // 歩行アニメーション定数
        this.walkTimer = 0;
        this.WALK_INTERVAL = 0.15; // 0.15秒ごとにフレーム切り替え

        // テクスチャ読み込み開始
        this.loadTextures();
    }

    /**
     * テクスチャの非同期読み込みと設定
     */
    loadTextures() {
        if (!this.assetManager) return;

        const setupTexture = (texture) => {
            texture.generateMipmaps = true;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.anisotropy = this.assetManager.maxAnisotropy || 16;
            texture.colorSpace = THREE.SRGBColorSpace;
            return texture;
        };

        const load = (key, path) => {
            if (!path) return Promise.resolve(); // パスがない場合はスキップ
            return this.assetManager.loadTexture(path).then(texture => {
                setupTexture(texture);
                const aspect = texture.image.width / texture.image.height;
                this.textures[key] = { texture, aspect };
            }).catch(err => console.error(`[Player] Failed to load ${key}:`, err));
        };

        const promises = [
            load('stand', this.texturePath),
            load('jump', this.jumpTexturePath)
        ];

        // 武器テクスチャの読み込み
        if (this.weaponTexturePath) {
            promises.push(load('weapon', this.weaponTexturePath));
        }
        if (this.arrowTexturePath) {
            promises.push(load('arrow', this.arrowTexturePath));
        }

        // 歩行テクスチャの読み込み
        if (this.walkTexturePaths && this.walkTexturePaths.length > 0) {
            this.walkTexturePaths.forEach((path, index) => {
                promises.push(load(`walk${index + 1}`, path));
            });
        }

        Promise.all(promises).then(() => {
            // 初期テクスチャ適用
            this.setTexture('stand');

            // 武器テクスチャ適用
            if (this.textures['weapon'] && this.swordMesh) {
                this.swordMesh.material.map = this.textures['weapon'].texture;
                this.swordMesh.material.transparent = true;
                this.swordMesh.material.needsUpdate = true;

                // アスペクト比を反映（高さ2.0基準）
                const aspect = this.textures['weapon'].aspect;
                this.swordMesh.scale.x = aspect; // Plane(0.5, 2.0)の初期幅0.5を基準にする場合は少し計算が必要だが、ここではScaleで調整
                // ただし、元のGeometryが(0.5, 2.0)なのでアスペクト比が0.25。
                // 画像のアスペクト比に合わせて幅を調整するほうが自然。
                // ここでは単純にMapを割り当てるに留めるか、形状合わせを行うか。
                // 形状合わせを行う: Height 2.0 固定なら、Width = 2.0 * aspect
                // 元のGeometry Width 0.5。Scale X = (2.0 * aspect) / 0.5 = 4.0 * aspect
                // アスペクト比を反映
                this.swordMesh.scale.x = 4.0 * aspect;

                if (this.weaponType === 'sword') {
                    // 剣(竹刀)の場合：持ち手(左端)をピボット(X=0)に合わせる
                    // Mesh Width = 0.5 * scale.x -> Offset = Width / 2
                    this.swordMesh.position.set(0.25 * this.swordMesh.scale.x, 0, 0);
                } else {
                    // 弓などの場合：中心をピボット(X=0, Y=0)に合わせる
                    this.swordMesh.position.set(0, 0, 0);
                }
            }

            // マテリアル設定（初回のみ）
            this.mesh.material.transparent = true;
            this.mesh.material.alphaTest = 0.5;
            this.mesh.material.needsUpdate = true;
        });
    }

    /**
     * テクスチャ切り替え
     */
    setTexture(key) {
        if (!this.textures[key] || this.currentTextureKey === key) return;

        const data = this.textures[key];
        this.mesh.material.map = data.texture;

        // Preserve current facing direction (sign of scale.x)
        const currentSign = Math.sign(this.mesh.scale.x) || 1;

        // 高さ3基準でアスペクト比を維持
        // Geometry(1, 1.5) -> Scale(X, 3, 1) -> Real Height 4.5
        this.mesh.scale.set(4.5 * data.aspect * currentSign, 3, 1);

        this.mesh.material.needsUpdate = true;
        this.currentTextureKey = key;
    }

    /**
     * アニメーション状態更新
     */
    updateAnimation(deltaTime) {
        if (!this.isGrounded) {
            this.setTexture('jump');
            return;
        }

        // 移動していない場合は立ち絵
        const speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
        if (speed < 0.1) {
            this.setTexture('stand');
            this.walkTimer = 0;
            return;
        }

        // 歩行アニメーション (Stand -> Walk1 -> Stand -> Walk2)
        // 必要テクスチャが揃っていない場合はstandフォールバック
        if (!this.textures['walk1'] || !this.textures['walk2']) {
            this.setTexture('stand');
            return;
        }

        this.walkTimer += deltaTime;
        const frameIndex = Math.floor(this.walkTimer / this.WALK_INTERVAL) % 4;

        switch (frameIndex) {
            case 0:
                this.setTexture('stand');
                break;
            case 1:
                this.setTexture('walk1');
                break;
            case 2:
                this.setTexture('stand');
                break;
            case 3:
                this.setTexture('walk2');
                break;
        }
    }

    /**
     * 追従モード（ダブル主人公用）
     * @param {Player} target - 追従対象のリーダー
     * @param {number} deltaTime - 経過時間
     */
    follow(target, deltaTime) {
        // 水平距離のみで計算（ジャンプ等のY軸移動を無視するため）
        const dx = target.position.x - this.position.x;
        const dz = target.position.z - this.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        const stopDist = 2.0;

        // リスポーン判定（距離が離れすぎている場合）
        // 水平距離 または 垂直距離 が閾値を超えた場合
        const dy = Math.abs(target.position.y - this.position.y);

        if (dist > this.autoRespawnDistance || dy > this.autoRespawnHeight) {
            this.autoRespawnTimer += deltaTime;
            if (this.autoRespawnTimer > this.AUTO_RESPAWN_DELAY) {
                this.respawnAt(target);
                return;
            }
        } else {
            // 距離が戻ったらタイマーリセット
            this.autoRespawnTimer = 0;
        }

        if (dist > stopDist) {
            const dir = target.position.clone().sub(this.position);
            dir.y = 0; // 高さは無視して水平移動
            if (dir.lengthSq() > 0) dir.normalize();

            // 距離が離れすぎたらダッシュで追いかける
            const moveSpeed = (dist > 5.0) ? this.dashSpeed : this.speed;
            this.isDashing = (dist > 5.0);

            this.velocity.x = dir.x * moveSpeed;
            this.velocity.z = dir.z * moveSpeed;

            // 進行方向に向く
            if (dir.x < 0) this.mesh.scale.x = -Math.abs(this.mesh.scale.x);
            if (dir.x > 0) this.mesh.scale.x = Math.abs(this.mesh.scale.x);

            // --- ジャンプ追従判定 ---
            // 接地していて、かつターゲットが高い位置にいる場合
            if (this.isGrounded && (target.position.y - this.position.y > 2.0)) {
                this.jumpDelayTimer += deltaTime;
                if (this.jumpDelayTimer > this.JUMP_DELAY) {
                    this.velocity.y = this.jumpForce;
                    this.isGrounded = false;
                    this.jumpDelayTimer = 0;

                    if (this.soundManager) {
                        this.soundManager.playSE('jump');
                    }
                }
            } else {
                this.jumpDelayTimer = 0;
            }

        } else {
            // 停止
            this.velocity.x = 0;
            this.velocity.z = 0;
            this.isDashing = false;
            this.jumpDelayTimer = 0;
        }
    }

    /**
     * メイン更新処理
     * @param {number} deltaTime - 前フレームからの経過時間
     * @param {THREE.Camera} camera - ビルボード用カメラ
     * @param {boolean} processInput - 操作入力を受け付けるかどうか
     */
    update(deltaTime, camera, processInput = true) {
        // 状態更新
        this.updateAttack(deltaTime);

        // 入力処理（リーダー操作時のみ）
        if (processInput) {
            this.handleInput(deltaTime);
        }

        // 物理演算・移動
        this.updatePhysics(deltaTime);

        // ビルボード処理（カメラに向ける）
        this.updateBillboard(camera);

        // 足音再生
        this.handleFootsteps(deltaTime);

        // アニメーション更新
        this.updateAnimation(deltaTime);
    }

    /**
     * 足音の処理
     */
    handleFootsteps(deltaTime) {
        // 地面にいて、かつ移動している場合のみ再生
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

    /**
     * 攻撃アニメーションの更新
     */
    updateAttack(deltaTime) {
        if (this.isAttacking) {
            this.attackTimer += deltaTime;
            const progress = Math.min(this.attackTimer / this.ATTACK_DURATION, 1.0);

            // アニメーション設定: 縦90度(PI/2)から真横(0)へ右回転
            const startAngle = Math.PI / 2; // 90度 (垂直)
            const endAngle = 0;             // 0度 (水平)

            // イージングを入れて自然な振りにする (easeOutCubic)
            const p = 1 - Math.pow(1 - progress, 3);
            const currentAngle = startAngle + (endAngle - startAngle) * p;

            this.swordPivot.rotation.z = currentAngle;

            // 終了判定
            if (progress >= 1.0) {
                this.isAttacking = false;
                this.swordPivot.visible = false;
            }
        } else if (this.isAiming) {
            // 弓を構えている状態
            this.aimDuration += deltaTime;
            this.swordPivot.rotation.z = 0; // 水平に構える
            this.swordPivot.visible = true;

            // 1秒経過でチャージ完了エフェクト
            if (this.aimDuration >= 1.0 && !this.chargeEffectTriggered) {
                this.chargeEffectTriggered = true;
                this.showChargeEffect();
            }
        }

        // Update Charge Effect Animation
        if (this.chargeEffectMesh) {
            this.chargeEffectTimer += deltaTime;
            if (this.chargeEffectTimer < 0.5) {
                const s = 1.0 + this.chargeEffectTimer * 2.0; // Scale up
                this.chargeEffectMesh.scale.set(s, s, s);
                this.chargeEffectMesh.material.opacity = 1.0 - (this.chargeEffectTimer / 0.5); // Fade out
            } else {
                this.removeChargeEffect();
            }
        }
    }

    startAim() {
        if (this.isAttacking || this.isAiming) return;
        this.isAiming = true;
        this.aimDuration = 0;
        this.chargeEffectTriggered = false; // Reset trigger
        // 構え音?
    }

    showChargeEffect() {
        if (this.chargeEffectMesh) this.removeChargeEffect();

        // Create a simple star/sparkle shape (Plane)
        const geometry = new THREE.PlaneGeometry(1.0, 1.0);
        const material = new THREE.MeshBasicMaterial({
            color: 0xFFFF00, // Yellow
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide
        });

        this.chargeEffectMesh = new THREE.Mesh(geometry, material);
        // Position at tip of bow/sword?
        // Adjusted to be closer to player/bow center (was overlapping poorly)
        this.chargeEffectMesh.position.set(0.6, 0, 0.1);
        this.swordPivot.add(this.chargeEffectMesh);

        this.chargeEffectTimer = 0;

        if (this.soundManager) {
            this.soundManager.playSE('select'); // Use 'select' sound as placeholder for sparkle
        }
    }

    removeChargeEffect() {
        if (this.chargeEffectMesh) {
            if (this.chargeEffectMesh.parent) this.chargeEffectMesh.parent.remove(this.chargeEffectMesh);
            this.chargeEffectMesh.geometry.dispose();
            this.chargeEffectMesh.material.dispose();
            this.chargeEffectMesh = null;
        }
    }

    /**
     * 攻撃開始（現在未使用だがロジックは保持）
     */
    startAttack() {
        if (this.isAttacking || this.isAiming) return;

        if (this.weaponType === 'sword') {
            this.isAttacking = true;
            this.attackTimer = 0;
            this.swordPivot.visible = true;

            if (this.soundManager) {
                this.soundManager.playSE('sword');
            }
        }
    }



    fireBow() {
        if (!this.isAiming) return;

        // 1秒未満のチャージでは発射不可
        if (this.aimDuration < 1.0) {
            this.isAiming = false;
            this.swordPivot.visible = false;
            return;
        }

        this.isAiming = false;
        this.swordPivot.visible = false;

        // Fire Arrow
        if (this.onShoot && this.textures['arrow']) {
            const spawnPos = this.container.position.clone();
            spawnPos.y += 2.25; // Center height
            // Offset slightly forward
            // Check facing direction
            const facing = Math.sign(this.mesh.scale.x) || 1;
            spawnPos.x += facing * 1.0;

            // Velocity: Parabola (Yamunari)
            // Forward + Up
            const force = 16.0; // Forward speed (Double of 8.0)
            const upForce = 10.0; // Upward kick (Double of 5.0)
            const vel = new THREE.Vector3(facing * force, upForce, 0);

            this.onShoot(spawnPos, vel, this.textures['arrow'].texture);

            if (this.soundManager) {
                this.soundManager.playSE('shoot') || this.soundManager.playSE('jump'); // Fallback
            }
        }
    }

    /**
     * 入力処理
     */
    handleInput(deltaTime) {


        // 1. ダッシュ入力判定
        this.processDashInput();

        // 攻撃入力 (Bボタン) - 接地時かつ攻撃可能な場合のみ
        if (this.isGrounded && this.canAttack) {
            if (this.weaponType === 'sword') {
                if (this.inputManager.isJustPressed('B')) {
                    this.startAttack();
                }
            } else if (this.weaponType === 'bow') {
                if (this.inputManager.isDown('B')) {
                    this.startAim();
                }
                if (this.inputManager.isJustReleased('B')) {
                    this.fireBow();
                }
            }
        }

        // 攻撃・構え中は移動・ジャンプ不可
        if ((this.isAttacking || this.isAiming) && this.isGrounded) {
            this.velocity.x = 0;
            this.velocity.z = 0;
            return;
        }

        // 2. 移動方向の計算
        const moveDir = this.processMovementInput();

        // 3. ジャンプ入力
        this.processJumpInput();

        // 4. 速度への反映（水平移動のみ）
        const currentSpeed = this.isDashing ? this.dashSpeed : this.speed;

        if (moveDir.lengthSq() > 0) {
            this.velocity.x = moveDir.x * currentSpeed;
            this.velocity.z = moveDir.z * currentSpeed;

            // 左向きなら反転、右向きなら通常
            if (moveDir.x < 0) this.mesh.scale.x = -Math.abs(this.mesh.scale.x);
            if (moveDir.x > 0) this.mesh.scale.x = Math.abs(this.mesh.scale.x);
        } else {
            // 入力がないときは停止
            this.velocity.x = 0;
            this.velocity.z = 0;
        }
    }

    /**
     * 十字キー入力から移動ベクトルを算出
     */
    processMovementInput() {
        let dx = 0;
        let dz = 0;

        if (this.inputManager.isDown('Up')) dz -= 1;
        if (this.inputManager.isDown('Down')) dz += 1;
        if (this.inputManager.isDown('Left')) dx -= 1;
        if (this.inputManager.isDown('Right')) dx += 1;

        return new THREE.Vector3(dx, 0, dz).normalize();
    }

    /**
     * ジャンプ入力処理
     */
    processJumpInput() {
        if (this.inputManager.isJustPressed('A') && this.isGrounded) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;

            if (this.soundManager) {
                this.soundManager.playSE('jump');
            }
        }
    }

    /**
     * ダブルタップによるダッシュ判定
     */
    processDashInput() {
        const isMoving = this.inputManager.isDown('Up') ||
            this.inputManager.isDown('Down') ||
            this.inputManager.isDown('Left') ||
            this.inputManager.isDown('Right');

        if (!isMoving) {
            this.isDashing = false;
            return;
        }



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

    /**
     * 物理演算（重力・衝突判定）
     */
    updatePhysics(deltaTime) {
        this.wasGrounded = this.isGrounded;

        // --- 1. 水平移動と壁当たり判定 ---
        const moveStep = this.velocity.clone().multiplyScalar(deltaTime);
        const currentFeetY = this.position.y;
        const maxStepHeight = 0.3; // 壁登り制限（スイッチに乗れないように）
        const maxLandingTolerance = 4.0; // 着地補正（高速落下時やすり抜け時の復帰用）
        const bodyRadius = 1.05;

        // 壁判定関数
        const isSafe = (x, z) => {
            const corners = [
                { x: x + bodyRadius, z: z + bodyRadius },
                { x: x + bodyRadius, z: z - bodyRadius },
                { x: x - bodyRadius, z: z + bodyRadius },
                { x: x - bodyRadius, z: z - bodyRadius },
                { x: x, z: z + bodyRadius }, // 前
                { x: x, z: z - bodyRadius }, // 後
                { x: x + bodyRadius, z: z }, // 右
                { x: x - bodyRadius, z: z }, // 左
                { x: x, z: z } // 中心
            ];

            for (const c of corners) {
                // Use getGroundInfo to check for Walls
                const info = this.world.getGroundInfo(c.x, c.z);
                const h = info.height;

                // 1. Wall Check (isWall=true なら段差許容なしでブロック)
                if (info.isWall && h > currentFeetY + 0.01) { // 僅かな浮きも許容しない
                    return false;
                }

                // 2. Standard Slope/Stair Check
                // 足元の高さより急激に高い場所は「壁」とみなす (登り制限)
                if (h > currentFeetY + maxStepHeight) {
                    return false;
                }
            }
            return true;
        };

        // ... (省略: moveAxis) ...
        const moveAxis = (axis, amount) => {
            const stepSize = 0.1; // Reduced from 0.5 to prevent tunneling through small objects
            const steps = Math.ceil(Math.abs(amount) / stepSize);
            const inc = amount / steps;

            for (let i = 0; i < steps; i++) {
                const checkX = (axis === 'x') ? this.position.x + inc : this.position.x;
                const checkZ = (axis === 'z') ? this.position.z + inc : this.position.z;

                if (isSafe(checkX, checkZ)) {
                    this.position[axis] += inc;
                } else {
                    this.velocity[axis] = 0;
                    break;
                }
            }
        };

        // X軸移動トライ
        if (moveStep.x !== 0) moveAxis('x', moveStep.x);

        // Z軸移動トライ
        if (moveStep.z !== 0) moveAxis('z', moveStep.z);

        // --- 2. 接地判定と吸い付き処理 (Ground Snapping) ---
        // 5点サンプリングで最も高い地面を足場とする
        const getH = (ox, oz) => this.world.getGroundHeight(this.position.x + ox, this.position.z + oz);
        const checkRadius = 0.1; // Reduced from bodyRadius * 0.8 to prevent climbing walls

        const floorHeight = Math.max(
            getH(0, 0),
            getH(-checkRadius, 0),
            getH(checkRadius, 0),
            getH(0, -checkRadius),
            getH(0, checkRadius)
        );

        // 吸い付き判定
        let snapped = false;
        if (this.isGrounded && this.velocity.y <= 0) {
            const snapThreshold = 2.0;
            if (this.position.y > floorHeight && (this.position.y - floorHeight) <= snapThreshold) {
                this.position.y = floorHeight;
                this.velocity.y = 0;
                this.isGrounded = true;
                snapped = true;
            }
        }

        // --- 3. 垂直移動（重力） ---
        if (!snapped) {
            this.velocity.y -= this.gravity * deltaTime;
            const yStep = this.velocity.y * deltaTime;
            this.position.y += yStep;

            // --- 4. 着地判定 ---
            // 落下中で、かつ地面の高さ以下になったら着地
            if (this.position.y <= floorHeight && this.velocity.y <= 0) {
                // 着地補正範囲内なら着地させる
                if (this.position.y > floorHeight - maxLandingTolerance) {
                    this.position.y = floorHeight;
                    this.velocity.y = 0;
                    this.isGrounded = true;
                }
            } else {
                this.isGrounded = false;
            }
        }

        // カメラ用の高さ情報を更新
        if (this.isGrounded) {
            this.currentGroundHeight = this.position.y;
        } else {
            // 空中時は直下の地面をある程度追従させる
            const dist = this.position.y - floorHeight;
            if (dist < 10.0 && floorHeight > -50) {
                this.currentGroundHeight = floorHeight;
            }
        }

        // 奈落判定（リスポーン）
        if (this.position.y < -30) {
            this.respawn();
        }
    }

    /**
     * リスポーン処理
     */
    respawn() {
        this.position.set(0, 0, 0);
        this.velocity.set(0, 0, 0);
        console.log("Respawned!");
    }

    /**
     * 指定ターゲット周辺にリスポーン
     * @param {Player} target 
     */
    respawnAt(target) {
        // ターゲットの頭上から少しずらして降ってくる
        this.position.copy(target.position);
        this.position.y += 5.0; // 頭上5m

        // 速度リセット
        this.velocity.set(0, 0, 0);
        this.autoRespawnTimer = 0;

        console.log("Auto Respawned at Leader's position!");
    }

    /**
     * ビルボード処理（常にカメラの方を向く）
     */
    updateBillboard(camera) {
        if (camera) {
            this.mesh.quaternion.copy(camera.quaternion);
            if (this.swordHolder) {
                this.swordHolder.quaternion.copy(camera.quaternion);

                // 体の向きに合わせて竹刀も反転（左向きならXスケールを-1に）
                const facing = Math.sign(this.mesh.scale.x) || 1;
                // 元のスケール(1 or -1)を維持しつつ反転
                this.swordHolder.scale.x = facing;
            }
        }
    }
}
