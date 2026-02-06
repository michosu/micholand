// ==========================================
// VIDEO VIEWER (Carousel integrated into main scene)
// Merges skyScene.js transition logic with carouselTest.js carousel
// ==========================================

import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { PROJECTS } from './projectData.js';
import { notifyProjectEntered, notifyProjectExited, notifySceneChanged } from './framerBridge.js';

const gsap = window.gsap;
const CustomEase = window.CustomEase;

// ==========================================
// CONFIGURATION
// ==========================================
const VIEWER_CONFIG = {
    // Transition
    transitionDuration: 2,

    // Card settings (from carouselTest.js)
    cardWidth: 1.92,
    cardHeight: 1.28,
    cardScale: 1.5,
    cardHeightMultiplier: 1.45,
    cardSpacing: 0.05,
    cardSegments: 8,
    cardWidthInPathUnits: 0.03,
    mainCardT: 0.72,

    cardRotation: { x: 12, y: 180, z: 0 },

    // Fly-in animation
    flyInDuration: 2,
    flyInDelay: 0,
    flyInHold: 1,

    // Camera for carousel view (relative offset applied after transition)
    camera: {
        fov: 35,
        position: { x: -2.894, y: 5.156, z: -5.044 },
        rotation: { x: 0.0032, y: -0.1307 }
    },

    // 3D Title
    titleOffset: { x: 3.2, y: -1.4, z: 0.1 },
    titleScale: 0.6,
    titleRotation: { x: -31, y: -40, z: -15 },

    // Video overlay
    videoScale: 1.2,

    // Timeline
    timelineOffset: { x: 0.1, y: -1.2, z: -0.2 },
    timelineScale: 0.6,
    timelinePixelsToWorld: 0.001,
    timelineRotation: { x: -2, y: 5, z: 5 },
    progressMarkerA: { x: 688, y: 1303 },
    progressMarkerB: { x: 5809, y: 1304 },
    timelineAssets: {
        body: 'assets/timeline/timeline_body.png',
        progressFill: 'assets/timeline/timeline_progress_fill.png',
        buttons: {
            prev: 'assets/timeline/buttons/timeline_button_previ.png',
            play: 'assets/timeline/buttons/timeline_button_play.png',
            pause: 'assets/timeline/buttons/timeline_button_pause.png',
            next: 'assets/timeline/buttons/timeline_button_next.png'
        },
        time1Ref: 'assets/timeline/timeline_time1.png',
        time2Ref: 'assets/timeline/timeline_time2.png'
    },
    timelineCanvasWidth: 6296,
    timelineCanvasHeight: 1950,

    // Font settings
    fonts: {
        family: "'Inter', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
        titleWeight: '900',
        subtitleWeight: '700',
        titleStyle: 'normal',
        subtitleStyle: 'normal',
        skew: 0,
        bgColor: '#e8e8e8',
        textColor: '#000000'
    },

    timeText: {
        fontFamily: "'Sneakers Script Narrow', 'Inter', sans-serif",
        fontSize: 100,
        fontWeight: 700,
        letterSpacing: 2,
        currentColor: '#fff',
        durationColor: 'rgba(255,255,255,0.7)'
    }
};

// ==========================================
// STATE
// ==========================================
const state = {
    active: false,
    transitioning: false,
    characterX: 0,
    characterY: 0,

    // Carousel
    carouselGroup: null,
    path: null,
    cards: [],
    currentIndex: 0,
    globalOffset: 0,
    targetOffset: 0,
    isAnimating: false,

    // CSS3D
    cssRenderer: null,
    cssScene: null,
    cssContainer: null,
    videoObject: null,
    videoElement: null,
    hiddenCardIndex: null,

    // Video iframes
    iframes: [],
    iframeAssignments: {},
    activeIframeIndex: null,
    isVideoPlaying: false,
    isSeeking: false,
    lastPlayPauseToggle: 0,
    currentVideoId: null,
    videoContainerWidth: 1920,
    videoDuration: 0,
    videoCurrentTime: 0,
    videoBaseScale: 0,

    // Timeline
    timelineObject: null,
    timelineElements: null,
    timelineButtonImages: null,
    timelineHitboxes: {},
    buttonHoverStates: { play: false, pause: false, prev: false, next: false },
    scrubberDot: null,
    progressRefMarkers: [],
    progressBounds: null,

    // Title
    titleGroup: null,
    titleMesh: null,
    subtitleMesh: null,

    // Saved camera state for returning
    savedCameraPos: null,
    savedCameraQuat: null,
    savedFov: null,

    // Tweens
    transitionTween: null,
    transitionFovTween: null,

    // Path visualization
    pathVisualization: null,

    // References (set during init)
    mainCamera: null,
    mainScene: null,

    // Teleport spots for viewer positioning
    viewerTeleportSpots: [],
    viewerElevation: 15,
    viewerGroupOffset: { x: 0, y: 0, z: 0 },

    // Render management (skip rendering when idle to save GPU)
    renderFramesLeft: 0,

    // Lazy video loading: iframe only created when user clicks play
    videoLoaded: false
};

// Reusable vectors for updateCardPositions (eliminates per-frame allocations)
const _v = {
    point: new THREE.Vector3(),
    tangent: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    heightDir: new THREE.Vector3(),
    up: new THREE.Vector3(0, 1, 0),
    heightOffset: new THREE.Vector3(),
    finalPos: new THREE.Vector3(),
    altAxis: new THREE.Vector3(1, 0, 0)
};

// ==========================================
// INITIALIZATION
// ==========================================
export async function initViewer(scene) {
    state.mainScene = scene;

    // Create carousel group (added to main scene like skyScene did)
    state.carouselGroup = new THREE.Group();
    state.carouselGroup.visible = false;
    scene.add(state.carouselGroup);

    // Setup CSS3D renderer
    setupCSS3D();

    // Load bezier path
    await loadPath();

    // Create cards along path
    createCards();

    // Create 3D title
    create3DTitle();
    updateProjectTitle(0);

    // Setup video overlay
    setupVideoOverlay();

    // Wait for timeline
    await state.timelineReady;

    // Setup YouTube message listener
    setupYouTubeMessageListener();

    // Setup keyboard for carousel navigation
    setupInteraction();

    console.log('Video viewer initialized with', state.cards.length, 'cards');
}

// ==========================================
// CSS3D RENDERER
// ==========================================
function setupCSS3D() {
    state.cssContainer = document.getElementById('css3d-container');
    state.cssScene = new THREE.Scene();
    state.cssRenderer = new CSS3DRenderer();
    state.cssRenderer.setSize(window.innerWidth, window.innerHeight);
    state.cssRenderer.domElement.style.position = 'absolute';
    state.cssRenderer.domElement.style.top = '0';
    state.cssRenderer.domElement.style.left = '0';
    state.cssRenderer.domElement.style.pointerEvents = 'auto';
    state.cssContainer.appendChild(state.cssRenderer.domElement);

    window.addEventListener('resize', () => {
        if (state.cssRenderer) {
            state.cssRenderer.setSize(window.innerWidth, window.innerHeight);
        }
    });
}

