import './style.css'; // グローバルスタイルの読み込み
import { RenderSystem } from './systems/RenderSystem.js';
import { InputManager } from './systems/InputManager.js';
import { SoundManager } from './systems/SoundManager.js';
import { AssetManager } from './systems/AssetManager.js';
import { DebugSystem } from './systems/DebugSystem.js';
import { MenuSystem } from './systems/MenuSystem.js';
import { TitleSystem } from './systems/TitleSystem.js';
import { World } from './world/World.js';
import { Player } from './entities/Player.js';
import { NPC } from './entities/NPC.js';
import * as THREE from 'three';

/**
 * ゲーム本体クラス
 * システムの初期化、メインループの管理を行う
 */
class Game {
    constructor() {
        // --- システム初期化 ---
        this.renderSystem = new RenderSystem();
        this.inputManager = new InputManager();
        this.soundManager = new SoundManager();
        this.assetManager = new AssetManager();
        this.debugSystem = new DebugSystem();
        this.debugSystem = new DebugSystem();
        this.menuSystem = new MenuSystem(this.soundManager, this.renderSystem, this.inputManager, this); // added 'this' for callback access

        // --- Game State ---
        this.gameState = 'TITLE'; // Initial state

        this.titleSystem = new TitleSystem(() => {
            this.startGame();
        });
        this.titleSystem.show();

        // テクスチャ設定をアセットマネージャーに共有
        this.assetManager.setMaxAnisotropy(this.renderSystem.getMaxAnisotropy());

        // ワールド生成
        this.world = new World(this.renderSystem.scene);

        // --- キャラクター生成（ダブル主人公） ---
        const p1 = new Player(this.renderSystem.scene, this.inputManager, this.world, this.assetManager, this.soundManager, './assets/player_stand.png', './assets/player_jump.png', ['./assets/player_walk1.png', './assets/player_walk2.png']);
        const p2 = new Player(this.renderSystem.scene, this.inputManager, this.world, this.assetManager, this.soundManager, './assets/player2_stand.png', './assets/player2_jump.png', ['./assets/player2_walk1.png', './assets/player2_walk2.png']);

        // P2が重ならないように少しずらす
        p2.container.position.x = -2.0;

        this.players = [p1, p2];
        this.activePlayerIndex = 0;
        this.player = this.players[0]; // 現在の操作キャラクター

        // --- カメラ初期設定 ---
        const offset = new THREE.Vector3(0, 12, 30);
        const targetPos = this.player.position.clone().add(offset);
        this.renderSystem.camera.position.copy(targetPos);

        // プレイヤーが画面下方（約80%の位置）に来るように視点を調整
        const lookOffset = new THREE.Vector3(0, 0, -25);
        const lookTarget = this.player.position.clone().add(lookOffset);
        this.renderSystem.camera.lookAt(lookTarget);

        // NPC配置
        this.npc = new NPC(this.renderSystem.scene, new THREE.Vector3(15, 2.25, 15), 0x0000ff);

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
        console.log("[Game] Started (In Title)");

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
        this.inputManager.update();

        // 2. メニュー処理
        // タイトル画面の処理
        if (this.gameState === 'TITLE') {
            this.titleSystem.handleInput(this.inputManager);
            this.renderSystem.render(); // Render scene as background? Or just title overlay?
            // If we want title image only, existing render might show game world behind.
            // TitleSystem overlay covers it, so it's fine.
            return;
        }

        const wasMenuVisible = this.menuSystem.isVisible;
        this.menuSystem.handleInput(this.inputManager, deltaTime);

        // メニューが開いている、または閉じた瞬間はゲームロジックを停止
        if (this.menuSystem.isVisible || wasMenuVisible) {
            this.renderSystem.render();
            return;
        }

        // 3. ゲームロジック

        // 主人公切り替え
        if (this.inputManager.isJustPressed('Switch')) {
            this.switchPlayer();
        }

        // プレイヤー更新（リーダーは入力あり、フォロワーは自動追従）
        this.players.forEach((p, index) => {
            if (index === this.activePlayerIndex) {
                p.update(deltaTime, this.renderSystem.camera, true);
            } else {
                p.follow(this.player, deltaTime);
                p.update(deltaTime, this.renderSystem.camera, false);
            }
        });

        // カメラ更新（プレイヤー移動後に行う）
        this.updateCamera(deltaTime);

        // ライト位置更新（影追従）
        this.renderSystem.updateLightPosition(this.player.position);

        // ビルボード角度更新（カメラ移動後に行う）
        this.players.forEach(p => p.updateBillboard(this.renderSystem.camera));
        this.npc.update(this.renderSystem.camera);

        // デバッグ表示更新
        this.debugSystem.update(this.player, this.inputManager);

        // 4. 描画
        this.renderSystem.render();
    }

    /**
     * プレイヤー切り替え処理
     */
    switchPlayer() {
        this.activePlayerIndex = (this.activePlayerIndex + 1) % this.players.length;
        this.player = this.players[this.activePlayerIndex];
        this.soundManager.playSE('select');
        this.cameraTransitionTimer = 0.5; // カメラ補間時間をセット
        console.log(`[Game] Switched to Player ${this.activePlayerIndex + 1}`);
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

    startGame() {
        this.gameState = 'GAME';
        this.titleSystem.hide();
        this.soundManager.playSE('select'); // Start sound
        this.soundManager.resumeContext();
        // Reset or Setup initial state if needed
    }

    returnToTitle() {
        this.gameState = 'TITLE';
        this.menuSystem.isVisible = false; // Close menu if open
        this.menuSystem.container.style.display = 'none';

        this.titleSystem.show();

        // Reset Player Position to Spawn Point (approx)
        this.player.position.set(0, 0, 0); // Default spawn? Or initial player pos
        // Re-sync camera
        const offset = new THREE.Vector3(0, 12, 30);
        const targetPos = this.player.position.clone().add(offset);
        this.renderSystem.camera.position.copy(targetPos);
        const lookOffset = new THREE.Vector3(0, 0, -25);
        this.renderSystem.camera.lookAt(this.player.position.clone().add(lookOffset));
    }
}

// エントリーポイント
window.onload = () => {
    try {
        const game = new Game();
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
