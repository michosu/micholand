import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Octree } from 'three/addons/math/Octree.js';
import { Capsule } from 'three/addons/math/Capsule.js';
import { PROJECTS, COLLECTIONS } from './projectData.js';
import { initViewer, enterViewer, exitViewer, updateViewer, isViewerActive, isViewerTransitioning, getCurrentViewerIndex, setViewerTeleportSpots, viewerNeedsRender } from './videoViewer.js';
import { initCollectionPopup, isCollectionOpen, openCollectionPopup } from './collectionPopup.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { handleDeepLink } from './framerBridge.js';

// ==========================================
// CONFIGURATION
// ==========================================
const CONFIG = {
    files: {
        scene: 'assets/models/scene.glb',
        collisions: 'assets/models/collisions.glb',
        character: 'assets/models/character.glb',
        zones: 'assets/models/zones.glb',
        room: 'assets/models/room.glb',
        teleportSpots: 'assets/models/teleport_spots.glb',
        sceneText: 'assets/models/scene_text.glb'
    },

    camera: {
        fov: 30,
        fovMin: 20,
        fovMax: 40,
        fovSmoothIn: 0.01,
        fovSmoothOut: 0.3,
        speedSmoothing: 0.01,
        fovRoomTransition: 0.08,
        fovIslandTransition: 0.05,
        startX: 0,
        startY: 3,
        startZ: 25,
        followSmooth: 0.03,

        islandY: -3,
        islandZ: 20,
        islandSmooth: 0.05,

        manualRoomCamera: {
            x: -50,
            y: 3.5,
            z: 25,
            rotX: 0,
            rotY: 0,
            rotZ: 0
        },
        roomTransitionSpeed: 0.05
    },

    character: {
        startX: 0,
        moveSpeed: 0.5,
        maxSpeed: 18,
        friction: 0.95,
        airFriction: 0.98,
        airControl: 0.5,
        turnSpeed: 0.65,
        jumpForce: 20,
        gravity: 50,
        tiltAmount: 0.15,
    },

    scene: {
        backgroundColor: 0x363636,
        fogColor: 0xa6b4c9,
        fogNear: 10,
        fogFar: 100
    },

    environment: {
        text: {
            hdr: 'assets/environment/klippad_sunrise_2_4k.hdr',  // HDR for 3D text reflections
            intensity: 5.0,
            rotation: { x: 0, y: 0, z: 90 }     // degrees
        },
        world: {
            hdr: 'assets/environment/monochrome_studio_02_1k.hdr',  // HDR for world/scene
            intensity: 2,                        // 0 = no HDR on world
            rotation: { x: 0, y: 0, z: 0 }      // degrees
        }
    }
};

// ==========================================
// RENDERER UTILITIES
// ==========================================
const MAX_RENDER_PIXELS = 1920 * 1080;

function getOptimalPixelRatio() {
    const dpr = window.devicePixelRatio || 1;
    const screenPixels = window.innerWidth * window.innerHeight;
    // Max DPR that keeps total rendered pixels within budget
    const maxRatio = Math.sqrt(MAX_RENDER_PIXELS / screenPixels);
    return Math.min(maxRatio, dpr);
}

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
renderer.setPixelRatio(getOptimalPixelRatio());
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.25;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

// ==========================================
// LIGHTING  (physically-based, no legacy mode)
// ==========================================
// Soft ambient fill — keeps shadows from going pure black
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

// Sky/ground gradient — adds subtle colour variation
const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x444422, 0.3);
scene.add(hemiLight);

// Key light — main shadow-casting sun
const mainLight = new THREE.DirectionalLight(0xffffff, 2.8);
mainLight.position.set(12, 24, 14);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 512;
mainLight.shadow.mapSize.height = 512;
mainLight.shadow.bias = -0.0002;
mainLight.shadow.normalBias = 0.02;
mainLight.shadow.camera.near = 1;
mainLight.shadow.camera.far = 120;
mainLight.shadow.camera.left = -60;
mainLight.shadow.camera.right = 60;
mainLight.shadow.camera.top = 40;
mainLight.shadow.camera.bottom = -40;
scene.add(mainLight);

// Back fill — gentle rim from behind
const fillLight = new THREE.DirectionalLight(0xffffff, 4.5);
fillLight.position.set(-10, 15, -10);
scene.add(fillLight);

// Front fill — subtle warm kick from camera side
const frontFillLight = new THREE.DirectionalLight(0xfff8ee, 0.4);
frontFillLight.position.set(0, 12, 28);
scene.add(frontFillLight);

// Environment map — separate HDR files for text and world
let textEnvMap = null;
let textModelRef = null;

