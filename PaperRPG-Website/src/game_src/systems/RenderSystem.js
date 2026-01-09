import * as THREE from 'three';

export class RenderSystem {
    constructor() {
        // Initial sizing based on 16:9
        this.calculateLayout();

        // Graphics Settings
        this.resolutionMode = 'native'; // native, fhd, hd, sd
        this.shadowsEnabled = true;

        // Renderer Setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        // Initial Pixel Ratio Set
        this.updatePixelRatio();

        this.renderer.setSize(this.width, this.height);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.shadowMap.enabled = this.shadowsEnabled;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Append to DOM (usually handled by game, but good default)
        document.body.appendChild(this.renderer.domElement);

        // Camera Setup
        this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 1000);
        this.camera.position.set(0, 7, 20);

        // Scene Setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky Blue

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        this.dirLight = new THREE.DirectionalLight(0xffffff, 1);
        this.dirLight.position.set(5, 10, 7.5);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 2048;
        this.dirLight.shadow.mapSize.height = 2048;

        // 影の描画範囲を広げる
        const d = 50;
        this.dirLight.shadow.camera.left = -d;
        this.dirLight.shadow.camera.right = d;
        this.dirLight.shadow.camera.top = d;
        this.dirLight.shadow.camera.bottom = -d;
        this.dirLight.shadow.bias = -0.0005;

        this.scene.add(this.dirLight);
        this.scene.add(this.dirLight.target); // ターゲットもシーンに追加して動的な更新を可能にする

        // Resize Handler
        window.addEventListener('resize', () => this.onResize());
    }

    calculateLayout() {
        const aspect = 16 / 9;
        const windowAspect = window.innerWidth / window.innerHeight;

        if (windowAspect > aspect) {
            // Window is wider than 16:9 (Pillarbox)
            this.height = window.innerHeight;
            this.width = this.height * aspect;
        } else {
            // Window is taller than 16:9 (Letterbox)
            this.width = window.innerWidth;
            this.height = this.width / aspect;
        }
    }

    onResize() {
        this.calculateLayout();

        this.camera.aspect = 16 / 9;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);

        // Re-apply resolution scale as window size changed
        this.updatePixelRatio();
    }

    setResolutionMode(mode) {
        this.resolutionMode = mode;
        this.updatePixelRatio();
        console.log(`Resolution Mode set to: ${mode}`);
    }

    updatePixelRatio() {
        let pixelRatio = window.devicePixelRatio;

        if (this.resolutionMode === 'native') {
            pixelRatio = window.devicePixelRatio;
        } else {
            let targetHeight = 1080;
            if (this.resolutionMode === 'fhd') targetHeight = 1080;
            if (this.resolutionMode === 'hd') targetHeight = 720;
            if (this.resolutionMode === 'sd') targetHeight = 480;

            // Calculate ratio to achieve target height based on current window height
            // Ratio = Target / Window. 
            // Also need to cap at devicePixelRatio to avoid upscaling artifacts/cost? 
            // Usually we want to downscale. 
            // If Window is 2160p and Target is 1080p, Ratio is 0.5.
            pixelRatio = targetHeight / this.height;

            // Optional: Clamp to devicePixelRatio if we don't want to upscale 
            // (e.g. window is small but we ask for FHD) -> upscaling is generally fine but might be blurry.
            // Let's allow whatever checks out.
        }

        this.renderer.setPixelRatio(pixelRatio);
    }

    setShadowsEnabled(enabled) {
        this.shadowsEnabled = enabled;
        this.renderer.shadowMap.enabled = enabled;
        // Need to update materials or clear cache usually? 
        // For Three.js, shadowing often needs scene traversal to update 'castShadow'/'receiveShadow' 
        // OR just renderer setting might work if materials update.
        // Usually renderer.shadowMap.enabled needs to be set before compilation, 
        // but toggling at runtime might require traversing materials needsUpdate = true.

        this.dirLight.castShadow = enabled;

        this.scene.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.needsUpdate = true;
            }
        });

        console.log(`Shadows set to: ${enabled}`);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    getDomElement() {
        return this.renderer.domElement;
    }

    getMaxAnisotropy() {
        return this.renderer.capabilities.getMaxAnisotropy();
    }

    /**
     * ライト位置を更新（影の追従用）
     * @param {THREE.Vector3} targetPos 
     */
    updateLightPosition(targetPos) {
        if (!this.dirLight) return;

        const offset = new THREE.Vector3(5, 10, 7.5); // オフセットは初期位置と同じ
        this.dirLight.position.copy(targetPos).add(offset);
        this.dirLight.target.position.copy(targetPos);
    }
}
