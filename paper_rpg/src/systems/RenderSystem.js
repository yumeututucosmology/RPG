import * as THREE from 'three';

export class RenderSystem {
    constructor() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        // Renderer Setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(this.width, this.height);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Append to DOM (usually handled by game, but good default)
        document.body.appendChild(this.renderer.domElement);

        // Camera Setup
        // Camera Setup
        this.camera = new THREE.PerspectiveCamera(30, this.width / this.height, 0.1, 1000);
        this.camera.position.set(0, 7, 20);

        // Scene Setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky Blue

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(5, 10, 7.5);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        this.scene.add(dirLight);

        // Resize Handler
        window.addEventListener('resize', () => this.onResize());
    }

    onResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
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
}