// ==========================================
// PATH LOADING
// ==========================================
async function loadPath() {
    try {
        const response = await fetch('assets/paths/portfolioPathNew.json');
        const data = await response.json();

        if (data.curves && data.curves[0] && data.curves[0][0]) {
            const curveData = data.curves[0][0];
            const points = curveData.points;
            const curvePath = new THREE.CurvePath();

            for (let i = 0; i < points.length - 1; i++) {
                const p0 = points[i];
                const p1 = points[i + 1];
                const bezier = new THREE.CubicBezierCurve3(
                    new THREE.Vector3(p0.position[0], p0.position[1], p0.position[2]),
                    new THREE.Vector3(p0.right_handle[0], p0.right_handle[1], p0.right_handle[2]),
                    new THREE.Vector3(p1.left_handle[0], p1.left_handle[1], p1.left_handle[2]),
                    new THREE.Vector3(p1.position[0], p1.position[1], p1.position[2])
                );
                curvePath.add(bezier);
            }
            state.path = curvePath;
        } else if (data.points) {
            const points = data.points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
            state.path = new THREE.CatmullRomCurve3(points, false);
        }
    } catch (error) {
        console.error('Failed to load path:', error);
        // Fallback
        const points = [
            new THREE.Vector3(15, 1, -10),
            new THREE.Vector3(10, 1, -5),
            new THREE.Vector3(5, 1, 0),
            new THREE.Vector3(0, 1, 3),
            new THREE.Vector3(-5, 1, 4),
            new THREE.Vector3(-10, 1, 3),
            new THREE.Vector3(-15, 1, 0)
        ];
        state.path = new THREE.CatmullRomCurve3(points, false);
    }
}

// ==========================================
// CARD CREATION (from carouselTest.js)
// ==========================================
function createCards() {
    const cardCount = Math.min(PROJECTS.length, Math.floor(1 / VIEWER_CONFIG.cardSpacing));

    for (let i = 0; i < cardCount; i++) {
        const card = createCard(PROJECTS[i], i);
        state.cards.push(card);
        state.carouselGroup.add(card.mesh);
    }

    updateCardPositions();
}

function createCard(projectData, index) {
    const geometry = new THREE.PlaneGeometry(
        VIEWER_CONFIG.cardWidth,
        VIEWER_CONFIG.cardHeight,
        VIEWER_CONFIG.cardSegments,
        1
    );

    const CardMaterial = THREE.MeshBasicMaterial;

    let frontMaterial;
    if (projectData.image) {
        const texture = new THREE.TextureLoader().load(projectData.image);
        texture.wrapS = THREE.RepeatWrapping;
        texture.repeat.x = -1;
        frontMaterial = new CardMaterial({ map: texture, side: THREE.BackSide, fog: false });
    } else {
        frontMaterial = new CardMaterial({ color: projectData.color, side: THREE.BackSide, fog: false });
    }

    const backMaterial = new CardMaterial({
        color: 0x333333,
        side: THREE.FrontSide,
        fog: false
    });

    const materials = [frontMaterial, backMaterial];
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.frustumCulled = false;

    geometry.clearGroups();
    const count = geometry.index ? geometry.index.count : geometry.attributes.position.count;
    geometry.addGroup(0, count, 0);
    geometry.addGroup(0, count, 1);

    const posAttr = geometry.getAttribute('position');
    const originalPositions = new Float32Array(posAttr.array.length);
    originalPositions.set(posAttr.array);

    return {
        mesh,
        data: projectData,
        index,
        baseT: index * VIEWER_CONFIG.cardSpacing,
        originalPositions,
        currentT: 0
    };
}

function updateCardPositions() {
    const halfWidth = VIEWER_CONFIG.cardWidth / 2;
    const halfPathWidth = (VIEWER_CONFIG.cardWidthInPathUnits * VIEWER_CONFIG.cardScale) / 2;
    const rotX = THREE.MathUtils.degToRad(VIEWER_CONFIG.cardRotation.x);

    state.cards.forEach((card) => {
        let centerT = VIEWER_CONFIG.mainCardT - card.baseT + state.globalOffset;
        centerT = Math.max(halfPathWidth + 0.001, Math.min(1 - halfPathWidth - 0.001, centerT));
        card.currentT = centerT;

        card.mesh.position.set(0, 0, 0);
        card.mesh.rotation.set(0, 0, 0);
        card.mesh.scale.setScalar(1);

        const geometry = card.mesh.geometry;
        const posAttr = geometry.getAttribute('position');
        const origPos = card.originalPositions;

        for (let i = 0; i < posAttr.count; i++) {
            const localX = origPos[i * 3];
            const localY = origPos[i * 3 + 1];

            const tOffset = (localX / halfWidth) * halfPathWidth;
            let t = centerT + tOffset;
            t = Math.max(0.001, Math.min(0.999, t));

            state.path.getPointAt(t, _v.point);
            state.path.getTangentAt(t, _v.tangent);
            _v.tangent.normalize();

            _v.normal.crossVectors(_v.tangent, _v.up);
            if (_v.normal.length() < 0.001) {
                _v.normal.crossVectors(_v.tangent, _v.altAxis);
            }
            _v.normal.normalize();

            _v.heightDir.crossVectors(_v.normal, _v.tangent).normalize();
            if (_v.heightDir.y < 0) _v.heightDir.negate();

            const scaledHeight = localY * VIEWER_CONFIG.cardScale;
            _v.heightOffset.copy(_v.heightDir).multiplyScalar(scaledHeight);
            _v.heightOffset.applyAxisAngle(_v.tangent, rotX);

            _v.finalPos.copy(_v.point).add(_v.heightOffset);
            posAttr.setXYZ(i, _v.finalPos.x, _v.finalPos.y, _v.finalPos.z);
        }

        posAttr.needsUpdate = true;

        const edgeFade = Math.min(centerT * 10, (1 - centerT) * 10, 1);
        const mats = Array.isArray(card.mesh.material) ? card.mesh.material : [card.mesh.material];
        mats.forEach(mat => {
            mat.opacity = edgeFade;
            mat.transparent = edgeFade < 1;
        });
    });
}

// ==========================================
// 3D TITLE (from carouselTest.js)
// ==========================================
function create3DTitle() {
    const mainPoint = state.path.getPointAt(VIEWER_CONFIG.mainCardT);

    state.titleGroup = new THREE.Group();

    const subtitleBaseHeight = 0.4;
    const titleBaseHeight = 0.6;

    const subtitleResult = createTextTexture('PROJECT', {
        fontSize: 64,
        fontStyle: VIEWER_CONFIG.fonts.subtitleStyle,
        fontWeight: VIEWER_CONFIG.fonts.subtitleWeight,
        paddingX: 40,
        paddingY: 20
    });
    const subtitleWidth = subtitleBaseHeight * subtitleResult.aspect;
    const subtitleGeo = new THREE.PlaneGeometry(subtitleWidth, subtitleBaseHeight);
    const subtitleMat = new THREE.MeshBasicMaterial({
        map: subtitleResult.texture,
        transparent: true,
        side: THREE.DoubleSide
    });
    state.subtitleMesh = new THREE.Mesh(subtitleGeo, subtitleMat);
    state.subtitleMesh.position.set(-0.8, 0.55, 0);
    state.titleGroup.add(state.subtitleMesh);

    const titleResult = createTextTexture('TRUE HERO', {
        fontSize: 96,
        paddingX: 50,
        paddingY: 25
    });
    const titleWidth = titleBaseHeight * titleResult.aspect;
    const titleGeo = new THREE.PlaneGeometry(titleWidth, titleBaseHeight);
    const titleMat = new THREE.MeshBasicMaterial({
        map: titleResult.texture,
        transparent: true,
        side: THREE.DoubleSide
    });
    state.titleMesh = new THREE.Mesh(titleGeo, titleMat);
    state.titleMesh.position.set(0, 0, 0);
    state.titleGroup.add(state.titleMesh);

    state.titleGroup.position.set(
        mainPoint.x + VIEWER_CONFIG.titleOffset.x,
        mainPoint.y + VIEWER_CONFIG.titleOffset.y,
        mainPoint.z + VIEWER_CONFIG.titleOffset.z
    );
    state.titleGroup.rotation.set(
        THREE.MathUtils.degToRad(VIEWER_CONFIG.titleRotation.x),
        THREE.MathUtils.degToRad(VIEWER_CONFIG.titleRotation.y),
        THREE.MathUtils.degToRad(VIEWER_CONFIG.titleRotation.z)
    );
    state.titleGroup.scale.setScalar(VIEWER_CONFIG.titleScale);

    state.carouselGroup.add(state.titleGroup);
}

