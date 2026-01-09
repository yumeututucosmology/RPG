import './style.css'; // グローバルスタイルの読み込み
import { RenderSystem } from './systems/RenderSystem.js';
import { InputManager } from './systems/InputManager.js';
import { SoundManager } from './systems/SoundManager.js';
import { AssetManager } from './systems/AssetManager.js';
import { DebugSystem } from './systems/DebugSystem.js';
import { MenuSystem } from './systems/MenuSystem.js';
import { MessageSystem } from './systems/MessageSystem.js';
import { World } from './world/World.js';
import { Player } from './entities/Player.js';
import { NPC } from './entities/NPC.js';
import { Arrow } from './entities/Arrow.js';
import { Switch } from './entities/Switch.js';
import * as THREE from 'three';

/**
 * ゲーム本体クラス
 * システムの初期化、メインループの管理を行う
 */
class Game {
    constructor() {
        // --- システム初期化 ---
        this.renderSystem = new RenderSystem();

        // Clear Loading Text
        const loading = document.getElementById('loading');
        if (loading) loading.remove();

        this.inputManager = new InputManager();
        this.soundManager = new SoundManager();
        this.assetManager = new AssetManager();
        this.debugSystem = new DebugSystem();
        this.menuSystem = new MenuSystem(this.soundManager, this.renderSystem, this.inputManager);
        this.messageSystem = new MessageSystem();

        // テクスチャ設定をアセットマネージャーに共有
        this.assetManager.setMaxAnisotropy(this.renderSystem.getMaxAnisotropy());

        // ワールド生成
        this.world = new World(this.renderSystem.scene);

        // --- キャラクター生成（ダブル主人公） ---
        // Helper for GitHub Pages asset paths
        const getAssetPath = (path) => {
            const baseUrl = import.meta.env.BASE_URL; // e.g. '/RPG/' or './'
            // Remove leading './' if present
            const cleanPath = path.startsWith('./') ? path.substring(2) : path;
            const finalPath = baseUrl + cleanPath;
            console.log(`Loading Asset: ${path} -> ${finalPath}`);
            return finalPath;
        };

        // --- キャラクター生成（ダブル主人公） ---
        const p1 = new Player(this.renderSystem.scene, this.inputManager, this.world, this.assetManager, this.soundManager,
            getAssetPath('assets/player_stand.png'),
            getAssetPath('assets/player_jump.png'),
            [getAssetPath('assets/player_walk1.png'), getAssetPath('assets/player_walk2.png')],
            getAssetPath('assets/akane_weapon.png'),
            null,
            'sword'
        );

        // Player 2 (Reiko) - 弓 (Bow)
        const p2 = new Player(
            this.renderSystem.scene,
            this.inputManager,
            this.world,
            this.assetManager,
            this.soundManager,
            getAssetPath('assets/player2_stand.png'),
            getAssetPath('assets/player2_jump.png'),
            [getAssetPath('assets/player2_walk1.png'), getAssetPath('assets/player2_walk2.png')],
            getAssetPath('assets/reiko_weapon.png'),    // Weapon Texture
            getAssetPath('assets/reiko_arrow.png'),     // Arrow Texture
            'bow',                          // Weapon Type
            (pos, vel, tex) => this.spawnArrow(pos, vel, tex) // onShoot Callback
        );

        // P2が重ならないように少しずらす
        p2.container.position.x = -2.0;

        this.players = [p1, p2];
        this.projectiles = []; // List of active projectiles (Arrows)
        this.activePlayerIndex = 0;
        this.player = this.players[0]; // 現在の操作キャラクター

        // 分離行動モード (Separated Action)
        this.isSeparated = false;
        this.separationTimer = 0;
        this.separationModeSwitched = false; // 長押しによる切り替えが完了したかどうかのフラグ

        // --- カメラ初期設定 ---
        const offset = new THREE.Vector3(0, 12, 30);
        const targetPos = this.player.position.clone().add(offset);
        this.renderSystem.camera.position.copy(targetPos);

        // プレイヤーが画面下方（約80%の位置）に来るように視点を調整
        const lookOffset = new THREE.Vector3(0, 0, -25);
        const lookTarget = this.player.position.clone().add(lookOffset);
        this.renderSystem.camera.lookAt(lookTarget);

        // NPC配置 (Signboard)
        this.npc = new NPC(this.renderSystem.scene, this.world, new THREE.Vector3(15, 0, 15), this.assetManager);

        // Mob配置 (Character near Signboard)
        this.mob = new NPC(this.renderSystem.scene, this.world, new THREE.Vector3(12, 0, 15), this.assetManager, getAssetPath('assets/mob.png'));

        // 看板の当たり判定を追加 (幅3m, 奥行2m, 高さ20m: ジャンプ等による乗り越え・めり込みを完全に防止)
        // プレイヤーが乗り越えられない高さに設定
        this.world.addObstacle(15, 15, 3.0, 2.0, 20.0);

        // Floor Switch (X=30, Z=15) - Red (Initial: Up/Wall)
        this.switch = new Switch(this.renderSystem.scene, new THREE.Vector3(30, 0, 15), this.soundManager, 0xff0000); // Red
        this.switchCollider = this.world.addObstacle(30, 15, 1.6, 1.6, 1.4, true); // isWall=true

        // Blue Switch (X=40, Z=15) - Blue (Initial: Down/Floor)
        this.blueSwitch = new Switch(this.renderSystem.scene, new THREE.Vector3(40, 0, 15), this.soundManager, 0x0000ff); // Blue
        this.blueSwitch.setPressed(true); // Initially pressed
        this.blueSwitchCollider = this.world.addObstacle(40, 15, 1.6, 1.6, 0.2, false); // isWall=false, Height 0.2

        // タイマー・アニメーション関連
        this.clock = new THREE.Clock();
        this.cameraTransitionTimer = 0.0;

        // ループバインド
        this.animate = this.animate.bind(this);
    }

