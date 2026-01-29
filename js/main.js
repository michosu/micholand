import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Octree } from 'three/addons/math/Octree.js';
import { Capsule } from 'three/addons/math/Capsule.js';
import { createSkyScene, transitionToSky, transitionToGround, updateSky, handleSkyClose, isSkyActive, isSkyTransitioning, SKY_CONFIG } from './skyScene.js';

// ==========================================
// CONFIGURATION
// ==========================================
const CONFIG = {
    // Scene files
    files: {
        scene: 'assets/models/scene.glb',
        collisions: 'assets/models/collisions.glb',
        character: 'assets/models/character.glb',
        zones: 'assets/models/zones.glb',  // Blender boxes for project zones
        room: 'assets/models/room.glb'
    },

    // Camera settings
    camera: {
        fov: 30,
        fovMin: 20,          // NEW
        fovMax: 40,          // NEW
        fovSmoothIn: 0.01,   // Slow ease when speeding up
        fovSmoothOut: 0.3,   // Fast ease when slowing down
        speedSmoothing: 0.01,
        fovRoomTransition: 0.08,    // NEW - Room enter/exit
        fovIslandTransition: 0.05,   // NEW - Island open/close
        startX: 0,
        startY: 3,
        startZ: 25,
        followSmooth: 0.03,


        // Island viewing
        islandY: -3,
        islandZ: 15,
        islandSmooth: 0.05,

        manualRoomCamera: {
            x: -50,
            y: 3.5,
            z: 25,
            rotX: 0,    // degrees
            rotY: 0,    // degrees
            rotZ: 0     // degrees
        },
        roomTransitionSpeed: 0.05
    },

    // Character physics
    character: {
        startX: 0,
        moveSpeed: 0.5,          // Base acceleration
        maxSpeed: 18,            // Top speed
        friction: 0.95,          // Ground deceleration
        airFriction: 0.98,       // Air deceleration (less friction)
        airControl: 0.5,         // Air acceleration multiplier
        turnSpeed: 0.65,         // Turn-around deceleration
        jumpForce: 20,
        gravity: 50,
        tiltAmount: 0.15,  // NEW - max tilt angle
    },

    // Scene
    scene: {
        backgroundColor: 0x363636,
        fogColor: 0xa6b4c9,
        fogNear: 10,
        fogFar: 100
    },

    // Island/Project data - positions loaded from zones.glb
    // Just define metadata here
    islands: [
        {
            name: 'Island 1',
            subtitle: 'Project description',
            youtubeId: 'dQw4w9WgXcQ',
            color: 0xff6b6b
        },
        {
            name: 'Island 2',
            subtitle: 'Project description',
            youtubeId: 'dQw4w9WgXcQ',
            color: 0x4ecdc4
        },
        {
            name: 'Island 3',
            subtitle: 'Project description',
            youtubeId: 'dQw4w9WgXcQ',
            color: 0xffe66d
        },
        {
            name: 'Island 4',
            subtitle: 'Project description',
            youtubeId: 'dQw4w9WgXcQ',
            color: 0xa8e6cf
        },
        {
            name: 'Island 5',
            subtitle: 'Project description',
            youtubeId: 'dQw4w9WgXcQ',
            color: 0xff9ff3
        }
    ]
};

// ==========================================
// SCENE SETUP
// ==========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.scene.backgroundColor);
scene.fog = new THREE.Fog(CONFIG.scene.fogColor, CONFIG.scene.fogNear, CONFIG.scene.fogFar);