function createTextTexture(text, options = {}) {
    const {
        fontSize = 72,
        fontFamily = VIEWER_CONFIG.fonts.family,
        fontStyle = VIEWER_CONFIG.fonts.titleStyle,
        fontWeight = VIEWER_CONFIG.fonts.titleWeight,
        textColor = VIEWER_CONFIG.fonts.textColor,
        bgColor = VIEWER_CONFIG.fonts.bgColor,
        skewX = VIEWER_CONFIG.fonts.skew,
        paddingX = 40,
        paddingY = 20
    } = options;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = fontSize;

    const skewCompensation = Math.abs(skewX) * textHeight;
    canvas.width = Math.ceil(textWidth + paddingX * 2 + skewCompensation);
    canvas.height = Math.ceil(textHeight + paddingY * 2);

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.setTransform(1, 0, skewX, 1, 0, 0);
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = textColor;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    return {
        texture,
        width: canvas.width,
        height: canvas.height,
        aspect: canvas.width / canvas.height
    };
}

function updateProjectTitle(projectIndex) {
    const project = PROJECTS[projectIndex];
    if (!project) return;

    let mainTitle = project.name.toUpperCase();

    const subtitleBaseHeight = 0.4;
    const titleBaseHeight = 0.6;

    if (state.subtitleMesh) {
        if (state.subtitleMesh.material.map) state.subtitleMesh.material.map.dispose();
        const subtitleResult = createTextTexture(project.subtitle || 'PROJECT', {
            fontSize: 64,
            fontStyle: VIEWER_CONFIG.fonts.subtitleStyle,
            fontWeight: VIEWER_CONFIG.fonts.subtitleWeight,
            paddingX: 40,
            paddingY: 20
        });
        const subtitleWidth = subtitleBaseHeight * subtitleResult.aspect;
        state.subtitleMesh.geometry.dispose();
        state.subtitleMesh.geometry = new THREE.PlaneGeometry(subtitleWidth, subtitleBaseHeight);
        state.subtitleMesh.material.map = subtitleResult.texture;
        state.subtitleMesh.material.needsUpdate = true;
    }

    if (state.titleMesh) {
        if (state.titleMesh.material.map) state.titleMesh.material.map.dispose();
        const titleResult = createTextTexture(mainTitle, {
            fontSize: 96,
            paddingX: 50,
            paddingY: 25
        });
        const titleWidth = titleBaseHeight * titleResult.aspect;
        state.titleMesh.geometry.dispose();
        state.titleMesh.geometry = new THREE.PlaneGeometry(titleWidth, titleBaseHeight);
        state.titleMesh.material.map = titleResult.texture;
        state.titleMesh.material.needsUpdate = true;
    }
}

// ==========================================
// VIDEO OVERLAY (CSS3D - from carouselTest.js)
// ==========================================
function setupVideoOverlay() {
    const videoWidth = 1920;
    const videoHeight = 1080;

    const videoContainer = document.createElement('div');
    videoContainer.id = 'video-overlay';
    videoContainer.style.width = `${videoWidth}px`;
    videoContainer.style.height = `${videoHeight}px`;
    videoContainer.style.background = '#000';
    videoContainer.style.overflow = 'hidden';
    videoContainer.style.pointerEvents = 'auto';
    videoContainer.style.position = 'relative';

    const createIframe = (id) => {
        const iframe = document.createElement('iframe');
        iframe.id = id;
        iframe.style.position = 'absolute';
        iframe.style.top = '0';
        iframe.style.left = '0';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.opacity = '0';
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;
        iframe.src = '';
        iframe.dataset.videoId = '';
        return iframe;
    };

    state.iframes = [
        createIframe('youtube-player-0'),
        createIframe('youtube-player-1'),
        createIframe('youtube-player-2')
    ];

    state.iframes.forEach(iframe => videoContainer.appendChild(iframe));

    // Click overlay to block YouTube UI
    const clickOverlay = document.createElement('div');
    clickOverlay.id = 'video-click-overlay';
    clickOverlay.style.cssText = `
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: transparent; cursor: pointer; z-index: 10;
    `;
    clickOverlay.addEventListener('click', () => toggleVideoPlayback());
    videoContainer.appendChild(clickOverlay);

    state.videoElement = videoContainer;
    state.videoContainerWidth = videoWidth;

    const cardWorldWidth = VIEWER_CONFIG.cardWidth * VIEWER_CONFIG.cardScale;
    state.videoBaseScale = cardWorldWidth / videoWidth;

    state.videoObject = new CSS3DObject(videoContainer);
    updateVideoScale();
    state.videoObject.visible = false;
    state.cssScene.add(state.videoObject);

    state.timelineReady = create3DTimeline();
}

function updateVideoScale() {
    const s = state.videoBaseScale * VIEWER_CONFIG.videoScale;
    state.videoObject.scale.set(s, s, s);
}

