import * as THREE from 'three';

// ==========================================
// SKY SCENE CONFIGURATION
// ==========================================
const SKY_CONFIG = {
    cameraYOffset: 25,      // Height above character
    cameraZOffset: 12,      // Distance from carousel
    cameraFov: 30,          // Fixed FOV for sky scene
    cardSpacing: 4.5,       // Space between cards
    cardWidth: 3,
    cardHeight: 2,
    floatAmplitude: 0.3,    // How much cards bob up/down
    floatSpeed: 2,          // Speed of floating animation

    projects: [
        {
            title: 'Project 1',
            description: 'Short description here. This is a cool project about...',
            thumbnailUrl: '', // Leave empty for colored placeholder
            youtubeId: 'dQw4w9WgXcQ',
            color: 0xff6b6b
        },
        {
            title: 'Project 2',
            description: 'Another amazing project that showcases...',
            thumbnailUrl: '',
            youtubeId: 'dQw4w9WgXcQ',
            color: 0x4ecdc4
        },
        {
            title: 'Project 3',
            description: 'Third project with interesting features...',
            thumbnailUrl: '',
            youtubeId: 'dQw4w9WgXcQ',
            color: 0xffe66d
        },
        {
            title: 'Project 4',
            description: 'Fourth project description...',
            thumbnailUrl: '',
            youtubeId: 'dQw4w9WgXcQ',
            color: 0xa8e6cf
        }
    ]
};

// ==========================================
// SKY STATE
// ==========================================
const skyState = {
    active: false,
    carousel: null,
    cards: [],
    selectedCard: null,
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),
    prevMouse: new THREE.Vector2(),  // ADD - for mouse velocity
    characterX: 0,
    characterY: 0,  // ADD
    isDragging: false,
    dragStart: 0,
    dragDistance: 0,  // ADD - track how far dragged
    carouselOffset: 0,
    targetOffset: 0,
    transitionTween: null,
    transitionFovTween: null,
    camera: null,
    transitioning: false
};

// ==========================================
// CREATE SKY SCENE
// ==========================================
export function createSkyScene(scene) {
    skyState.carousel = new THREE.Group();

    const cardCount = SKY_CONFIG.projects.length;

    SKY_CONFIG.projects.forEach((project, index) => {
        const card = createProjectCard(project, index);
        skyState.cards.push(card);
        skyState.carousel.add(card.group);
    });

    scene.add(skyState.carousel);
    skyState.carousel.visible = false;

    console.log('☁️ Sky scene created with', cardCount, 'projects');

    setupSkyInteractions();
    startFloatingAnimation();
}

function createProjectCard(project, index) {
    const group = new THREE.Group();

    // Position in horizontal line
    const x = index * SKY_CONFIG.cardSpacing;
    group.position.set(x, 0, 0);

    // Card background
    const cardGeometry = new THREE.PlaneGeometry(
        SKY_CONFIG.cardWidth,
        SKY_CONFIG.cardHeight
    );
    const cardMaterial = new THREE.MeshStandardMaterial({
        color: project.color || 0xffffff,
        side: THREE.DoubleSide,
        emissive: project.color || 0x000000,
        emissiveIntensity: 0.2
    });
    const cardMesh = new THREE.Mesh(cardGeometry, cardMaterial);
    group.add(cardMesh);

    // Load thumbnail if provided
    if (project.thumbnailUrl) {
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(
            project.thumbnailUrl,
            (texture) => {
                cardMaterial.map = texture;
                cardMaterial.needsUpdate = true;
            },
            undefined,
            (error) => console.warn('Failed to load thumbnail:', project.thumbnailUrl)
        );
    }

    // Title text
    const titleSprite = createTextSprite(project.title, 'white');
    titleSprite.position.y = -SKY_CONFIG.cardHeight / 2 - 0.5;
    group.add(titleSprite);

    // Glow effect
    const glowGeometry = new THREE.PlaneGeometry(
        SKY_CONFIG.cardWidth + 0.2,
        SKY_CONFIG.cardHeight + 0.2
    );
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: project.color,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.z = -0.01;
    group.add(glow);

    // Store initial Y for floating animation
    group.userData.initialY = 0;
    group.userData.floatOffset = Math.random() * Math.PI * 2;

    return {
        group: group,
        mesh: cardMesh,
        glow: glow,
        glowMaterial: glowMaterial,
        titleSprite: titleSprite,
        data: project,
        isExpanded: false
    };
}

function createTextSprite(text, color = 'white') {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 128;

    context.fillStyle = color;
    context.font = 'bold 48px Arial';
    context.textAlign = 'center';
    context.shadowColor = 'black';
    context.shadowBlur = 10;
    context.fillText(text, 256, 80);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2, 0.5, 1);

    return sprite;
}