const camera = new THREE.PerspectiveCamera(
    CONFIG.camera.fov,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(CONFIG.camera.startX, CONFIG.camera.startY, CONFIG.camera.startZ);

const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('canvas'),
    antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Cap at 1.5

// ==========================================
// LIGHTING
// ==========================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x666666, 0.55);
scene.add(hemiLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 1.15);
mainLight.position.set(12, 24, 14);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 1024;
mainLight.shadow.mapSize.height = 1024;
mainLight.shadow.bias = -0.0002;
mainLight.shadow.normalBias = 0.02;
// Widen the shadow camera to better match the side-on POV.
mainLight.shadow.camera.near = 1;
mainLight.shadow.camera.far = 120;
mainLight.shadow.camera.left = -60;
mainLight.shadow.camera.right = 60;
mainLight.shadow.camera.top = 40;
mainLight.shadow.camera.bottom = -40;
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
fillLight.position.set(-10, 15, -10);
scene.add(fillLight);

// Front fill from the camera side to help gold text read clearly.
const frontFillLight = new THREE.DirectionalLight(0xfff2cc, 0.7);
frontFillLight.position.set(0, 12, 28);
scene.add(frontFillLight);

createSkyScene(scene); // NEW - initialize sky scene

// ==========================================
// PHYSICS SYSTEM
// ==========================================
const worldOctree = new Octree();
const clock = new THREE.Clock();

// Character state
const character = {
    group: new THREE.Group(),
    tiltGroup: null,
    model: null,
    mixer: null,
    x: CONFIG.character.startX,
    y: 0,
    velocityX: 0,
    velocityY: 0,
    isGrounded: false,
    groundedFrames: 0,  // For ground grace system
    groundNormal: new THREE.Vector3(0, 1, 0),
    hasGroundNormal: false,
    autoWalking: false,
    autoWalkTarget: 0
};
scene.add(character.group);

function freezeCharacterForSky() {
    character.velocityX = 0;
    character.velocityY = 0;
    character.autoWalking = false;
    keys.clear();
}

// Blob shadow: a classic always-visible undershadow under the character.
function createBlobShadowTexture(size = 128) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const r = size / 2;
    const gradient = ctx.createRadialGradient(r, r, r * 0.1, r, r, r);
    gradient.addColorStop(0, 'rgba(0,0,0,0.45)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

const blobShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 1.1),
    new THREE.MeshBasicMaterial({
        map: createBlobShadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0.35
    })
);
blobShadow.rotation.x = -Math.PI / 2;
blobShadow.position.set(0, 0.02, 0);
blobShadow.renderOrder = 1;
blobShadow.frustumCulled = false;
blobShadow.visible = true;
scene.add(blobShadow);

function updateBlobShadow() {
    // Raycast to the collision octree so the shadow sits on the ground below.
    const origin = characterCollider.end.clone();
    origin.y += 0.5;
    const down = new THREE.Vector3(0, -1, 0);
    const ray = new THREE.Ray(origin, down);
    const hit = worldOctree.rayIntersect(ray);

    const maxShadowDistance = 3.0;
    let distance = maxShadowDistance;
    let groundY = character.y - 1.35;

    if (hit) {
        distance = Math.min(hit.distance, maxShadowDistance);
        groundY = hit.position.y;
    }

    // Position on the ground (world-space).
    blobShadow.position.set(character.x, groundY + 0.02, 0);

    // Fade/scale based on height above ground.
    const t = THREE.MathUtils.clamp(distance / maxShadowDistance, 0, 1);
    const targetOpacity = (1 - t) * 0.45;
    blobShadow.material.opacity += (targetOpacity - blobShadow.material.opacity) * 0.2;

    const targetScale = THREE.MathUtils.lerp(1.15, 0.65, t);
    const s = blobShadow.scale.x + (targetScale - blobShadow.scale.x) * 0.2;
    blobShadow.scale.set(s, s, s);
}

// Capsule collider
const characterCollider = new Capsule(
    new THREE.Vector3(CONFIG.character.startX, 0.35, 0),
    new THREE.Vector3(CONFIG.character.startX, 1.35, 0),
    0.35
);

// Input
const keys = new Set();