// ==========================================
// 3D TIMELINE (from carouselTest.js)
// ==========================================
async function create3DTimeline() {
    const width = VIEWER_CONFIG.timelineCanvasWidth;
    const height = VIEWER_CONFIG.timelineCanvasHeight;

    const timeline = document.createElement('div');
    timeline.id = 'video-timeline-3d';
    timeline.style.cssText = `
        width: ${width}px; height: ${height}px;
        position: relative; pointer-events: auto;
    `;

    const createImageLayer = (src, zIndex = 0, isButton = false) => {
        const img = document.createElement('img');
        img.src = src;
        img.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            pointer-events: none; z-index: ${zIndex};
            ${isButton ? 'transform: scale(1); filter: brightness(1);' : ''}
        `;
        return img;
    };

    timeline.appendChild(createImageLayer(VIEWER_CONFIG.timelineAssets.body, 0));

    const progressImg = createImageLayer(VIEWER_CONFIG.timelineAssets.progressFill, 1);
    progressImg.id = 'timeline-progress-img';
    progressImg.style.clipPath = 'inset(0 100% 0 0)';
    timeline.appendChild(progressImg);

    const playImg = createImageLayer(VIEWER_CONFIG.timelineAssets.buttons.play, 2, true);
    playImg.id = 'timeline-btn-play-img';
    timeline.appendChild(playImg);

    const pauseImg = createImageLayer(VIEWER_CONFIG.timelineAssets.buttons.pause, 2, true);
    pauseImg.id = 'timeline-btn-pause-img';
    pauseImg.style.opacity = '0';
    timeline.appendChild(pauseImg);

    const prevImg = createImageLayer(VIEWER_CONFIG.timelineAssets.buttons.prev, 2, true);
    prevImg.id = 'timeline-btn-prev-img';
    timeline.appendChild(prevImg);

    const nextImg = createImageLayer(VIEWER_CONFIG.timelineAssets.buttons.next, 2, true);
    nextImg.id = 'timeline-btn-next-img';
    timeline.appendChild(nextImg);

    state.timelineButtonImages = { play: playImg, pause: pauseImg, prev: prevImg, next: nextImg };

    const tt = VIEWER_CONFIG.timeText;

    const currentTime = document.createElement('span');
    currentTime.id = 'timeline-current';
    currentTime.style.cssText = `
        position: absolute; color: ${tt.currentColor};
        font-family: ${tt.fontFamily}; font-size: ${tt.fontSize}px;
        font-weight: ${tt.fontWeight}; letter-spacing: ${tt.letterSpacing}px;
        z-index: 5; pointer-events: none;
    `;
    currentTime.textContent = '0:00';
    timeline.appendChild(currentTime);

    const durationTime = document.createElement('span');
    durationTime.id = 'timeline-duration';
    durationTime.style.cssText = `
        position: absolute; color: ${tt.durationColor};
        font-family: ${tt.fontFamily}; font-size: ${tt.fontSize}px;
        font-weight: ${tt.fontWeight}; letter-spacing: ${tt.letterSpacing}px;
        z-index: 5; pointer-events: none;
    `;
    durationTime.textContent = '0:00';
    timeline.appendChild(durationTime);

    state.timelineElements = {
        current: currentTime,
        duration: durationTime,
        progress: progressImg
    };

    await scanTimelineAssets(timeline, currentTime, durationTime);

    state.timelineObject = new CSS3DObject(timeline);
    applyTimelineScale();
    state.cssScene.add(state.timelineObject);

    updateTimelinePosition();
}

async function getImageBounds(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            let minX = canvas.width, minY = canvas.height;
            let maxX = 0, maxY = 0;
            let found = false;

            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    const alpha = data[(y * canvas.width + x) * 4 + 3];
                    if (alpha > 10) {
                        found = true;
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                }
            }

            if (found) {
                resolve({
                    x: minX, y: minY,
                    width: maxX - minX, height: maxY - minY,
                    centerX: minX + (maxX - minX) / 2,
                    centerY: minY + (maxY - minY) / 2
                });
            } else {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

async function scanTimelineAssets(timeline, currentTimeEl, durationTimeEl) {
    const buttonConfigs = [
        { name: 'prev', src: VIEWER_CONFIG.timelineAssets.buttons.prev, action: () => prev() },
        { name: 'play', src: VIEWER_CONFIG.timelineAssets.buttons.play, action: () => onTimelinePlayClick() },
        { name: 'next', src: VIEWER_CONFIG.timelineAssets.buttons.next, action: () => next() }
    ];

    for (const btn of buttonConfigs) {
        const bounds = await getImageBounds(btn.src);
        if (bounds) {
            const hitbox = document.createElement('div');
            hitbox.className = 'timeline-hitbox';
            hitbox.dataset.button = btn.name;
            hitbox.style.cssText = `
                position: absolute; left: ${bounds.x}px; top: ${bounds.y}px;
                width: ${bounds.width}px; height: ${bounds.height}px;
                cursor: pointer; z-index: 10;
            `;
            hitbox.dataset.centerX = bounds.centerX;
            hitbox.dataset.centerY = bounds.centerY;

            hitbox.addEventListener('click', (e) => {
                e.stopPropagation();
                if (btn.name === 'play') {
                    animateTimelineButton(state.isVideoPlaying ? 'pause' : 'play');
                } else {
                    animateTimelineButton(btn.name);
                }
                btn.action();
            });

            hitbox.addEventListener('mouseenter', () => {
                if (btn.name === 'play') {
                    animatePlayPauseHover(true);
                } else {
                    animateTimelineButtonHover(btn.name, true);
                }
            });
            hitbox.addEventListener('mouseleave', () => {
                if (btn.name === 'play') {
                    animatePlayPauseHover(false);
                } else {
                    animateTimelineButtonHover(btn.name, false);
                }
            });

            timeline.appendChild(hitbox);
            state.timelineHitboxes[btn.name] = { hitbox, bounds };
        }
    }

    const time1Bounds = await getImageBounds(VIEWER_CONFIG.timelineAssets.time1Ref);
    const time2Bounds = await getImageBounds(VIEWER_CONFIG.timelineAssets.time2Ref);

    if (time1Bounds) {
        currentTimeEl.style.left = `${time1Bounds.centerX}px`;
        currentTimeEl.style.top = `${time1Bounds.centerY}px`;
        currentTimeEl.style.transform = 'translate(-50%, -50%)';
    }
    if (time2Bounds) {
        durationTimeEl.style.left = `${time2Bounds.centerX}px`;
        durationTimeEl.style.top = `${time2Bounds.centerY}px`;
        durationTimeEl.style.transform = 'translate(-50%, -50%)';
    }

    const progressBounds = await getImageBounds(VIEWER_CONFIG.timelineAssets.progressFill);
    if (!progressBounds) return;
    state.progressBounds = progressBounds;

    // Scrubber dot
    const scrubberDot = document.createElement('div');
    scrubberDot.id = 'timeline-scrubber-dot';
    scrubberDot.style.cssText = `
        position: absolute; width: 60px; height: 60px;
        background: #fff; border-radius: 50%;
        top: ${VIEWER_CONFIG.progressMarkerA.y}px;
        left: ${VIEWER_CONFIG.progressMarkerA.x}px;
        transform: translate(-50%, -50%);
        pointer-events: none; z-index: 10;
        box-shadow: 0 0 20px rgba(255,255,255,0.5); opacity: 0.9;
    `;
    timeline.appendChild(scrubberDot);
    state.scrubberDot = scrubberDot;

    // Progress hitbox for scrubbing
    const progressHitbox = document.createElement('div');
    progressHitbox.id = 'timeline-progress-hitbox';
    progressHitbox.style.cssText = `
        position: absolute; left: ${progressBounds.x}px;
        top: ${progressBounds.y - 30}px;
        width: ${progressBounds.width}px;
        height: ${progressBounds.height + 60}px;
        cursor: pointer; z-index: 9;
    `;

    let isDragging = false;

    const numSamples = 11;
    state.progressRefMarkers = [];

    for (let i = 0; i < numSamples; i++) {
        const t = i / (numSamples - 1);
        const localX = VIEWER_CONFIG.progressMarkerA.x + t * (VIEWER_CONFIG.progressMarkerB.x - VIEWER_CONFIG.progressMarkerA.x);
        const localY = VIEWER_CONFIG.progressMarkerA.y + t * (VIEWER_CONFIG.progressMarkerB.y - VIEWER_CONFIG.progressMarkerA.y);

        const marker = document.createElement('div');
        marker.className = 'progress-ref-marker';
        marker.style.cssText = `
            position: absolute; width: 4px; height: 4px;
            left: ${localX}px; top: ${localY}px;
            pointer-events: none; z-index: 1;
        `;
        marker.dataset.percent = t;
        timeline.appendChild(marker);
        state.progressRefMarkers.push(marker);
    }

    const updateProgress = (e) => {
        let percent;
        if (state.progressRefMarkers && state.progressRefMarkers.length >= 2) {
            const samples = state.progressRefMarkers.map(marker => {
                const rect = marker.getBoundingClientRect();
                return { screenX: rect.left + rect.width / 2, percent: parseFloat(marker.dataset.percent) };
            });
            const mouseX = e.clientX;
            for (let i = 0; i < samples.length - 1; i++) {
                const curr = samples[i];
                const nextS = samples[i + 1];
                if (mouseX >= curr.screenX && mouseX <= nextS.screenX) {
                    const t = (mouseX - curr.screenX) / (nextS.screenX - curr.screenX);
                    percent = curr.percent + t * (nextS.percent - curr.percent);
                    break;
                }
            }
            if (percent === undefined) {
                percent = mouseX < samples[0].screenX ? 0 : 1;
            }
        } else {
            const rect = progressHitbox.getBoundingClientRect();
            percent = (e.clientX - rect.left) / rect.width;
        }
        percent = Math.max(0, Math.min(1, percent));
        updateScrubberPosition(percent);
        seekToPercent(percent);
    };

    progressHitbox.addEventListener('mousedown', (e) => {
        isDragging = true;
        updateProgress(e);
        if (state.scrubberDot) {
            gsap.to(state.scrubberDot, { scale: 1.3, boxShadow: '0 0 30px rgba(255,255,255,0.8)', duration: 0.15 });
        }
    });

    progressHitbox.addEventListener('mouseenter', () => {
        if (state.scrubberDot && !isDragging) gsap.to(state.scrubberDot, { scale: 1.15, duration: 0.2 });
    });
    progressHitbox.addEventListener('mouseleave', () => {
        if (state.scrubberDot && !isDragging) gsap.to(state.scrubberDot, { scale: 1, duration: 0.2 });
    });

    document.addEventListener('mousemove', (e) => { if (isDragging) updateProgress(e); });
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            if (state.scrubberDot) {
                gsap.to(state.scrubberDot, { scale: 1, boxShadow: '0 0 20px rgba(255,255,255,0.5)', duration: 0.2 });
            }
        }
    });

    timeline.appendChild(progressHitbox);
}

function updateScrubberPosition(percent) {
    if (!state.scrubberDot) return;
    const markerA = VIEWER_CONFIG.progressMarkerA;
    const markerB = VIEWER_CONFIG.progressMarkerB;
    const x = markerA.x + (percent * (markerB.x - markerA.x));
    const y = markerA.y + (percent * (markerB.y - markerA.y));
    state.scrubberDot.style.left = `${x}px`;
    state.scrubberDot.style.top = `${y}px`;

    if (state.timelineElements && state.timelineElements.progress) {
        const canvasWidth = VIEWER_CONFIG.timelineCanvasWidth;
        const clipRight = ((canvasWidth - x) / canvasWidth) * 100;
        state.timelineElements.progress.style.clipPath = `inset(0 ${clipRight}% 0 0)`;
    }
}

function applyTimelineScale() {
    if (state.timelineObject) {
        state.timelineObject.scale.setScalar(VIEWER_CONFIG.timelineScale * VIEWER_CONFIG.timelinePixelsToWorld);
    }
}

function updateTimelinePosition() {
    if (!state.timelineObject || !state.path) return;
    const mainPoint = state.path.getPointAt(VIEWER_CONFIG.mainCardT);
    const groupOffset = state.carouselGroup.position;
    state.timelineObject.position.set(
        mainPoint.x + VIEWER_CONFIG.timelineOffset.x + groupOffset.x,
        mainPoint.y + VIEWER_CONFIG.timelineOffset.y + groupOffset.y,
        mainPoint.z + VIEWER_CONFIG.timelineOffset.z + groupOffset.z
    );
    state.timelineObject.rotation.set(
        THREE.MathUtils.degToRad(VIEWER_CONFIG.timelineRotation.x),
        THREE.MathUtils.degToRad(VIEWER_CONFIG.timelineRotation.y),
        THREE.MathUtils.degToRad(VIEWER_CONFIG.timelineRotation.z)
    );
}

// ==========================================
// TIMELINE BUTTON ANIMATIONS
// ==========================================
function animateTimelineButton(name) {
    const img = state.timelineButtonImages[name];
    if (!img) return;
    const hitboxData = state.timelineHitboxes[name];
    const bounds = hitboxData?.bounds;
    const isHovered = state.buttonHoverStates?.[name] ?? false;
    const hoverScale = 1.08;
    const hoverBrightness = 1.15;

    if (bounds) img.style.transformOrigin = `${bounds.centerX}px ${bounds.centerY}px`;

    const scaleBack = isHovered ? hoverScale : 1;
    const brightnessBack = isHovered ? hoverBrightness : 1;

    gsap.timeline()
        .to(img, { scale: 0.92, filter: 'brightness(1.3)', duration: 0.075, ease: 'power2.in' })
        .to(img, { scale: scaleBack, filter: `brightness(${brightnessBack})`, duration: 0.175, ease: 'elastic.out(1, 0.3)' });
}

function animateTimelineButtonHover(name, isHovering) {
    const img = state.timelineButtonImages[name];
    if (!img) return;
    if (state.buttonHoverStates) state.buttonHoverStates[name] = isHovering;
    const hitboxData = state.timelineHitboxes[name];
    const bounds = hitboxData?.bounds;
    if (bounds) img.style.transformOrigin = `${bounds.centerX}px ${bounds.centerY}px`;

    gsap.to(img, { scale: isHovering ? 1.08 : 1, duration: 0.3, ease: 'elastic.out(1, 0.2)' });
    gsap.to(img, { filter: isHovering ? 'brightness(1.15)' : 'brightness(1)', duration: 0.15, ease: 'power2.out' });
}

function animatePlayPauseHover(isHovering) {
    if (!state.timelineButtonImages) return;
    const { play, pause } = state.timelineButtonImages;
    if (state.buttonHoverStates) {
        state.buttonHoverStates.play = isHovering;
        state.buttonHoverStates.pause = isHovering;
    }
    const hitboxData = state.timelineHitboxes['play'];
    const bounds = hitboxData?.bounds;
    if (bounds) {
        play.style.transformOrigin = `${bounds.centerX}px ${bounds.centerY}px`;
        pause.style.transformOrigin = `${bounds.centerX}px ${bounds.centerY}px`;
    }
    gsap.to([play, pause], { scale: isHovering ? 1.08 : 1, duration: 0.3, ease: 'elastic.out(1, 0.2)' });
    gsap.to([play, pause], { filter: isHovering ? 'brightness(1.15)' : 'brightness(1)', duration: 0.15, ease: 'power2.out' });
}

function onTimelinePlayClick() {
    toggleVideoPlayback();
}

function setPlayPauseState(isPlaying) {
    if (!state.timelineButtonImages) return;
    const { play, pause } = state.timelineButtonImages;
    gsap.killTweensOf(play);
    gsap.killTweensOf(pause);
    play.style.opacity = isPlaying ? '0' : '1';
    pause.style.opacity = isPlaying ? '1' : '0';
}

function updatePlayPauseButton() {
    if (!state.timelineButtonImages || state.isSeeking) return;
    const { play, pause } = state.timelineButtonImages;
    gsap.killTweensOf(play);
    gsap.killTweensOf(pause);
    const duration = 0.15;
    if (state.isVideoPlaying) {
        gsap.to(play, { opacity: 0, duration, ease: 'power2.out' });
        gsap.to(pause, { opacity: 1, duration, ease: 'power2.out' });
    } else {
        gsap.to(play, { opacity: 1, duration, ease: 'power2.out' });
        gsap.to(pause, { opacity: 0, duration, ease: 'power2.out' });
    }
}

// ==========================================
// VIDEO / YOUTUBE (from carouselTest.js)
// ==========================================
function setupYouTubeMessageListener() {
    window.addEventListener('message', (event) => {
        if (event.origin !== 'https://www.youtube.com') return;
        try {
            const data = JSON.parse(event.data);
            if (data.event === 'infoDelivery' && data.info) {
                if (data.info.currentTime !== undefined) {
                    state.videoCurrentTime = data.info.currentTime;
                    updateTimelineDisplay();
                }
                if (data.info.duration !== undefined) {
                    state.videoDuration = data.info.duration;
                    updateTimelineDisplay();
                }
                if (data.info.playerState !== undefined) {
                    const newState = data.info.playerState === 1;
                    const timeSinceToggle = Date.now() - state.lastPlayPauseToggle;
                    if (timeSinceToggle < 500) return;
                    if (state.isVideoPlaying !== newState) {
                        state.isVideoPlaying = newState;
                        updatePlayPauseButton();
                    }
                }
            }
            if (data.event === 'onReady') {
                requestVideoInfo();
            }
        } catch (e) { /* ignore */ }
    });

    setInterval(() => {
        if (state.isVideoPlaying) requestVideoInfo();
    }, 500);
}

function requestVideoInfo() {
    if (state.activeIframeIndex === null) return;
    const iframe = state.iframes[state.activeIframeIndex];
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(JSON.stringify({
            event: 'listening', id: iframe.id
        }), '*');
    }
}

function updateTimelineDisplay() {
    if (!state.timelineElements) return;
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    state.timelineElements.current.textContent = formatTime(state.videoCurrentTime);
    state.timelineElements.duration.textContent = formatTime(state.videoDuration);
    if (state.videoDuration > 0) {
        const percent = state.videoCurrentTime / state.videoDuration;
        updateScrubberPosition(percent);
    }
}

function seekToPercent(percent) {
    if (state.videoDuration <= 0) return;
    const seekTime = percent * state.videoDuration;
    if (state.activeIframeIndex === null) return;
    const iframe = state.iframes[state.activeIframeIndex];
    if (iframe && iframe.contentWindow) {
        state.isSeeking = true;
        if (state.seekTimeout) clearTimeout(state.seekTimeout);
        iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command', func: 'seekTo', args: [seekTime, true]
        }), '*');
        state.seekTimeout = setTimeout(() => { state.isSeeking = false; }, 300);
    }
}


function loadVideoIntoIframe(iframeIndex, videoId) {
    if (!videoId) return;
    const iframe = state.iframes[iframeIndex];
    if (iframe.dataset.videoId === videoId) return;
    iframe.dataset.videoId = videoId;
    iframe.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=0&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&fs=0&controls=0`;
    state.iframeAssignments[videoId] = iframeIndex;
}

function getIframeForVideo(videoId) {
    if (state.iframeAssignments[videoId] !== undefined) return state.iframeAssignments[videoId];
    for (let i = 0; i < state.iframes.length; i++) {
        if (i !== state.activeIframeIndex) return i;
    }
    return 0;
}

function showVideo(videoId) {
    state.renderFramesLeft = Math.max(state.renderFramesLeft, 15);
    if (!videoId) return;
    const targetIframeIndex = state.iframeAssignments[videoId];
    if (targetIframeIndex !== undefined && state.iframes[targetIframeIndex].dataset.videoId === videoId) {
        swapToIframe(targetIframeIndex);
    } else {
        const freeIndex = getIframeForVideo(videoId);
        loadVideoIntoIframe(freeIndex, videoId);
        state.activeIframeIndex = freeIndex;
        setTimeout(() => swapToIframe(freeIndex), 100);
    }
}

function swapToIframe(newIndex) {
    state.iframes.forEach((iframe, i) => {
        gsap.to(iframe, { opacity: i === newIndex ? 1 : 0, duration: 0.2, ease: 'power2.inOut' });
    });
    state.activeIframeIndex = newIndex;
}


function toggleVideoPlayback() {
    // Lazy load: first play triggers iframe creation
    if (!state.videoLoaded) {
        loadAndPlayVideo();
        return;
    }
    if (state.activeIframeIndex === null) return;
    const activeIframe = state.iframes[state.activeIframeIndex];
    if (activeIframe && activeIframe.contentWindow) {
        const command = state.isVideoPlaying ? 'pauseVideo' : 'playVideo';
        state.lastPlayPauseToggle = Date.now();
        state.isVideoPlaying = !state.isVideoPlaying;
        setPlayPauseState(state.isVideoPlaying);
        activeIframe.contentWindow.postMessage(JSON.stringify({
            event: 'command', func: command, args: []
        }), '*');
    }
}

function pauseCurrentVideo() {
    if (state.activeIframeIndex === null) return;
    const activeIframe = state.iframes[state.activeIframeIndex];
    if (activeIframe && activeIframe.contentWindow && state.isVideoPlaying) {
        activeIframe.contentWindow.postMessage(JSON.stringify({
            event: 'command', func: 'pauseVideo', args: []
        }), '*');
        state.isVideoPlaying = false;
    }
}

function loadAndPlayVideo() {
    const project = PROJECTS[state.currentIndex];
    if (!project || !project.youtubeId) return;

    state.videoLoaded = true;
    state.renderFramesLeft = Math.max(state.renderFramesLeft, 60);

    // Auto-play after iframe has time to load
    setTimeout(() => {
        if (state.activeIframeIndex !== null) {
            const iframe = state.iframes[state.activeIframeIndex];
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage(JSON.stringify({
                    event: 'command', func: 'playVideo', args: []
                }), '*');
                state.isVideoPlaying = true;
                setPlayPauseState(true);
            }
        }
    }, 800);
}

