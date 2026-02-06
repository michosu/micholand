import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

// Use global GSAP loaded via <script> tag in HTML
const gsap = window.gsap;
const MotionPathPlugin = window.MotionPathPlugin;
const CustomEase = window.CustomEase;
gsap.registerPlugin(MotionPathPlugin, CustomEase);

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    
    // Card settings (16:9 aspect ratio)
    cardWidth: 1.92,
    cardHeight: 1.28,
    cardScale: 1.5, // Uniform scale multiplier for all cards
    useCardLighting: false, // Set true to enable lit materials (more expensive)
    cardHeightMultiplier: 1.45, // Adjust this to fix aspect ratio (increase if cards look too wide)
    cardSpacing: 0.05, // Spacing between cards as fraction of path length (0-1)
    cardSegments: 16, // Number of segmentds along card width for curve bending
    cardWidthInPathUnits: 0.03, // Base path width (will be multiplied by cardScale)

    // Where on the path (0-1) the main/focused card sits
    mainCardT: 0.72,

    // Card rotation offsets (in degrees, applied after Frenet frame)
    cardRotation: {
        x: 12,
        y: 180,
        z: 0
    },

    // Animation
    transitionDuration: 2.8,
    flyInDuration: 2,
    flyInDelay: 0,
    flyInHold: 1,

    // Camera
    camera: {
        fov: 35,
        position: { x: -2.894, y: 5.156, z: -5.044 },
        rotation: { x: 0.0032, y: -0.1307 }
    },

    // 3D Title settings
    titleOffset: { x: 3.2, y: -1.4, z: 0.1 },
    titleScale: 0.6,
    titleRotation: { x: -31, y: -40, z: -15 },

    // Video overlay scale multiplier (1.0 = match card width)
    videoScale: 1.2,

    // Timeline settings (3D floating element using image assets)
    timelineOffset: { x: 0.1, y: -1.2, z: -0.2 },
    timelineScale: 0.6, // Scale multiplier (1 = 100% of pixel-to-world base)
    timelinePixelsToWorld: 0.001, // Convert timeline pixels to world units
    timelineRotation: { x: -2, y: 5, z: 5 },
    // Progress bar marker positions (local timeline pixel coordinates)
    // Set these by enabling debug mode and dragging the markers to the correct positions
    progressMarkerA: { x: 688, y: 1303 },   // Start of progress bar (0%)
    progressMarkerB: { x: 5809, y: 1304 },  // End of progress bar (100%)
    // Timeline asset paths
    timelineAssets: {
        body: './assets/timeline/timeline_body.png',
        progressFill: './assets/timeline/timeline_progress_fill.png',
        buttons: {
            prev: './assets/timeline/buttons/timeline_button_previ.png',
            play: './assets/timeline/buttons/timeline_button_play.png',
            pause: './assets/timeline/buttons/timeline_button_pause.png',
            next: './assets/timeline/buttons/timeline_button_next.png'
        },
        // Reference images for time text positions (we'll scan these)
        time1Ref: './assets/timeline/timeline_time1.png',
        time2Ref: './assets/timeline/timeline_time2.png'
    },
    // Timeline canvas dimensions (from your exports)
    timelineCanvasWidth: 6296,
    timelineCanvasHeight: 1950,

    // Font settings for title/subtitle
    fonts: {
        family: "'Inter', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
        titleWeight: '900',      // 400-900 or 'bold', 'black'
        subtitleWeight: '700',
        titleStyle: 'normal',    // 'normal' or 'italic'
        subtitleStyle: 'normal',
        skew: 0,                 // -0.15 for italic slant, 0 for none
        bgColor: '#e8e8e8',
        textColor: '#000000'
    },

    // Timeline time text settings
    timeText: {
        fontFamily: "'Sneakers Script Narrow', 'Inter', sans-serif",
        fontSize: 100,            // pixels
        fontWeight: 700,
        letterSpacing: 2,        // pixels
        currentColor: '#fff',
        durationColor: 'rgba(255,255,255,0.7)'
    }
};

// ============================================
// PROJECT DATA
// ============================================
const PROJECTS = [
    { title: "333", subtitle: "PROJECT", color: 0xcccccc, image: './assets/textures/project-01.png', video: 'KPtK3FW5E3E' },
    { title: "TRUE HERO", subtitle: "PROJECT", color: 0xbbbbbb, image: './assets/textures/project-02.png', video: 'eaoRglirIaU' },
    { title: "RUIN 2", subtitle: "PROJECT", color: 0xaaaaaa, image: './assets/textures/project-03.png', video: 'gKvS01ru5x4' },
    { title: "INVISIBLE FRENZY", subtitle: "PROJECT", color: 0x999999, image: './assets/textures/project-04.png', video: '_IVGP3PnRLE' },
    { title: "STARZ", subtitle: "PROJECT", color: 0x888888, image: './assets/textures/project-05.png', video: 'h9k9Bq7NKrg' },
    { title: "Project Six", subtitle: "PROJECT", color: 0x777777, image: './assets/textures/project-locked.png', video: null },
    { title: "Project Seven", subtitle: "PROJECT", color: 0x666666, image: './assets/textures/project-locked.png', video: null },
    { title: "Project Eight", subtitle: "PROJECT", color: 0x555555, image: './assets/textures/project-locked.png', video: null },
    { title: "Project Nine", subtitle: "PROJECT", color: 0x444444, image: './assets/textures/project-locked.png', video: null },
    { title: "Project Ten", subtitle: "PROJECT", color: 0x333333, image: './assets/textures/project-locked.png', video: null },
    { title: "Project Eleven", subtitle: "PROJECT", color: 0x222222, image: './assets/textures/project-locked.png', video: null },
    { title: "Project Twelve", subtitle: "PROJECT", color: 0x111111, image: './assets/textures/project-locked.png', video: null },
    { title: "Project Thirteen", subtitle: "PROJECT", color: 0x1a1a1a, image: './assets/textures/project-locked.png', video: null },
    { title: "Project Fourteen", subtitle: "PROJECT", color: 0x2a2a2a, image: './assets/textures/project-locked.png', video: null },
    { title: "Project Fifteen", subtitle: "PROJECT", color: 0x3a3a3a, image: './assets/textures/project-locked.png', video: null },
    { title: "Project Sixteen", subtitle: "PROJECT", color: 0x4a4a4a, image: './assets/textures/project-locked.png', video: null }
];

// ============================================
// CAROUSEL CLASS
// ============================================
class Carousel3D {
    constructor(container) {
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.path = null;
        this.cards = [];
        this.currentIndex = 0;
        this.globalOffset = 0;
        this.targetOffset = 0;
        this.isAnimating = false;
        this.clock = new THREE.Clock();
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // CSS3D video overlay
        this.cssRenderer = null;
        this.cssScene = null;
        this.videoObject = null;
        this.videoElement = null;
        this.hiddenCardIndex = null; // Track which card is hidden by video overlay

        // Fly camera state
        this.flyMode = false;
        this.flySpeed = 0.15;
        this.flySpeedMin = 0.01;
        this.flySpeedMax = 2.0;
        this.lookSpeed = 0.002;
        this.keys = {};
        this.cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.isPointerLocked = false;
        this.loadingScreen = document.getElementById('loading-screen');

        this.init();
    }

    async init() {
        this.setupScene();
        this.setupRenderer();
        await this.loadPath();
        this.setupCameraFromPath();
        this.setupPostProcessing();
        this.setupLights();
        this.createCards();
        this.create3DTitle();
        this.updateProjectTitle(this.currentIndex);
        this.setupInteraction();

        // Wait for timeline to be fully created
        await this.timelineReady;

        // Set initial hidden states
        this.setIntroStartState();

        // Start render loop
        this.animate();

        // Preload all assets and warm up GPU before animation
        await this.preloadAndWarmup();

        // Pre-warm the intro animation under the loading screen
        await this.prewarmIntroAnimation();

        // Trigger fly-in animation
        this.flyInAnimation();

        // Fade out loading screen once animation starts
        this.hideLoadingScreen();
    }

    // Preload all images and warm up the GPU
    async preloadAndWarmup() {
        // Collect all image URLs to preload
        const imageUrls = [
            CONFIG.timelineAssets.body,
            CONFIG.timelineAssets.progressFill,
            CONFIG.timelineAssets.buttons.prev,
            CONFIG.timelineAssets.buttons.play,
            CONFIG.timelineAssets.buttons.pause,
            CONFIG.timelineAssets.buttons.next,
            CONFIG.timelineAssets.time1Ref,
            CONFIG.timelineAssets.time2Ref,
            ...PROJECTS.map(p => p.image)
        ];

        // Preload all images
        await Promise.all(imageUrls.map(url => {
            return new Promise(resolve => {
                const img = new Image();
                img.onload = resolve;
                img.onerror = resolve; // Don't block on errors
                img.src = url;
            });
        }));

        const webglCanvas = this.renderer?.domElement;
        const cssCanvas = this.cssRenderer?.domElement;
        const prevWebglVisibility = webglCanvas?.style.visibility ?? '';
        const prevCssVisibility = cssCanvas?.style.visibility ?? '';

        if (webglCanvas) webglCanvas.style.visibility = 'hidden';
        if (cssCanvas) cssCanvas.style.visibility = 'hidden';

        try {
            // Temporarily show everything at tiny scale to force GPU upload
            this.cards.forEach(card => card.mesh.visible = true);
            if (this.timelineObject) {
                this.timelineObject.visible = true;
                this.timelineObject.scale.setScalar(0.0001);
            }
            if (this.titleGroup) {
                this.titleGroup.visible = true;
                this.titleGroup.scale.setScalar(0.0001);
            }

            // Render a few frames to warm up GPU
            for (let i = 0; i < 5; i++) {
                this.composer.render();
                this.cssRenderer.render(this.cssScene, this.camera);
                await new Promise(r => requestAnimationFrame(r));
            }

            // Hide everything again before animation
            this.cards.forEach(card => card.mesh.visible = false);
            if (this.timelineObject) {
                this.timelineObject.visible = false;
            }
            if (this.titleGroup) {
                this.titleGroup.visible = false;
            }

            // Render one clean frame with everything hidden
            this.composer.render();
            this.cssRenderer.render(this.cssScene, this.camera);
            await new Promise(r => requestAnimationFrame(r));
        } finally {
            if (webglCanvas) webglCanvas.style.visibility = prevWebglVisibility;
            if (cssCanvas) cssCanvas.style.visibility = prevCssVisibility;
        }
    }