function applyTextEnvMap() {
    if (!textEnvMap || !textModelRef) return;
    const cfg = CONFIG.environment.text;
    const rotation = new THREE.Euler(
        THREE.MathUtils.degToRad(cfg.rotation.x),
        THREE.MathUtils.degToRad(cfg.rotation.y),
        THREE.MathUtils.degToRad(cfg.rotation.z)
    );
    textModelRef.traverse(child => {
        if (!child.isMesh) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(mat => {
            mat.envMap = textEnvMap;
            mat.envMapIntensity = cfg.intensity;
            if (mat.envMapRotation) mat.envMapRotation.copy(rotation);
            mat.needsUpdate = true;
        });
    });
}

const pmremGenerator = new THREE.PMREMGenerator(renderer);

function envLoader(path) {
    return path.toLowerCase().endsWith('.exr') ? new EXRLoader() : new RGBELoader();
}

const textHdr = CONFIG.environment.text.hdr;
const worldHdr = CONFIG.environment.world.hdr;
const sameHdr = textHdr === worldHdr;

// Load world environment
envLoader(worldHdr).load(worldHdr, (hdrTexture) => {
    hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
    const processed = pmremGenerator.fromEquirectangular(hdrTexture).texture;

    // World environment
    scene.environment = processed;
    scene.environmentIntensity = CONFIG.environment.world.intensity;
    scene.environmentRotation = new THREE.Euler(
        THREE.MathUtils.degToRad(CONFIG.environment.world.rotation.x),
        THREE.MathUtils.degToRad(CONFIG.environment.world.rotation.y),
        THREE.MathUtils.degToRad(CONFIG.environment.world.rotation.z)
    );

    // If same file, reuse for text too
    if (sameHdr) {
        textEnvMap = processed;
        applyTextEnvMap();
    }

    hdrTexture.dispose();
    if (sameHdr) pmremGenerator.dispose();
});

// Load separate text environment (only if different from world)
if (!sameHdr) {
    envLoader(textHdr).load(textHdr, (hdrTexture) => {
        hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
        textEnvMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;
        applyTextEnvMap();
        hdrTexture.dispose();
        pmremGenerator.dispose();
    });
}

// Initialize video viewer (carousel) into main scene
initViewer(scene);

// Initialize collection popup
initCollectionPopup();

// ==========================================
// PHYSICS SYSTEM
// ==========================================
const worldOctree = new Octree();
const clock = new THREE.Clock();

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
    groundedFrames: 0,
    groundNormal: new THREE.Vector3(0, 1, 0),
    hasGroundNormal: false,
    autoWalking: false,
    autoWalkTarget: 0,
    autoWalkCallback: null
};
scene.add(character.group);

// Teleport spots (loaded from teleport_spots.glb)
const teleportSpots = [];

// FPS counter
const fpsCounter = { frames: 0, lastTime: performance.now(), fps: 0 };

// Room trophies
let nearestTrophy = null;
const roomTrophies = [];

function freezeCharacter() {
    character.velocityX = 0;
    character.velocityY = 0;
    character.autoWalking = false;
    keys.clear();
}

// Blob shadow
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

    blobShadow.position.set(character.x, groundY + 0.02, 0);

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

function bindMobileControls() {
    const controls = document.getElementById('mobile-controls');
    if (!controls) return;

    const setKey = (key, active) => {
        if (active) keys.add(key);
        else keys.delete(key);
    };

    const press = (e) => {
        const key = e.currentTarget?.dataset?.key;
        if (!key) return;
        e.preventDefault();
        if (isViewerActive() || projectSelectActive) return;
        setKey(key, true);
        if (key === 'ArrowUp') {
            // Trophy interaction in room - auto-walk then freeze + open
            if (cameraState.inRoom && nearestTrophy && !isCollectionOpen()) {
                const trophy = nearestTrophy;
                character.autoWalking = true;
                character.autoWalkTarget = trophy.position.x;
                character.autoWalkCallback = () => {
                    freezeCharacter();
                    openCollectionPopup(trophy.category);
                };
                return;
            }
            // Island interaction
            if (nearestIsland && canInteract) {
                const zIdx = zones.indexOf(nearestIsland);
                const spt = (zIdx >= 0) ? teleportSpots[zIdx] : null;
                character.autoWalking = true;
                character.autoWalkTarget = spt ? spt.x : nearestIsland.x;
                character.autoWalkCallback = () => openIsland(nearestIsland);
            }
        }
    };

    const release = (e) => {
        const key = e.currentTarget?.dataset?.key;
        if (!key) return;
        e.preventDefault();
        setKey(key, false);
    };

    controls.querySelectorAll('.mc-btn').forEach((btn) => {
        btn.addEventListener('touchstart', press, { passive: false });
        btn.addEventListener('touchend', release, { passive: false });
        btn.addEventListener('touchcancel', release, { passive: false });
        btn.addEventListener('mousedown', press);
        btn.addEventListener('mouseup', release);
        btn.addEventListener('mouseleave', release);
    });
}

bindMobileControls();

function setTouchClass() {
    const isTouch = window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (isTouch) document.body.classList.add('touch');
    else document.body.classList.remove('touch');
}

setTouchClass();
window.addEventListener('resize', setTouchClass);

// ==========================================
// PROJECT SELECTION STATE
// ==========================================
let projectSelectActive = false;
let currentProjectIndex = 0;

