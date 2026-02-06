// ==========================================
// FRAMER BRIDGE
// Communication utilities for parent Framer page
// ==========================================

const FRAMER_ORIGIN = '*'; // Accept any origin for flexibility

export function notifyProjectEntered(projectId, framerHash) {
    if (framerHash) {
        window.location.hash = framerHash;
    }
    window.parent.postMessage({
        type: 'projectEntered',
        projectId,
        hash: framerHash || projectId
    }, FRAMER_ORIGIN);
}

export function notifyProjectExited() {
    window.location.hash = '';
    window.parent.postMessage({
        type: 'projectExited'
    }, FRAMER_ORIGIN);
}

export function notifySceneChanged(sceneName) {
    window.parent.postMessage({
        type: 'sceneChanged',
        scene: sceneName
    }, FRAMER_ORIGIN);
}

/**
 * Check URL hash on load. Returns the matching project index or -1.
 * @param {Array} projects - PROJECTS array from projectData.js
 */
export function handleDeepLink(projects) {
    const hash = window.location.hash.replace('#', '');
    if (!hash) return -1;

    const index = projects.findIndex(p => p.framerHash === hash || p.id === hash);
    return index;
}