    /**
     * ゲーム開始処理
     */
    start() {
        this.animate();
        console.log("[Game] Started");

        // アイテムデータの読み込み
        this.assetManager.loadJSON('./data/items.json')
            .then(data => {
                console.log("[Game] Loaded Items Data:", data);
                this.items = data;
            });

        // サウンドコンテキストの再開（ブラウザの自動再生ポリシー対策）
        const resumeAudio = () => {
            this.soundManager.resumeContext();
            window.removeEventListener('click', resumeAudio);
            window.removeEventListener('keydown', resumeAudio);
        };
        window.addEventListener('click', resumeAudio);
        window.addEventListener('keydown', resumeAudio);
    }

    /**
     * メインループ
     */
    animate() {
        requestAnimationFrame(this.animate);

        // デルタタイム計算（バックグラウンド復帰時のすり抜け防止のためキャップを設ける）
        const rawDelta = this.clock.getDelta();
        const deltaTime = Math.min(rawDelta, 0.05); // 最大でも20FPS相当の進行に留める

        // 1. 入力更新
        this.handleInput();

        // メッセージ表示中はゲームロジックを停止
        if (this.messageSystem.isVisible) {
            this.messageSystem.update(deltaTime);
            // 誤操作防止のため、表示から少し時間が経ってから閉じる判定を行う
            if (this.messageSystem.canClose() && this.inputManager.isJustPressed('A')) {
                this.messageSystem.hide();
                this.soundManager.playSE('cancel');
            }
            this.renderSystem.render();
            return;
        }

        // 2. メニュー処理
        const wasMenuVisible = this.menuSystem.isVisible;
        this.menuSystem.handleInput(this.inputManager, deltaTime);

        // メニューが開いている、または閉じた瞬間はゲームロジックを停止
        if (this.menuSystem.isVisible || wasMenuVisible) {
            this.renderSystem.render();
            return;
        }

        // 3. ゲームロジック
        this.updateSeparationMode(deltaTime);
        this.checkInteractions();
        this.updateEntities(deltaTime);

        // 4. カメラ & 描画関連
        this.updateCamera(deltaTime);
        this.renderSystem.updateLightPosition(this.player.position);

        this.players.forEach(p => p.updateBillboard(this.renderSystem.camera));
        this.npc.update(this.renderSystem.camera, deltaTime);
        this.mob.update(this.renderSystem.camera, deltaTime);
        // --- Switch Logic (Seesaw) ---
        // Red activation -> Blue Release
        if (this.switch.update(this.players, this.projectiles)) {
            // If Red gets pressed (from Up to Down)
            if (this.blueSwitch.isPressed) {
                this.blueSwitch.release(); // Blue goes Up

                // Update Colliders
                this.switchCollider.height = 0.2;
                this.switchCollider.isWall = false;

                this.blueSwitchCollider.height = 1.4;
                this.blueSwitchCollider.isWall = true;
            }
        }

        // Blue activation -> Red Release
        if (this.blueSwitch.update(this.players, this.projectiles)) {
            // If Blue gets pressed (from Up to Down)
            if (this.switch.isPressed) {
                this.switch.release(); // Red goes Up

                // Update Colliders
                this.blueSwitchCollider.height = 0.2;
                this.blueSwitchCollider.isWall = false;

                this.switchCollider.height = 1.4;
                this.switchCollider.isWall = true;
            }
        }

        this.debugSystem.update(this.player, this.inputManager);

        // 描画実行
        this.renderSystem.render();
    }