const psPanel = document.getElementById('project-select');
const psTitle = document.getElementById('ps-title');
const psScore = document.getElementById('ps-score');
const psTime = document.getElementById('ps-time');
const psClient = document.getElementById('ps-client');
const psYear = document.getElementById('ps-year');
const psType = document.getElementById('ps-type');
const psThumbnail = document.getElementById('ps-thumbnail');
const psPrev = document.getElementById('ps-prev');
const psNext = document.getElementById('ps-next');
const psEnter = document.getElementById('ps-enter');

// Cached UI DOM references (avoid per-frame getElementById)
const uiRefs = {
    posX: document.getElementById('pos-x'),
    velX: document.getElementById('vel-x'),
    velY: document.getElementById('vel-y'),
    grounded: document.getElementById('grounded'),
    fpsCounter: document.getElementById('fps-counter'),
    charPos: document.getElementById('char-pos'),
    camPos: document.getElementById('cam-pos'),
    camRot: document.getElementById('cam-rot'),
    camFov: document.getElementById('cam-fov'),
    nearest: document.getElementById('nearest'),
    interactButton: document.getElementById('interact-button'),
    buttonLabel: document.getElementById('button-label')
};
let frameCount = 0;

function showProjectSelect(zoneIndex) {
    currentProjectIndex = zoneIndex;
    projectSelectActive = true;
    updateProjectSelectPanel(zoneIndex);
    psPanel.classList.add('active');
}

function hideProjectSelect() {
    projectSelectActive = false;
    psPanel.classList.remove('active');
}

function updateProjectSelectPanel(index) {
    const project = PROJECTS[index];
    if (!project) return;
    psTitle.textContent = project.name;
    psScore.textContent = project.score;
    psTime.textContent = project.time;
    psClient.textContent = project.client;
    psYear.textContent = project.year;
    psType.textContent = project.type;
    psThumbnail.src = project.thumbnailUrl;
}

function teleportToProject(direction) {
    const newIndex = currentProjectIndex + direction;
    if (newIndex < 0 || newIndex >= zones.length) return;

    currentProjectIndex = newIndex;
    const targetZone = zones[newIndex];

    // Use teleport spot if available, otherwise zone center
    const spot = teleportSpots[newIndex];
    const newX = spot ? spot.x : targetZone.x;
    const newY = spot ? spot.y : targetZone.y;

    // Teleport character to spot
    characterCollider.start.set(newX, newY + 0.35, 0);
    characterCollider.end.set(newX, newY + 1.35, 0);
    character.x = newX;
    character.y = newY;
    character.velocityX = 0;
    character.velocityY = 0;
    character.group.position.set(newX, newY, 0);

    // Lock camera on new island - INSTANT snap
    currentIsland = targetZone;
    currentSpot = spot;
    cameraState.locked = true;
    cameraState.targetX = spot ? spot.x : targetZone.x;
    cameraState.targetY = targetZone.y + CONFIG.camera.islandY;
    cameraState.targetZ = CONFIG.camera.islandZ;

    // Instant camera snap (no smooth transition)
    camera.position.set(cameraState.targetX, cameraState.targetY, cameraState.targetZ);
    camera.lookAt(camera.position.x, camera.position.y, 0);
    cameraState.currentFov = CONFIG.camera.fovMin;
    camera.fov = CONFIG.camera.fovMin;
    camera.updateProjectionMatrix();

    updateProjectSelectPanel(newIndex);
}

function enterVideoViewer() {
    hideProjectSelect();
    freezeCharacter();
    viewerQuitBtn.classList.add('visible');
    enterViewer(camera, scene, roomState.worldScene, roomState.roomScene, character, cameraState, currentProjectIndex);
}

function exitVideoViewerToProjectSelect() {
    // Sync project index with viewer's current index (user may have navigated)
    const viewerIndex = getCurrentViewerIndex();
    if (viewerIndex >= 0 && viewerIndex < zones.length) {
        currentProjectIndex = viewerIndex;
        currentIsland = zones[viewerIndex];
    }

    viewerQuitBtn.classList.remove('visible');

    exitViewer(camera, scene, roomState.worldScene, roomState.roomScene, character, cameraState, CONFIG,
        // onReady: called while screen is black - set up character and camera
        () => {
            const spot = teleportSpots[currentProjectIndex];
            if (spot) {
                characterCollider.start.set(spot.x, spot.y + 0.35, 0);
                characterCollider.end.set(spot.x, spot.y + 1.35, 0);
                character.x = spot.x;
                character.y = spot.y;
                character.velocityX = 0;
                character.velocityY = 0;
                character.group.position.set(spot.x, spot.y, 0);
            }

            if (currentIsland) {
                currentSpot = spot;
                cameraState.locked = true;
                cameraState.targetX = spot ? spot.x : currentIsland.x;
                cameraState.targetY = currentIsland.y + CONFIG.camera.islandY;
                cameraState.targetZ = CONFIG.camera.islandZ;

                // Set camera instantly while covered
                camera.position.set(cameraState.targetX, cameraState.targetY, cameraState.targetZ);
                camera.quaternion.set(0, 0, 0, 1);
                camera.fov = CONFIG.camera.fovMin;
                cameraState.currentFov = CONFIG.camera.fovMin;
                camera.updateProjectionMatrix();

                showProjectSelect(currentProjectIndex);
            }
        }
    );
}