function unloadCurrentVideo() {
    if (!state.videoLoaded) return;

    pauseCurrentVideo();
    state.videoLoaded = false;
    state.currentVideoId = null;

    // Clear all iframes to free GPU memory
    state.iframes.forEach(iframe => {
        iframe.src = '';
        iframe.dataset.videoId = '';
        iframe.style.opacity = '0';
    });
    state.iframeAssignments = {};
    state.activeIframeIndex = null;
    state.isVideoPlaying = false;
    state.videoCurrentTime = 0;
    state.videoDuration = 0;

    setPlayPauseState(false);
    if (state.timelineElements) {
        state.timelineElements.current.textContent = '0:00';
        state.timelineElements.duration.textContent = '0:00';
        updateScrubberPosition(0);
    }

    state.renderFramesLeft = Math.max(state.renderFramesLeft, 15);
}

// ==========================================
// NAVIGATION
// ==========================================
function next() {
    if (state.currentIndex >= PROJECTS.length - 1) return;
    unloadCurrentVideo();
    state.currentIndex++;
    state.targetOffset += VIEWER_CONFIG.cardSpacing;
    animateToTarget();
    updateProjectTitle(state.currentIndex);
    updateTimelineVisibility();
    teleportViewerToSpot(state.currentIndex);
    const project = PROJECTS[state.currentIndex];
    if (project) notifyProjectEntered(project.id, project.framerHash);
}