    /**
     * 入力更新処理
     */
    handleInput() {
        this.inputManager.update();
    }

    /**
     * 分離モードのロジック更新
     */
    updateSeparationMode(deltaTime) {
        // Rボタン長押しによる分離行動切り替え (Separate Action)
        const holdDuration = this.inputManager.getHoldDuration('Switch');

        if (holdDuration > 1000) { // 1.0秒長押し
            // 分離モードONにする処理（既に分離している場合は何もしない）
            if (!this.isSeparated) {
                if (this.separationTimer <= 0 && !this.separationModeSwitched) {
                    this.isSeparated = true;
                    this.separationTimer = 1.0; // クールダウン

                    const msg = "Separation Mode: ON";
                    console.log(msg);
                    this.soundManager.playSE('select');

                    this.separationModeSwitched = true; // 今回の長押しでの切り替え済みフラグをON

                    // 分離時は全キャラの速度をゼロリセット（歩きっぱなし防止）
                    this.players.forEach(p => p.velocity.set(0, 0, 0));
                }
            }
        }

        if (this.separationTimer > 0) {
            this.separationTimer -= deltaTime;
        }

        // 分離モードOFFにする処理（接触判定）
        if (this.isSeparated) {
            const followerIndex = (this.activePlayerIndex + 1) % this.players.length;
            const follower = this.players[followerIndex];
            // 距離判定（接触）
            const distToFollower = this.player.position.distanceTo(follower.position);

            // 1.0m以内に接近したら合流
            if (distToFollower < 1.0 && this.separationTimer <= 0) {
                this.isSeparated = false;
                this.separationTimer = 1.0; // クールダウン（誤作動防止）

                const msg = "Separation Mode: OFF (Rejoined)";
                console.log(msg);
                this.soundManager.playSE('select');
            }
        }
    }

    /**
     * インタラクションとアクション判定
     */
    checkInteractions() {
        // 主人公切り替え (長押し成立時はconsumeされている... ではなくフラグで制御)
        if (this.inputManager.isJustReleased('Switch')) {
            // 長押しによるモード切替が行われた直後のリリースなら、切り替え処理を行わない
            if (!this.separationModeSwitched) {
                this.switchPlayer();
            }
            // リリースされたのでフラグをリセット
            this.separationModeSwitched = false;
        }

        // 看板とのインタラクション判定
        const dist = this.player.position.distanceTo(this.npc.mesh.position);
        if (dist < 3.0 && this.inputManager.isJustPressed('A')) {
            // 正面判定
            const npcPos = this.npc.mesh.position;
            const playerPos = this.player.position;
            // NPCの向き(0,0,1)に対して、プレイヤーがどちらにいるか
            // ここでは簡易的に「プレイヤーが看板の正面(Z軸プラス方向)にいるか」ではなく
            // 「プレイヤーから見て看板が正面にあるか」の判定を行うべきだが、
            // 元のロジックは dot(forward, toPlayer) > 0.5 なので
            // 「看板の前方ベクトル」と「看板からプレイヤーへのベクトル」の内積。
            // つまり「看板の前にプレイヤーがいる（後ろではない）」ことを判定している。

            const forward = new THREE.Vector3(0, 0, 1);
            const toPlayer = playerPos.clone().sub(npcPos).normalize();
            const dot = forward.dot(toPlayer);

            if (dot > 0.5) {
                this.messageSystem.show("こんにちは");
                this.soundManager.playSE('select');
                this.inputManager.consumeAction('A'); // ジャンプ暴発防止
            }
        }

        // Mobとのインタラクション判定
        this.mob.checkInteraction(this.player, this.inputManager, this.messageSystem, this.soundManager, this.isSeparated, this.activePlayerIndex);
    }