document.addEventListener('keydown', (e) => {
    // DEV SHORTCUTS (remove before deploy)
    if (e.key === '1') {
        console.log('🌍 Switching to Ground');
        transitionToGround(camera, scene, roomState.worldScene, character, cameraState, CONFIG);
        return;
    }
    if (e.key === '2') {
        console.log('☁️ Switching to Sky');
        freezeCharacterForSky();
        transitionToSky(camera, scene, roomState.worldScene, roomState.roomScene, character, cameraState);
        return;
    }

    if (isSkyActive()) {
        return;
    }
    if (currentIsland) {
        if (e.key === 'Escape') closeIsland();
        return;
    }

    // Movement keys
    if (['ArrowLeft', 'ArrowRight', ' ', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        keys.add(e.key);

        if (e.key === 'ArrowUp' && nearestIsland && canInteract) {
            character.autoWalking = true;
            character.autoWalkTarget = nearestIsland.x;
        }
    }

});

document.addEventListener('keyup', (e) => {
    keys.delete(e.key);
});

// ==========================================
// PHYSICS UPDATE
// ==========================================
function updatePhysics(deltaTime) {
    // Constants
    const MAX_SLOPE_COS = Math.cos(THREE.MathUtils.degToRad(50));
    const GROUND_GRACE_FRAMES = 3;
    const GROUND_STICK_FORCE = 8;
    const GROUND_SNAP_DISTANCE = 0.35;
    const SURFACE_FOLLOW_DISTANCE = 0.8;
    const SURFACE_OFFSET = 0.02;
    const SLOPE_ACCEL_MULT = 1.6;
    const STEPS = 3;
    const stepDelta = deltaTime / STEPS;

    for (let i = 0; i < STEPS; i++) {
        // 1. Apply gravity
        character.velocityY -= CONFIG.character.gravity * stepDelta;

        // 2. Move capsule
        const deltaPos = new THREE.Vector3(
            character.velocityX * stepDelta,
            character.velocityY * stepDelta,
            0
        );
        characterCollider.translate(deltaPos);

        // 3. Check collision
        const result = worldOctree.capsuleIntersect(characterCollider);

        if (result) {
            // Push out
            characterCollider.translate(result.normal.clone().multiplyScalar(result.depth));

            const isGround = result.normal.y >= MAX_SLOPE_COS;
            const movingUp = character.velocityY > 0;

            if (isGround) {
                // GROUND COLLISION
                character.isGrounded = true;
                character.groundedFrames = GROUND_GRACE_FRAMES;
                character.groundNormal.copy(result.normal);
                character.hasGroundNormal = true;

                // Project velocity along slope
                const velocity = new THREE.Vector3(
                    character.velocityX,
                    character.velocityY,
                    0
                );
                const normalComponent = result.normal.clone().multiplyScalar(velocity.dot(result.normal));
                velocity.sub(normalComponent);

                character.velocityX = velocity.x;
                character.velocityY = velocity.y;

                // Stop falling
                if (character.velocityY < 0) {
                    character.velocityY = 0;
                }

            } else if (movingUp && result.normal.y < -0.5) {
                // CEILING COLLISION
                character.isGrounded = false;
                character.velocityY = 0;
                character.hasGroundNormal = false;

            } else {
                // WALL COLLISION
                character.groundedFrames--;
                character.isGrounded = character.groundedFrames > 0;
            }

        } else {
            // No collision - grace period
            character.groundedFrames--;
            character.isGrounded = character.groundedFrames > 0;
        }

        // 4. Ground sticking (prevents bounce on slopes)
        if (character.isGrounded) {
            character.velocityY -= GROUND_STICK_FORCE * stepDelta;
        }

        // 5. Ground snap (sticks to segmented slopes)
        if (!character.isGrounded) {
            const down = new THREE.Vector3(0, -1, 0);
            const ray = new THREE.Ray(characterCollider.end.clone(), down);
            const hit = worldOctree.rayIntersect(ray);

            if (hit && hit.distance <= GROUND_SNAP_DISTANCE) {
                characterCollider.translate(down.multiplyScalar(hit.distance));
                character.isGrounded = true;
                character.groundedFrames = GROUND_GRACE_FRAMES;
                character.velocityY = 0;
                if (hit.normal) {
                    character.groundNormal.copy(hit.normal);
                    character.hasGroundNormal = true;
                }
            }
        }

        // 6. Surface follow: glue to the ground under us even when not intersecting.
        {
            const down = new THREE.Vector3(0, -1, 0);
            const rayOrigin = characterCollider.start.clone();
            rayOrigin.y += 0.5;
            const ray = new THREE.Ray(rayOrigin, down);
            const hit = worldOctree.rayIntersect(ray);

            if (hit && hit.distance <= SURFACE_FOLLOW_DISTANCE) {
                const currentBottom = characterCollider.start.y - characterCollider.radius;
                const desiredBottom = hit.position.y + SURFACE_OFFSET;
                const deltaY = desiredBottom - currentBottom;

                if (Math.abs(deltaY) > 1e-4) {
                    characterCollider.translate(new THREE.Vector3(0, deltaY, 0));
                }

                character.isGrounded = true;
                character.groundedFrames = GROUND_GRACE_FRAMES;

                if (hit.normal) {
                    character.groundNormal.copy(hit.normal);
                    character.hasGroundNormal = true;
                }
            }
        }

        if (!character.isGrounded) {
            character.hasGroundNormal = false;
        }

        // 7. When grounded, project velocity onto the surface tangent (Sonic-style glue).
        if (character.isGrounded && character.hasGroundNormal) {
            const n = character.groundNormal;
            // Preserve horizontal speed and derive vertical speed from the slope.
            // This avoids the "downhill slows X velocity" artifact from tangent projection.
            const minNy = 0.2;
            if (Math.abs(n.y) > minNy) {
                const slopeDyDx = -n.x / n.y;
                character.velocityY = character.velocityX * slopeDyDx;
            }
        }

        // 8. Safety clamps
        character.velocityY = Math.max(-50, Math.min(30, character.velocityY));
    }

    // 9. Sync visual
    const pos = characterCollider.end;
    character.x = pos.x;
    character.y = pos.y - 1.35;
    character.group.position.set(character.x, character.y, 0);
}

// ==========================================
// CHARACTER CONTROLLER
// ==========================================
function updateCharacter() {
    if (isSkyActive()) return;
    if (currentIsland) return;

    const ACCEL = CONFIG.character.moveSpeed;
    const MAX_SPEED = CONFIG.character.maxSpeed;
    const FRICTION = character.isGrounded ? CONFIG.character.friction : CONFIG.character.airFriction;
    const TURN_SPEED = CONFIG.character.turnSpeed;

    // Acceleration multiplier based on speed (Sonic-style)
    const speedRatioAccel = Math.abs(character.velocityX) / MAX_SPEED;
    const accelMultiplier = character.isGrounded ?
        1 + speedRatioAccel * 0.5 :  // Faster acceleration when already moving (ground)
        CONFIG.character.airControl;  // Reduced control in air

    if (character.autoWalking) {
        const dist = character.autoWalkTarget - character.x;
        if (Math.abs(dist) > 0.5) {
            character.velocityX = Math.sign(dist) * 8;
        } else {
            character.velocityX = 0;
            character.autoWalking = false;
            setTimeout(() => openIsland(nearestIsland), 200);
        }
    } else {
        const movingRight = keys.has('ArrowRight');
        const movingLeft = keys.has('ArrowLeft');

        if (movingRight) {
            // Check if turning around (moving left but want to go right)
            if (character.velocityX < 0) {
                character.velocityX *= TURN_SPEED;  // Quick turnaround
            }
            character.velocityX += ACCEL * accelMultiplier;
            if (character.tiltGroup) character.tiltGroup.scale.x = 1;

        } else if (movingLeft) {
            // Check if turning around (moving right but want to go left)
            if (character.velocityX > 0) {
                character.velocityX *= TURN_SPEED;  // Quick turnaround
            }
            character.velocityX -= ACCEL * accelMultiplier;
            if (character.tiltGroup) character.tiltGroup.scale.x = -1;

        } else {
            // No input - apply friction
            character.velocityX *= FRICTION;
        }

        // Clamp to max speed
        character.velocityX = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, character.velocityX));

        // Jump
        if (keys.has(' ') && character.isGrounded) {
            character.velocityY = CONFIG.character.jumpForce;
            character.hasGroundNormal = false;
        }
    }

    // Character tilt based on speed
    const speedRatio = Math.abs(character.velocityX) / CONFIG.character.maxSpeed;
    const tiltAmount = speedRatio * -0.3;  // Increase to 0.3 (more visible)
    const targetTilt = Math.sign(character.velocityX) * tiltAmount;

    // Smooth tilt transition
    if (character.tiltGroup) {
        character.tiltGroup.rotation.z += (targetTilt - character.tiltGroup.rotation.z) * 0.1;
        if (Math.random() < 0.01) {
            console.log('Tilt Group Z:', character.tiltGroup.rotation.z.toFixed(3));
        }
    } else {
        console.log('NO TILT GROUP!');
    }
} // <-- Add this closing brace for updateCharacter