function prev() {
    if (state.currentIndex <= 0) return;
    unloadCurrentVideo();
    state.currentIndex--;
    state.targetOffset -= VIEWER_CONFIG.cardSpacing;
    animateToTarget();
    updateProjectTitle(state.currentIndex);
    updateTimelineVisibility();
    teleportViewerToSpot(state.currentIndex);
    const project = PROJECTS[state.currentIndex];
    if (project) notifyProjectEntered(project.id, project.framerHash);
}

function goToProject(index) {
    index = Math.max(0, Math.min(PROJECTS.length - 1, index));
    const steps = index - state.currentIndex;
    state.targetOffset += steps * VIEWER_CONFIG.cardSpacing;
    state.currentIndex = index;
    animateToTarget();
    updateProjectTitle(state.currentIndex);
}

function animateToTarget() {
    gsap.killTweensOf(state, "globalOffset");
    state.isAnimating = true;
    state.renderFramesLeft = Math.max(state.renderFramesLeft, 60);
    gsap.to(state, {
        globalOffset: state.targetOffset,
        duration: 0.6,
        ease: "elastic.out(0.5,0.2)",
        onUpdate: () => updateCardPositions(),
        onComplete: () => { state.isAnimating = false; }
    });
}

// ==========================================
// FLY-IN ANIMATION (modified for project index)
// ==========================================
function setIntroStartState() {
    state.cards.forEach(card => card.mesh.visible = false);
    state.globalOffset = -0.85; // Always start from same point (all cards off-curve)
    updateCardPositions();
    if (state.timelineObject) state.timelineObject.visible = false;
    if (state.titleGroup) state.titleGroup.visible = false;
}