// Project Selection event listeners
psPrev.addEventListener('click', () => teleportToProject(-1));
psNext.addEventListener('click', () => teleportToProject(1));
psEnter.addEventListener('click', enterVideoViewer);

// Viewer Quit button
const viewerQuitBtn = document.getElementById('viewer-quit');
viewerQuitBtn.addEventListener('click', exitVideoViewerToProjectSelect);

// ==========================================
// KEY HANDLER
// ==========================================
document.addEventListener('keydown', (e) => {
    // Video viewer active - ESC returns to project select
    if (isViewerActive()) {
        if (e.key === 'Escape') {
            exitVideoViewerToProjectSelect();
        }
        return;
    }

    // Collection popup open
    if (isCollectionOpen()) return;

    // Project selection active
    if (projectSelectActive) {
        if (e.key === 'Escape') {
            closeIsland();
            return;
        }
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            teleportToProject(-1);
            return;
        }
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            teleportToProject(1);
            return;
        }
        if (e.key === 'Enter') {
            enterVideoViewer();
            return;
        }
        return;
    }

    // Room trophy interaction - auto-walk to trophy then freeze + open popup
    if (cameraState.inRoom && nearestTrophy && !isCollectionOpen()) {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const trophy = nearestTrophy;
            character.autoWalking = true;
            character.autoWalkTarget = trophy.position.x;
            character.autoWalkCallback = () => {
                freezeCharacter();
                openCollectionPopup(trophy.category);
            };
            return;
        }
    }

    // Island locked (camera locked but not in project select yet - shouldn't normally happen)
    if (currentIsland) {
        if (e.key === 'Escape') closeIsland();
        return;
    }

    // Movement keys
    if (['ArrowLeft', 'ArrowRight', ' ', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        keys.add(e.key);

        if (e.key === 'ArrowUp' && nearestIsland && canInteract) {
            const zIdx = zones.indexOf(nearestIsland);
            const spt = (zIdx >= 0) ? teleportSpots[zIdx] : null;
            character.autoWalking = true;
            character.autoWalkTarget = spt ? spt.x : nearestIsland.x;
            character.autoWalkCallback = () => openIsland(nearestIsland);
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
    const MAX_SLOPE_COS = Math.cos(THREE.MathUtils.degToRad(50));
    const GROUND_GRACE_FRAMES = 3;
    const GROUND_STICK_FORCE = 8;
    const GROUND_SNAP_DISTANCE = 0.35;
    const SURFACE_FOLLOW_DISTANCE = 0.8;
    const SURFACE_OFFSET = 0.02;
    const STEPS = 3;
    const stepDelta = deltaTime / STEPS;

    for (let i = 0; i < STEPS; i++) {
        character.velocityY -= CONFIG.character.gravity * stepDelta;

        const deltaPos = new THREE.Vector3(
            character.velocityX * stepDelta,
            character.velocityY * stepDelta,
            0
        );
        characterCollider.translate(deltaPos);

        const result = worldOctree.capsuleIntersect(characterCollider);

        if (result) {
            characterCollider.translate(result.normal.clone().multiplyScalar(result.depth));

            const isGround = result.normal.y >= MAX_SLOPE_COS;
            const movingUp = character.velocityY > 0;

            if (isGround) {
                character.isGrounded = true;
                character.groundedFrames = GROUND_GRACE_FRAMES;
                character.groundNormal.copy(result.normal);
                character.hasGroundNormal = true;

                const velocity = new THREE.Vector3(character.velocityX, character.velocityY, 0);
                const normalComponent = result.normal.clone().multiplyScalar(velocity.dot(result.normal));
                velocity.sub(normalComponent);
                character.velocityX = velocity.x;
                character.velocityY = velocity.y;

                if (character.velocityY < 0) character.velocityY = 0;

            } else if (movingUp && result.normal.y < -0.5) {
                character.isGrounded = false;
                character.velocityY = 0;
                character.hasGroundNormal = false;
            } else {
                character.groundedFrames--;
                character.isGrounded = character.groundedFrames > 0;
            }
        } else {
            character.groundedFrames--;
            character.isGrounded = character.groundedFrames > 0;
        }

        if (character.isGrounded) {
            character.velocityY -= GROUND_STICK_FORCE * stepDelta;
        }

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

        if (!character.isGrounded) character.hasGroundNormal = false;

        if (character.isGrounded && character.hasGroundNormal) {
            const n = character.groundNormal;
            const minNy = 0.2;
            if (Math.abs(n.y) > minNy) {
                const slopeDyDx = -n.x / n.y;
                character.velocityY = character.velocityX * slopeDyDx;
            }
        }

        character.velocityY = Math.max(-50, Math.min(30, character.velocityY));
    }

    const pos = characterCollider.end;
    character.x = pos.x;
    character.y = pos.y - 1.35;
    character.group.position.set(character.x, character.y, 0);
}

// ==========================================
// CHARACTER CONTROLLER
// ==========================================
function updateCharacter() {
    if (isViewerActive()) return;
    if (projectSelectActive) return;
    if (isCollectionOpen()) return;
    if (currentIsland) return;

    const ACCEL = CONFIG.character.moveSpeed;
    const MAX_SPEED = CONFIG.character.maxSpeed;
    const FRICTION = character.isGrounded ? CONFIG.character.friction : CONFIG.character.airFriction;
    const TURN_SPEED = CONFIG.character.turnSpeed;

    const speedRatioAccel = Math.abs(character.velocityX) / MAX_SPEED;
    const accelMultiplier = character.isGrounded ?
        1 + speedRatioAccel * 0.5 :
        CONFIG.character.airControl;

    if (character.autoWalking) {
        const dist = character.autoWalkTarget - character.x;
        const absDist = Math.abs(dist);
        if (absDist > 0.05) {
            // Smooth deceleration: fast when far, slow when close
            const speed = Math.min(8, Math.max(1.5, absDist * 5));
            character.velocityX = Math.sign(dist) * speed;
        } else {
            character.x = character.autoWalkTarget;
            character.group.position.x = character.autoWalkTarget;
            characterCollider.start.x = character.autoWalkTarget;
            characterCollider.end.x = character.autoWalkTarget;
            character.velocityX = 0;
            character.autoWalking = false;
            const cb = character.autoWalkCallback;
            character.autoWalkCallback = null;
            if (cb) setTimeout(cb, 200);
        }
    } else {
        const movingRight = keys.has('ArrowRight');
        const movingLeft = keys.has('ArrowLeft');

        if (movingRight) {
            if (character.velocityX < 0) character.velocityX *= TURN_SPEED;
            character.velocityX += ACCEL * accelMultiplier;
            if (character.tiltGroup) character.tiltGroup.scale.x = 1;
        } else if (movingLeft) {
            if (character.velocityX > 0) character.velocityX *= TURN_SPEED;
            character.velocityX -= ACCEL * accelMultiplier;
            if (character.tiltGroup) character.tiltGroup.scale.x = -1;
        } else {
            character.velocityX *= FRICTION;
        }

        character.velocityX = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, character.velocityX));

        if (keys.has(' ') && character.isGrounded) {
            character.velocityY = CONFIG.character.jumpForce;
            character.hasGroundNormal = false;
        }
    }

    // Character tilt
    const speedRatio = Math.abs(character.velocityX) / CONFIG.character.maxSpeed;
    const tiltAmount = speedRatio * -0.3;
    const targetTilt = Math.sign(character.velocityX) * tiltAmount;

    if (character.tiltGroup) {
        character.tiltGroup.rotation.z += (targetTilt - character.tiltGroup.rotation.z) * 0.1;
    }
}

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
    wasLocked: false,
    wasInRoom: false,
    roomTargetX: 0,
    roomTargetY: 0
};

