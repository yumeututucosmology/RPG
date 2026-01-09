import * as THREE from 'three';

export class NPC {
    constructor(scene, position = new THREE.Vector3(0, 2.25, 0), color = 0x00ff00) {
        this.scene = scene;
        const geometry = new THREE.PlaneGeometry(3, 4.5);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            side: THREE.DoubleSide
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.scene.add(this.mesh);
    }

    update(camera) {
        if (camera) {
            this.mesh.quaternion.copy(camera.quaternion);
        }
    }
}