function flyInToProject(projectIndex) {
    const targetOffset = projectIndex * VIEWER_CONFIG.cardSpacing;
    state.currentIndex = projectIndex;
    state.targetOffset = targetOffset;
    state.renderFramesLeft = 180; // ~3s of rendering for fly-in

    setIntroStartState();
    createFlyInTimeline(targetOffset);
}

function createFlyInTimeline(targetOffset) {
    const tl = gsap.timeline({ delay: VIEWER_CONFIG.flyInDelay });

    tl.call(() => {
        state.cards.forEach((card, index) => {
            const project = PROJECTS[index];
            if (index === state.currentIndex && project && project.youtubeId) {
                card.mesh.visible = false;
                state.hiddenCardIndex = index;
            } else {
                card.mesh.visible = true;
            }
        });
        updateCardPositions();
    });

    tl.to({}, { duration: VIEWER_CONFIG.flyInHold });

    tl.call(() => {
        if (state.timelineObject) {
            state.timelineObject.visible = true;
            state.timelineObject.scale.setScalar(0);
        }
        if (state.titleGroup) {
            state.titleGroup.visible = true;
            state.titleGroup.scale.setScalar(0);
        }
    }, [], VIEWER_CONFIG.flyInHold);

    tl.to(state, {
        globalOffset: targetOffset,
        duration: 1.2,
        ease: CustomEase.create("custom", "M0,0 C0,0 0.23157,0.91941 0.28491,1.07864 0.28731,1.0832 0.29051,1.08856 0.29291,1.09152 0.29531,1.09366 0.29931,1.09796 0.30251,1.09904 0.30491,1.09984 0.30971,1.09984 0.31211,1.09904 0.31611,1.09796 0.32251,1.09233 0.32491,1.08964 0.32891,1.08562 0.33371,1.07783 0.33851,1.07112 0.35051,1.05314 0.3729,1.00806 0.3865,0.99061 0.3913,0.9839 0.4001,0.97584 0.4049,0.97209 0.4073,0.97021 0.4105,0.96833 0.4129,0.96752 0.4153,0.96645 0.4201,0.96511 0.4233,0.96484 0.4257,0.9643 0.4305,0.96456 0.4329,0.96484 0.4361,0.96537 0.4401,0.96617 0.4449,0.96805 0.4601,0.97449 0.49129,0.99624 0.50648,1.00321 0.51208,1.00562 0.51928,1.00831 0.52408,1.00938 0.52808,1.01046 0.53688,1.01207 0.54168,1.01234 0.54728,1.01261 0.55848,1.01181 0.56568,1.011 0.58008,1.00912 0.61207,1.0008 0.62647,0.99866 0.63527,0.99732 0.64807,0.99571 0.65926,0.99544 0.68566,0.99491 0.74645,1.00081 0.77604,1.00135 0.80564,1.00188 0.86483,0.99947 0.89442,0.99947 0.92082,0.9992 1,1 1,1 "),
        onUpdate: () => updateCardPositions()
    }, VIEWER_CONFIG.flyInHold);

    if (state.titleGroup) {
        tl.to(state.titleGroup.scale, {
            x: VIEWER_CONFIG.titleScale,
            y: VIEWER_CONFIG.titleScale,
            z: VIEWER_CONFIG.titleScale,
            delay: 0.4,
            duration: 0.6,
            ease: "elastic.out(1,0.3)"
        }, VIEWER_CONFIG.flyInHold);
    }

    if (state.timelineObject) {
        const timelineScale = VIEWER_CONFIG.timelineScale * VIEWER_CONFIG.timelinePixelsToWorld;
        tl.to(state.timelineObject.scale, {
            x: timelineScale,
            y: timelineScale,
            z: timelineScale,
            delay: 0.4,
            duration: 0.6,
            ease: "elastic.out(1,0.3)"
        }, VIEWER_CONFIG.flyInHold);
    }

    return tl;
}

// ==========================================
// INTERACTION
// ==========================================
function setupInteraction() {
    document.addEventListener('keydown', (e) => {
        if (!state.active || state.transitioning) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    });
}

// ==========================================
// VIDEO OVERLAY UPDATE (per frame)
// ==========================================
function updateVideoOverlay() {
    if (!state.videoObject || !state.cards.length) return;

    const focusedCard = state.cards[state.currentIndex];
    if (!focusedCard) return;

    const project = PROJECTS[state.currentIndex];
    const groupOffset = state.carouselGroup.position;

    if (project && project.youtubeId && state.videoLoaded) {
        state.videoObject.visible = true;

        if (state.hiddenCardIndex !== state.currentIndex) {
            if (state.hiddenCardIndex !== null && state.cards[state.hiddenCardIndex]) {
                state.cards[state.hiddenCardIndex].mesh.visible = true;
            }
            focusedCard.mesh.visible = false;
            state.hiddenCardIndex = state.currentIndex;
        }

        if (state.currentVideoId !== project.youtubeId) {
            state.currentVideoId = project.youtubeId;
            showVideo(project.youtubeId);
        }

        const centerT = focusedCard.currentT;
        const position = state.path.getPointAt(centerT);
        const tangent = state.path.getTangentAt(centerT).normalize();

        const up = new THREE.Vector3(0, 1, 0);
        let normal = new THREE.Vector3().crossVectors(tangent, up);
        if (normal.length() < 0.001) {
            normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(1, 0, 0));
        }
        normal.normalize();

        let heightDir = new THREE.Vector3().crossVectors(normal, tangent).normalize();
        if (heightDir.y < 0) heightDir.negate();

        // Add group offset for CSS3D world-space positioning
        state.videoObject.position.copy(position).add(groupOffset);

        const matrix = new THREE.Matrix4();
        matrix.makeBasis(tangent, heightDir, normal);
        state.videoObject.quaternion.setFromRotationMatrix(matrix);

        const rotX = THREE.MathUtils.degToRad(VIEWER_CONFIG.cardRotation.x);
        const rotY = THREE.MathUtils.degToRad(VIEWER_CONFIG.cardRotation.y);
        const rotZ = THREE.MathUtils.degToRad(VIEWER_CONFIG.cardRotation.z);
        state.videoObject.rotateX(rotX);
        state.videoObject.rotateY(rotY);
        state.videoObject.rotateZ(rotZ);

        const s = state.videoBaseScale * VIEWER_CONFIG.videoScale;
        state.videoObject.scale.set(s, s, s);
    } else {
        state.videoObject.visible = false;
        if (state.hiddenCardIndex !== null && state.cards[state.hiddenCardIndex]) {
            state.cards[state.hiddenCardIndex].mesh.visible = true;
            state.hiddenCardIndex = null;
        }
    }
}

// ==========================================
// LOCKED CARD UTILITIES
// ==========================================
function updateTimelineVisibility() {
    if (!state.timelineObject) return;
    const project = PROJECTS[state.currentIndex];
    state.timelineObject.visible = !(project && project.locked);
}

// ==========================================
// TELEPORT SPOTS & VIEWER POSITIONING
// ==========================================
export function setViewerTeleportSpots(spots) {
    state.viewerTeleportSpots = spots;
}