function updateCamera() {
    if (isViewerActive() || isViewerTransitioning()) return;

    if (cameraState.locked) {
        cameraState.targetX = currentSpot ? currentSpot.x : currentIsland.x;
        cameraState.targetY = currentIsland.y + CONFIG.camera.islandY;
        cameraState.targetZ = CONFIG.camera.islandZ;
    } else if (cameraState.inRoom) {
        const room = CONFIG.camera.manualRoomCamera;
        cameraState.targetX = room.x;
        cameraState.targetY = room.y;
        cameraState.targetZ = room.z;
    } else {
        cameraState.targetX = character.x;
        cameraState.targetY = character.y + CONFIG.camera.startY;
        cameraState.targetZ = CONFIG.camera.startZ;
    }

    const smooth = cameraState.inRoom ?
        CONFIG.camera.roomTransitionSpeed :
        (cameraState.locked ? CONFIG.camera.islandSmooth : CONFIG.camera.followSmooth);

    camera.position.x += (cameraState.targetX - camera.position.x) * smooth;
    camera.position.y += (cameraState.targetY - camera.position.y) * smooth;
    camera.position.z += (cameraState.targetZ - camera.position.z) * smooth;

    if (cameraState.inRoom) {
        const room = CONFIG.camera.manualRoomCamera;
        camera.rotation.x = room.rotX * Math.PI / 180;
        camera.rotation.y = room.rotY * Math.PI / 180;
        camera.rotation.z = room.rotZ * Math.PI / 180;
    } else {
        camera.lookAt(camera.position.x, camera.position.y, 0);
    }

    if (!cameraState.locked && !cameraState.inRoom) {
        const currentSpeed = Math.abs(character.velocityX);
        cameraState.smoothedSpeed += (currentSpeed - cameraState.smoothedSpeed) * CONFIG.camera.speedSmoothing;

        const speedRatio = cameraState.smoothedSpeed / CONFIG.character.maxSpeed;
        const targetFov = CONFIG.camera.fovMin + (CONFIG.camera.fovMax - CONFIG.camera.fovMin) * speedRatio;

        const increasing = targetFov > cameraState.currentFov;
        const fovSmooth = increasing ? CONFIG.camera.fovSmoothIn : CONFIG.camera.fovSmoothOut;
        cameraState.currentFov += (targetFov - cameraState.currentFov) * fovSmooth;

    } else if (cameraState.locked) {
        const fovSmooth = CONFIG.camera.fovIslandTransition;
        cameraState.currentFov += (CONFIG.camera.fovMin - cameraState.currentFov) * fovSmooth;
        cameraState.smoothedSpeed = 0;
    } else if (cameraState.inRoom) {
        const fovSmooth = CONFIG.camera.fovRoomTransition;
        cameraState.currentFov += (CONFIG.camera.fovMin - cameraState.currentFov) * fovSmooth;
        cameraState.smoothedSpeed = 0;
    }

    if (Math.abs(camera.fov - cameraState.currentFov) > 0.01) {
        camera.fov = cameraState.currentFov;
        camera.updateProjectionMatrix();
    }
}