function startFloatingAnimation() {
    // Initialize physics properties for each card
    skyState.cards.forEach((card, index) => {
        card.physics = {
            baseY: (Math.random() - 0.5) * 0.4,  // Random rest position
            velocityY: 0,
            floatSpeed: 0.3 + Math.random() * 0.2,
            damping: 0.92,
            mouseForce: 0,
            rotation: 0,
            rotationVelocity: 0
        };
    });
}

// ==========================================
// SCENE TRANSITIONS
// ==========================================
export function transitionToSky(camera, scene, worldScene, roomScene, character, cameraState) {
    skyState.active = true;
    skyState.transitioning = true;
    skyState.camera = camera;
    skyState.characterX = character.x;
    skyState.characterY = character.y;  // ADD THIS LINE

    // Cancel any in-flight transition tween so its onComplete can't hide the sky.
    if (skyState.transitionTween) {
        skyState.transitionTween.kill();
        skyState.transitionTween = null;
    }
    if (skyState.transitionFovTween) {
        skyState.transitionFovTween.kill();
        skyState.transitionFovTween = null;
    }
    // Keep sky ready above the character while we move the camera up.
    skyState.carousel.visible = true;

    // Position carousel above camera
    updateCarouselPosition();

    // Animate camera UP only
    const targetY = character.y + SKY_CONFIG.cameraYOffset;
    const targetZ = character.group.position.z + SKY_CONFIG.cameraZOffset;

    skyState.transitionTween = gsap.to(camera.position, {
        y: targetY,
        z: targetZ,
        duration: 2,
        ease: "power2.inOut",
        onComplete: () => {
            if (worldScene) worldScene.visible = false;
            if (roomScene) roomScene.visible = false;
            if (cameraState) {
                cameraState.fovTransitionActive = false;
            }
            skyState.transitioning = false;
            console.log('☁️ Arrived in sky');
            window.parent.postMessage({ type: 'sceneChanged', scene: 'sky' }, '*');
        }
    });

    if (cameraState) {
        cameraState.currentFov = camera.fov;
        cameraState.fovTransitionActive = true;
    }

    skyState.transitionFovTween = gsap.to(cameraState || camera, {
        ...(cameraState ? { currentFov: SKY_CONFIG.cameraFov } : { fov: SKY_CONFIG.cameraFov }),
        duration: 2,
        ease: "power2.inOut",
        onUpdate: () => {
            if (cameraState) {
                camera.fov = cameraState.currentFov;
            }
            camera.updateProjectionMatrix();
        }
    });

    // Opacity fade happens after the camera arrives in sky.

    // Fade fog
    gsap.to(scene.fog, {
        near: 5,
        far: 50,
        duration: 2
    });
}

export function transitionToGround(camera, scene, worldScene, character, cameraState, CONFIG) {
    skyState.active = false;
    skyState.transitioning = true;

    // DON'T hide immediately - REMOVE THIS LINE:
    // skyState.carousel.visible = false;

    // Show ground
    if (worldScene) worldScene.visible = true;

    // Close any expanded card
    if (skyState.selectedCard) {
        collapseCard(skyState.selectedCard);
    }

    // Animate camera DOWN only
    const targetY = character.y + CONFIG.camera.startY;
    const targetZ = CONFIG.camera.startZ;

    if (skyState.transitionTween) {
        skyState.transitionTween.kill();
    }
    if (skyState.transitionFovTween) {
        skyState.transitionFovTween.kill();
        skyState.transitionFovTween = null;
    }

    cameraState.currentFov = camera.fov;
    cameraState.fovTransitionActive = true;
    camera.fov = cameraState.currentFov;
    camera.updateProjectionMatrix();

    skyState.transitionTween = gsap.to(camera.position, {
        y: targetY,
        z: targetZ,
        duration: 2,
        ease: "power2.inOut",
        onComplete: () => {
            if (!skyState.active) {
                skyState.carousel.visible = false;  // HIDE AFTER transition
            }
            cameraState.inRoom = false;
            cameraState.locked = false;
            cameraState.fovTransitionActive = false;
            skyState.transitioning = false;
            console.log('🌍 Back on ground');
            window.parent.postMessage({ type: 'sceneChanged', scene: 'ground' }, '*');
        }
    });

    skyState.transitionFovTween = gsap.to(cameraState, {
        currentFov: CONFIG.camera.fovMin,
        duration: 2,
        ease: "power2.inOut",
        onUpdate: () => {
            camera.fov = cameraState.currentFov;
            camera.updateProjectionMatrix();
        }
    });

    // Restore fog
    gsap.to(scene.fog, {
        near: CONFIG.scene.fogNear,
        far: CONFIG.scene.fogFar,
        duration: 2
    });
}