    setIntroStartState() {
        this.cards.forEach(card => card.mesh.visible = false);
        this.globalOffset = -0.6;
        this.updateCardPositions();
        if (this.timelineObject) {
            this.timelineObject.visible = false;
        }
        if (this.titleGroup) {
            this.titleGroup.visible = false;
        }
    }

    prewarmIntroAnimation() {
        if (!gsap) return Promise.resolve();
        return new Promise((resolve) => {
            this.setIntroStartState();
            const tl = this.createFlyInTimeline();
            tl.timeScale(4);
            tl.eventCallback('onComplete', () => {
                this.setIntroStartState();
                resolve();
            });
        });
    }

    hideLoadingScreen() {
        if (!this.loadingScreen || !gsap) return;
        gsap.to(this.loadingScreen, {
            opacity: 0,
            duration: 0.4,
            ease: "power1.out",
            onComplete: () => {
                this.loadingScreen.style.display = 'none';
            }
        });
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);
    }

    setupCameraFromPath() {
        // Create camera with configured FOV
        this.camera = new THREE.PerspectiveCamera(
            CONFIG.camera.fov,
            this.container.clientWidth / this.container.clientHeight,
            0.001,
            10000
        );

        // Use configured camera position
        this.camera.position.set(
            CONFIG.camera.position.x,
            CONFIG.camera.position.y,
            CONFIG.camera.position.z
        );

        // Apply configured camera rotation
        this.cameraEuler = new THREE.Euler(
            CONFIG.camera.rotation.x,
            CONFIG.camera.rotation.y,
            0,
            'YXZ'
        );
        this.camera.quaternion.setFromEuler(this.cameraEuler);

        // Store target for reference (main card position)
        const mainPoint = this.path.getPointAt(CONFIG.mainCardT);
        this.cameraTarget = mainPoint.clone();
    }

    // Manual camera positioning
    setCameraPosition(x, y, z) {
        this.camera.position.set(x, y, z);
    }

    setCameraLookAt(x, y, z) {
        this.cameraTarget.set(x, y, z);
        this.camera.lookAt(this.cameraTarget);
    }

    setupPostProcessing() {
        // Add render pass (renders the scene)
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        // Add SMAA anti-aliasing pass
        const smaaPass = new SMAAPass(
            this.container.clientWidth * this.renderer.getPixelRatio(),
            this.container.clientHeight * this.renderer.getPixelRatio()
        );
        this.renderer.render(this.scene, this.camera);
        this.smaaPass = smaaPass;
    }

    setupRenderer() {
        // WebGL renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        // Use higher pixel ratio for better quality (minimum 2)
        const pixelRatio = Math.max(window.devicePixelRatio, 2);
        this.renderer.setPixelRatio(pixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // Post-processing with SMAA anti-aliasing
        // Create render target with proper pixel ratio
        const renderTarget = new THREE.WebGLRenderTarget(
            this.container.clientWidth * pixelRatio,
            this.container.clientHeight * pixelRatio,
            {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat,
                colorSpace: THREE.SRGBColorSpace
            }
        );
        this.composer = new EffectComposer(this.renderer, renderTarget);
        // Note: RenderPass will be added after camera is set up (in setupPostProcessing)

        // CSS3D renderer (layered on top for video overlay)
        this.cssScene = new THREE.Scene();
        this.cssRenderer = new CSS3DRenderer();
        this.cssRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.cssRenderer.domElement.style.position = 'absolute';
        this.cssRenderer.domElement.style.top = '0';
        this.cssRenderer.domElement.style.left = '0';
        this.cssRenderer.domElement.style.pointerEvents = 'auto';
        this.container.appendChild(this.cssRenderer.domElement);

        // Create video container element
        this.setupVideoOverlay();

        window.addEventListener('resize', () => this.onResize());
    }

    setupVideoOverlay() {
        // 16:9 HD resolution for YouTube
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

        // Create 3 iframes for preloading (prev, current, next)
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
            iframe.dataset.videoId = ''; // Track which video is loaded
            return iframe;
        };

        this.iframes = [
            createIframe('youtube-player-0'),
            createIframe('youtube-player-1'),
            createIframe('youtube-player-2')
        ];

        // Track iframe assignments: which iframe shows which project index
        this.iframeAssignments = {}; // videoId -> iframe index
        this.activeIframeIndex = null;

        this.iframes.forEach(iframe => videoContainer.appendChild(iframe));

        // Create clickable overlay to block YouTube's "More videos" popup
        // This overlay intercepts all clicks and uses our own play/pause control
        const clickOverlay = document.createElement('div');
        clickOverlay.id = 'video-click-overlay';
        clickOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: transparent;
            cursor: pointer;
            z-index: 10;
        `;
        clickOverlay.addEventListener('click', () => {
            this.toggleVideoPlayback();
        });
        videoContainer.appendChild(clickOverlay);
        this.videoClickOverlay = clickOverlay;

        this.videoElement = videoContainer;
        this.isVideoPlaying = false;
        this.isSeeking = false;
        this.lastPlayPauseToggle = 0; // Timestamp of last user toggle
        this.currentVideoId = null;
        this.videoContainerWidth = videoWidth;
        this.videoDuration = 0;
        this.videoCurrentTime = 0;

        // Calculate base scale to match card width in 3D world
        const cardWorldWidth = CONFIG.cardWidth * CONFIG.cardScale;
        this.videoBaseScale = cardWorldWidth / videoWidth;

        // Create CSS3D object
        this.videoObject = new CSS3DObject(videoContainer);
        this.updateVideoScale();
        this.videoObject.visible = false;
        this.cssScene.add(this.videoObject);

        // Create 3D timeline (separate floating element)
        // Store promise so init() can wait for timeline to be ready
        this.timelineReady = this.create3DTimeline();

        // Listen for YouTube postMessage responses
        this.setupYouTubeMessageListener();
    }

    async create3DTimeline() {
        const width = CONFIG.timelineCanvasWidth;
        const height = CONFIG.timelineCanvasHeight;

        const timeline = document.createElement('div');
        timeline.id = 'video-timeline-3d';
        timeline.style.cssText = `
            width: ${width}px;
            height: ${height}px;
            position: relative;
            pointer-events: auto;
        `;

        // Helper to create an image layer
        const createImageLayer = (src, zIndex = 0, isButton = false) => {
            const img = document.createElement('img');
            img.src = src;
            img.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: ${zIndex};
                ${isButton ? 'transform: scale(1); filter: brightness(1);' : ''}
            `;
            return img;
        };

        // 1. Add timeline body (static background)
        const bodyImg = createImageLayer(CONFIG.timelineAssets.body, 0);
        timeline.appendChild(bodyImg);

        // 2. Add progress fill (will be clipped)
        const progressImg = createImageLayer(CONFIG.timelineAssets.progressFill, 1);
        progressImg.id = 'timeline-progress-img';
        progressImg.style.clipPath = 'inset(0 100% 0 0)'; // Start hidden
        timeline.appendChild(progressImg);

        // 3. Add play button (visible by default)
        const playImg = createImageLayer(CONFIG.timelineAssets.buttons.play, 2, true);
        playImg.id = 'timeline-btn-play-img';
        timeline.appendChild(playImg);

        // 4. Add pause button (hidden by default)
        const pauseImg = createImageLayer(CONFIG.timelineAssets.buttons.pause, 2, true);
        pauseImg.id = 'timeline-btn-pause-img';
        pauseImg.style.opacity = '0';
        timeline.appendChild(pauseImg);

        // 5. Add prev button
        const prevImg = createImageLayer(CONFIG.timelineAssets.buttons.prev, 2, true);
        prevImg.id = 'timeline-btn-prev-img';
        timeline.appendChild(prevImg);

        // 6. Add next button
        const nextImg = createImageLayer(CONFIG.timelineAssets.buttons.next, 2, true);
        nextImg.id = 'timeline-btn-next-img';
        timeline.appendChild(nextImg);

        // Store button images for animations
        this.timelineButtonImages = {
            play: playImg,
            pause: pauseImg,
            prev: prevImg,
            next: nextImg
        };

        // Track hover state per button for click animation
        this.buttonHoverStates = {
            play: false,
            pause: false,
            prev: false,
            next: false
        };

        // 7. Create time text elements (positioned based on reference images)
        // We'll position these after scanning the reference images
        const tt = CONFIG.timeText; // shorthand

        const currentTime = document.createElement('span');
        currentTime.id = 'timeline-current';
        currentTime.style.cssText = `
            position: absolute;
            color: ${tt.currentColor};
            font-family: ${tt.fontFamily};
            font-size: ${tt.fontSize}px;
            font-weight: ${tt.fontWeight};
            letter-spacing: ${tt.letterSpacing}px;
            z-index: 5;
            pointer-events: none;
        `;
        currentTime.textContent = '0:00';
        timeline.appendChild(currentTime);

        const durationTime = document.createElement('span');
        durationTime.id = 'timeline-duration';
        durationTime.style.cssText = `
            position: absolute;
            color: ${tt.durationColor};
            font-family: ${tt.fontFamily};
            font-size: ${tt.fontSize}px;
            font-weight: ${tt.fontWeight};
            letter-spacing: ${tt.letterSpacing}px;
            z-index: 5;
            pointer-events: none;
        `;
        durationTime.textContent = '0:00';
        timeline.appendChild(durationTime);

        // Store timeline elements
        this.timelineElements = {
            current: currentTime,
            duration: durationTime,
            progress: progressImg
        };

        // 8. Scan images to get button bounds and time positions
        await this.scanTimelineAssets(timeline, currentTime, durationTime);

        // Create CSS3D object for timeline
        this.timelineObject = new CSS3DObject(timeline);
        this.applyTimelineScale();
        this.cssScene.add(this.timelineObject);

        // Position timeline relative to main card
        this.updateTimelinePosition();
    }

    // Scan an image to find the bounding box of non-transparent pixels
    async getImageBounds(src) {
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
                        if (alpha > 10) { // Non-transparent pixel
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
                        x: minX,
                        y: minY,
                        width: maxX - minX,
                        height: maxY - minY,
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

    async scanTimelineAssets(timeline, currentTimeEl, durationTimeEl) {
        // Scan button images and create hitboxes
        const buttonConfigs = [
            { name: 'prev', src: CONFIG.timelineAssets.buttons.prev, action: () => this.prev() },
            { name: 'play', src: CONFIG.timelineAssets.buttons.play, action: () => this.onTimelinePlayClick() },
            { name: 'next', src: CONFIG.timelineAssets.buttons.next, action: () => this.next() }
        ];

        this.timelineHitboxes = {};

        for (const btn of buttonConfigs) {
            const bounds = await this.getImageBounds(btn.src);
            if (bounds) {
                // Create invisible hitbox div
                const hitbox = document.createElement('div');
                hitbox.className = 'timeline-hitbox';
                hitbox.dataset.button = btn.name;
                hitbox.style.cssText = `
                    position: absolute;
                    left: ${bounds.x}px;
                    top: ${bounds.y}px;
                    width: ${bounds.width}px;
                    height: ${bounds.height}px;
                    cursor: pointer;
                    z-index: 10;
                `;

                // Store bounds for animation origin
                hitbox.dataset.centerX = bounds.centerX;
                hitbox.dataset.centerY = bounds.centerY;

                // Add click handler
                hitbox.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // For play button, animate whichever is currently visible
                    if (btn.name === 'play') {
                        this.animateTimelineButton(this.isVideoPlaying ? 'pause' : 'play');
                    } else {
                        this.animateTimelineButton(btn.name);
                    }
                    btn.action();
                });

                // Add hover animations
                hitbox.addEventListener('mouseenter', () => {
                    // For play/pause hitbox, animate whichever button is visible
                    if (btn.name === 'play') {
                        this.animatePlayPauseHover(true);
                    } else {
                        this.animateTimelineButtonHover(btn.name, true);
                    }
                });
                hitbox.addEventListener('mouseleave', () => {
                    if (btn.name === 'play') {
                        this.animatePlayPauseHover(false);
                    } else {
                        this.animateTimelineButtonHover(btn.name, false);
                    }
                });

                timeline.appendChild(hitbox);
                this.timelineHitboxes[btn.name] = { hitbox, bounds };
            }
        }

        // Scan time reference images to position text
        const time1Bounds = await this.getImageBounds(CONFIG.timelineAssets.time1Ref);
        const time2Bounds = await this.getImageBounds(CONFIG.timelineAssets.time2Ref);

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

        // Scan progress fill image to get actual pixel bounds
        const progressBounds = await this.getImageBounds(CONFIG.timelineAssets.progressFill);
        if (!progressBounds) {
            console.warn('Could not scan progress fill image bounds');
            return;
        }

        this.progressBounds = progressBounds;
        console.log('Progress bar bounds:', progressBounds);

        // Create scrubber dot for time indication
        // Position using marker A as the starting point (0%)
        const scrubberDot = document.createElement('div');
        scrubberDot.id = 'timeline-scrubber-dot';
        scrubberDot.style.cssText = `
            position: absolute;
            width: 60px;
            height: 60px;
            background: #fff;
            border-radius: 50%;
            top: ${CONFIG.progressMarkerA.y}px;
            left: ${CONFIG.progressMarkerA.x}px;
            transform: translate(-50%, -50%);
            pointer-events: none;
            z-index: 10;
            box-shadow: 0 0 20px rgba(255,255,255,0.5);
            opacity: 0.9;
        `;
        timeline.appendChild(scrubberDot);
        this.scrubberDot = scrubberDot;

        // Create progress bar hitbox for scrubbing
        // Use the scanned bounds from the progress fill image
        const progressHitbox = document.createElement('div');
        progressHitbox.id = 'timeline-progress-hitbox';
        progressHitbox.style.cssText = `
            position: absolute;
            left: ${progressBounds.x}px;
            top: ${progressBounds.y - 30}px;
            width: ${progressBounds.width}px;
            height: ${progressBounds.height + 60}px;
            cursor: pointer;
            z-index: 9;
        `;

        let isDragging = false;

        // Create multiple invisible reference markers along the progress bar
        // More samples = more accurate perspective correction
        const numSamples = 11; // 0%, 10%, 20%, ... 100%
        this.progressRefMarkers = [];

        for (let i = 0; i < numSamples; i++) {
            const t = i / (numSamples - 1); // 0 to 1
            const localX = CONFIG.progressMarkerA.x + t * (CONFIG.progressMarkerB.x - CONFIG.progressMarkerA.x);
            const localY = CONFIG.progressMarkerA.y + t * (CONFIG.progressMarkerB.y - CONFIG.progressMarkerA.y);

            const marker = document.createElement('div');
            marker.className = 'progress-ref-marker';
            marker.style.cssText = `
                position: absolute;
                width: 4px;
                height: 4px;
                left: ${localX}px;
                top: ${localY}px;
                pointer-events: none;
                z-index: 1;
            `;
            marker.dataset.percent = t;
            timeline.appendChild(marker);
            this.progressRefMarkers.push(marker);
        }

        // Calculate progress percent based on click position within the progress bar
        // Uses multiple reference markers for perspective-correct calculation
        const updateProgress = (e) => {
            let percent;

            if (this.progressRefMarkers && this.progressRefMarkers.length >= 2) {
                // Get screen X positions of all markers
                const samples = this.progressRefMarkers.map(marker => {
                    const rect = marker.getBoundingClientRect();
                    return {
                        screenX: rect.left + rect.width / 2,
                        percent: parseFloat(marker.dataset.percent)
                    };
                });

                const mouseX = e.clientX;

                // Find which segment the mouse is in and interpolate
                for (let i = 0; i < samples.length - 1; i++) {
                    const curr = samples[i];
                    const next = samples[i + 1];

                    if (mouseX >= curr.screenX && mouseX <= next.screenX) {
                        // Interpolate within this segment
                        const t = (mouseX - curr.screenX) / (next.screenX - curr.screenX);
                        percent = curr.percent + t * (next.percent - curr.percent);
                        break;
                    }
                }

                // Handle edges
                if (percent === undefined) {
                    if (mouseX < samples[0].screenX) {
                        percent = 0;
                    } else {
                        percent = 1;
                    }
                }
            } else {
                // Fallback to hitbox-based calculation
                const rect = progressHitbox.getBoundingClientRect();
                percent = (e.clientX - rect.left) / rect.width;
            }

            percent = Math.max(0, Math.min(1, percent));

            // Update scrubber dot position immediately for visual feedback
            this.updateScrubberPosition(percent);

            // Seek video
            this.seekToPercent(percent);
        };

        progressHitbox.addEventListener('mousedown', (e) => {
            isDragging = true;
            updateProgress(e);
            // Scale up scrubber dot when dragging
            if (this.scrubberDot) {
                gsap.to(this.scrubberDot, {
                    scale: 1.3,
                    boxShadow: '0 0 30px rgba(255,255,255,0.8)',
                    duration: 0.15
                });
            }
        });

        // Hover effect on progress bar
        progressHitbox.addEventListener('mouseenter', () => {
            if (this.scrubberDot && !isDragging) {
                gsap.to(this.scrubberDot, {
                    scale: 1.15,
                    duration: 0.2
                });
            }
        });

        progressHitbox.addEventListener('mouseleave', () => {
            if (this.scrubberDot && !isDragging) {
                gsap.to(this.scrubberDot, {
                    scale: 1,
                    duration: 0.2
                });
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) updateProgress(e);
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                // Reset scrubber dot scale
                if (this.scrubberDot) {
                    gsap.to(this.scrubberDot, {
                        scale: 1,
                        boxShadow: '0 0 20px rgba(255,255,255,0.5)',
                        duration: 0.2
                    });
                }
            }
        });

        timeline.appendChild(progressHitbox);
    }

    updateScrubberPosition(percent) {
        if (!this.scrubberDot) return;

        // Calculate pixel position using markers A and B for accurate positioning
        const markerA = CONFIG.progressMarkerA;
        const markerB = CONFIG.progressMarkerB;
        const x = markerA.x + (percent * (markerB.x - markerA.x));
        const y = markerA.y + (percent * (markerB.y - markerA.y));
        this.scrubberDot.style.left = `${x}px`;
        this.scrubberDot.style.top = `${y}px`;

        // Update progress bar clip to match dot position exactly
        // clip-path inset(top right bottom left) - right value clips from right edge
        if (this.timelineElements && this.timelineElements.progress) {
            const canvasWidth = CONFIG.timelineCanvasWidth;
            // Calculate how much to clip from the right to reveal up to position x
            const clipRight = ((canvasWidth - x) / canvasWidth) * 100;
            this.timelineElements.progress.style.clipPath = `inset(0 ${clipRight}% 0 0)`;
        }
    }

    onTimelinePlayClick() {
        this.toggleVideoPlayback();
        // Note: updatePlayPauseButton is called inside toggleVideoPlayback
    }

    // Immediately set play/pause button state (no animation, for initialization)
    setPlayPauseState(isPlaying) {
        if (!this.timelineButtonImages) return;
        const { play, pause } = this.timelineButtonImages;

        gsap.killTweensOf(play);
        gsap.killTweensOf(pause);

        play.style.opacity = isPlaying ? '0' : '1';
        pause.style.opacity = isPlaying ? '1' : '0';
    }

    // Animate play/pause button transition
    updatePlayPauseButton() {
        if (!this.timelineButtonImages) return;

        // Don't update during seek operations
        if (this.isSeeking) return;

        const { play, pause } = this.timelineButtonImages;

        // Kill any existing animations to prevent conflicts
        gsap.killTweensOf(play);
        gsap.killTweensOf(pause);

        const duration = 0.15;
        if (this.isVideoPlaying) {
            gsap.to(play, { opacity: 0, duration, ease: 'power2.out' });
            gsap.to(pause, { opacity: 1, duration, ease: 'power2.out' });
        } else {
            gsap.to(play, { opacity: 1, duration, ease: 'power2.out' });
            gsap.to(pause, { opacity: 0, duration, ease: 'power2.out' });
        }
    }

    // Generic button click animation - use for any timeline button
    animateButtonClick(buttonName, options = {}) {
        const img = this.timelineButtonImages[buttonName];
        if (!img) return;

        const hitboxData = this.timelineHitboxes[buttonName];
        const bounds = hitboxData?.bounds;

        // Check if button is currently hovered
        const isHovered = this.buttonHoverStates?.[buttonName] ?? false;

        // Hover state values
        const hoverScale = 1.08;
        const hoverBrightness = 1.15;

        const defaults = {
            scaleTo: 0.92,
            clickBrightness: 1.3,
            duration: 0.25
        };
        const opts = { ...defaults, ...options };

        if (bounds) {
            img.style.transformOrigin = `${bounds.centerX}px ${bounds.centerY}px`;
        }

        // Determine what to animate back to based on hover state
        const scaleBack = isHovered ? hoverScale : 1;
        const brightnessBack = isHovered ? hoverBrightness : 1;

        // Quick press down then elastic release back to hover/default state
        gsap.timeline()
            .to(img, {
                scale: opts.scaleTo,
                filter: `brightness(${opts.clickBrightness})`,
                duration: opts.duration * 0.3,
                ease: 'power2.in'
            })
            .to(img, {
                scale: scaleBack,
                filter: `brightness(${brightnessBack})`,
                duration: opts.duration * 0.7,
                ease: 'elastic.out(1, 0.3)'
            });
    }

    // Generic button hover animation - use for any timeline button
    animateButtonHover(buttonName, isHovering, options = {}) {
        const img = this.timelineButtonImages[buttonName];
        if (!img) return;

        // Track hover state for click animation
        if (this.buttonHoverStates) {
            this.buttonHoverStates[buttonName] = isHovering;
        }

        const hitboxData = this.timelineHitboxes[buttonName];
        const bounds = hitboxData?.bounds;

        const defaults = {
            hoverScale: 1.08,
            hoverBrightness: 1.15,
            scaleDuration: 0.3,
            brightnessDuration: 0.15,
            scaleEase: 'elastic.out(1, 0.2)',
            brightnessEase: 'power2.out'
        };
        const opts = { ...defaults, ...options };

        if (bounds) {
            img.style.transformOrigin = `${bounds.centerX}px ${bounds.centerY}px`;
        }

        // Scale with elastic ease
        gsap.to(img, {
            scale: isHovering ? opts.hoverScale : 1,
            duration: opts.scaleDuration,
            ease: opts.scaleEase
        });

        // Brightness with power ease
        gsap.to(img, {
            filter: isHovering ? `brightness(${opts.hoverBrightness})` : 'brightness(1)',
            duration: opts.brightnessDuration,
            ease: opts.brightnessEase
        });
    }

    // Legacy wrappers for compatibility
    animateTimelineButton(name) {
        this.animateButtonClick(name);
    }

    animateTimelineButtonHover(name, isHovering) {
        this.animateButtonHover(name, isHovering);
    }

    // Special hover for play/pause - animates whichever button is currently visible
    animatePlayPauseHover(isHovering) {
        if (!this.timelineButtonImages) return;
        const { play, pause } = this.timelineButtonImages;

        // Track hover state for both play and pause buttons
        if (this.buttonHoverStates) {
            this.buttonHoverStates.play = isHovering;
            this.buttonHoverStates.pause = isHovering;
        }

        // Get bounds from play button hitbox (pause uses same position)
        const hitboxData = this.timelineHitboxes['play'];
        const bounds = hitboxData?.bounds;

        const opts = {
            hoverScale: 1.08,
            hoverBrightness: 1.15,
            scaleDuration: 0.3,
            brightnessDuration: 0.15,
            scaleEase: 'elastic.out(1, 0.2)',
            brightnessEase: 'power2.out'
        };

        // Set transform origin for both buttons
        if (bounds) {
            play.style.transformOrigin = `${bounds.centerX}px ${bounds.centerY}px`;
            pause.style.transformOrigin = `${bounds.centerX}px ${bounds.centerY}px`;
        }

        // Scale with elastic ease
        gsap.to([play, pause], {
            scale: isHovering ? opts.hoverScale : 1,
            duration: opts.scaleDuration,
            ease: opts.scaleEase
        });

        // Brightness with power ease
        gsap.to([play, pause], {
            filter: isHovering ? `brightness(${opts.hoverBrightness})` : 'brightness(1)',
            duration: opts.brightnessDuration,
            ease: opts.brightnessEase
        });
    }

    updateTimelinePosition() {
        if (!this.timelineObject || !this.path) return;

        // Position timeline relative to main card position
        const mainPoint = this.path.getPointAt(CONFIG.mainCardT);
        this.timelineObject.position.set(
            mainPoint.x + CONFIG.timelineOffset.x,
            mainPoint.y + CONFIG.timelineOffset.y,
            mainPoint.z + CONFIG.timelineOffset.z
        );

        this.timelineObject.rotation.set(
            THREE.MathUtils.degToRad(CONFIG.timelineRotation.x),
            THREE.MathUtils.degToRad(CONFIG.timelineRotation.y),
            THREE.MathUtils.degToRad(CONFIG.timelineRotation.z)
        );
    }

    getTimelineScale() {
        return CONFIG.timelineScale;
    }

    getTimelineWorldScale() {
        return CONFIG.timelineScale * CONFIG.timelinePixelsToWorld;
    }

    applyTimelineScale() {
        if (this.timelineObject) {
            this.timelineObject.scale.setScalar(this.getTimelineWorldScale());
        }
    }

    setTimelineOffset(x, y, z) {
        CONFIG.timelineOffset.x = x;
        CONFIG.timelineOffset.y = y;
        CONFIG.timelineOffset.z = z;
        this.updateTimelinePosition();
    }

    setTimelineScale(scale) {
        CONFIG.timelineScale = scale;
        this.applyTimelineScale();
    }

    setTimelineRotation(x, y, z) {
        CONFIG.timelineRotation.x = x;
        CONFIG.timelineRotation.y = y;
        CONFIG.timelineRotation.z = z;
        this.updateTimelinePosition();
    }

    setupYouTubeMessageListener() {
        window.addEventListener('message', (event) => {
            if (event.origin !== 'https://www.youtube.com') return;

            try {
                const data = JSON.parse(event.data);
                if (data.event === 'infoDelivery' && data.info) {
                    if (data.info.currentTime !== undefined) {
                        this.videoCurrentTime = data.info.currentTime;
                        this.updateTimelineDisplay();
                    }
                    if (data.info.duration !== undefined) {
                        this.videoDuration = data.info.duration;
                        this.updateTimelineDisplay();
                    }
                    if (data.info.playerState !== undefined) {
                        // 1 = playing, 2 = paused
                        const newState = data.info.playerState === 1;

                        // Ignore YouTube state updates for 500ms after user toggle
                        // (YouTube sends stale state before command takes effect)
                        const timeSinceToggle = Date.now() - this.lastPlayPauseToggle;
                        if (timeSinceToggle < 500) return;

                        // Only update button if state actually changed
                        if (this.isVideoPlaying !== newState) {
                            this.isVideoPlaying = newState;
                            this.updatePlayPauseButton();
                        }
                    }
                }
                if (data.event === 'onReady') {
                    // Request video info when ready
                    this.requestVideoInfo();
                }
            } catch (e) {
                // Not JSON or not from YouTube
            }
        });

        // Poll for time updates
        setInterval(() => {
            if (this.isVideoPlaying) {
                this.requestVideoInfo();
            }
        }, 500);
    }

    requestVideoInfo() {
        if (this.activeIframeIndex === null) return;
        const iframe = this.iframes[this.activeIframeIndex];
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage(JSON.stringify({
                event: 'listening',
                id: iframe.id
            }), '*');
        }
    }

    updateTimelineDisplay() {
        if (!this.timelineElements) return;

        const formatTime = (seconds) => {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        this.timelineElements.current.textContent = formatTime(this.videoCurrentTime);
        this.timelineElements.duration.textContent = formatTime(this.videoDuration);

        if (this.videoDuration > 0) {
            const percent = this.videoCurrentTime / this.videoDuration;
            // Update scrubber dot position (also updates progress bar clip)
            this.updateScrubberPosition(percent);
        }
        // Note: play/pause button is updated separately when state changes
    }

    seekToPercent(percent) {
        if (this.videoDuration <= 0) return;
        const seekTime = percent * this.videoDuration;

        if (this.activeIframeIndex === null) return;
        const iframe = this.iframes[this.activeIframeIndex];
        if (iframe && iframe.contentWindow) {
            // Set seeking flag to prevent button state changes during seek
            this.isSeeking = true;

            // Clear any existing seek timeout
            if (this.seekTimeout) clearTimeout(this.seekTimeout);

            iframe.contentWindow.postMessage(JSON.stringify({
                event: 'command',
                func: 'seekTo',
                args: [seekTime, true]
            }), '*');

            // Clear seeking flag after a short delay
            this.seekTimeout = setTimeout(() => {
                this.isSeeking = false;
            }, 300);
        }
    }

    updateVideoScale() {
        const s = this.videoBaseScale * CONFIG.videoScale;
        this.videoObject.scale.set(s, s, s);
    }

    setVideoScale(scale) {
        CONFIG.videoScale = scale;
        this.updateVideoScale();
    }

    // Get video ID for a project index
    getVideoIdForIndex(index) {
        if (index < 0 || index >= PROJECTS.length) return null;
        return PROJECTS[index].video || null;
    }

    // Load a video into a specific iframe
    loadVideoIntoIframe(iframeIndex, videoId) {
        if (!videoId) return;
        const iframe = this.iframes[iframeIndex];
        if (iframe.dataset.videoId === videoId) return; // Already loaded

        iframe.dataset.videoId = videoId;
        // YouTube embed parameters to hide UI elements:
        // rel=0 - no related videos from other channels
        // modestbranding=1 - minimal YouTube branding
        // iv_load_policy=3 - hide annotations
        // disablekb=1 - disable keyboard (we have our own controls)
        // fs=0 - hide fullscreen button
        // controls=0 - hide YouTube controls (we have our own timeline)
        iframe.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=0&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&fs=0&controls=0`;
        this.iframeAssignments[videoId] = iframeIndex;
    }

    // Find which iframe has a video loaded, or get a free one
    getIframeForVideo(videoId) {
        // Check if already loaded
        if (this.iframeAssignments[videoId] !== undefined) {
            return this.iframeAssignments[videoId];
        }
        // Find unused iframe (not active, not adjacent preloads)
        for (let i = 0; i < this.iframes.length; i++) {
            if (i !== this.activeIframeIndex) {
                return i;
            }
        }
        return 0;
    }

    // Switch to showing a video (instant if preloaded)
    showVideo(videoId) {
        if (!videoId) return;

        const targetIframeIndex = this.iframeAssignments[videoId];

        if (targetIframeIndex !== undefined && this.iframes[targetIframeIndex].dataset.videoId === videoId) {
            // Video is preloaded - instant swap!
            this.swapToIframe(targetIframeIndex);
        } else {
            // Not preloaded - need to load first
            const freeIndex = this.getIframeForVideo(videoId);
            this.loadVideoIntoIframe(freeIndex, videoId);
            // Set active immediately so preloading doesn't overwrite it
            this.activeIframeIndex = freeIndex;
            // Swap after brief delay for load
            setTimeout(() => this.swapToIframe(freeIndex), 100);
        }

        // Preload adjacent videos
        this.preloadAdjacentVideos();
    }

    swapToIframe(newIndex) {
        // Hide all, show target
        this.iframes.forEach((iframe, i) => {
            gsap.to(iframe, {
                opacity: i === newIndex ? 1 : 0,
                duration: 0.2,
                ease: "power2.inOut"
            });
        });
        this.activeIframeIndex = newIndex;
    }

    preloadAdjacentVideos() {
        const prevVideoId = this.getVideoIdForIndex(this.currentIndex - 1);
        const nextVideoId = this.getVideoIdForIndex(this.currentIndex + 1);
        const currentVideoId = this.getVideoIdForIndex(this.currentIndex);

        // Find which iframes are free (not showing current)
        const freeIframes = [];
        for (let i = 0; i < this.iframes.length; i++) {
            if (i !== this.activeIframeIndex) {
                freeIframes.push(i);
            }
        }

        // Preload prev and next into free iframes
        if (prevVideoId && freeIframes.length > 0) {
            const idx = freeIframes.shift();
            this.loadVideoIntoIframe(idx, prevVideoId);
        }
        if (nextVideoId && freeIframes.length > 0) {
            const idx = freeIframes.shift();
            this.loadVideoIntoIframe(idx, nextVideoId);
        }
    }

    toggleVideoPlayback() {
        if (this.activeIframeIndex === null) return;
        const activeIframe = this.iframes[this.activeIframeIndex];
        if (activeIframe && activeIframe.contentWindow) {
            const command = this.isVideoPlaying ? 'pauseVideo' : 'playVideo';

            // Mark the time of user interaction (to ignore YouTube state updates briefly)
            this.lastPlayPauseToggle = Date.now();

            // Update button IMMEDIATELY (no animation delay)
            this.isVideoPlaying = !this.isVideoPlaying;
            this.setPlayPauseState(this.isVideoPlaying);

            // Then send command to YouTube
            activeIframe.contentWindow.postMessage(JSON.stringify({
                event: 'command',
                func: command,
                args: []
            }), '*');
        }
    }

    // Pause the currently playing video (used when navigating away)
    pauseCurrentVideo() {
        if (this.activeIframeIndex === null) return;
        const activeIframe = this.iframes[this.activeIframeIndex];
        if (activeIframe && activeIframe.contentWindow && this.isVideoPlaying) {
            activeIframe.contentWindow.postMessage(JSON.stringify({
                event: 'command',
                func: 'pauseVideo',
                args: []
            }), '*');
            this.isVideoPlaying = false;
        }
    }

    setupLights() {
        if (!CONFIG.useCardLighting) return;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 5);
        this.scene.add(directionalLight);

        // Add a subtle light near the main card area
        const mainPoint = this.path.getPointAt(CONFIG.mainCardT);
        const pointLight = new THREE.PointLight(0xffffff, 0.5, 20);
        pointLight.position.copy(mainPoint).add(new THREE.Vector3(0, 3, 0));
        this.scene.add(pointLight);
    }

    async loadPath() {
        try {
            const response = await fetch('./assets/paths/portfolioPathNew.json');
            const data = await response.json();

            // Handle new Bezier curve format from Blender
            if (data.curves && data.curves[0] && data.curves[0][0]) {
                const curveData = data.curves[0][0];
                const points = curveData.points;

                // Create a CurvePath from cubic bezier segments
                const curvePath = new THREE.CurvePath();

                for (let i = 0; i < points.length - 1; i++) {
                    const p0 = points[i];
                    const p1 = points[i + 1];

                    // Cubic bezier: start, control1 (right handle of start), control2 (left handle of end), end
                    const bezier = new THREE.CubicBezierCurve3(
                        new THREE.Vector3(p0.position[0], p0.position[1], p0.position[2]),
                        new THREE.Vector3(p0.right_handle[0], p0.right_handle[1], p0.right_handle[2]),
                        new THREE.Vector3(p1.left_handle[0], p1.left_handle[1], p1.left_handle[2]),
                        new THREE.Vector3(p1.position[0], p1.position[1], p1.position[2])
                    );

                    curvePath.add(bezier);
                }

                this.path = curvePath;
                this.visualizePath();
            }
            // Fallback to old simple points format
            else if (data.points) {
                const points = data.points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
                this.path = new THREE.CatmullRomCurve3(points, false);
                this.visualizePath();
            }
        } catch (error) {
            console.error('Failed to load path:', error);
            this.createDefaultPath();
        }
    }

    createDefaultPath() {
        // Default: a curve that sweeps in from distance
        const points = [
            new THREE.Vector3(15, 1, -10),
            new THREE.Vector3(10, 1, -5),
            new THREE.Vector3(5, 1, 0),
            new THREE.Vector3(0, 1, 3),
            new THREE.Vector3(-5, 1, 4),
            new THREE.Vector3(-10, 1, 3),
            new THREE.Vector3(-15, 1, 0)
        ];
        this.path = new THREE.CatmullRomCurve3(points, false);
    }

    visualizePath() {
        // Sample points from the path to create visualization
        const points = this.path.getPoints(100);
        const curve = new THREE.CatmullRomCurve3(points, false);

        const tubeGeometry = new THREE.TubeGeometry(curve, 100, 0.03, 8, false);
        const tubeMaterial = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.5
        });
        const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
        tube.visible = false;
        this.scene.add(tube);
        this.pathVisualization = tube;
    }

    createCards() {
        const cardCount = Math.min(PROJECTS.length, Math.floor(1 / CONFIG.cardSpacing));

        for (let i = 0; i < cardCount; i++) {
            const card = this.createCard(PROJECTS[i], i);
            this.cards.push(card);
            this.scene.add(card.mesh);
        }

        this.updateCardPositions();
    }

    createCard(projectData, index) {
        // Create subdivided geometry for curve bending
        const geometry = new THREE.PlaneGeometry(
            CONFIG.cardWidth,
            CONFIG.cardHeight,
            CONFIG.cardSegments, // width segments
            1 // height segments
        );

        const CardMaterial = CONFIG.useCardLighting ? THREE.MeshStandardMaterial : THREE.MeshBasicMaterial;

        // Create front material with texture (on BackSide since geometry faces away)
        let frontMaterial;
        if (projectData.image) {
            const texture = new THREE.TextureLoader().load(projectData.image);
            // Flip texture horizontally to correct mirroring
            texture.wrapS = THREE.RepeatWrapping;
            texture.repeat.x = -1;
            frontMaterial = new CardMaterial({ map: texture, side: THREE.BackSide });
        } else {
            frontMaterial = new CardMaterial({ color: projectData.color, side: THREE.BackSide });
        }

        // Create back material with solid color (on FrontSide)
        const backMaterial = new CardMaterial({
            color: 0x333333,
            side: THREE.FrontSide
        });

        // Create mesh with both materials using material array
        const materials = [frontMaterial, backMaterial];
        const mesh = new THREE.Mesh(geometry, materials);
        mesh.frustumCulled = false;

        // Set up geometry groups for front and back faces
        geometry.clearGroups();
        geometry.addGroup(0, geometry.index ? geometry.index.count : geometry.attributes.position.count, 0);
        geometry.addGroup(0, geometry.index ? geometry.index.count : geometry.attributes.position.count, 1);

        // Store original vertex positions for bending calculation
        const posAttr = geometry.getAttribute('position');
        const originalPositions = new Float32Array(posAttr.array.length);
        originalPositions.set(posAttr.array);

        return {
            mesh,
            data: projectData,
            index,
            baseT: index * CONFIG.cardSpacing, // Base position along path (0-1)
            originalPositions
        };
    }

    updateCardPositions() {
        const halfWidth = CONFIG.cardWidth / 2;
        const halfPathWidth = (CONFIG.cardWidthInPathUnits * CONFIG.cardScale) / 2;
        const up = new THREE.Vector3(0, 1, 0);
        const rotX = THREE.MathUtils.degToRad(CONFIG.cardRotation.x);

        this.cards.forEach((card) => {
            // Calculate center position on path
            let centerT = CONFIG.mainCardT - card.baseT + this.globalOffset;
            centerT = Math.max(halfPathWidth + 0.001, Math.min(1 - halfPathWidth - 0.001, centerT));
            card.currentT = centerT;

            // Reset mesh transform
            card.mesh.position.set(0, 0, 0);
            card.mesh.rotation.set(0, 0, 0);
            card.mesh.scale.setScalar(1);

            const geometry = card.mesh.geometry;
            const posAttr = geometry.getAttribute('position');
            const origPos = card.originalPositions;

            // Position each vertex along the curve
            for (let i = 0; i < posAttr.count; i++) {
                const localX = origPos[i * 3];     // -halfWidth to +halfWidth
                const localY = origPos[i * 3 + 1]; // -halfHeight to +halfHeight

                // Map local X to position along the path
                const tOffset = (localX / halfWidth) * halfPathWidth;
                let t = centerT + tOffset;
                t = Math.max(0.001, Math.min(0.999, t));

                // Get point and tangent at this t
                const pointOnCurve = this.path.getPointAt(t);
                const tangent = this.path.getTangentAt(t).normalize();

                // Calculate local frame at this point
                let normal = new THREE.Vector3().crossVectors(tangent, up);
                if (normal.length() < 0.001) {
                    normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(1, 0, 0));
                }
                normal.normalize();

                // Height direction (generally up, perpendicular to tangent)
                let heightDir = new THREE.Vector3().crossVectors(normal, tangent).normalize();
                if (heightDir.y < 0) heightDir.negate();

                // Apply height offset
                const scaledHeight = localY * CONFIG.cardScale;
                const heightOffset = heightDir.clone().multiplyScalar(scaledHeight);

                // Apply X rotation (tilt) around the tangent axis
                heightOffset.applyAxisAngle(tangent, rotX);

                // Final position
                const finalPos = pointOnCurve.clone().add(heightOffset);
                posAttr.setXYZ(i, finalPos.x, finalPos.y, finalPos.z);
            }

            posAttr.needsUpdate = true;
            if (CONFIG.useCardLighting) {
                geometry.computeVertexNormals();
            }

            // Fade cards at edges
            const edgeFade = Math.min(centerT * 10, (1 - centerT) * 10, 1);
            // Handle both single material and material array
            const materials = Array.isArray(card.mesh.material) ? card.mesh.material : [card.mesh.material];
            materials.forEach(mat => {
                mat.opacity = edgeFade;
                mat.transparent = edgeFade < 1;
            });
        });
    }

    computeFrenetFrames(segments) {
        const tangents = [];
        const normals = [];
        const binormals = [];

        // Sample tangents along the curve
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            tangents.push(this.path.getTangentAt(t).normalize());
        }

        // Initial normal - find a vector not parallel to first tangent
        let initialNormal = new THREE.Vector3(0, 1, 0);
        if (Math.abs(tangents[0].dot(initialNormal)) > 0.9) {
            initialNormal = new THREE.Vector3(1, 0, 0);
        }

        // First binormal and normal
        const firstBinormal = new THREE.Vector3().crossVectors(tangents[0], initialNormal).normalize();
        const firstNormal = new THREE.Vector3().crossVectors(firstBinormal, tangents[0]).normalize();

        normals.push(firstNormal);
        binormals.push(firstBinormal);

        // Propagate frames along curve (parallel transport)
        for (let i = 1; i <= segments; i++) {
            const prevNormal = normals[i - 1].clone();
            const prevBinormal = binormals[i - 1].clone();

            // Rotate previous frame to align with new tangent
            const axis = new THREE.Vector3().crossVectors(tangents[i - 1], tangents[i]);
            const angle = Math.acos(Math.max(-1, Math.min(1, tangents[i - 1].dot(tangents[i]))));

            if (axis.length() > 0.0001 && !isNaN(angle) && angle > 0.0001) {
                axis.normalize();
                const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle);
                prevNormal.applyQuaternion(quaternion);
                prevBinormal.applyQuaternion(quaternion);
            }

            normals.push(prevNormal.normalize());
            binormals.push(prevBinormal.normalize());
        }

        return { tangents, normals, binormals };
    }

    create3DTitle() {
        const mainPoint = this.path.getPointAt(CONFIG.mainCardT);

        // Create title group
        this.titleGroup = new THREE.Group();

        // Base height for scaling (adjustable)
        const subtitleBaseHeight = 0.4;
        const titleBaseHeight = 0.6;

        // Create subtitle mesh with canvas texture
        const subtitleResult = this.createTextTexture('PROJECT', {
            fontSize: 64,
            fontStyle: CONFIG.fonts.subtitleStyle,
            fontWeight: CONFIG.fonts.subtitleWeight,
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
        this.subtitleMesh = new THREE.Mesh(subtitleGeo, subtitleMat);
        this.subtitleMesh.position.set(-0.8, 0.55, 0);
        this.titleGroup.add(this.subtitleMesh);

        // Create main title mesh with canvas texture
        const titleResult = this.createTextTexture('TRUE HERO', {
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
        this.titleMesh = new THREE.Mesh(titleGeo, titleMat);
        this.titleMesh.position.set(0, 0, 0);
        this.titleGroup.add(this.titleMesh);

        // Position title group
        this.titleGroup.position.set(
            mainPoint.x + CONFIG.titleOffset.x,
            mainPoint.y + CONFIG.titleOffset.y,
            mainPoint.z + CONFIG.titleOffset.z
        );

        // Apply rotation
        this.titleGroup.rotation.set(
            THREE.MathUtils.degToRad(CONFIG.titleRotation.x),
            THREE.MathUtils.degToRad(CONFIG.titleRotation.y),
            THREE.MathUtils.degToRad(CONFIG.titleRotation.z)
        );

        // Apply scale
        this.titleGroup.scale.setScalar(CONFIG.titleScale);

        this.scene.add(this.titleGroup);
    }

    createTextTexture(text, options = {}) {
        const {
            fontSize = 72,
            fontFamily = CONFIG.fonts.family,
            fontStyle = CONFIG.fonts.titleStyle,
            fontWeight = CONFIG.fonts.titleWeight,
            textColor = CONFIG.fonts.textColor,
            bgColor = CONFIG.fonts.bgColor,
            skewX = CONFIG.fonts.skew,
            paddingX = 40,
            paddingY = 20
        } = options;

        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set font to measure text
        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
        const metrics = ctx.measureText(text);
        const textWidth = metrics.width;
        const textHeight = fontSize;

        // Calculate canvas size with padding and skew compensation
        const skewCompensation = Math.abs(skewX) * textHeight;
        canvas.width = Math.ceil(textWidth + paddingX * 2 + skewCompensation);
        canvas.height = Math.ceil(textHeight + paddingY * 2);

        // Fill background
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Apply skew transform for italic effect
        ctx.setTransform(1, 0, skewX, 1, 0, 0);

        // Draw text
        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.fillStyle = textColor;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        // Create texture
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        // Return texture and dimensions for proper plane sizing
        return {
            texture,
            width: canvas.width,
            height: canvas.height,
            aspect: canvas.width / canvas.height
        };
    }

    updateProjectTitle(projectIndex) {
        const project = PROJECTS[projectIndex];
        if (!project) return;

        // Parse title - extract main title without "Project" prefix
        let mainTitle = project.title;
        if (mainTitle.toLowerCase().startsWith('project ')) {
            mainTitle = mainTitle.substring(8); // Remove "Project " prefix
        }
        mainTitle = mainTitle.toUpperCase();

        // Base heights (same as in create3DTitle)
        const subtitleBaseHeight = 0.4;
        const titleBaseHeight = 0.6;

        // Update subtitle texture and geometry
        if (this.subtitleMesh) {
            const subtitleResult = this.createTextTexture(project.subtitle || 'PROJECT', {
                fontSize: 64,
                fontStyle: CONFIG.fonts.subtitleStyle,
                fontWeight: CONFIG.fonts.subtitleWeight,
                paddingX: 40,
                paddingY: 20
            });

            // Update geometry to match new aspect ratio
            const subtitleWidth = subtitleBaseHeight * subtitleResult.aspect;
            this.subtitleMesh.geometry.dispose();
            this.subtitleMesh.geometry = new THREE.PlaneGeometry(subtitleWidth, subtitleBaseHeight);

            this.subtitleMesh.material.map = subtitleResult.texture;
            this.subtitleMesh.material.needsUpdate = true;
        }

        // Update main title texture and geometry
        if (this.titleMesh) {
            const titleResult = this.createTextTexture(mainTitle, {
                fontSize: 96,
                paddingX: 50,
                paddingY: 25
            });

            // Update geometry to match new aspect ratio
            const titleWidth = titleBaseHeight * titleResult.aspect;
            this.titleMesh.geometry.dispose();
            this.titleMesh.geometry = new THREE.PlaneGeometry(titleWidth, titleBaseHeight);

            this.titleMesh.material.map = titleResult.texture;
            this.titleMesh.material.needsUpdate = true;
        }
    }

    // ==========================================
    // UI ELEMENT CONTROLS
    // ==========================================
    setTitleOffset(x, y, z) {
        CONFIG.titleOffset.x = x;
        CONFIG.titleOffset.y = y;
        CONFIG.titleOffset.z = z;
        this.updateTitlePosition();
    }

    setTitleScale(scale) {
        CONFIG.titleScale = scale;
        if (this.titleGroup) {
            this.titleGroup.scale.setScalar(scale);
        }
    }

    setTitleRotation(x, y, z) {
        CONFIG.titleRotation.x = x;
        CONFIG.titleRotation.y = y;
        CONFIG.titleRotation.z = z;
        if (this.titleGroup) {
            this.titleGroup.rotation.set(
                THREE.MathUtils.degToRad(x),
                THREE.MathUtils.degToRad(y),
                THREE.MathUtils.degToRad(z)
            );
        }
    }

    updateTitlePosition() {
        if (!this.titleGroup) return;
        const mainPoint = this.path.getPointAt(CONFIG.mainCardT);
        this.titleGroup.position.set(
            mainPoint.x + CONFIG.titleOffset.x,
            mainPoint.y + CONFIG.titleOffset.y,
            mainPoint.z + CONFIG.titleOffset.z
        );
    }

    setupInteraction() {
        // Mouse/touch interaction for 3D buttons
        this.container.addEventListener('click', (e) => this.onClick(e));
        this.container.addEventListener('mousemove', (e) => this.onMouseMove(e));

        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') this.next();
            if (e.key === 'ArrowLeft') this.prev();

            // Toggle fly camera with 'F' key
            if (e.key === 'f' || e.key === 'F') {
                if (this.flyMode) {
                    this.disableFlyMode();
                } else {
                    this.enableFlyMode();
                }
            }

            // ESC to exit fly mode
            if (e.key === 'Escape' && this.flyMode) {
                this.disableFlyMode();
            }
        });
    }

    onClick(event) {
        // Old WebGL button click detection removed
        // Timeline buttons now use CSS3D with DOM event listeners
    }

    onMouseMove(event) {
        // Old WebGL button hover detection removed
        // Timeline buttons now use CSS3D with DOM event listeners
    }

    updateMouse(event) {
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    onButtonClick(name) {
        if (name === 'prev') this.prev();
        else if (name === 'next') this.next();
        else if (name === 'play') this.playVideo();
    }

    // Navigation
    next() {
        if (this.currentIndex >= PROJECTS.length - 1) return;

        // Pause current video before navigating
        this.pauseCurrentVideo();

        this.currentIndex++;
        this.targetOffset += CONFIG.cardSpacing;
        this.animateToTarget();
        this.updateProjectTitle(this.currentIndex);
    }

    prev() {
        if (this.currentIndex <= 0) return;

        // Pause current video before navigating
        this.pauseCurrentVideo();

        this.currentIndex--;
        this.targetOffset -= CONFIG.cardSpacing;
        this.animateToTarget();
        this.updateProjectTitle(this.currentIndex);
    }

    goToProject(index) {
        index = Math.max(0, Math.min(PROJECTS.length - 1, index));

        const steps = index - this.currentIndex;
        this.targetOffset += steps * CONFIG.cardSpacing;
        this.currentIndex = index;
        this.animateToTarget();
        this.updateProjectTitle(this.currentIndex);
    }

    playVideo() {
        const project = PROJECTS[this.currentIndex];
        if (project.video) {
            this.toggleVideoPlayback();
        }
    }

    animateToTarget() {
        gsap.killTweensOf(this, "globalOffset");
        this.isAnimating = true;

        gsap.to(this, {
            globalOffset: this.targetOffset,
            duration: 0.6,
            ease: "elastic.out(0.5,0.2)",
            onUpdate: () => this.updateCardPositions(),
            onComplete: () => {
                this.isAnimating = false;
                this.onProjectChange(this.currentIndex);
            }
        });
    }

    flyInAnimation() {
        this.setIntroStartState();
        this.createFlyInTimeline();
    }

    createFlyInTimeline() {
        const tl = gsap.timeline({ delay: CONFIG.flyInDelay });

        // Show cards at start position
        tl.call(() => {
            this.cards.forEach((card, index) => {
                const project = PROJECTS[index];
                if (index === this.currentIndex && project && project.video) {
                    card.mesh.visible = false;
                    this.hiddenCardIndex = index;
                } else {
                    card.mesh.visible = true;
                }
            });
            this.updateCardPositions();
        });

        // Hold at start position
        tl.to({}, { duration: CONFIG.flyInHold });

        // Show timeline and title at start of their animation (small scale)
        tl.call(() => {
            if (this.timelineObject) {
                this.timelineObject.visible = true;
                this.timelineObject.scale.setScalar(0);
            }
            if (this.titleGroup) {
                this.titleGroup.visible = true;
                this.titleGroup.scale.setScalar(0);
            }
        }, [], CONFIG.flyInHold);

        // Animate cards to final position
        tl.to(this, {
            globalOffset: 0,
            duration: 1.2,
            ease: CustomEase.create("custom", "M0,0 C0,0 0.23157,0.91941 0.28491,1.07864 0.28731,1.0832 0.29051,1.08856 0.29291,1.09152 0.29531,1.09366 0.29931,1.09796 0.30251,1.09904 0.30491,1.09984 0.30971,1.09984 0.31211,1.09904 0.31611,1.09796 0.32251,1.09233 0.32491,1.08964 0.32891,1.08562 0.33371,1.07783 0.33851,1.07112 0.35051,1.05314 0.3729,1.00806 0.3865,0.99061 0.3913,0.9839 0.4001,0.97584 0.4049,0.97209 0.4073,0.97021 0.4105,0.96833 0.4129,0.96752 0.4153,0.96645 0.4201,0.96511 0.4233,0.96484 0.4257,0.9643 0.4305,0.96456 0.4329,0.96484 0.4361,0.96537 0.4401,0.96617 0.4449,0.96805 0.4601,0.97449 0.49129,0.99624 0.50648,1.00321 0.51208,1.00562 0.51928,1.00831 0.52408,1.00938 0.52808,1.01046 0.53688,1.01207 0.54168,1.01234 0.54728,1.01261 0.55848,1.01181 0.56568,1.011 0.58008,1.00912 0.61207,1.0008 0.62647,0.99866 0.63527,0.99732 0.64807,0.99571 0.65926,0.99544 0.68566,0.99491 0.74645,1.00081 0.77604,1.00135 0.80564,1.00188 0.86483,0.99947 0.89442,0.99947 0.92082,0.9992 1,1 1,1 "),
            onUpdate: () => {
                this.updateCardPositions();
            }
        }, CONFIG.flyInHold);

        // Animate title scale (same time as cards)
        if (this.titleGroup) {
            tl.to(this.titleGroup.scale, {
                x: CONFIG.titleScale,
                y: CONFIG.titleScale,
                z: CONFIG.titleScale,
                delay: 0.4,
                duration: 0.6,
                ease: "elastic.out(1,0.3)",
            }, CONFIG.flyInHold);
        }

        // Animate timeline scale (same time as cards)
        if (this.timelineObject) {
            const timelineScale = this.getTimelineWorldScale();
            tl.to(this.timelineObject.scale, {
                x: timelineScale,
                y: timelineScale,
                z: timelineScale,
                delay: 0.4,
                duration: 0.6,
                ease: "elastic.out(1,0.3)",
            }, CONFIG.flyInHold);
        }

        return tl;
    }

    // Direct offset control
    setOffset(offset) {
        this.globalOffset = offset;
        this.targetOffset = offset;
        this.updateCardPositions();
    }

    getCurrentProject() {
        return PROJECTS[this.currentIndex];
    }

    onProjectChange(index) {
        const event = new CustomEvent('projectChange', {
            detail: { index, project: PROJECTS[index] }
        });
        this.container.dispatchEvent(event);
    }

    onResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        const pixelRatio = this.renderer.getPixelRatio();

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.cssRenderer.setSize(width, height);

        // Update composer and SMAA pass for new size (with pixel ratio)
        this.composer.setSize(width * pixelRatio, height * pixelRatio);
        if (this.smaaPass) {
            this.smaaPass.setSize(width * pixelRatio, height * pixelRatio);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Update fly camera if enabled
        this.updateFlyCamera();

        // Update video overlay position
        this.updateVideoOverlay();

        // Update timeline position
        this.updateTimelinePosition();

        // Render with SMAA post-processing
        this.composer.render();
        this.cssRenderer.render(this.cssScene, this.camera);
    }

    updateVideoOverlay() {
        if (!this.videoObject || !this.cards.length) return;

        const focusedCard = this.cards[this.currentIndex];
        if (!focusedCard) return;

        const project = PROJECTS[this.currentIndex];

        // Show video overlay only if project has a video
        if (project.video) {
            this.videoObject.visible = true;

            // Hide the focused card (video overlay replaces it)
            if (this.hiddenCardIndex !== this.currentIndex) {
                // Show previously hidden card
                if (this.hiddenCardIndex !== null && this.cards[this.hiddenCardIndex]) {
                    this.cards[this.hiddenCardIndex].mesh.visible = true;
                }
                // Hide current focused card
                focusedCard.mesh.visible = false;
                this.hiddenCardIndex = this.currentIndex;
            }

            // Show video if changed (uses preloaded iframes for instant swap)
            if (this.currentVideoId !== project.video) {
                this.currentVideoId = project.video;
                this.showVideo(project.video);
                // Reset play state and set button immediately (no animation) on video change
                this.isVideoPlaying = false;
                this.setPlayPauseState(false);
            }

            // Get the center position of the focused card on the path
            const centerT = focusedCard.currentT;
            const position = this.path.getPointAt(centerT);
            const tangent = this.path.getTangentAt(centerT).normalize();

            // Calculate frame vectors (same as card positioning)
            const up = new THREE.Vector3(0, 1, 0);
            let normal = new THREE.Vector3().crossVectors(tangent, up);
            if (normal.length() < 0.001) {
                normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(1, 0, 0));
            }
            normal.normalize();

            // Height direction
            let heightDir = new THREE.Vector3().crossVectors(normal, tangent).normalize();
            if (heightDir.y < 0) heightDir.negate();

            // Build rotation to face along normal, with heightDir as up
            this.videoObject.position.copy(position);

            // Create a quaternion that orients the video plane
            const matrix = new THREE.Matrix4();
            // X axis = tangent (width direction), Y axis = heightDir (up), Z axis = normal (facing)
            matrix.makeBasis(tangent, heightDir, normal);
            this.videoObject.quaternion.setFromRotationMatrix(matrix);

            // Apply card rotation offsets
            const rotX = THREE.MathUtils.degToRad(CONFIG.cardRotation.x);
            const rotY = THREE.MathUtils.degToRad(CONFIG.cardRotation.y);
            const rotZ = THREE.MathUtils.degToRad(CONFIG.cardRotation.z);
            this.videoObject.rotateX(rotX);
            this.videoObject.rotateY(rotY);
            this.videoObject.rotateZ(rotZ);

            const s = this.videoBaseScale * CONFIG.videoScale;
            this.videoObject.scale.set(s, s, s);
        } else {
            this.videoObject.visible = false;
            // Show previously hidden card since no video overlay
            if (this.hiddenCardIndex !== null && this.cards[this.hiddenCardIndex]) {
                this.cards[this.hiddenCardIndex].mesh.visible = true;
                this.hiddenCardIndex = null;
            }
        }
    }

    // ==========================================
    // FLY CAMERA MODE
    // ==========================================
    enableFlyMode() {
        this.flyMode = true;
        this.cameraEuler.setFromQuaternion(this.camera.quaternion);

        // Keyboard controls
        document.addEventListener('keydown', this._onKeyDown = (e) => {
            this.keys[e.code] = true;
        });
        document.addEventListener('keyup', this._onKeyUp = (e) => {
            this.keys[e.code] = false;
        });

        // Pointer lock for mouse look
        this.renderer.domElement.addEventListener('click', this._requestPointerLock = () => {
            if (this.flyMode) {
                this.renderer.domElement.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', this._onPointerLockChange = () => {
            this.isPointerLocked = document.pointerLockElement === this.renderer.domElement;
        });

        document.addEventListener('mousemove', this._onMouseMoveFly = (e) => {
            if (this.flyMode && this.isPointerLocked) {
                this.cameraEuler.y -= e.movementX * this.lookSpeed;
                this.cameraEuler.x -= e.movementY * this.lookSpeed;
                this.cameraEuler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.cameraEuler.x));
                this.camera.quaternion.setFromEuler(this.cameraEuler);
            }
        });

        // Scroll wheel to adjust speed
        document.addEventListener('wheel', this._onWheel = (e) => {
            if (this.flyMode) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? 0.8 : 1.25; // Scroll down = slower, up = faster
                this.flySpeed = Math.max(this.flySpeedMin, Math.min(this.flySpeedMax, this.flySpeed * delta));

                // Dispatch event for UI update
                window.dispatchEvent(new CustomEvent('flySpeedChange', { detail: this.flySpeed }));
            }
        }, { passive: false });

        console.log('Fly mode enabled. Click canvas to capture mouse. WASD to move, mouse to look, Q/E for up/down, Shift for speed boost, Scroll for speed.');
    }

    disableFlyMode() {
        this.flyMode = false;
        document.exitPointerLock();

        if (this._onKeyDown) document.removeEventListener('keydown', this._onKeyDown);
        if (this._onKeyUp) document.removeEventListener('keyup', this._onKeyUp);
        if (this._requestPointerLock) this.renderer.domElement.removeEventListener('click', this._requestPointerLock);
        if (this._onPointerLockChange) document.removeEventListener('pointerlockchange', this._onPointerLockChange);
        if (this._onMouseMoveFly) document.removeEventListener('mousemove', this._onMouseMoveFly);
        if (this._onWheel) document.removeEventListener('wheel', this._onWheel);

        console.log('Fly mode disabled.');
    }

    setFlySpeed(speed) {
        this.flySpeed = Math.max(this.flySpeedMin, Math.min(this.flySpeedMax, speed));
    }

    updateFlyCamera() {
        if (!this.flyMode) return;

        const speed = this.keys['ShiftLeft'] || this.keys['ShiftRight'] ? this.flySpeed * 3 : this.flySpeed;
        const direction = new THREE.Vector3();

        // Forward/backward (W/S)
        if (this.keys['KeyW']) direction.z -= 1;
        if (this.keys['KeyS']) direction.z += 1;

        // Left/right strafe (A/D)
        if (this.keys['KeyA']) direction.x -= 1;
        if (this.keys['KeyD']) direction.x += 1;

        // Up/down (Q/E)
        if (this.keys['KeyQ']) direction.y -= 1;
        if (this.keys['KeyE']) direction.y += 1;

        if (direction.length() > 0) {
            direction.normalize().multiplyScalar(speed);
            direction.applyQuaternion(this.camera.quaternion);
            this.camera.position.add(direction);
        }
    }

    // ==========================================
    // DYNAMIC SETTINGS UPDATES
    // ==========================================
    setCardRotation(x, y, z) {
        CONFIG.cardRotation.x = x;
        CONFIG.cardRotation.y = y;
        CONFIG.cardRotation.z = z;
        this.updateCardPositions();
    }

    setCardScale(scale) {
        CONFIG.cardScale = scale;
        this.updateCardPositions();
    }

    setFOV(fov) {
        CONFIG.camera.fov = fov;
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
    }

    setMainCardT(t) {
        CONFIG.mainCardT = t;
        this.updateCardPositions();
    }

    // ==========================================
    // EXPORT CURRENT SETTINGS
    // ==========================================
    exportSettings() {
        // Get actual world positions/rotations from the 3D objects
        const titleWorldPos = this.titleGroup ? this.titleGroup.position : { x: 0, y: 0, z: 0 };
        const titleWorldRot = this.titleGroup ? {
            x: THREE.MathUtils.radToDeg(this.titleGroup.rotation.x),
            y: THREE.MathUtils.radToDeg(this.titleGroup.rotation.y),
            z: THREE.MathUtils.radToDeg(this.titleGroup.rotation.z)
        } : { x: 0, y: 0, z: 0 };
        const titleWorldScale = this.titleGroup ? this.titleGroup.scale.x : 1;

        // Calculate the offset from mainCardT position
        const mainPoint = this.path.getPointAt(CONFIG.mainCardT);

        // Timeline values (from CSS3D object)
        const timelineWorldPos = this.timelineObject ? this.timelineObject.position : { x: 0, y: 0, z: 0 };
        const timelineWorldRot = this.timelineObject ? {
            x: THREE.MathUtils.radToDeg(this.timelineObject.rotation.x),
            y: THREE.MathUtils.radToDeg(this.timelineObject.rotation.y),
            z: THREE.MathUtils.radToDeg(this.timelineObject.rotation.z)
        } : { x: 0, y: 0, z: 0 };
        const timelineScale = this.getTimelineScale();

        const settings = {
            camera: {
                fov: this.camera.fov,
                position: {
                    x: parseFloat(this.camera.position.x.toFixed(3)),
                    y: parseFloat(this.camera.position.y.toFixed(3)),
                    z: parseFloat(this.camera.position.z.toFixed(3))
                },
                rotation: {
                    x: parseFloat(this.cameraEuler.x.toFixed(4)),
                    y: parseFloat(this.cameraEuler.y.toFixed(4))
                }
            },
            cardRotation: { ...CONFIG.cardRotation },
            cardScale: CONFIG.cardScale,
            cardSpacing: CONFIG.cardSpacing,
            mainCardT: CONFIG.mainCardT,
            titleOffset: {
                x: parseFloat((titleWorldPos.x - mainPoint.x).toFixed(1)),
                y: parseFloat((titleWorldPos.y - mainPoint.y).toFixed(1)),
                z: parseFloat((titleWorldPos.z - mainPoint.z).toFixed(1))
            },
            titleScale: parseFloat(titleWorldScale.toFixed(2)),
            titleRotation: {
                x: Math.round(titleWorldRot.x),
                y: Math.round(titleWorldRot.y),
                z: Math.round(titleWorldRot.z)
            },
            timelineOffset: {
                x: parseFloat((timelineWorldPos.x - mainPoint.x).toFixed(1)),
                y: parseFloat((timelineWorldPos.y - mainPoint.y).toFixed(1)),
                z: parseFloat((timelineWorldPos.z - mainPoint.z).toFixed(1))
            },
            timelineScale: parseFloat(timelineScale.toFixed(2)),
            timelineRotation: {
                x: Math.round(timelineWorldRot.x),
                y: Math.round(timelineWorldRot.y),
                z: Math.round(timelineWorldRot.z)
            },
            globalOffset: parseFloat(this.globalOffset.toFixed(4))
        };

        const json = JSON.stringify(settings, null, 2);
        console.log('=== EXPORT SETTINGS ===');
        console.log(json);
        console.log('=======================');

        // Also copy to clipboard if possible
        if (navigator.clipboard) {
            navigator.clipboard.writeText(json).then(() => {
                console.log('Settings copied to clipboard!');
            });
        }

        return settings;
    }

    loadSettings(settings) {
        if (settings.camera) {
            if (settings.camera.fov) this.setFOV(settings.camera.fov);
            if (settings.camera.position) {
                this.camera.position.set(
                    settings.camera.position.x,
                    settings.camera.position.y,
                    settings.camera.position.z
                );
            }
            if (settings.camera.rotation) {
                this.cameraEuler.x = settings.camera.rotation.x;
                this.cameraEuler.y = settings.camera.rotation.y;
                this.camera.quaternion.setFromEuler(this.cameraEuler);
            }
        }
        if (settings.cardRotation) {
            this.setCardRotation(
                settings.cardRotation.x,
                settings.cardRotation.y,
                settings.cardRotation.z
            );
        }
        if (settings.cardScale !== undefined) {
            this.setCardScale(settings.cardScale);
        }
        if (settings.mainCardT !== undefined) {
            this.setMainCardT(settings.mainCardT);
        }
        if (settings.titleOffset) {
            this.setTitleOffset(
                settings.titleOffset.x,
                settings.titleOffset.y,
                settings.titleOffset.z
            );
        }
        if (settings.titleScale !== undefined) {
            this.setTitleScale(settings.titleScale);
        }
        if (settings.titleRotation) {
            this.setTitleRotation(
                settings.titleRotation.x,
                settings.titleRotation.y,
                settings.titleRotation.z
            );
        }
        if (settings.timelineOffset) {
            this.setTimelineOffset(
                settings.timelineOffset.x,
                settings.timelineOffset.y,
                settings.timelineOffset.z
            );
        }
        if (settings.timelineScale !== undefined) {
            this.setTimelineScale(settings.timelineScale);
        }
        if (settings.timelineRotation) {
            this.setTimelineRotation(
                settings.timelineRotation.x,
                settings.timelineRotation.y,
                settings.timelineRotation.z
            );
        }
        if (settings.globalOffset !== undefined) {
            this.setOffset(settings.globalOffset);
        }
    }

    // Debug helpers
    togglePathVisualization(visible) {
        if (this.pathVisualization) {
            this.pathVisualization.visible = visible;
        }
    }

    // Set a completely custom path
    setPath(points, closed = false) {
        const vectors = points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
        this.path = new THREE.CatmullRomCurve3(vectors, closed);

        // Recreate path visualization
        if (this.pathVisualization) {
            this.scene.remove(this.pathVisualization);
        }
        this.visualizePath();

        // Update positions
        this.updateCardPositions();
        this.setupCameraFromPath();
    }
}

// ============================================
// INITIALIZATION
// ============================================
let carousel;

// Use 'load' event - fires after all resources loaded and page is painted
window.addEventListener('load', () => {
    const container = document.getElementById('carousel-container');
    if (container) {
        carousel = new Carousel3D(container);
        window.carousel = carousel;
    }
});

export { Carousel3D, CONFIG, PROJECTS };