// ==========================================
// ISLAND SYSTEM
// ==========================================
let nearestIsland = null;
let currentIsland = null;
let currentSpot = null;
let canInteract = false;

function findNearestIsland() {
    if (currentIsland || projectSelectActive || zones.length === 0) {
        uiRefs.interactButton.classList.remove('visible');
        return;
    }

    let closest = null;
    let minDist = Infinity;
    const ZONE_PADDING = 1.0;

    zones.forEach(zone => {
        const charPos = character.group.position;
        const minX = -zone.max.x - ZONE_PADDING;
        const maxX = -zone.min.x + ZONE_PADDING;
        const minY = zone.min.y - ZONE_PADDING;
        const maxY = zone.max.y + ZONE_PADDING;

        const insideX = charPos.x >= minX && charPos.x <= maxX;
        const insideY = charPos.y >= minY && charPos.y <= maxY;

        if (insideX && insideY) {
            closest = zone;
            minDist = 0;
        } else {
            const dist = Math.abs(character.x - zone.x);
            if (dist < minDist) {
                minDist = dist;
                closest = zone;
            }
        }
    });

    nearestIsland = closest;
    canInteract = minDist === 0;

    uiRefs.nearest.textContent = closest ? closest.name : '--';
    updateInteractButton();
}

function updateInteractButton() {
    const btn = uiRefs.interactButton;

    // Hide during auto-walk
    if (character.autoWalking) {
        btn.classList.remove('visible');
        return;
    }

    // Trophy interaction in room
    if (cameraState.inRoom && nearestTrophy && !isCollectionOpen()) {
        btn.classList.add('visible');
        uiRefs.buttonLabel.textContent = nearestTrophy.name.toUpperCase();

        const worldPos = new THREE.Vector3(nearestTrophy.position.x, nearestTrophy.position.y + 1, 0);
        worldPos.project(camera);

        const x = (worldPos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (worldPos.y * -0.5 + 0.5) * window.innerHeight;

        btn.style.left = x + 'px';
        btn.style.top = y + 'px';
        return;
    }

    if (!canInteract || !nearestIsland || currentIsland || projectSelectActive || isViewerActive()) {
        btn.classList.remove('visible');
        return;
    }

    btn.classList.add('visible');
    uiRefs.buttonLabel.textContent = nearestIsland.name.toUpperCase();

    const zoneIdx = zones.indexOf(nearestIsland);
    const spot = (zoneIdx >= 0) ? teleportSpots[zoneIdx] : null;
    const buttonX = spot ? spot.x : nearestIsland.x;
    const buttonY = (spot ? spot.y : nearestIsland.min.y) - 0.5;
    const worldPos = new THREE.Vector3(buttonX, buttonY, 0);
    worldPos.project(camera);

    const x = (worldPos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (worldPos.y * -0.5 + 0.5) * window.innerHeight;

    btn.style.left = x + 'px';
    btn.style.top = y + 'px';
}

function openIsland(island) {
    if (!island) return;

    currentIsland = island;
    const zoneIndex = zones.indexOf(island);
    const spot = (zoneIndex >= 0) ? teleportSpots[zoneIndex] : null;
    currentSpot = spot;

    cameraState.locked = true;
    cameraState.targetX = spot ? spot.x : island.x;
    cameraState.targetY = island.y + CONFIG.camera.islandY;
    cameraState.targetZ = CONFIG.camera.islandZ;
    freezeCharacter();

    // Show project selection panel after camera settles
    setTimeout(() => {
        showProjectSelect(zoneIndex >= 0 ? zoneIndex : 0);
    }, 500);
}

function closeIsland() {
    hideProjectSelect();

    cameraState.targetY = character.y + CONFIG.camera.startY;
    cameraState.targetZ = CONFIG.camera.startZ;

    setTimeout(() => {
        cameraState.locked = false;
        currentIsland = null;
        currentSpot = null;
    }, 400);
}

// ==========================================
// ASSET LOADING
// ==========================================
const loader = new GLTFLoader();
let loadedCount = 0;
const totalAssets = 7;

const zones = [];
let roomZone = null;
const roomState = {
    scene: null,
    worldScene: null,
    roomScene: null,
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
    const shouldWriteDepth = clamped >= 0.15;
    for (let i = 0; i < roomState.materials.length; i++) {
        const mat = roomState.materials[i];
        if (!mat) continue;
        mat.opacity = clamped;
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

            // Check for deep links after loading
            const deepLinkIndex = handleDeepLink(PROJECTS);
            if (deepLinkIndex >= 0 && zones.length > deepLinkIndex) {
                openIsland(zones[deepLinkIndex]);
            }
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
        }
    });
    scene.add(sceneModel);
    roomState.worldScene = sceneModel;
    loadedCount++;
    updateLoadingBar();
});