// ==========================================
// CAMERA CONTROLLER
// ==========================================
const cameraState = {
    targetX: CONFIG.camera.startX,
    targetY: CONFIG.camera.startY,
    targetZ: CONFIG.camera.startZ,
    currentFov: CONFIG.camera.fovMin,
    smoothedSpeed: 0,
    locked: false,
    inRoom: false,
    wasLocked: false,   // NEW - track previous locked state
    wasInRoom: false,   // NEW - track previous room state
    roomTargetX: 0,
    roomTargetY: 0
};

function updateCamera() {
    if (isSkyActive() || isSkyTransitioning()) return;
    
    if (cameraState.locked) {
        // Island viewing
        cameraState.targetX = currentIsland.x;
        cameraState.targetY = currentIsland.y + CONFIG.camera.islandY;
        cameraState.targetZ = CONFIG.camera.islandZ;

    } else if (cameraState.inRoom) {
        // Manual room camera
        const room = CONFIG.camera.manualRoomCamera;
        cameraState.targetX = room.x;
        cameraState.targetY = room.y;
        cameraState.targetZ = room.z;

    } else {
        // World mode
        cameraState.targetX = character.x;
        cameraState.targetY = character.y + CONFIG.camera.startY;
        cameraState.targetZ = CONFIG.camera.startZ;
    }

    // Choose smooth speed for position
    const smooth = cameraState.inRoom ?
        CONFIG.camera.roomTransitionSpeed :
        (cameraState.locked ? CONFIG.camera.islandSmooth : CONFIG.camera.followSmooth);

    // Apply smooth movement
    camera.position.x += (cameraState.targetX - camera.position.x) * smooth;
    camera.position.y += (cameraState.targetY - camera.position.y) * smooth;
    camera.position.z += (cameraState.targetZ - camera.position.z) * smooth;

    // Look at / Rotation
    if (cameraState.inRoom) {
        const room = CONFIG.camera.manualRoomCamera;
        camera.rotation.x = room.rotX * Math.PI / 180;
        camera.rotation.y = room.rotY * Math.PI / 180;
        camera.rotation.z = room.rotZ * Math.PI / 180;
    } else {
        camera.lookAt(camera.position.x, camera.position.y, 0);
    }

    // Dynamic FOV with separate transition speeds
    if (!cameraState.locked && !cameraState.inRoom) {
        // WORLD MODE - speed-based FOV
        const currentSpeed = Math.abs(character.velocityX);
        cameraState.smoothedSpeed += (currentSpeed - cameraState.smoothedSpeed) * CONFIG.camera.speedSmoothing;

        const speedRatio = cameraState.smoothedSpeed / CONFIG.character.maxSpeed;
        const targetFov = CONFIG.camera.fovMin + (CONFIG.camera.fovMax - CONFIG.camera.fovMin) * speedRatio;

        const increasing = targetFov > cameraState.currentFov;
        const smooth = increasing ? CONFIG.camera.fovSmoothIn : CONFIG.camera.fovSmoothOut;

        cameraState.currentFov += (targetFov - cameraState.currentFov) * smooth;

    } else if (cameraState.locked) {
        // ISLAND MODE - custom transition speed
        const smooth = CONFIG.camera.fovIslandTransition;
        cameraState.currentFov += (CONFIG.camera.fovMin - cameraState.currentFov) * smooth;
        cameraState.smoothedSpeed = 0;

    } else if (cameraState.inRoom) {
        // ROOM MODE - custom transition speed
        const smooth = CONFIG.camera.fovRoomTransition;
        cameraState.currentFov += (CONFIG.camera.fovMin - cameraState.currentFov) * smooth;
        cameraState.smoothedSpeed = 0;
    }

    camera.fov = cameraState.currentFov;
    camera.updateProjectionMatrix();
}