    /**
     * キャラクターの更新
     */
    updateEntities(deltaTime) {
        // プレイヤー更新（リーダーは入力あり、フォロワーは自動追従）
        this.players.forEach((p, index) => {
            if (index === this.activePlayerIndex) {
                p.update(deltaTime, this.renderSystem.camera, true);
            } else {
                if (!this.isSeparated) {
                    p.follow(this.player, deltaTime);
                }
                // 分離時は追従せず、物理演算のみ更新 (待機ポーズ)
                p.update(deltaTime, this.renderSystem.camera, false);
            }
        });

        // プロジェクタイル更新
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(deltaTime, this.renderSystem.camera);
            if (!p.isActive) {
                // Remove if needed (or if simple removal logic is in update, just splice)
                // Arrow marks itself inactive on hit.
                // We should splice it out if it is done.
                // For now, let's keep it until it disposes itself? 
                // Arrow.js disposes mesh in dispose().
                if (!p.mesh.parent) { // If removed from scene
                    this.projectiles.splice(i, 1);
                }
                // Or we can verify logic:
                // Arrow.js sets isActive=false on hit.
                // We can keep it for a while? Arrow.js removes mesh after 3s.
                // So we check if mesh is still in scene?
            }
        }
    }

    /**
     * プレイヤー切り替え処理
     */
    switchPlayer() {
        // 切り替え前のプレイヤーの動きを止める
        this.player.velocity.set(0, 0, 0);

        this.activePlayerIndex = (this.activePlayerIndex + 1) % this.players.length;
        this.player = this.players[this.activePlayerIndex];
        this.soundManager.playSE('select');
        this.cameraTransitionTimer = 0.5; // カメラ補間時間をセット
        console.log(`[Game] Switched to Player ${this.activePlayerIndex + 1}`);

        // 切り替え後のプレイヤーの動きも念のため止める（入力が入れば即座に上書きされるので問題ない）
        this.player.velocity.set(0, 0, 0);
    }

    /**
     * カメラ更新処理
     */
    updateCamera(deltaTime) {
        // 遷移タイマー更新
        if (this.cameraTransitionTimer > 0) {
            this.cameraTransitionTimer -= deltaTime;
            if (this.cameraTransitionTimer < 0) this.cameraTransitionTimer = 0;
        }

        // 基本オフセット
        const offset = new THREE.Vector3(0, 12, 30);

        // 目標座標（水平位置はプレイヤーに追従）
        const targetX = this.player.position.x + offset.x;
        const targetZ = this.player.position.z + offset.z;

        // 目標高さ（プレイヤーの足場の高さを基準にする）
        let groundHeight = this.player.currentGroundHeight;
        if (groundHeight === undefined) {
            groundHeight = this.world.getGroundHeight(this.player.position.x, this.player.position.z);
        }
        const targetY = groundHeight + offset.y;

        // Y軸のスムージング（階段などでガクつかないように）
        const currentY = this.renderSystem.camera.position.y;
        const lerpFactorY = 1.0 - Math.exp(-5.0 * deltaTime);
        const smoothedY = THREE.MathUtils.lerp(currentY, targetY, lerpFactorY);

        // カメラ位置の適用
        if (this.cameraTransitionTimer > 0) {
            // キャラクター切り替え時はX/Z軸もスムーズに補間
            const currentX = this.renderSystem.camera.position.x;
            const currentZ = this.renderSystem.camera.position.z;
            const lerpFactorXZ = 1.0 - Math.exp(-15.0 * deltaTime);

            const smoothedX = THREE.MathUtils.lerp(currentX, targetX, lerpFactorXZ);
            const smoothedZ = THREE.MathUtils.lerp(currentZ, targetZ, lerpFactorXZ);

            this.renderSystem.camera.position.set(smoothedX, smoothedY, smoothedZ);
        } else {
            // 通常時はX/Zは即時追従（遅延なし）
            this.renderSystem.camera.position.set(targetX, smoothedY, targetZ);
        }

        // ライト位置の更新（影追従）
        this.renderSystem.updateLightPosition(this.player.position);
    }

    spawnArrow(pos, vel, tex) {
        const arrow = new Arrow(this.renderSystem.scene, this.world, pos, vel, tex);
        // Apply initial rotation immediately
        if (this.renderSystem.camera) {
            arrow.updateRotation(this.renderSystem.camera);
        }
        this.projectiles.push(arrow);
    }
}

// エントリーポイント
window.onload = () => {
    try {
        const game = new Game();
        window.game = game; // Expose for debugging
        game.start();
    } catch (e) {
        console.error("Critical Game Error:", e);
        document.body.innerHTML += `<div style="position:fixed;top:0;left:0;background:red;color:white;padding:20px;z-index:9999;">Error: ${e.message}<br><pre>${e.stack}</pre></div>`;
    }
};

window.onerror = function (msg, url, line, col, error) {
    document.body.innerHTML += `<div style="position:fixed;bottom:0;left:0;background:darkred;color:white;padding:10px;z-index:9999;">Global Error: ${msg} <br> ${url}:${line}:${col}</div>`;
    return false;
};