function prepareForFlyIn(projectIndex) {
    const targetOffset = projectIndex * VIEWER_CONFIG.cardSpacing;
    state.currentIndex = projectIndex;
    state.targetOffset = targetOffset;

    // Hide all cards
    state.cards.forEach(card => card.mesh.visible = false);

    // Always start from a fixed offset that pushes all cards off the curve
    // Card 0 has centerT = mainCardT + globalOffset, so we need globalOffset < -mainCardT
    state.globalOffset = -0.85;
    updateCardPositions();

    // Hide title and timeline (will be scaled in by fly-in)
    if (state.titleGroup) {
        state.titleGroup.visible = false;
        state.titleGroup.scale.setScalar(0);
    }
    if (state.timelineObject) {
        state.timelineObject.visible = false;
        state.timelineObject.scale.setScalar(0);
    }

    // Hide video overlay
    if (state.videoObject) {
        state.videoObject.visible = false;
    }
}

function teleportViewerToSpot(index) {
    const spot = state.viewerTeleportSpots[index];
    if (!spot) return;

    const newX = spot.x;
    const deltaX = newX - state.viewerGroupOffset.x;

    // Only shift X (keep Y constant during viewer session)
    state.viewerGroupOffset.x = newX;
    state.carouselGroup.position.x = newX;

    // Also teleport camera X
    if (state.mainCamera) {
        state.mainCamera.position.x += deltaX;
    }
}

// ==========================================
// TRANSITIONS
// ==========================================
export function enterViewer(camera, scene, worldScene, roomScene, character, cameraState, projectIndex) {
    state.active = true;
    state.transitioning = true;
    state.videoLoaded = false;
    state.mainCamera = camera;
    state.characterX = character.x;
    state.characterY = character.y;

    // Position carousel above the project's spot
    const spot = state.viewerTeleportSpots[projectIndex];
    const spotX = spot ? spot.x : character.x;
    const spotY = spot ? spot.y : character.y;
    state.viewerGroupOffset = { x: spotX, y: spotY + state.viewerElevation, z: 0 };
    state.carouselGroup.position.set(state.viewerGroupOffset.x, state.viewerGroupOffset.y, state.viewerGroupOffset.z);

    // Save camera state
    state.savedCameraPos = camera.position.clone();
    state.savedCameraQuat = camera.quaternion.clone();
    state.savedFov = camera.fov;

    // Kill any in-flight tweens
    if (state.transitionTween) { state.transitionTween.kill(); state.transitionTween = null; }
    if (state.transitionFovTween) { state.transitionFovTween.kill(); state.transitionFovTween = null; }

    // Pre-set fly-in state
    prepareForFlyIn(projectIndex);

    const overlay = document.getElementById('transition-overlay');

    // Fade to black
    gsap.to(overlay, {
        opacity: 1,
        duration: 0.4,
        ease: "power2.inOut",
        onComplete: () => {
            // While screen is black: set up everything instantly
            if (worldScene) worldScene.visible = false;
            if (roomScene) roomScene.visible = false;

            // Show carousel (cards hidden by prepareForFlyIn)
            state.carouselGroup.visible = true;

            // Move camera to carousel view instantly
            const targetCamPos = new THREE.Vector3(
                VIEWER_CONFIG.camera.position.x + state.viewerGroupOffset.x,
                VIEWER_CONFIG.camera.position.y + state.viewerGroupOffset.y,
                VIEWER_CONFIG.camera.position.z
            );
            camera.position.copy(targetCamPos);

            const targetEuler = new THREE.Euler(
                VIEWER_CONFIG.camera.rotation.x,
                VIEWER_CONFIG.camera.rotation.y,
                0, 'YXZ'
            );
            camera.quaternion.setFromEuler(targetEuler);
            camera.fov = VIEWER_CONFIG.camera.fov;
            if (cameraState) cameraState.currentFov = camera.fov;
            camera.updateProjectionMatrix();

            // Set fog for viewer
            scene.fog.near = 5;
            scene.fog.far = 50;

            // Show CSS3D
            state.cssContainer.classList.add('active');
            notifySceneChanged('viewer');

            // Start fly-in while still covered by black overlay
            state.transitioning = false;
            flyInToProject(projectIndex);
            updateProjectTitle(projectIndex);
            updateTimelineVisibility();
            const project = PROJECTS[projectIndex];
            if (project) notifyProjectEntered(project.id, project.framerHash);

            // Fade from black (fly-in animation already running)
            gsap.to(overlay, {
                opacity: 0,
                duration: 0.4,
                ease: "power2.inOut"
            });
        }
    });
}

export function exitViewer(camera, scene, worldScene, roomScene, character, cameraState, CONFIG, onReady) {
    state.active = false;
    state.transitioning = true;

    // Pause video
    pauseCurrentVideo();

    if (state.transitionTween) { state.transitionTween.kill(); state.transitionTween = null; }
    if (state.transitionFovTween) { state.transitionFovTween.kill(); state.transitionFovTween = null; }

    const overlay = document.getElementById('transition-overlay');

    // Fade to black
    gsap.to(overlay, {
        opacity: 1,
        duration: 0.4,
        ease: "power2.inOut",
        onComplete: () => {
            // While screen is black: swap scenes
            state.cssContainer.classList.remove('active');
            state.carouselGroup.visible = false;
            state.carouselGroup.position.set(0, 0, 0);
            state.viewerGroupOffset = { x: 0, y: 0, z: 0 };

            if (worldScene) worldScene.visible = true;
            if (roomScene) roomScene.visible = true;

            // Restore fog instantly
            scene.fog.near = CONFIG.scene.fogNear;
            scene.fog.far = CONFIG.scene.fogFar;

            notifySceneChanged('ground');
            notifyProjectExited();

            // Unload YouTube iframes to free GPU memory
            state.iframes.forEach(iframe => {
                iframe.src = '';
                iframe.dataset.videoId = '';
                iframe.style.opacity = '0';
            });
            state.iframeAssignments = {};
            state.activeIframeIndex = null;
            state.currentVideoId = null;
            state.isVideoPlaying = false;
            state.videoLoaded = false;
            state.videoCurrentTime = 0;
            state.videoDuration = 0;

            // Let caller set up camera and character while covered
            if (onReady) onReady();

            // Fade from black
            gsap.to(overlay, {
                opacity: 0,
                duration: 0.4,
                ease: "power2.inOut",
                onComplete: () => {
                    state.transitioning = false;
                }
            });
        }
    });
}

// ==========================================
// UPDATE (called from main animation loop)
// ==========================================
export function updateViewer(camera) {
    if (!state.active) return;

    state.mainCamera = camera;

    // Skip heavy CSS3D work during camera transition
    if (state.transitioning) return;

    // Only do expensive rendering when something is changing
    const needsRender = state.isAnimating || state.renderFramesLeft > 0;

    if (needsRender) {
        updateVideoOverlay();
        updateTimelinePosition();

        if (state.cssRenderer && state.cssScene) {
            state.cssRenderer.render(state.cssScene, camera);
        }

        if (state.renderFramesLeft > 0) state.renderFramesLeft--;
    }
}

// ==========================================
// STATE QUERIES
// ==========================================
export function isViewerActive() {
    return state.active;
}

export function isViewerTransitioning() {
    return state.transitioning;
}

export function getCurrentViewerIndex() {
    return state.currentIndex;
}

export function viewerNeedsRender() {
    if (!state.active) return false;
    if (state.transitioning) return true;
    if (state.isAnimating) return true;
    if (state.renderFramesLeft > 0) return true;
    return false;
}

export { VIEWER_CONFIG };
