
import * as THREE from 'three';

/**
 * Arrow Class
 * Represents an arrow fired by Reiko.
 * Handles parabolic flight (yamunari) and ground collision.
 */
export class Arrow {
    constructor(scene, world, position, velocity, texture) {
        this.scene = scene;
        this.world = world;
        this.velocity = velocity.clone();
        this.isActive = true;
        this.gravity = 9.8; // Gravity for arrow flight

        // Setup Mesh
        // Use a simple plane for the sprite
        const geometry = new THREE.PlaneGeometry(0.8, 0.8);
        const material = new THREE.MeshStandardMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);

        // Initial orientation
        this.updateRotation();

        this.scene.add(this.mesh);
    }

    update(dt, camera) {
        if (!this.isActive) return;

        // Apply Gravity
        // Yamunari = Parabola. Needs gravity.
        this.velocity.y -= this.gravity * dt * 3.0; // Tuned multiplier for better game feel

        // Flight Lifetime Limit
        this.flightTime = (this.flightTime || 0) + dt;
        if (this.flightTime > 3.0) {
            this.isActive = false;
            this.dispose();
            return;
        }

        // Move
        const moveStep = this.velocity.clone().multiplyScalar(dt);
        this.mesh.position.add(moveStep);

        // Rotate to face velocity direction
        this.updateRotation(camera);

        // Check Ground Collision
        const groundHeight = this.world.getGroundHeight(this.mesh.position.x, this.mesh.position.z);
        if (this.mesh.position.y <= groundHeight) {
            this.mesh.position.y = groundHeight;
            this.isActive = false;

            // "Stick" in the ground
            // Optionally change angle to look like it's stuck?
            // For now, just stop updating.

            // Despawn after a few seconds
            setTimeout(() => {
                this.dispose();
            }, 3000);
        }
    }

    updateRotation(camera) {
        if (!camera) return;

        // Billboard: Face the camera
        this.mesh.quaternion.copy(camera.quaternion);

        // Calculate angle of flight in vertical plane (approximate for 2D look)
        // Assume Side-Scrolling view dominance
        const vx = this.velocity.x;
        const vy = this.velocity.y;

        // Calculate angle (Simple atan2 of Y speed vs Horizontal speed)
        // Adjust for direction
        const hSpeed = Math.hypot(this.velocity.x, this.velocity.z);
        const angle = Math.atan2(vy, hSpeed);

        // Apply rotation
        // If moving Right (vx > 0), rotate Z by angle.
        // If moving Left (vx < 0), flip mesh and rotate.

        if (vx >= 0) {
            this.mesh.scale.x = 1;
            this.mesh.rotation.z = angle;
        } else {
            this.mesh.scale.x = -1;
            // Mirror angle for left side
            this.mesh.rotation.z = -angle;
        }
    }

    dispose() {
        if (this.mesh.parent) {
            this.mesh.parent.remove(this.mesh);
        }
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}