function updateCarouselPosition() {
    // Keep carousel centered above the character.
    const centerOffset = -(skyState.cards.length - 1) * SKY_CONFIG.cardSpacing / 2;
    skyState.carousel.position.set(
        skyState.characterX + centerOffset + skyState.carouselOffset,
        skyState.characterY + SKY_CONFIG.cameraYOffset,
        0
    );
}

// ==========================================
// INTERACTIONS
// ==========================================
function setupSkyInteractions() {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('click', onMouseClick);
}

function onMouseMove(event) {
    if (!skyState.active || skyState.transitioning) return;

    const newMouse = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: -(event.clientY / window.innerHeight) * 2 + 1
    };

    // Dragging
    if (skyState.isDragging) {
        const dragDelta = newMouse.x - skyState.mouse.x;
        skyState.targetOffset += dragDelta * 7.5;  // Sensitivity factor
        skyState.dragDistance += Math.abs(dragDelta);  // ADD - track distance
    }

    skyState.prevMouse.copy(skyState.mouse);  // ADD - store previous
    skyState.mouse.x = newMouse.x;
    skyState.mouse.y = newMouse.y;
}

function onMouseDown(event) {
    if (!skyState.active || skyState.transitioning) return;
    skyState.isDragging = true;
    skyState.dragStart = skyState.mouse.x;
    skyState.dragDistance = 0;  // ADD - reset drag distance
}

function onMouseUp(event) {
    skyState.isDragging = false;
}

function onMouseClick(event) {
    if (!skyState.active || skyState.transitioning) return;

    // Ignore click if dragged too far
    if (skyState.dragDistance > 0.02) {  // ADD THIS CHECK
        skyState.dragDistance = 0;
        return;
    }

    const clickedCard = getHoveredCard();
    if (clickedCard && !clickedCard.isExpanded) {
        expandCard(clickedCard);
    } else if (skyState.selectedCard && skyState.selectedCard.isExpanded) {
        // Click outside to close
        collapseCard(skyState.selectedCard);
    }
}

function getHoveredCard() {
    const cardMeshes = skyState.cards.map(c => c.mesh);
    skyState.raycaster.setFromCamera(skyState.mouse, skyState.camera);
    const intersects = skyState.raycaster.intersectObjects(cardMeshes);

    if (intersects.length > 0) {
        return skyState.cards.find(c => c.mesh === intersects[0].object);
    }
    return null;
}

function expandCard(card) {
    skyState.selectedCard = card;
    card.isExpanded = true;

    // Scale up card
    gsap.to(card.group.scale, {
        x: 2,
        y: 2,
        z: 1,
        duration: 0.5,
        ease: "back.out(1.4)"
    });

    // Bring forward
    gsap.to(card.group.position, {
        z: 2,
        duration: 0.5,
        ease: "power2.out"
    });

    // Dim other cards
    skyState.cards.forEach(c => {
        if (c !== card) {
            gsap.to(c.mesh.material, { opacity: 0.2, duration: 0.3 });
            gsap.to(c.titleSprite.material, { opacity: 0.2, duration: 0.3 });
        }
    });

    // Show info overlay (HTML)
    showCardInfo(card.data);
}

function collapseCard(card) {
    card.isExpanded = false;
    skyState.selectedCard = null;

    // Scale back
    gsap.to(card.group.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 0.4,
        ease: "power2.inOut"
    });

    // Move back
    gsap.to(card.group.position, {
        z: 0,
        duration: 0.4,
        ease: "power2.inOut"
    });

    // Restore other cards
    skyState.cards.forEach(c => {
        gsap.to(c.mesh.material, { opacity: 1, duration: 0.3 });
        gsap.to(c.titleSprite.material, { opacity: 1, duration: 0.3 });
    });

    // Hide info overlay
    hideCardInfo();
}

function showCardInfo(project) {
    // Use existing video overlay
    document.getElementById('video-title').textContent = project.title;
    document.getElementById('video-subtitle').textContent = project.description;
    document.getElementById('video-iframe').src =
        `https://www.youtube.com/embed/${project.youtubeId}?autoplay=1`;
    document.getElementById('video-overlay').classList.add('active');
}

function hideCardInfo() {
    document.getElementById('video-overlay').classList.remove('active');
    document.getElementById('video-iframe').src = '';
}

