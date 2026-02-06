// ==========================================
// UNIFIED PROJECT & COLLECTION DATA
// ==========================================
// Single source of truth for both the ground scene islands
// and the video viewer carousel.

export const PROJECTS = [
    {
        id: 'showreel',
        name: 'SHOWREEL',
        subtitle: 'PROJECT',
        score: '030000',
        time: '00:02:30',
        client: 'PERSONAL',
        year: '2026.02',
        type: 'REEL',
        thumbnailUrl: 'assets/textures/thumb-showreel.png',
        image: 'assets/textures/thumb-showreel.png',
        youtubeId: 'G53bMjhMKH8',
        color: 0xcccccc,
        framerHash: 'showreel-project'
    },
    {
        id: 'true-hero',
        name: 'TRUE HERO',
        subtitle: 'PROJECT',
        score: '033000',
        time: '00:03:01',
        client: 'REDSHYFT',
        year: '2023.09',
        type: 'Rocket League Edit',
        thumbnailUrl: 'assets/textures/thumb-true-hero.png',
        image: 'assets/textures/thumb-true-hero.png',
        youtubeId: 'eaoRglirIaU',
        color: 0xbbbbbb,
        framerHash: 'true-hero-project'
    },
    {
        id: 'wayne-rooney',
        name: '06 wayne rooney',
        subtitle: 'PROJECT',
        score: '520000',
        time: '00:01:45',
        client: 'JIM LEGXACY',
        year: '2025.10',
        type: 'Music Video',
        thumbnailUrl: 'assets/textures/thumb-06-wayne-rooney.png',
        image: 'assets/textures/thumb-06-wayne-rooney.png',
        youtubeId: 'RhjZgIk9oCs',
        color: 0xaaaaaa,
        framerHash: 'wayne-rooney-project'
    },
    {
        id: 'synthesis',
        name: 'SYNTHESIS',
        subtitle: 'PROJECT',
        score: '020000',
        time: '00:02:15',
        client: 'TEAM FATE',
        year: '2025.08',
        type: '3D Animation',
        thumbnailUrl: 'assets/textures/thumb-synthesis.png',
        image: 'assets/textures/thumb-synthesis.png',
        youtubeId: 'TnzvqJenCLE',
        color: 0x999999,
        framerHash: 'synthesis-project'
    },
    {
        id: 'home',
        name: 'HOME',
        subtitle: 'PROJECT',
        score: '015000',
        time: '00:01:30',
        client: 'PERSONAL',
        year: '2025.05',
        type: 'life',
        thumbnailUrl: 'assets/textures/thumb-home.png',
        image: 'assets/textures/thumb-home.png',
        youtubeId: 'HVwy-_EP69M',
        color: 0x888888,
        framerHash: 'home-project'
    },
    {
        id: 'starz',
        name: 'STARZ',
        subtitle: 'PROJECT',
        score: '015000',
        time: '00:01:30',
        client: 'PERSONAL',
        year: '2025.01',
        type: 'EXPERIMENT',
        thumbnailUrl: 'assets/textures/thumb-starz.png',
        image: 'assets/textures/thumb-starz.png',
        youtubeId: 'h9k9Bq7NKrg',
        color: 0x888888,
        framerHash: 'starz-project'
    },
    {
        id: 'studiopolis',
        name: 'STUDIOPOLIS',
        subtitle: 'PROJECT',
        score: '015000',
        time: '00:01:30',
        client: 'PERSONAL',
        year: '2021.02',
        type: 'Rocket League Edit',
        thumbnailUrl: 'assets/textures/thumb-studiopolis.png',
        image: 'assets/textures/thumb-studiopolis.png',
        youtubeId: 'IOcZSYp75Ec',
        color: 0x888888,
        framerHash: 'studiopolis-project'
        
    },
    {
        id: 'ruin-2',
        name: 'RUIN 2',
        subtitle: 'PROJECT',
        score: '015000',
        time: '00:01:30',
        client: 'PERSONAL',
        year: '2022.08',
        type: 'Music Video',
        thumbnailUrl: 'assets/textures/thumb-ruin-2.png',
        image: 'assets/textures/thumb-ruin-2.png',
        youtubeId: 'gKvS01ru5x4',
        color: 0x888888,
        framerHash: 'ruin-2-project'
    },
    {
        id: 'invisible-frenzy',
        name: 'INVISIBLE FRENZY',
        subtitle: 'PROJECT',
        score: '015000',
        time: '00:01:30',
        client: 'PERSONAL',
        year: '2022.08',
        type: 'Music Video',
        thumbnailUrl: 'assets/textures/thumb-invisible-frenzy.png',
        image: 'assets/textures/thumb-invisible-frenzy.png',
        youtubeId: '_IVGP3PnRLE',
        color: 0x888888,
        framerHash: 'invisible-frenzy-project'
    },
    {
        id: 'hiasobi',
        name: 'HIASOBI',
        subtitle: 'PROJECT',
        score: '015000',
        time: '00:01:30',
        client: 'PERSONAL',
        year: '2022.08',
        type: 'Music Video',
        thumbnailUrl: 'assets/textures/thumb-hiasobi.png',
        image: 'assets/textures/thumb-hiasobi.png',
        youtubeId: 'GcNA2fv6Esw',
        color: 0x888888,
        framerHash: 'hiasobi-project'
    },
    // === LOCKED CARDS (Carousel-only fillers, no ground zones) ===
    {
        id: 'locked-1',
        name: 'LOCKED',
        subtitle: 'COMING SOON',
        score: '------',
        time: '--:--:--',
        client: '???',
        year: '----',
        type: 'LOCKED',
        thumbnailUrl: 'assets/textures/thumb-locked.png',
        image: 'assets/textures/thumb-locked.png',
        color: 0x555555,
        framerHash: 'locked',
        locked: true
    },
    {
        id: 'locked-2',
        name: 'LOCKED',
        subtitle: 'COMING SOON',
        score: '------',
        time: '--:--:--',
        client: '???',
        year: '----',
        type: 'LOCKED',
        thumbnailUrl: 'assets/textures/thumb-locked.png',
        image: 'assets/textures/thumb-locked.png',
        color: 0x555555,
        framerHash: 'locked',
        locked: true
    },
    {
        id: 'locked-3',
        name: 'LOCKED',
        subtitle: 'COMING SOON',
        score: '------',
        time: '--:--:--',
        client: '???',
        year: '----',
        type: 'LOCKED',
        thumbnailUrl: 'assets/textures/thumb-locked.png',
        image: 'assets/textures/thumb-locked.png',
        color: 0x555555,
        framerHash: 'locked',
        locked: true
    },
    {
        id: 'locked-4',
        name: 'LOCKED',
        subtitle: 'COMING SOON',
        score: '------',
        time: '--:--:--',
        client: '???',
        year: '----',
        type: 'LOCKED',
        thumbnailUrl: 'assets/textures/thumb-locked.png',
        image: 'assets/textures/thumb-locked.png',
        color: 0x555555,
        framerHash: 'locked',
        locked: true
    },
    {
        id: 'locked-5',
        name: 'LOCKED',
        subtitle: 'COMING SOON',
        score: '------',
        time: '--:--:--',
        client: '???',
        year: '----',
        type: 'LOCKED',
        thumbnailUrl: 'assets/textures/thumb-locked.png',
        image: 'assets/textures/thumb-locked.png',
        color: 0x555555,
        framerHash: 'locked',
        locked: true
    }
];

// Collection room data - populated with placeholder structure.
// Add actual items when assets are ready.
export const COLLECTIONS = {
    photography: {
        title: 'Photography',
        items: []
        // items: [{ name: 'Photo Name', thumbnail: 'assets/collections/photo1.png' }, ...]
    },
    sfxEdits: {
        title: 'SFX Edits',
        items: []
    },
    conceptArt: {
        title: 'Concept Art',
        items: []
    }
};
