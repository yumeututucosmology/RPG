import * as THREE from 'three';

export class AssetManager {
    constructor() {
        this.textureLoader = new THREE.TextureLoader();
        this.maxAnisotropy = 1; // Default, should be updated from RenderSystem
    }

    setMaxAnisotropy(value) {
        this.maxAnisotropy = value;
    }

    loadTexture(path) {
        return new Promise((resolve, reject) => {
            this.textureLoader.load(
                path,
                (texture) => {
                    this._configureTexture(texture);
                    resolve(texture);
                },
                undefined,
                (err) => {
                    console.error(`Failed to load texture: ${path}`, err);
                    reject(err);
                }
            );
        });
    }

    _configureTexture(texture) {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = this.maxAnisotropy;
        texture.generateMipmaps = true;
    }

    loadJSON(path) {
        return fetch(path)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .catch(e => {
                console.error(`Failed to load JSON: ${path}`, e);
                throw e;
            });
    }
}
