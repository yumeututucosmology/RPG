import * as THREE from 'three';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.colliders = []; // Array of { box: Box3, y: number }
        this.generate();
    }

    generate() {
        // Floor
        const floorGeo = new THREE.PlaneGeometry(150, 150);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // SaddleBrown
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Floor Collider (Ground level 0)
        // Check roughly -75 to 75
        this.colliders.push({
            minX: -75, maxX: 75,
            minZ: -75, maxZ: 75,
            height: 0
        });

        // Grid Helper
        const grid = new THREE.GridHelper(150, 150);
        this.scene.add(grid);

        // --- Mountain Generation ---
        const mountainZ = -30;
        const xOffset = -45; // Shift left to fit on board (-15 * 3)

        // Removed Summit (Merged into stairs)

        // 1. Steep Stairs (Left Side / West)
        // Climb from Left (-X) towards Peak.
        // Meets Right Stairs at X = -3 boundary.
        // Top step (Index 4, Height 12.0) at X = -6.
        for (let i = 1; i <= 4; i++) {
            const h = i * 3.0; // 1.0 * 3
            const stepGeo = new THREE.BoxGeometry(6, h, 12); // Width 2*3, Depth 4*3
            const stepMat = new THREE.MeshStandardMaterial({ color: 0xA0522D });
            const step = new THREE.Mesh(stepGeo, stepMat);

            // i=4 (Top) -> X_local = -6. 
            // i=1 (Bottom) -> X_local = -6 - (3*6) = -24.
            const xPos = (-6 - ((4 - i) * 6)) + xOffset;

            step.position.set(xPos, h / 2, mountainZ);
            step.castShadow = true;
            step.receiveShadow = true;
            this.scene.add(step);

            this.colliders.push({
                minX: xPos - 3, maxX: xPos + 3, // Width 6 -> Radius 3
                minZ: mountainZ - 6, maxZ: mountainZ + 6, // Depth 12 -> Radius 6
                height: h
            });
        }

        // 2. Shallow Stairs (Right Side / East)
        // Climb from Right (+X) towards Peak.
        // Forms the Peak at X = 0 (Height 15.0).
        // 20 steps. 0.75 to 15.0.
        for (let i = 1; i <= 20; i++) {
            const h = i * 0.75; // 0.25 * 3
            const stepGeo = new THREE.BoxGeometry(6, h, 12); // Width 6, Depth 12
            const stepMat = new THREE.MeshStandardMaterial({ color: 0xCD853F }); // Peru
            const step = new THREE.Mesh(stepGeo, stepMat);

            // i=20 (Top, Peak) -> X_local = 0.
            // i=1 (Bottom) -> X_local = 0 + (19*6) = 114.
            const xPos = (0 + ((20 - i) * 6)) + xOffset;

            step.position.set(xPos, h / 2, mountainZ);
            step.castShadow = true;
            step.receiveShadow = true;
            this.scene.add(step);

            this.colliders.push({
                minX: xPos - 3, maxX: xPos + 3,
                minZ: mountainZ - 6, maxZ: mountainZ + 6,
                height: h
            });
        }
    }

    getGroundHeight(x, z) {
        // Find highest ground below (or at) this position
        let highestY = -Infinity;

        for (const c of this.colliders) {
            if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) {
                if (c.height > highestY) {
                    highestY = c.height;
                }
            }
        }

        return highestY === -Infinity ? -100 : highestY; // Return low value if void
    }

    /**
     * 動的に障害物を追加する
     * @param {number} x 中心X座標
     * @param {number} z 中心Z座標
     * @param {number} width 幅 (X軸)
     * @param {number} depth 奥行き (Z軸)
     * @param {number} height 高さ (Y軸)
     */
    getGroundInfo(x, z) {
        // Find highest ground and its properties
        let highestY = -Infinity;
        let isWall = false;

        for (const c of this.colliders) {
            if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) {
                if (c.height > highestY) {
                    highestY = c.height;
                    isWall = c.isWall || false;
                }
            }
        }

        return { height: highestY === -Infinity ? -100 : highestY, isWall };
    }

    /**
     * 動的に障害物を追加する
     * @param {number} x 中心X座標
     * @param {number} z 中心Z座標
     * @param {number} width 幅 (X軸)
     * @param {number} depth 奥行き (Z軸)
     * @param {number} height 高さ (Y軸)
     * @param {boolean} isWall 登り判定を無効にする「壁」かどうか
     */
    addObstacle(x, z, width, depth, height, isWall = false) {
        const collider = {
            minX: x - width / 2,
            maxX: x + width / 2,
            minZ: z - depth / 2,
            maxZ: z + depth / 2,
            height: height,
            isWall: isWall
        };
        this.colliders.push(collider);
        return collider;
    }
}