// ==========================================
// UPDATE LOOP
// ==========================================
export function updateSky(camera, character) {
    if (!skyState.active) return;

    skyState.camera = camera;

    // Update character position tracking (fallback if camera not set)
    if (character) {
        skyState.characterX = character.x;
        skyState.characterY = character.y;
    }

    // Smooth carousel drag
    skyState.carouselOffset += (skyState.targetOffset - skyState.carouselOffset) * 0.1;

    // Update carousel position
    updateCarouselPosition();

    if (skyState.transitioning) {
        return;
    }

    // Physics-based floating and mouse interaction
    updateCardPhysics();

    // Hover effects (only if not expanded)
    if (!skyState.selectedCard) {
        const hoveredCard = getHoveredCard();

        skyState.cards.forEach(card => {
            const isHovered = card === hoveredCard;

            gsap.to(card.glowMaterial, {
                opacity: isHovered ? 0.5 : 0,
                duration: 0.2
            });
        });
    }
}
function updateCardPhysics() {
    const time = performance.now() * 0.001;

    skyState.cards.forEach((card) => {
        if (card.isExpanded) return;

        const physics = card.physics || (card.physics = {});

        if (physics.baseX === undefined) physics.baseX = card.group.position.x;
        if (physics.baseY === undefined) physics.baseY = card.group.position.y;
        if (physics.baseZ === undefined) physics.baseZ = card.group.position.z;
        if (physics.offsetX === undefined) physics.offsetX = 0;
        if (physics.offsetY === undefined) physics.offsetY = 0;
        if (physics.offsetZ === undefined) physics.offsetZ = 0;
        if (physics.velX === undefined) physics.velX = 0;
        if (physics.velY === undefined) physics.velY = 0;
        if (physics.velZ === undefined) physics.velZ = 0;
        if (physics.rotX === undefined) physics.rotX = 0;
        if (physics.rotY === undefined) physics.rotY = 0;
        if (physics.rotZ === undefined) physics.rotZ = 0;
        if (physics.rotVelX === undefined) physics.rotVelX = 0;
        if (physics.rotVelY === undefined) physics.rotVelY = 0;
        if (physics.rotVelZ === undefined) physics.rotVelZ = 0;
        if (physics.wiggleSeed === undefined) physics.wiggleSeed = Math.random() * 10;

        const cardWorldPos = new THREE.Vector3();
        card.group.getWorldPosition(cardWorldPos);
        const cardScreenPos = cardWorldPos.clone().project(skyState.camera);

        const dx = skyState.mouse.x - cardScreenPos.x;
        const dy = skyState.mouse.y - cardScreenPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const range = 0.6;
        const t = THREE.MathUtils.clamp(1 - dist / range, 0, 1);
        const falloff = t * t * (3 - 2 * t);

        const pushStrength = 1.25 * falloff;
        const pushX = -dx * pushStrength;
        const pushY = -dy * pushStrength;
        const pushZ = -falloff * 0.6;

        const spring = 0.12;
        const damp = 0.86;
        physics.velX += (pushX - physics.offsetX) * spring;
        physics.velY += (pushY - physics.offsetY) * spring;
        physics.velZ += (pushZ - physics.offsetZ) * spring;

        physics.velX *= damp;
        physics.velY *= damp;
        physics.velZ *= damp;

        physics.offsetX += physics.velX;
        physics.offsetY += physics.velY;
        physics.offsetZ += physics.velZ;

        physics.rotVelX += (pushY * 0.6 - physics.rotX) * 0.08;
        physics.rotVelY += (-pushX * 0.8 - physics.rotY) * 0.08;
        physics.rotVelZ += (-pushX * 0.25 - physics.rotZ) * 0.05;

        physics.rotVelX *= 0.85;
        physics.rotVelY *= 0.85;
        physics.rotVelZ *= 0.88;

        physics.rotX += physics.rotVelX;
        physics.rotY += physics.rotVelY;
        physics.rotZ += physics.rotVelZ;

        const wiggle = (Math.sin(time * 1.1 + physics.wiggleSeed) * 0.05) +
            (Math.sin(time * 0.7 + physics.wiggleSeed * 1.7) * 0.03);
        const bob = Math.sin(time * 0.9 + card.group.userData.floatOffset) * 0.06;

        card.group.position.x = physics.baseX + physics.offsetX;
        card.group.position.y = physics.baseY + physics.offsetY + bob + wiggle;
        card.group.position.z = physics.baseZ + physics.offsetZ;

        card.group.rotation.x = physics.rotX + wiggle * 0.2;
        card.group.rotation.y = physics.rotY;
        card.group.rotation.z = physics.rotZ;
    });
}

// ==========================================
// CLOSE HANDLER
// ==========================================
export function handleSkyClose() {
    if (skyState.selectedCard) {
        collapseCard(skyState.selectedCard);
    }
}

export function isSkyActive() {
    return skyState.active;
}

export function isSkyTransitioning() {
    return skyState.transitioning;
}

export { SKY_CONFIG };