// Scene Text (metallic 3D titles - gets its own envMap from config)
loader.load(CONFIG.files.sceneText, (gltf) => {
    const textModel = gltf.scene;
    textModel.rotation.y = Math.PI;
    textModel.traverse(child => {
        if (child.isMesh) {
            child.material.side = THREE.DoubleSide;
            child.receiveShadow = true;
        }
    });
    textModelRef = textModel;
    applyTextEnvMap();
    scene.add(textModel);
    loadedCount++;
    updateLoadingBar();
});

// Room
loader.load(CONFIG.files.room, (gltf) => {
    const roomModel = gltf.scene;
    roomModel.rotation.y = Math.PI;
    roomState.scene = roomModel;
    roomState.roomScene = roomModel;
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
            roomState.meshes.push(child);
        }
    });
    // Detect trophy objects for interaction
    roomModel.traverse(child => {
        if (child.isMesh) {
            const name = child.name.toLowerCase();
            let category = null;
            if (name.includes('trophy-photo')) category = 'photography';
            else if (name.includes('trophy-sfx')) category = 'sfxEdits';
            else if (name.includes('trophy-concept')) category = 'conceptArt';

            if (category) {
                child.updateMatrixWorld(true);
                const box = new THREE.Box3().setFromObject(child);
                const center = new THREE.Vector3();
                box.getCenter(center);
                const displayName = COLLECTIONS[category]?.title || child.name;
                roomTrophies.push({
                    name: displayName,
                    position: { x: -center.x, y: center.y, z: center.z },
                    category: category
                });
                console.log('Trophy found:', child.name, '→', category);
            }
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
        if (child.isMesh) child.visible = false;
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
        if (child.isMesh) child.castShadow = true;
    });
    character.tiltGroup = new THREE.Group();
    character.model.position.y = 0;
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

// Zones
loader.load(CONFIG.files.zones, (gltf) => {
    const zoneObjects = [];

    gltf.scene.traverse(child => {
        if (child.isMesh) {
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

    zoneObjects.sort((a, b) => {
        const aNum = a.name.match(/\d+/);
        const bNum = b.name.match(/\d+/);
        if (!aNum || !bNum) return 0;
        return parseInt(aNum[0]) - parseInt(bNum[0]);
    });

    let islandIndex = 0;
    zoneObjects.forEach((zone) => {
        if (zone.name.toLowerCase().includes('room')) {
            roomZone = { min: zone.min, max: zone.max, center: zone.center };
            console.log('Room zone found:', zone.name);
            return;
        }

        // Match with PROJECTS data instead of CONFIG.islands
        if (PROJECTS[islandIndex]) {
            zones.push({
                ...PROJECTS[islandIndex],
                center: zone.center,
                size: zone.size,
                min: zone.min,
                max: zone.max,
                x: -zone.center.x,
                y: zone.center.y
            });
            islandIndex++;
        }
    });

    console.log('Zones loaded:', zones.length);
    loadedCount++;
    updateLoadingBar();
});

// Teleport Spots
loader.load(CONFIG.files.teleportSpots, (gltf) => {
    const spotObjects = [];

    gltf.scene.traverse(child => {
        if (child.isMesh) {
            child.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(child);
            const center = new THREE.Vector3();
            box.getCenter(center);

            const numMatch = child.name.match(/\d+/);
            if (numMatch) {
                spotObjects.push({
                    name: child.name,
                    index: parseInt(numMatch[0]),
                    x: -center.x,
                    y: center.y,
                    z: center.z
                });
            }
        }
    });

    spotObjects.sort((a, b) => a.index - b.index);
    teleportSpots.push(...spotObjects);

    // Set character spawn to spot-1 (first spot)
    if (teleportSpots.length > 0) {
        const spawn = teleportSpots[0];
        character.x = spawn.x;
        character.y = spawn.y;
        characterCollider.start.set(spawn.x, spawn.y + 0.35, 0);
        characterCollider.end.set(spawn.x, spawn.y + 1.35, 0);
        character.group.position.set(spawn.x, spawn.y, 0);

        // Update camera to start at spawn
        cameraState.targetX = spawn.x;
        cameraState.targetY = spawn.y + CONFIG.camera.startY;
        camera.position.x = spawn.x;
        camera.position.y = spawn.y + CONFIG.camera.startY;
    }

    // Pass spots to video viewer
    setViewerTeleportSpots(teleportSpots);

    // Extract room trophy spots (spot-photography, spot-sfx-edits, spot-concept-art)
    gltf.scene.traverse(child => {
        if (!child.isMesh) return;
        const name = child.name.toLowerCase();
        let category = null;
        if (name.includes('photography')) category = 'photography';
        else if (name.includes('sfx')) category = 'sfxEdits';
        else if (name.includes('concept')) category = 'conceptArt';
        if (category) {
            child.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(child);
            const center = new THREE.Vector3();
            box.getCenter(center);
            const displayName = COLLECTIONS[category]?.title || category;
            roomTrophies.push({
                name: displayName,
                position: { x: -center.x, y: center.y, z: center.z },
                category: category
            });
            console.log('Trophy spot:', child.name, '→', category, 'at x:', -center.x, 'y:', center.y);
        }
    });

    console.log('Teleport spots loaded:', teleportSpots.length, '| Trophy spots:', roomTrophies.length);
    loadedCount++;
    updateLoadingBar();
}, undefined, (err) => {
    console.error('Failed to load teleport_spots.glb', err);
    loadedCount++;
    updateLoadingBar();
});

// ==========================================
// ROOM ZONE DETECTION
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
    }
}

// ==========================================
// TROPHY PROXIMITY CHECK
// ==========================================
function checkTrophyProximity() {
    if (!cameraState.inRoom || roomTrophies.length === 0 || isCollectionOpen()) {
        nearestTrophy = null;
        return;
    }

    const TROPHY_INTERACT_RADIUS = 2.0;
    let closest = null;
    let minDist = Infinity;

    roomTrophies.forEach(trophy => {
        const dx = Math.abs(character.x - trophy.position.x);
        const dy = Math.abs(character.y - trophy.position.y);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
            minDist = dist;
            closest = trophy;
        }
    });

    nearestTrophy = (minDist < TROPHY_INTERACT_RADIUS) ? closest : null;
}

// ==========================================
// ANIMATION LOOP
// ==========================================
function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    frameCount++;

    const viewerActive = isViewerActive();
    const viewerFullyActive = viewerActive && !isViewerTransitioning();

    if (!viewerActive) {
        updateCharacter();
        updatePhysics(delta);
        checkRoomZone();
        updateRoomFade();
        updateBlobShadow();
        findNearestIsland();
        checkTrophyProximity();
    }

    updateCamera();

    // Scene optimization: hide expensive elements when viewer is active
    if (viewerFullyActive) {
        character.group.visible = false;
        blobShadow.visible = false;
        renderer.shadowMap.enabled = false;
    } else {
        character.group.visible = true;
        blobShadow.visible = true;
        renderer.shadowMap.enabled = true;
    }

    updateViewer(camera);

    if (character.mixer && !viewerFullyActive) character.mixer.update(delta);

    // FPS counter
    fpsCounter.frames++;
    const now = performance.now();
    if (now - fpsCounter.lastTime >= 1000) {
        fpsCounter.fps = fpsCounter.frames;
        fpsCounter.frames = 0;
        fpsCounter.lastTime = now;
    }

    // Throttled debug UI updates (every 5 frames)
    if (frameCount % 5 === 0) {
        uiRefs.posX.textContent = character.x.toFixed(1);
        uiRefs.velX.textContent = character.velocityX.toFixed(2);
        uiRefs.velY.textContent = character.velocityY.toFixed(2);
        uiRefs.grounded.textContent = character.isGrounded ? 'YES' : 'NO';
        uiRefs.fpsCounter.textContent = fpsCounter.fps;
        uiRefs.charPos.textContent = `${character.x.toFixed(1)}, ${character.y.toFixed(1)}`;
        uiRefs.camPos.textContent = `${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}`;
        uiRefs.camRot.textContent = `${(camera.rotation.x * 180 / Math.PI).toFixed(1)}, ${(camera.rotation.y * 180 / Math.PI).toFixed(1)}, ${(camera.rotation.z * 180 / Math.PI).toFixed(1)}`;
        uiRefs.camFov.textContent = camera.fov.toFixed(2);
    }

    // Skip WebGL render when viewer is idle (carousel static, only YouTube playing)
    if (!viewerActive || viewerNeedsRender()) {
        renderer.render(scene, camera);
    }
}

// ==========================================
// WINDOW RESIZE
// ==========================================
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(getOptimalPixelRatio());
});

animate();