// ==========================================
// ISLAND SYSTEM
// ==========================================
let nearestIsland = null;
let currentIsland = null;
let canInteract = false;

function findNearestIsland() {
    if (currentIsland || zones.length === 0) return;

    let closest = null;
    let minDist = Infinity;

    zones.forEach(zone => {
        // Check if character is inside the box zone
        const charPos = character.group.position;

        // Apply 180° rotation to zone bounds
        const minX = -zone.max.x;
        const maxX = -zone.min.x;
        const minY = zone.min.y;
        const maxY = zone.max.y;

        const insideX = charPos.x >= minX && charPos.x <= maxX;
        const insideY = charPos.y >= minY && charPos.y <= maxY;

        if (insideX && insideY) {
            // Inside zone - this is the one!
            closest = zone;
            minDist = 0;
        } else {
            // Calculate distance to zone center
            const dist = Math.abs(character.x - zone.x);
            if (dist < minDist) {
                minDist = dist;
                closest = zone;
            }
        }
    });

    nearestIsland = closest;
    canInteract = minDist === 0;  // Only interact when inside zone

    document.getElementById('nearest').textContent = closest ? closest.name : '--';

    updateInteractButton();
}

function updateInteractButton() {
    const btn = document.getElementById('interact-button');

    if (!canInteract || !nearestIsland || currentIsland) {
        btn.classList.remove('visible');
        return;
    }

    btn.classList.add('visible');
    document.getElementById('button-label').textContent = nearestIsland.name.toUpperCase();

    // Position button at bottom of zone box (with 180° rotation applied)
    const buttonY = nearestIsland.min.y - 0.5;  // Bottom face + small offset
    const worldPos = new THREE.Vector3(nearestIsland.x, buttonY, 0);
    worldPos.project(camera);

    const x = (worldPos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (worldPos.y * -0.5 + 0.5) * window.innerHeight;

    btn.style.left = x + 'px';
    btn.style.top = y + 'px';
}

function openIsland(island) {
    if (!island) return;

    currentIsland = island;
    cameraState.locked = true;
    cameraState.targetX = island.x;
    cameraState.targetY = island.y + CONFIG.camera.islandY;
    cameraState.targetZ = CONFIG.camera.islandZ;

    setTimeout(() => {
        document.getElementById('video-title').textContent = island.name;
        document.getElementById('video-subtitle').textContent = island.subtitle;
        document.getElementById('video-iframe').src =
            `https://www.youtube.com/embed/${island.youtubeId}?autoplay=1`;
        document.getElementById('video-overlay').classList.add('active');
    }, 500);
}

function closeIsland() {
    document.getElementById('video-overlay').classList.remove('active');
    document.getElementById('video-iframe').src = '';

    cameraState.targetY = character.y + CONFIG.camera.startY;
    cameraState.targetZ = CONFIG.camera.startZ;

    setTimeout(() => {
        cameraState.locked = false;
        currentIsland = null;
    }, 400);
}

document.getElementById('close-button').addEventListener('click', closeIsland);

// ==========================================
// ASSET LOADING
// ==========================================
const loader = new GLTFLoader();
let loadedCount = 0;
const totalAssets = 5;  // scene, collisions, character, zones, room

// Store loaded zones
const zones = [];
let roomZone = null;
const roomState = {
    scene: null,
    meshes: [],
    materials: [],
    ready: false,
    inRoom: false,
    currentOpacity: 0,
    targetOpacity: 0,
    fadeSpeed: 0.12
};

function applyRoomOpacity(opacity) {
    if (!roomState.ready) return;
    const clamped = THREE.MathUtils.clamp(opacity, 0, 1);
    roomState.currentOpacity = clamped;
    const isOpaque = clamped >= 0.999;
    // Start writing depth earlier to avoid the "overlay floor" artifact mid-fade.
    const shouldWriteDepth = clamped >= 0.15;
    for (let i = 0; i < roomState.materials.length; i++) {
        const mat = roomState.materials[i];
        if (!mat) continue;
        mat.opacity = clamped;
        // Avoid transparent sorting artifacts when fully visible.
        const nextTransparent = !isOpaque;
        const nextDepthWrite = shouldWriteDepth;
        if (mat.transparent !== nextTransparent || mat.depthWrite !== nextDepthWrite) {
            mat.transparent = nextTransparent;
            mat.depthWrite = nextDepthWrite;
            mat.needsUpdate = true;
        }
        mat.depthTest = true;
    }
}

function updateRoomFade() {
    if (!roomState.ready) return;
    roomState.currentOpacity +=
        (roomState.targetOpacity - roomState.currentOpacity) * roomState.fadeSpeed;
    applyRoomOpacity(roomState.currentOpacity);
}

function updateLoadingBar() {
    const progress = (loadedCount / totalAssets) * 100;
    document.getElementById('loading-progress').style.width = progress + '%';

    if (loadedCount >= totalAssets) {
        setTimeout(() => {
            document.getElementById('loading').classList.add('hidden');
        }, 500);
    }
}

// Scene
loader.load(CONFIG.files.scene, (gltf) => {
    const sceneModel = gltf.scene;
    sceneModel.rotation.y = Math.PI;
    sceneModel.traverse(child => {
        if (child.isMesh) {
            child.material.side = THREE.DoubleSide;
            child.receiveShadow = true;
            child.castShadow = true;
        }
    });
    scene.add(sceneModel);
    loadedCount++;
    updateLoadingBar();
});

// Room - preload invisible, then fade in when entering room zone
loader.load(CONFIG.files.room, (gltf) => {
    const roomModel = gltf.scene;
    roomModel.rotation.y = Math.PI;
    roomState.scene = roomModel;
    roomState.meshes.length = 0;
    roomState.materials.length = 0;

    const prepareMaterial = (mat) => {
        const cloned = mat?.clone ? mat.clone() : mat;
        if (!cloned) return cloned;
        cloned.transparent = true;
        cloned.opacity = 0;
        cloned.depthWrite = false;
        cloned.needsUpdate = true;
        roomState.materials.push(cloned);
        return cloned;
    };

    roomModel.traverse(child => {
        if (child.isMesh) {
            if (Array.isArray(child.material)) {
                child.material = child.material.map(prepareMaterial);
            } else {
                child.material = prepareMaterial(child.material);
            }
            child.receiveShadow = true;
            child.castShadow = true;
            roomState.meshes.push(child);
        }
    });
    scene.add(roomModel);
    roomState.ready = true;
    applyRoomOpacity(0);
    loadedCount++;
    updateLoadingBar();
}, undefined, (err) => {
    console.error('Failed to load room.glb', err);
});

// Collisions
loader.load(CONFIG.files.collisions, (gltf) => {
    const collisionMesh = gltf.scene;
    collisionMesh.rotation.y = Math.PI;
    collisionMesh.traverse(child => {
        if (child.isMesh) {
            child.visible = false;
        }
    });
    scene.add(collisionMesh);

    collisionMesh.updateMatrixWorld(true);
    worldOctree.fromGraphNode(collisionMesh);

    loadedCount++;
    updateLoadingBar();
});

// Character
loader.load(CONFIG.files.character, (gltf) => {
    character.model = gltf.scene;
    character.model.scale.setScalar(1);
    character.model.rotation.y = Math.PI;
    character.model.traverse(child => {
        if (child.isMesh) {
            child.castShadow = true;
        }
    });
    character.tiltGroup = new THREE.Group();
    character.model.position.y = 0;  // Offset model so feet are at (0,0,0)
    character.tiltGroup.add(character.model);
    character.group.add(character.tiltGroup);
    if (gltf.animations.length > 0) {
        character.mixer = new THREE.AnimationMixer(character.model);
        const action = character.mixer.clipAction(gltf.animations[0]);
        action.play();
    }

    loadedCount++;
    updateLoadingBar();
});

// Zones - load boxes from Blender
loader.load(CONFIG.files.zones, (gltf) => {
    const zoneObjects = [];

    // Extract all meshes (boxes)
    gltf.scene.traverse(child => {
        if (child.isMesh) {
            // Get world position and scale
            child.updateMatrixWorld(true);

            const box = new THREE.Box3().setFromObject(child);
            const center = new THREE.Vector3();
            const size = new THREE.Vector3();
            box.getCenter(center);
            box.getSize(size);

            zoneObjects.push({
                name: child.name,
                center: center,
                size: size,
                min: box.min.clone(),
                max: box.max.clone()
            });
        }
    });

    // Sort by name/number
    zoneObjects.sort((a, b) => {
        const aNum = a.name.match(/\d+/);
        const bNum = b.name.match(/\d+/);
        if (!aNum || !bNum) return 0;
        return parseInt(aNum[0]) - parseInt(bNum[0]);
    });

    // Match with CONFIG.islands data
    zoneObjects.forEach((zone, index) => {
        // Capture the room zone for camera switching, but don't treat it as an island.
        if (zone.name.toLowerCase().includes('room')) {
            roomZone = {
                min: zone.min,
                max: zone.max,
                center: zone.center
            };
            console.log('Room zone found:', zone.name);
            return;
        }

        // Otherwise it's a project island zone
        if (CONFIG.islands[index]) {
            zones.push({
                ...CONFIG.islands[index],
                center: zone.center,
                size: zone.size,
                min: zone.min,
                max: zone.max,
                x: -zone.center.x,
                y: zone.center.y
            });
        }
    });

    console.log('✅ Zones loaded:', zones.length);
    console.log('Zones:', zones);

    loadedCount++;
    updateLoadingBar();
});
// ==========================================
// ROOM ZONE DETECTION (camera only)
// ==========================================
function checkRoomZone() {
    if (!roomZone) return;

    const charPos = character.group.position;
    const minX = -roomZone.max.x;
    const maxX = -roomZone.min.x;
    const minY = roomZone.min.y;
    const maxY = roomZone.max.y;

    const insideX = charPos.x >= minX && charPos.x <= maxX;
    const insideY = charPos.y >= minY && charPos.y <= maxY;
    const nowInRoom = insideX && insideY;
    cameraState.inRoom = nowInRoom;

    if (roomState.ready && roomState.inRoom !== nowInRoom) {
        roomState.inRoom = nowInRoom;
        roomState.targetOpacity = nowInRoom ? 1 : 0;
        console.log(nowInRoom ? 'Entering room (fade in)' : 'Exiting room (fade out)');
    }
}
// ==========================================
// ANIMATION LOOP
// ==========================================
function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);

    if (!isSkyActive()) {
        updateCharacter();
        updatePhysics(delta);
    }
    checkRoomZone();
    updateRoomFade();
    updateCamera();
    updateBlobShadow();
    findNearestIsland();
    updateSky(camera, character); // Pass character

    if (character.mixer) character.mixer.update(delta);

    // Update UI
    document.getElementById('pos-x').textContent = character.x.toFixed(1);
    document.getElementById('vel-x').textContent = character.velocityX.toFixed(2);
    document.getElementById('vel-y').textContent = character.velocityY.toFixed(2);
    document.getElementById('grounded').textContent = character.isGrounded ? 'YES' : 'NO';
    document.getElementById('char-pos').textContent = `${character.x.toFixed(1)}, ${character.y.toFixed(1)}`;
    document.getElementById('cam-pos').textContent = `${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}`;
    document.getElementById('cam-rot').textContent = `${(camera.rotation.x * 180 / Math.PI).toFixed(1)}°, ${(camera.rotation.y * 180 / Math.PI).toFixed(1)}°, ${(camera.rotation.z * 180 / Math.PI).toFixed(1)}°`;
    document.getElementById('cam-fov').textContent = camera.fov.toFixed(2);

    // Calculate gravity pull per frame (gravity * deltaTime)
    const gravityPull = (CONFIG.character.gravity * delta).toFixed(2);
    document.getElementById('gravity-pull').textContent = gravityPull;

    renderer.render(scene, camera);
}

// ==========================================
// WINDOW RESIZE
// ==========================================
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
animate();
