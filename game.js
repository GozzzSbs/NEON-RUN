// ======================================================
// NEON RUN 3D - SPACE GALAXY
// Three.js r128 requis avant ce fichier
// ======================================================

const canvas = document.getElementById("game");

if (!window.THREE) {
    alert("Three.js n'est pas chargé !");
    throw new Error("Three.js missing");
}

if (!canvas) throw new Error("Canvas #game introuvable");

// ======================================================
// SCÈNE
// ======================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050313);
scene.fog = new THREE.Fog(0x09051e, 65, 190);

const camera = new THREE.PerspectiveCamera(
    65,
    (canvas.clientWidth / canvas.clientHeight) || 1,
    0.1,
    400
);

camera.position.set(0, 5, 9);
camera.lookAt(0, 1.5, -20);

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(
    canvas.clientWidth || window.innerWidth,
    canvas.clientHeight || window.innerHeight
);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ======================================================
// LUMIÈRES
// ======================================================

scene.add(new THREE.HemisphereLight(0x7777bb, 0x171020, 1.1));

const mainLight = new THREE.DirectionalLight(0xaaaaff, 1.2);
mainLight.position.set(-10, 25, 10);
mainLight.castShadow = true;
scene.add(mainLight);

const purpleLight = new THREE.PointLight(0x7c25ff, 2, 55);
purpleLight.position.set(0, 8, -25);
scene.add(purpleLight);

// ======================================================
// VARIABLES
// ======================================================
// ======================================================
// SÉCURITÉ SUPABASE
// ======================================================

let isDeveloper = false;

const SUPABASE_URL = "https://xumhnzfrvyjiiwftarje.supabase.co";

const SUPABASE_KEY = "sb_publishable_oJUFcIernBcgfNZqw9vBbA_TeNIJwHc";

const supabaseClient = window.supabase?.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

if (!supabaseClient) {
    console.warn("Supabase non chargé : espace développeur indisponible.");
}
let running = false;
let paused = false;
let gameEnded = false;
let animationStarted = false;
const originalPlayerMaterials = new Map();
let equippedSkin = localStorage.getItem("neonEquippedSkin") || "default";
let equippedCape = localStorage.getItem("neonEquippedCape") || "";
let shopCapeObject = null;
let score = 0;
let coins = 0;
// TIMER NO COIN
let noCoinStartTime = 0;
let noCoinTimerInterval = null;
let noCoinElapsed = 0;
let best = Number(localStorage.getItem("neonBest") || 0);
let selectedLeaderboardMode = "classic";
// Diamants gagnés pendant cette partie
let diamondMilestones = 0;

let lane = 1;
let targetX = 0;

let jumping = false;
let ridingTrain = null;
let sliding = false;
let jumpVelocity = 0;
let slideTimer = 0;

let speed = 0.65;
let baseSpeed = 0.65;
let speedMultiplier = 1.5;
let maxSpeedMultiplier = 2;

const SPEED_INCREASE = 0.00008;

let difficulty = "normal";
let selectedMode = "classic";

let frame = 0;
let spawnTimer = 0;

const lanePositions = [-3, 0, 3];

let obstacles = [];
let coinObjects = [];

let movingSleepers = [];
let movingStars = [];
let movingAliens = [];
let movingTrains = [];

let player;
let playerParts;

let lavaGroup;
let lavaPlatforms = [];
let lavaPlatformTimer = 0;
let lavaLastLane = 1;

const LAVA_PLATFORM_TOP = 0.42;

const normalTrackMeshes = [];

const DIFFICULTY_SETTINGS = {
    facile: { base: 0.45, start: 1, max: 1.4 },
    normal: { base: 0.55, start: 1.2, max: 1.8 },
    difficile: { base: 0.65, start: 1.5, max: 2.1 },
    extreme: { base: 0.75, start: 1.6, max: 2.4 }
};

function applyDifficultySettings(reset = true) {
    const settings =
        DIFFICULTY_SETTINGS[difficulty] || DIFFICULTY_SETTINGS.normal;

    baseSpeed = settings.base;
    maxSpeedMultiplier = settings.max;

    if (reset) speedMultiplier = settings.start;

    speed = baseSpeed * speedMultiplier;
}

// ======================================================
// MATÉRIAUX
// ======================================================

function mat(color, emissive = 0x000000, intensity = 0) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.65,
        metalness: 0.25,
        emissive,
        emissiveIntensity: intensity
    });
}

function box(w, h, d, color, x, y, z, parent = scene) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        typeof color === "number" ? mat(color) : color
    );

    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);

    return mesh;
}

// ======================================================
// FOND GALAXIE
// ======================================================

const starMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff
});

for (let i = 0; i < 900; i++) {
    const star = new THREE.Mesh(
        new THREE.SphereGeometry(
            0.035 + Math.random() * 0.045,
            5,
            5
        ),
        starMaterial
    );

    star.position.set(
        (Math.random() - 0.5) * 250,
        5 + Math.random() * 100,
        -Math.random() * 250
    );

    scene.add(star);
    movingStars.push(star);
}

function createNebula(x, y, z, color, size) {
    const cloud = new THREE.Mesh(
        new THREE.SphereGeometry(size, 24, 24),
        new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.12,
            depthWrite: false
        })
    );

    cloud.position.set(x, y, z);
    cloud.scale.set(1.8, 0.7, 0.3);
    scene.add(cloud);
}

createNebula(-45, 35, -100, 0x8b22ff, 24);
createNebula(45, 45, -130, 0x163cff, 30);
createNebula(0, 55, -190, 0xff2299, 35);
createNebula(-70, 25, -210, 0x13cfff, 28);

// Planète géante
const planet = new THREE.Mesh(
    new THREE.SphereGeometry(15, 32, 32),
    mat(0x402080, 0x210044, 0.4)
);

planet.position.set(48, 28, -115);
scene.add(planet);

// Anneau de planète
const ring = new THREE.Mesh(
    new THREE.TorusGeometry(20, 0.7, 8, 100),
    mat(0x9b65ff, 0x6020ff, 1)
);

ring.position.copy(planet.position);
ring.rotation.x = 1.2;
scene.add(ring);

// ======================================================
// SOL SPATIAL
// ======================================================

const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 350),
    mat(0x100d24)
);

floor.rotation.x = -Math.PI / 2;
floor.position.set(0, -0.48, -100);
scene.add(floor);

const road = box(
    12, 0.3, 220,
    mat(0x25213b, 0x17103c, 0.3),
    0, -0.25, -80
);

normalTrackMeshes.push(road);

// Bords lumineux
for (const x of [-5.8, 5.8]) {
    const edge = box(
        0.12, 0.12, 220,
        mat(0x9c25ff, 0x8b00ff, 1.5),
        x, -0.05, -80
    );

    normalTrackMeshes.push(edge);
}

// Rails
function createTrack() {
    for (let i = 0; i < 3; i++) {
        const x = lanePositions[i];

        for (const side of [-0.85, 0.85]) {
            const rail = box(
                0.12, 0.16, 220,
                mat(0x777799, 0x2828aa, 0.4),
                x + side, 0, -80
            );

            normalTrackMeshes.push(rail);
        }

        for (let j = 0; j < 55; j++) {
            const sleeper = box(
                2.1, 0.18, 0.45,
                mat(0x34304d),
                x, -0.05, 15 - j * 4
            );

            movingSleepers.push(sleeper);
            normalTrackMeshes.push(sleeper);
        }
    }
}

createTrack();

// ======================================================
// VAISSEAUX ALIENS
// ======================================================

function createAlienShip(x, y, z) {
    const ship = new THREE.Group();

    const bodyMaterial = mat(0x4c4c65, 0x24244c, 0.5);

    const glassMaterial = new THREE.MeshStandardMaterial({
        color: 0x36eaff,
        emissive: 0x00bfff,
        emissiveIntensity: 1.8,
        metalness: 0.5,
        roughness: 0.15
    });

    const body = new THREE.Mesh(
        new THREE.SphereGeometry(1, 24, 16),
        bodyMaterial
    );

    body.scale.set(1.8, 0.35, 1);
    ship.add(body);

    const cockpit = new THREE.Mesh(
        new THREE.SphereGeometry(0.65, 20, 16),
        glassMaterial
    );

    cockpit.position.y = 0.35;
    cockpit.scale.set(0.9, 0.75, 0.9);
    ship.add(cockpit);

    for (let i = 0; i < 8; i++) {
        const angle = i / 8 * Math.PI * 2;

        const light = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 8, 8),
            mat(0x35ffb2, 0x00ff88, 2)
        );

        light.position.set(
            Math.cos(angle) * 1.35,
            -0.1,
            Math.sin(angle) * 0.7
        );

        ship.add(light);
    }

    const engine = new THREE.Mesh(
        new THREE.ConeGeometry(0.35, 1.4, 12),
        new THREE.MeshBasicMaterial({
            color: 0x9a35ff,
            transparent: true,
            opacity: 0.75
        })
    );

    engine.position.z = -1.2;
    engine.rotation.x = Math.PI / 2;
    ship.add(engine);

    ship.position.set(x, y, z);
    ship.userData.direction = 0.08;

    scene.add(ship);
    movingAliens.push(ship);
}

for (let i = 0; i < 14; i++) {
    createAlienShip(
        (Math.random() - 0.5) * 100,
        12 + Math.random() * 35,
        -30 - i * 18
    );
}

// ======================================================
// PERSONNAGE
// ======================================================

function createPlayer() {
    player = new THREE.Group();

    playerParts = {
        arms: [],
        legs: [],
        body: null,
        head: null
    };

    const purple = mat(0x7900b8, 0x39005c, 0.3);
    const black = mat(0x211b28);
    const lime = mat(0xb6ff19, 0x4cff00, 0.5);
    const skin = mat(0xd98a57);
    const white = mat(0xffe9d1);

    function limb(w, h, d, material, x, y, z, parent) {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            material
        );

        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        parent.add(mesh);
        return mesh;
    }

    function sphere(radius, material, x, y, z, parent) {
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 16, 16),
            material
        );

        mesh.position.set(x, y, z);
        parent.add(mesh);
        return mesh;
    }

    // Corps
    const torso = new THREE.Group();
    torso.position.y = 1.75;
    player.add(torso);
    playerParts.body = torso;

    limb(0.9, 1.1, 0.48, black, 0, 0, 0, torso);
    limb(0.94, 0.15, 0.5, white, 0, -0.52, 0, torso);

    // Logo
    const logo = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.28, 0.03),
        lime
    );

    logo.position.set(0, 0.1, 0.25);
    torso.add(logo);

    // Tête
    const head = new THREE.Group();
    head.position.set(0, 2.65, 0);
    player.add(head);
    playerParts.head = head;

    sphere(0.34, skin, 0, 0, 0, head);
    sphere(0.35, black, 0, 0.13, 0, head);
    sphere(0.39, purple, 0, 0.3, 0, head);

    limb(0.74, 0.18, 0.72, purple, 0, 0.17, 0, head);

    for (const side of [-1, 1]) {
        limb(0.16, 0.38, 0.28, black, side * 0.39, -0.12, 0, head);
        limb(0.17, 0.15, 0.29, lime, side * 0.4, -0.12, 0, head);
    }

    // Bras
    for (const side of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(side * 0.51, 2.2, 0);
        player.add(arm);

        limb(
            0.28, 0.48, 0.3,
            side === -1 ? purple : lime,
            0, -0.24, 0, arm
        );

        const elbow = new THREE.Group();
        elbow.position.y = -0.48;
        arm.add(elbow);

        limb(0.24, 0.43, 0.27, black, 0, -0.21, 0, elbow);
        sphere(0.14, skin, 0, -0.46, 0, elbow);

        arm.userData.elbow = elbow;
        playerParts.arms.push(arm);
    }

    // Jambes
    for (const side of [-1, 1]) {
        const leg = new THREE.Group();
        leg.position.set(side * 0.24, 1.22, 0);
        player.add(leg);

        limb(0.34, 0.6, 0.38, black, 0, -0.3, 0, leg);

        const knee = new THREE.Group();
        knee.position.y = -0.58;
        leg.add(knee);

        limb(0.32, 0.45, 0.36, black, 0, -0.2, 0, knee);
        limb(0.43, 0.23, 0.6, purple, 0, -0.48, -0.1, knee);
        limb(0.44, 0.08, 0.61, white, 0, -0.6, -0.1, knee);
        limb(0.35, 0.07, 0.12, lime, 0, -0.47, -0.36, knee);

        leg.userData.knee = knee;
        playerParts.legs.push(leg);
    }

    player.position.set(0, 0, 0);
    scene.add(player);
}

createPlayer();

// ======================================================
// TRAINS SPATIAUX
// ======================================================

function createTrain(laneIndex, z) {

    const train = new THREE.Group();

    // 4 STYLES DE TRAINS SPATIAUX
    const styles = [
        {
            name: "Galaxy Blue",
            body: 0x102b66,
            neon: 0x00ddff,
            windows: 0x75f5ff,
            roof: 0x183e80
        },
        {
            name: "Nebula",
            body: 0x35105c,
            neon: 0xff35dd,
            windows: 0xffaaff,
            roof: 0x541477
        },
        {
            name: "Cosmic Emerald",
            body: 0x092c32,
            neon: 0x00ffbb,
            windows: 0x80ffe0,
            roof: 0x12434a
        },
        {
            name: "Solar Galaxy",
            body: 0x30200c,
            neon: 0xffaa22,
            windows: 0xffe49a,
            roof: 0x50300d
        }
    ];

    // Choisir un style au hasard
    const style = styles[
        Math.floor(Math.random() * styles.length)
    ];

    const bodyMaterial = mat(style.body, style.neon, 0.7);
    const roofMaterial = mat(style.roof, style.neon, 0.5);
    const neonMaterial = mat(style.neon, style.neon, 2);
    const windowMaterial = mat(style.windows, style.windows, 1.7);

    // CORPS PRINCIPAL : dimensions conservées
    box(2.55, 3.4, 13, bodyMaterial, 0, 2, 0, train);

    // TOIT PLAT ET LARGE : même forme pour garder la surface supérieure
    box(2.48, 0.08, 12.8, roofMaterial, 0, 3.74, 0, train);

    // LIGNES LUMINEUSES SUR LE TOIT
    for (const side of [-1, 1]) {
        box(0.07, 0.04, 12, neonMaterial,
            side * 1.12, 3.81, 0, train);
    }

    // PANNEAUX GALAXY SUR LE TOIT
    for (let zPos = -4.5; zPos <= 4.5; zPos += 3) {
        box(0.75, 0.035, 1.1, neonMaterial,
            0, 3.81, zPos, train);
    }

    // AVANT LUMINEUX
    box(2.4, 1.1, 0.2, neonMaterial, 0, 3, 6.55, train);
    box(1.7, 0.85, 0.12, windowMaterial, 0, 2.8, 6.68, train);

    // FENÊTRES LATÉRALES
    for (let zPos = -5; zPos <= 4; zPos += 3) {
        box(0.08, 1, 1.5, windowMaterial,
            -1.3, 2.8, zPos, train);

        box(0.08, 1, 1.5, windowMaterial,
            1.3, 2.8, zPos, train);
    }

    const wheels = [];

    // BANDES LUMINEUSES LATÉRALES
    for (const side of [-1, 1]) {

        box(0.12, 0.12, 12, neonMaterial,
            side * 1.3, 1.2, 0, train);

        const headlight = new THREE.PointLight(
            style.neon, 3, 25
        );

        headlight.position.set(side * 0.8, 0.8, 7);
        train.add(headlight);

        box(0.4, 0.4, 0.15, style.windows,
            side * 0.8, 0.8, 6.7, train);
    }

    // BAS DU TRAIN
    box(2.3, 0.4, 11, 0x090914, 0, 0.2, 0, train);

    // ROUES
    for (const zPos of [-4, 4]) {
        for (const side of [-1, 1]) {

            const wheel = new THREE.Mesh(
                new THREE.CylinderGeometry(0.38, 0.38, 0.25, 16),
                mat(0x222233)
            );

            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(side * 1.35, 0.45, zPos);

            train.add(wheel);
            wheels.push(wheel);
        }
    }

    train.position.set(lanePositions[laneIndex], 0, z);

    // DONNÉES D'ANIMATION
    train.userData.wheels = wheels;
    train.userData.shake = Math.random() * Math.PI * 2;
    train.userData.style = style.name;

    scene.add(train);

    obstacles.push({
        object: train,
        type: "train",
        lane: laneIndex
    });
}

// ======================================================
// BARRIÈRES FUTURISTES
// ======================================================

function createBarrier(laneIndex, z) {

    const barrier = new THREE.Group();

    // MATÉRIAUX GALAXY
    const red = mat(0xff244f, 0x990020, 1.5);
    const white = mat(0xeafaff, 0x80dfff, 1);
    const blue = mat(0x087cff, 0x003bff, 2);
    const cyan = mat(0x00eaff, 0x0088ff, 2);
    const purple = mat(0x9b31ff, 0x6200ff, 2);
    const metal = mat(0x252b49, 0x10152e, 0.8);

    // 3 MODÈLES AU HASARD
    const variant = Math.floor(Math.random() * 3);

    // PETITE FONCTION POUR LES SPHÈRES
    function orb(x, y, z, radius, material) {
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 20, 16),
            material
        );

        sphere.position.set(x, y, z);
        barrier.add(sphere);
    }

    // PETITE FONCTION POUR LES BANDES
    function stripe(x, y, rotation) {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.38, 0.9, 0.16),
            red
        );

        mesh.position.set(x, y, 0);
        mesh.rotation.z = rotation;
        barrier.add(mesh);
    }

    // =================================================
    // MODÈLE 1 : GRANDE BARRIÈRE SUSPENDUE
    // =================================================

    if (variant === 0) {

        // Supports latéraux
        for (const side of [-1, 1]) {

            box(0.18, 2.5, 0.25,
                metal, side * 1.05, 1.25, 0, barrier);

            box(0.24, 0.12, 0.3,
                cyan, side * 1.05, 2.5, 0, barrier);

            // Boules d'énergie
            orb(side * 0.92, 2.55, 0, 0.25, blue);
        }

        // Panneau rayé
        box(2.1, 1.15, 0.35,
            red, 0, 2.15, 0, barrier);

        // Bandes blanches
        for (let i = -2; i <= 2; i++) {
            stripe(i * 0.4, 2.15, 0);
        }

        // Contour lumineux
        box(2.2, 0.08, 0.42,
            cyan, 0, 2.75, 0, barrier);

        // Énergie au centre
        box(0.12, 0.95, 0.43,
            purple, 0, 2.15, -0.03, barrier);
    }

    // =================================================
    // MODÈLE 2 : BARRIÈRE SUR PLATEFORME
    // =================================================

    else if (variant === 1) {

        // Base futuriste
        box(2.35, 0.25, 0.7,
            blue, 0, 0.15, 0, barrier);

        box(2.1, 0.08, 0.74,
            cyan, 0, 0.3, 0, barrier);

        // Montants
        for (const side of [-1, 1]) {

            box(0.2, 1.4, 0.3,
                metal, side * 0.85, 0.9, 0, barrier);

            box(0.3, 0.3, 0.35,
                purple, side * 0.85, 1.65, 0, barrier);

            orb(side * 0.85, 1.85, 0, 0.22, cyan);
        }

        // Panneau central
        box(2.1, 0.85, 0.35,
            red, 0, 1.55, 0, barrier);

        // Bandes blanches
        for (let i = -2; i <= 2; i++) {
            stripe(i * 0.4, 1.55, 0);
        }

        // Ligne lumineuse supérieure
        box(2.2, 0.08, 0.4,
            cyan, 0, 2.02, 0, barrier);
    }

    // =================================================
    // MODÈLE 3 : BARRIÈRE BASSE À SAUTER
    // =================================================

    else {

        // Panneau principal
        box(2.1, 1.05, 0.35,
            red, 0, 0.95, 0, barrier);

        // Bandes blanches
        for (let i = -2; i <= 2; i++) {
            stripe(i * 0.4, 0.95, 0);
        }

        // Grosses sphères latérales
        for (const side of [-1, 1]) {

            orb(side * 1.08, 1.35, 0, 0.28, blue);

            box(0.16, 0.9, 0.25,
                metal, side * 1.08, 0.45, 0, barrier);
        }

        // Socle
        box(2.25, 0.18, 0.55,
            metal, 0, 0.08, 0, barrier);

        // Ligne d'énergie
        box(2.15, 0.07, 0.4,
            cyan, 0, 1.5, 0, barrier);
    }

    // POSITION
    barrier.position.set(
        lanePositions[laneIndex],
        0,
        z
    );

    scene.add(barrier);

    obstacles.push({
        object: barrier,
        type: "barrier",
        lane: laneIndex,
        variant: variant
    });
}
// ======================================================
// PIÈCES COSMIQUES
// ======================================================

function createCoin(laneIndex, z) {
    const coin = new THREE.Group();

    const goldMaterial = new THREE.MeshStandardMaterial({
        color: 0xffd52a,
        metalness: 0.8,
        roughness: 0.2,
        emissive: 0xff9900,
        emissiveIntensity: 0.8
    });

    const coinRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.4, 0.12, 12, 24),
        goldMaterial
    );

    coin.add(coinRing);

    const center = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 12, 12),
        mat(0xffffff, 0xffcc00, 1.5)
    );

    coin.add(center);

    coin.position.set(lanePositions[laneIndex], 1.3, z);
    scene.add(coin);
    coinObjects.push(coin);
}

// ======================================================
// LAVE
// ======================================================

function createLavaEnvironment() {
    if (lavaGroup) return;

    lavaGroup = new THREE.Group();

    const lava = new THREE.Mesh(
        new THREE.PlaneGeometry(22, 230),
        new THREE.MeshStandardMaterial({
            color: 0xff3b08,
            emissive: 0xff2600,
            emissiveIntensity: 1.15
        })
    );

    lava.rotation.x = -Math.PI / 2;
    lava.position.set(0, -0.48, -78);
    lavaGroup.add(lava);

    scene.add(lavaGroup);
}

function setLavaVisuals(enabled) {
    createLavaEnvironment();

    normalTrackMeshes.forEach(mesh => {
        mesh.visible = !enabled;
    });

    lavaGroup.visible = enabled;

    scene.background = new THREE.Color(
        enabled ? 0x260b12 : 0x050313
    );

    scene.fog.color.set(
        enabled ? 0x3b1010 : 0x09051e
    );
}

// ======================================================
// PLATEFORMES DE LAVE
// ======================================================

function createLavaPlatform(laneIndex, z, width = 2.55, depth = 5.2) {
    const platform = new THREE.Group();

    const rock = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.55, depth),
        mat(0x40332e)
    );

    rock.position.y = -0.02;
    platform.add(rock);

    const top = new THREE.Mesh(
        new THREE.BoxGeometry(width - 0.2, 0.12, depth - 0.2),
        mat(0x716052)
    );

    top.position.y = 0.31;
    platform.add(top);

    const edgeMaterial = new THREE.MeshBasicMaterial({
        color: 0xff5a12
    });

    for (const side of [-1, 1]) {
        const edge = new THREE.Mesh(
            new THREE.BoxGeometry(0.09, 0.08, depth),
            edgeMaterial
        );

        edge.position.set(side * (width / 2 - 0.1), 0.34, 0);
        platform.add(edge);
    }

    platform.position.set(lanePositions[laneIndex], 0, z);
    platform.userData.width = width;
    platform.userData.depth = depth;

    scene.add(platform);
    lavaPlatforms.push({
        object: platform,
        lane: laneIndex
    });
}

function spawnLavaSegment(z) {
    const choices = [lavaLastLane];

    if (lavaLastLane > 0) choices.push(lavaLastLane - 1);
    if (lavaLastLane < 2) choices.push(lavaLastLane + 1);

    const nextLane = choices[Math.floor(Math.random() * choices.length)];

    lavaLastLane = nextLane;
    createLavaPlatform(nextLane, z);
}

function resetLavaPlatforms() {
    lavaPlatforms.forEach(item => scene.remove(item.object));

    lavaPlatforms = [];
    lavaPlatformTimer = 0;
    lavaLastLane = 1;

    if (selectedMode !== "lava") return;

    createLavaPlatform(1, -25, 9.2, 60);

    for (let i = 0; i < 12; i++) {
        spawnLavaSegment(-65 - i * 12);
    }
}

function moveLavaPlatforms() {
    if (selectedMode !== "lava") return;

    lavaPlatformTimer++;

    lavaPlatforms.forEach(item => {
        item.object.position.z += speed;
    });

    lavaPlatforms = lavaPlatforms.filter(item => {
        if (item.object.position.z > 18) {
            scene.remove(item.object);
            return false;
        }

        return true;
    });

    if (lavaPlatformTimer > 12) {
        const furthestZ = lavaPlatforms.reduce(
            (min, item) => Math.min(min, item.object.position.z),
            0
        );

        spawnLavaSegment(furthestZ - 12);
        lavaPlatformTimer = 0;
    }
}

function isPlayerAboveLavaPlatform() {
    return lavaPlatforms.some(item => {
        const p = item.object;

        return (
            Math.abs(p.position.x - player.position.x) <
                (p.userData.width / 2 - 0.15) &&
            Math.abs(p.position.z) <
                (p.userData.depth / 2 - 0.15)
        );
    });
}

// ======================================================
// GÉNÉRATION
// ======================================================

function spawnObjects() {
    const laneIndex = Math.floor(Math.random() * 3);

    if (Math.random() < 0.55) {
        createTrain(laneIndex, -115);
    } else {
        createBarrier(laneIndex, -105);
    }

    if (selectedMode === "lava") return;

    if (Math.random() < 0.8) {
        const possibleLanes = [0, 1, 2].filter(l => l !== laneIndex);

        const coinLane =
            possibleLanes[Math.floor(Math.random() * possibleLanes.length)];

        for (let i = 0; i < 5; i++) {
            createCoin(coinLane, -75 - i * 3);
        }
    }
}

// ======================================================
// MODES
// ======================================================

function selectMode(mode, button) {
    selectedMode = mode;

    document.querySelectorAll(".mode-buttons button").forEach(b => {
        b.classList.remove("active");
    });

    if (button) button.classList.add("active");

    const descriptions = {
        classic: "Évite les trains et les barrières spatiales. Ramasse les pièces !",
        nocoin: "Ne touche aucune pièce !",
        lava: "La voie est devenue de la lave ! Saute de plateforme en plateforme."
    };

    const description = document.getElementById("modeDescription");

    if (description) {
        description.textContent = descriptions[mode] || descriptions.classic;
    }
}

window.selectMode = selectMode;

// ======================================================
// DIFFICULTÉ
// ======================================================

function setDifficulty(level, button) {
    difficulty = level;
window.difficulty = level;
    console.log("DIFFICULTÉ SÉLECTIONNÉE :", difficulty);
    document.querySelectorAll(".difficulty-buttons button").forEach(b => {
        b.classList.remove("active");
    });

    if (button) button.classList.add("active");

    applyDifficultySettings(true);
}

window.setDifficulty = setDifficulty;

// ======================================================
// COMMANDES
// ======================================================

function moveLeft() {
    if (!running || paused) return;

    lane = Math.max(0, lane - 1);
    targetX = lanePositions[lane];
}

function moveRight() {
    if (!running || paused) return;

    lane = Math.min(2, lane + 1);
    targetX = lanePositions[lane];
}

function jump() {
   if (!running || paused || (jumping && !ridingTrain)) return;

ridingTrain = null;

    sliding = false;
    slideTimer = 0;
    player.scale.y = 1;

    jumping = true;
    jumpVelocity = 0.32;
}

function slide() {
    if (!running || paused) return;

    if (jumping) {
        jumpVelocity = -0.38;
        sliding = true;
        slideTimer = 50;
        return;
    }

    if (!sliding) {
        sliding = true;
        slideTimer = 50;
    }
}

window.addEventListener("keydown", e => {
    const key = e.key.toLowerCase();

    if ([
        "arrowleft", "arrowright", "arrowup", "arrowdown", " "
    ].includes(key)) {
        e.preventDefault();
    }

    if (key === "q" || key === "arrowleft") moveLeft();
    if (key === "d" || key === "arrowright") moveRight();
    if (key === "z" || key === "arrowup" || key === " ") jump();
    if (key === "s" || key === "arrowdown") slide();
    if (key === "escape") pauseGame();
});// ======================================================
// COLLISIONS
// ======================================================

function checkCollisions() {
    if (
        selectedMode === "lava" &&
        !jumping &&
        !isPlayerAboveLavaPlatform()
    ) {
        endGame("Tu es tombé dans la lave !");
        return;
    }

    for (const obstacle of obstacles) {
        const distance = obstacle.object.position.z;

        const sameLane =
            Math.abs(obstacle.object.position.x - player.position.x) < 1.25;

        if (!sameLane) continue;

        if (
    obstacle.type === "train" &&
    ridingTrain !== obstacle.object &&
    distance > -8 &&
    distance < 2
) {
            endGame("Un train spatial t'a percuté !");
            return;
        }

        if (
            obstacle.type === "barrier" &&
            distance > -1.3 &&
            distance < 1.3
        ) {
            if (!jumping && !sliding) {
                endGame("Tu as heurté une barrière !");
                return;
            }
        }
    }

    // Ramassage des pièces
    for (let i = coinObjects.length - 1; i >= 0; i--) {
        const coin = coinObjects[i];

        if (
            Math.abs(coin.position.z) < 1.5 &&
            Math.abs(coin.position.x - player.position.x) < 1.2 &&
            Math.abs(coin.position.y - (1.3 + player.position.y)) < 1.5
        ) {
            scene.remove(coin);
            coinObjects.splice(i, 1);

            if (selectedMode === "nocoin") {
                endGame("Tu as ramassé une pièce !");
                return;
            }

            coins++;
updateDailyChallengeProgress("coins", 1);
            shopWallet++;
            localStorage.setItem("neonWallet", shopWallet);

            updateShopWallet();
        }
    }
}

// ======================================================
// SYSTÈME DE DIAMANTS
// ======================================================

function checkDiamondMilestones() {
    const reachedMilestones = Math.floor(score / 3000);

    if (reachedMilestones <= diamondMilestones) return;

    const newMilestones = reachedMilestones - diamondMilestones;
    const earned = newMilestones * 2;

    diamondMilestones = reachedMilestones;

    shopDiamonds += earned;

    localStorage.setItem("neonDiamonds", shopDiamonds);

    updateShopWallet();

    showDiamondMessage(earned);
}

function showDiamondMessage(amount) {
    const message = document.getElementById("diamondRewardMessage");

    if (!message) return;

    message.textContent =
        "💎 VOUS AVEZ GAGNÉ " + amount + " DIAMANTS !";

    message.style.opacity = "1";

    clearTimeout(window.neonDiamondMessageTimer);

    window.neonDiamondMessageTimer = setTimeout(() => {
        message.style.opacity = "0";
    }, 2500);
}

// ======================================================
// ANIMATION DU PERSONNAGE
// ======================================================

function animateRunner() {
    const movement = frame * 0.18;

    if (!jumping && !sliding) {
        const swing = Math.sin(movement);

        playerParts.arms[0].rotation.x = swing * 0.85;
        playerParts.arms[1].rotation.x = -swing * 0.85;

        playerParts.legs[0].rotation.x = -swing * 0.75;
        playerParts.legs[1].rotation.x = swing * 0.75;

        playerParts.legs[0].userData.knee.rotation.x =
            Math.max(0, swing) * 0.8;

        playerParts.legs[1].userData.knee.rotation.x =
            Math.max(0, -swing) * 0.8;

        playerParts.body.position.y =
            1.75 + Math.abs(Math.sin(movement * 2)) * 0.06;
    }

    if (jumping) {
        playerParts.arms[0].rotation.x = -0.9;
        playerParts.arms[1].rotation.x = -0.9;
        playerParts.legs[0].rotation.x = 0.45;
        playerParts.legs[1].rotation.x = -0.45;
    }

    if (sliding) {
        playerParts.arms[0].rotation.x = 0.7;
        playerParts.arms[1].rotation.x = 0.7;
        playerParts.legs[0].rotation.x = -0.5;
        playerParts.legs[1].rotation.x = -0.5;
    }

    animateCape();
}

// ======================================================
// DÉFILEMENT DU DÉCOR
// ======================================================

function moveEnvironment() {
    movingSleepers.forEach(sleeper => {
        sleeper.position.z += speed;

        if (sleeper.position.z > 20) {
            sleeper.position.z -= 220;
        }
    });

    movingStars.forEach(star => {
        star.position.z += speed * 0.3;

        if (star.position.z > 20) {
            star.position.z -= 260;
        }
    });

    movingAliens.forEach(ship => {
        ship.position.x += ship.userData.direction || 0.08;
        ship.position.y += Math.sin(frame * 0.025 + ship.position.z) * 0.015;
        ship.rotation.z = Math.sin(frame * 0.02 + ship.position.z) * 0.04;

        if (ship.position.x > 75) {
            ship.position.x = -75;
            ship.position.z = -40 - Math.random() * 180;
        }
    });
}

// ======================================================
// OBSTACLES ET TRAINS
// ======================================================

function moveObstacles() {
    obstacles.forEach(obstacle => {

        if (obstacle.type === "train") {

            // Le train fonce vers le joueur
            obstacle.object.position.z += speed * 1.8;

            // Rotation des roues
            const wheels = obstacle.object.userData.wheels || [];

            wheels.forEach(wheel => {
                wheel.rotation.x += speed * 0.15;
            });

            // Légères vibrations du train
            obstacle.object.position.y =
                Math.sin(frame * 0.25 + obstacle.object.userData.shake) * 0.025;

        } else {

            obstacle.object.position.z += speed;
        }
    });

    obstacles = obstacles.filter(obstacle => {
        if (obstacle.object.position.z > 20) {
            scene.remove(obstacle.object);
            return false;
        }

        return true;
    });
}
function moveCoins() {
    coinObjects.forEach(coin => {
        coin.position.z += speed;
        coin.rotation.y += 0.08;
        coin.rotation.z += 0.04;
    });

    coinObjects = coinObjects.filter(coin => {
        if (coin.position.z > 18) {
            scene.remove(coin);
            return false;
        }

        return true;
    });
}

// ======================================================
// HUD
// ======================================================

function updateHUD() {
    const scoreElement = document.getElementById("score");
    const coinElement = document.getElementById("coins");
    const bestElement = document.getElementById("best");

    if (scoreElement) scoreElement.textContent = score;
    if (coinElement) coinElement.textContent = coins;
    if (bestElement) bestElement.textContent = best;
}

// ======================================================
// GAME OVER
// ======================================================

function endGame(reason) {
    if (gameEnded) return;

   gameEnded = true;
running = false;
paused = false;

stopNoCoinTimer();

saveScoreToSupabase().catch(error => {
    console.error("Erreur lors de la sauvegarde :", error);
});
    if (score > best) {
        best = score;
        localStorage.setItem("neonBest", best);
    }

    const gameOver = document.getElementById("gameOver");

    const title = document.getElementById("gameOverTitle");
    const reasonElement = document.getElementById("gameOverReason");
    const finalScore = document.getElementById("finalScore");
    const finalCoins = document.getElementById("finalCoins");

    if (title) title.textContent = "GAME OVER";
    if (reasonElement) reasonElement.textContent = reason;
    if (finalScore) finalScore.textContent = score;
    if (finalCoins) finalCoins.textContent = coins;

    if (gameOver) gameOver.classList.remove("hidden");

    updateHUD();
}
// ======================================================
// SAUVEGARDE DU SCORE DANS SUPABASE
// ======================================================

async function saveScoreToSupabase() {

    const pseudo = localStorage.getItem("neonPlayerPseudo");

    if (!pseudo || pseudo.trim() === "" || pseudo === "TON_PSEUDO") {
        console.warn("Pseudo invalide : score non enregistré.");
        return;
    }

    if (!supabaseClient) {
        console.warn("Supabase n'est pas connecté !");
        return;
    }

    const mode = selectedMode || "classic";
    const currentDifficulty = window.difficulty || difficulty;
    const newScore = Math.floor(score);

    const newTime = mode === "nocoin"
        ? Number(noCoinElapsed.toFixed(2))
        : null;

    const { data: previousScores, error: fetchError } =
        await supabaseClient
            .from("neon_scores")
.select("score, time_seconds")
.eq("player_pseudo", pseudo)
.eq("game_mode", mode)
.eq("difficulty", currentDifficulty);

    if (fetchError) {
        console.error("Erreur récupération record :", fetchError);
        return;
    }

    if (previousScores && previousScores.length > 0) {

        if (mode === "nocoin") {

            const validTimes = previousScores
                .map(s => Number(s.time_seconds))
                .filter(t => Number.isFinite(t) && t > 0);

            const bestTime = validTimes.length
                ? Math.max(...validTimes)
                : 0;

            if (newTime <= bestTime) {
                console.log("Pas de nouveau record No Coin.");
                return;
            }

        } else {

            const bestScore = Math.max(
                ...previousScores.map(s => Number(s.score))
            );

            if (newScore < bestScore) {
    console.log("Pas de nouveau record classique.");
    return;
}
        }
    }
console.log("DIFFICULTÉ ENREGISTRÉE :", difficulty, window.difficulty);
    const { error: insertError } = await supabaseClient
        .from("neon_scores")
        .insert([{
    player_pseudo: pseudo,
    score: newScore,
    coins: Math.floor(coins),
    game_mode: mode,
    difficulty: currentDifficulty,
    time_seconds: newTime
}]);

    if (insertError) {
        console.error("Erreur sauvegarde du record :", insertError);
    } else {
        console.log("🏆 NOUVEAU RECORD ENREGISTRÉ !");
    }
}
// ======================================================
// BOUCLE PRINCIPALE
// ======================================================

function animate() {
    requestAnimationFrame(animate);

    if (!running || paused || gameEnded) return;

    frame++;

    score++;
if (score % 100 === 0) {
    updateDailyChallengeProgress("score", 100);
}
    checkDiamondMilestones();

    speedMultiplier = Math.min(
        maxSpeedMultiplier,
        speedMultiplier + SPEED_INCREASE
    );

    speed = baseSpeed * speedMultiplier;

    spawnTimer++;

    const spawnDelay = Math.max(48, 100 - speed * 25);

    if (spawnTimer >= spawnDelay) {
        spawnObjects();
        spawnTimer = 0;
    }

    player.position.x += (targetX - player.position.x) * 0.18;

    if (jumping) {
        const previousY = player.position.y;
        player.position.y += jumpVelocity;

        jumpVelocity -= selectedMode === "lava" ? 0.035 : 0.012;
// DÉTECTION DE L'ATTERRISSAGE SUR UN TRAIN
if (jumpVelocity < 0) {
    for (const obstacle of obstacles) {
        if (obstacle.type !== "train") continue;

        const train = obstacle.object;
        const roofHeight = 3.78 + train.position.y;

        const sameLane =
            Math.abs(train.position.x - player.position.x) < 1.2;

        const aboveTrain =
            Math.abs(train.position.z) < 6.2;

        if (
            sameLane &&
            aboveTrain &&
            previousY >= roofHeight &&
            player.position.y <= roofHeight
        ) {
            player.position.y = roofHeight;
            jumping = false;
            jumpVelocity = 0;
            ridingTrain = train;
            break;
        }
    }
}
        const landingHeight =
            selectedMode === "lava" ? LAVA_PLATFORM_TOP : 0;

        if (player.position.y <= landingHeight) {
            player.position.y = landingHeight;
            jumping = false;
            jumpVelocity = 0;

            if (
                selectedMode === "lava" &&
                !isPlayerAboveLavaPlatform()
            ) {
                endGame("Tu es tombé dans la lave !");
                return;
            }
        }
    }

    if (sliding) {
        slideTimer--;
        player.scale.y = 0.65;

        if (slideTimer <= 0) {
            sliding = false;
            player.scale.y = 1;
        }
    }

    if (selectedMode === "lava" && !jumping) {
        player.position.y = LAVA_PLATFORM_TOP;
    }

    animateRunner();

    moveEnvironment();
    moveLavaPlatforms();
    moveObstacles();
    // JACKO RESTE SUR LE TOIT DU TRAIN
if (ridingTrain) {
    const trainExists = obstacles.some(
        obstacle => obstacle.object === ridingTrain
    );

    if (trainExists) {
        ridingTrain.position.z -= speed * 1.8;
        player.position.y = 3.78 + ridingTrain.position.y;
        jumping = false;
    } else {
        ridingTrain = null;
        jumping = true;
        jumpVelocity = 0;
    }
}
    moveCoins();

    checkCollisions();

    if (!running) return;

    camera.position.x +=
        (player.position.x * 0.35 - camera.position.x) * 0.08;

    camera.position.y = 5 + player.position.y * 0.3;

    camera.lookAt(player.position.x * 0.25, 1.5, -20);

    updateHUD();
    renderer.render(scene, camera);
}

// ======================================================
// DÉMARRER
// ======================================================
// ======================================================
// TIMER NO COIN
// ======================================================

function startNoCoinTimer() {
    clearInterval(noCoinTimerInterval);

    const timer = document.getElementById("noCoinTimer");

    if (selectedMode !== "nocoin") {
        if (timer) timer.style.display = "none";
        return;
    }

    let display = timer;

    if (!display) {
        display = document.createElement("div");
        display.id = "noCoinTimer";
        document.body.appendChild(display);
    }

    display.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        color: #00ffff;
        font-size: 32px;
        font-weight: bold;
        font-family: Arial, sans-serif;
        text-shadow: 0 0 15px #00ffff;
        z-index: 99999;
        pointer-events: none;
    `;

    display.style.display = "block";

    noCoinStartTime = performance.now();
    noCoinElapsed = 0;

    display.textContent = "NO COIN : 0.00 s";

    noCoinTimerInterval = setInterval(() => {
        noCoinElapsed = (performance.now() - noCoinStartTime) / 1000;

        display.textContent =
            "NO COIN : " + noCoinElapsed.toFixed(2) + " s";

    }, 30);
}

function stopNoCoinTimer() {
    clearInterval(noCoinTimerInterval);
    noCoinTimerInterval = null;

    if (selectedMode === "nocoin") {
        noCoinElapsed = (performance.now() - noCoinStartTime) / 1000;

        const timer = document.getElementById("noCoinTimer");

        if (timer) {
            timer.textContent =
                "NO COIN : " + noCoinElapsed.toFixed(2) + " s";
        }
    }
}
function startGame() {

    // THE FLOOR IS LAVA : ÉCRAN SOON
    if (selectedMode === "lava") {

        let soonScreen = document.getElementById("soonScreen");

        if (!soonScreen) {
            soonScreen = document.createElement("div");
            soonScreen.id = "soonScreen";

            soonScreen.style.cssText = `
                position: fixed;
                inset: 0;
                background: #000;
                display: flex;
                justify-content: center;
                align-items: center;
                color: white;
                font-family: Arial, sans-serif;
                font-size: clamp(40px, 8vw, 80px);
                font-weight: bold;
                z-index: 999999;
            `;

            soonScreen.textContent = "SOON...";
            document.body.appendChild(soonScreen);
        }

        soonScreen.style.display = "flex";
        return;
    }

    score = 0;
    coins = 0;

    diamondMilestones = 0;

    lane = 1;
    targetX = 0;

    jumping = false;
    ridingTrain = null;
    sliding = false;

    jumpVelocity = 0;
    slideTimer = 0;

    frame = 0;
    spawnTimer = 0;

    applyDifficultySettings(true);

    player.position.set(0, 0, 0);
    player.scale.set(1, 1, 1);

    playerParts.body.position.y = 1.75;

    playerParts.arms.forEach(arm => {
        arm.rotation.set(0, 0, 0);
        arm.userData.elbow.rotation.set(0, 0, 0);
    });

    playerParts.legs.forEach(leg => {
        leg.rotation.set(0, 0, 0);
        leg.userData.knee.rotation.set(0, 0, 0);
    });

    playerParts.head.rotation.set(0, 0, 0);

    obstacles.forEach(obstacle => scene.remove(obstacle.object));
    coinObjects.forEach(coin => scene.remove(coin));

    obstacles = [];
    coinObjects = [];

    setLavaVisuals(false);
    resetLavaPlatforms();

    applyShopSkin();
    applyShopCape();

    camera.position.set(0, 5, 9);
    camera.lookAt(0, 1.5, -20);

    if (shopCapeObject) {
        shopCapeObject.rotation.set(0, 0, 0);
    }

    running = true;
    updateDailyChallengeProgress("runs", 1);
paused = false;
gameEnded = false;

startNoCoinTimer();

    const menu = document.getElementById("menu");
    const gameScreen = document.getElementById("gameScreen");
    const gameOver = document.getElementById("gameOver");

    if (menu) menu.classList.add("hidden");
    if (gameScreen) gameScreen.classList.remove("hidden");
    if (gameOver) gameOver.classList.add("hidden");

    const modeName = document.getElementById("modeName");

    if (modeName) {
        modeName.textContent =
            selectedMode === "nocoin" ? "NO COIN" : "SPACE GALAXY";
    }

    updateHUD();
    renderer.render(scene, camera);

    if (!animationStarted) {
        animationStarted = true;
        animate();
    }
}

window.startGame = startGame;

// ======================================================
// PAUSE
// ======================================================

function pauseGame() {
    if (!running || gameEnded) return;

    paused = !paused;

    document.querySelectorAll(".gameHeader button").forEach(button => {
        if (
            button.textContent.includes("PAUSE") ||
            button.textContent.includes("REPRENDRE")
        ) {
            button.textContent = paused
                ? "▶ REPRENDRE"
                : "Ⅱ PAUSE";
        }
    });
}

window.pauseGame = pauseGame;

// ======================================================
// RETOUR MENU
// ======================================================
function backToMenu() {
    running = false;
    paused = false;
    gameEnded = false;

    setLavaVisuals(false);

    lavaPlatforms.forEach(item => scene.remove(item.object));
    lavaPlatforms = [];

    const menu = document.getElementById("menu");
    const gameScreen = document.getElementById("gameScreen");
    const gameOver = document.getElementById("gameOver");

    if (menu) {
        menu.classList.remove("hidden");
        menu.style.pointerEvents = "auto";
    }

    if (gameScreen) {
        gameScreen.classList.add("hidden");
    }

    if (gameOver) {
        gameOver.classList.add("hidden");
    }

    const soonScreen = document.getElementById("soonScreen");
    if (soonScreen) {
        soonScreen.style.display = "none";
    }
}

window.backToMenu = backToMenu;

window.backToMenu = backToMenu;

// ======================================================
// REDIMENSIONNEMENT
// ======================================================

window.addEventListener("resize", () => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
});// ======================================================
// BOUTIQUE NEON RUN
// ======================================================

// ======================================================
// CATALOGUE
// ======================================================

const SHOP_CATALOG = {
    skins: [
    {
        id: "default",
        name: "JACKO",
        price: 0,
        currency: "coins",
        color: 0x7900b8,
        description: "Le runner original."
    },
    {
        id: "el_blackito",
        name: "EL BLACKITO",
        price: 10,
        currency: "diamonds",
        color: 0x050505,
        description: "Noir absolu avec des détails blancs."
    },
    {
        id: "electric",
        name: "ELECTRIC",
        price: 25,
        currency: "diamonds",
        color: 0x00eaff,
        description: "L'énergie électrique."
    },
    {
        id: "inferno",
        name: "INFERNO",
        price: 40,
        currency: "diamonds",
        color: 0xff3300,
        description: "Un runner venu des flammes."
    },
    {
        id: "royal",
        name: "ROYAL",
        price: 60,
        currency: "diamonds",
        color: 0xffd700,
        description: "Un style digne d'un roi."
    },
    {
        id: "galaxy",
        name: "GALAXY",
        price: 80,
        currency: "diamonds",
        color: 0x8a2be2,
        description: "La puissance de la galaxie."
    },
    {
        id: "diamond",
        name: "DIAMOND",
        price: 120,
        currency: "diamonds",
        color: 0xffffff,
        description: "Le skin ultime."
    }
],


    capes: [
        {
            id: "nr",
            name: "CAPE NR",
            price: 100,
            currency: "diamonds",
            color: 0x050505,
            description: "Cape noire avec le logo NR."
        }
    ]
};

// ======================================================
// SAUVEGARDE
// ======================================================

let shopWallet = Number(localStorage.getItem("neonWallet") || 0);
let shopDiamonds = Number(localStorage.getItem("neonDiamonds") || 0);

function readSavedArray(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || "null");
        return Array.isArray(value) ? value : fallback;
    } catch (error) {
        return fallback;
    }
}

let ownedSkins = readSavedArray(
    "neonOwnedSkins",
    ["default"]
);

let ownedCapes = readSavedArray(
    "neonOwnedCapes",
    []
);



// JACKO est le skin de départ.
if (!ownedSkins.includes("default")) {
    ownedSkins.push("default");
}






const validSkins = SHOP_CATALOG.skins.map(skin => skin.id);

if (!validSkins.includes(equippedSkin)) {
    equippedSkin = "default";
}

// La cape ne peut être équipée que si elle a été achetée.
if (!ownedCapes.includes("nr")) {
    equippedCape = "";
} else if (equippedCape !== "nr") {
    equippedCape = "";
}

let currentShopTab = "skins";

let shopElement = null;



// ======================================================
// SAUVEGARDE DES ACHATS
// ======================================================

function saveShop() {
    localStorage.setItem("neonWallet", shopWallet);
    localStorage.setItem("neonDiamonds", shopDiamonds);

    localStorage.setItem(
        "neonOwnedSkins",
        JSON.stringify(ownedSkins)
    );

    localStorage.setItem(
        "neonOwnedCapes",
        JSON.stringify(ownedCapes)
    );

    localStorage.setItem("neonEquippedSkin", equippedSkin);
    localStorage.setItem("neonEquippedCape", equippedCape);
}

function updateShopWallet() {
    shopWallet = Number(localStorage.getItem("neonWallet") || 0);
    shopDiamonds = Number(localStorage.getItem("neonDiamonds") || 0);

    const wallet = document.getElementById("shopWallet");
    const diamonds = document.getElementById("shopDiamonds");

    if (wallet) wallet.textContent = shopWallet;
    if (diamonds) diamonds.textContent = shopDiamonds;
}

window.updateShopWallet = updateShopWallet;
// ======================================================
// 👑 ESPACE DÉVELOPPEUR
// ======================================================

function createDeveloperTools() {
    if (!isDeveloper) return;

    if (document.getElementById("neonDeveloperBadge")) return;

    // STYLE
    const style = document.createElement("style");

    style.textContent = `
        #neonDeveloperBadge {
            position: fixed;
            top: 15px;
            right: 15px;
            z-index: 1000000;
            padding: 10px 16px;
            border: 1px solid #ffd700;
            border-radius: 12px;
            background: linear-gradient(135deg, #402500, #a66b00);
            color: #fff2a0;
            font-weight: 900;
            font-size: 13px;
            letter-spacing: 1px;
            cursor: pointer;
            box-shadow: 0 0 18px #ffcc00aa;
        }

        #neonDeveloperMenu {
            display: none;
            position: fixed;
            inset: 0;
            z-index: 1000001;
            align-items: center;
            justify-content: center;
            background: #000d;
            font-family: Arial, sans-serif;
        }

        #neonDeveloperMenu.open {
            display: flex;
        }

        .neon-dev-panel {
            width: min(420px, 90%);
            padding: 25px;
            text-align: center;
            border: 2px solid #ffd700;
            border-radius: 20px;
            background: linear-gradient(145deg, #241700, #090716);
            color: white;
            box-shadow: 0 0 30px #ffcc0066;
        }

        .neon-dev-panel h2 {
            color: #ffd700;
            text-shadow: 0 0 12px #ffcc00;
        }

        .neon-dev-button {
            display: block;
            width: 100%;
            margin-top: 13px;
            padding: 13px;
            border: 0;
            border-radius: 10px;
            background: linear-gradient(90deg, #9b6500, #e6ad00);
            color: white;
            font-weight: bold;
            cursor: pointer;
        }

        .neon-dev-close {
            background: #393342;
        }
    `;

    document.head.appendChild(style);

    // BADGE
    const badge = document.createElement("button");
    badge.id = "neonDeveloperBadge";
    badge.textContent = "👑 DÉVELOPPEUR";

    document.body.appendChild(badge);

    // MENU
    const menu = document.createElement("div");
    menu.id = "neonDeveloperMenu";

    menu.innerHTML = `
        <div class="neon-dev-panel">

            <h2>👑 ESPACE DÉVELOPPEUR</h2>

            <p>Bienvenue dans ton espace secret !</p>

            <button class="neon-dev-button" id="devUnlockAll">
                🔓 DÉBLOQUER TOUS LES SKINS ET CAPES
            </button>

            <button class="neon-dev-button neon-dev-close" id="devClose">
                ✕ FERMER
            </button>

        </div>
    `;

    document.body.appendChild(menu);

    // OUVRIR LE MENU
    function openDeveloperMenu() {
        menu.classList.add("open");
    }

    function closeDeveloperMenu() {
        menu.classList.remove("open");
    }

    badge.onclick = openDeveloperMenu;

    document.getElementById("devClose").onclick =
        closeDeveloperMenu;

    menu.addEventListener("click", event => {
        if (event.target === menu) {
            closeDeveloperMenu();
        }
    });

    // DÉBLOCAGE TOTAL
    document.getElementById("devUnlockAll").onclick = () => {

        ownedSkins = SHOP_CATALOG.skins.map(skin => skin.id);

        ownedCapes = SHOP_CATALOG.capes.map(cape => cape.id);

        saveShop();
        renderShop();

        alert("👑 Tous les skins et toutes les capes sont débloqués !");
    };

    // RACCOURCI SECRET : CTRL + MAJ + D
    window.addEventListener("keydown", event => {
        if (
            event.ctrlKey &&
            event.shiftKey &&
            event.key.toLowerCase() === "d"
        ) {
            event.preventDefault();
            openDeveloperMenu();
        }
    });
}
// ======================================================
// STYLE DE LA BOUTIQUE
// ======================================================

function createShopStyles() {
    if (document.getElementById("neonShopStyles")) return;

    const style = document.createElement("style");
    style.id = "neonShopStyles";

    style.textContent = `
        #neonShop {
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 18px;
            background:
                radial-gradient(ellipse at 50% 0%, #42117d99, transparent 60%),
                rgba(3, 2, 15, 0.94);
            backdrop-filter: blur(12px);
            font-family: Arial, sans-serif;
            color: white;
        }

        #neonShop.open {
            display: flex;
        }

        .neon-shop-panel {
            position: relative;
            width: min(850px, 100%);
            max-height: 90vh;
            overflow-y: auto;
            border: 2px solid #a52cff;
            border-radius: 22px;
            padding: 25px;
            background: linear-gradient(145deg, #17102e, #080716);
            box-shadow:
                0 0 25px #8d24ff66,
                inset 0 0 25px #5520a022;
        }

        .neon-shop-title {
            text-align: center;
            font-size: clamp(27px, 5vw, 43px);
            font-weight: 1000;
            letter-spacing: 5px;
            color: #d69aff;
            text-shadow: 0 0 18px #a52cff;
            margin: 5px 0 8px;
        }

        .neon-shop-subtitle {
            text-align: center;
            color: #aaa0ca;
            margin-bottom: 20px;
            font-size: 13px;
        }

        .neon-shop-wallet {
            display: flex;
            justify-content: center;
            align-items: center;
            flex-wrap: wrap;
            gap: 22px;
            margin-bottom: 20px;
            font-weight: bold;
            font-size: 18px;
        }

        .neon-shop-coins {
            color: #ffd84a;
            text-shadow: 0 0 10px #ffae00;
        }

        .neon-shop-diamonds {
            color: #53eaff;
            text-shadow: 0 0 10px #00cfff;
        }

        .neon-shop-tabs {
            display: flex;
            justify-content: center;
            gap: 12px;
            margin-bottom: 22px;
        }

        .neon-shop-tab {
            border: 1px solid #7134bd;
            background: #211438;
            color: white;
            padding: 12px 30px;
            border-radius: 12px;
            cursor: pointer;
            font-weight: bold;
            letter-spacing: 2px;
            transition: 0.2s;
        }

        .neon-shop-tab.active {
            background: #8d28d8;
            border-color: #e2aaff;
            box-shadow: 0 0 17px #a52cff;
        }

        .neon-shop-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
            gap: 15px;
        }

        .neon-shop-card {
            position: relative;
            overflow: hidden;
            padding: 17px;
            min-height: 210px;
            text-align: center;
            border: 1px solid #49336d;
            border-radius: 16px;
            background: linear-gradient(150deg, #261a40, #100d21);
            transition: 0.2s;
        }

        .neon-shop-card:hover {
            transform: translateY(-4px);
            border-color: #c36aff;
            box-shadow: 0 0 18px #9a36ff55;
        }

        .neon-shop-preview {
            height: 80px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 53px;
            margin-bottom: 8px;
            filter: drop-shadow(0 0 12px currentColor);
        }

        .neon-shop-card h3 {
            margin: 5px 0;
            font-size: 16px;
            letter-spacing: 1px;
        }

        .neon-shop-card p {
            color: #aaa0c4;
            font-size: 12px;
            min-height: 30px;
        }

        .neon-shop-price {
            color: #ffd84a;
            font-weight: bold;
            margin: 9px 0;
        }

        .neon-shop-action {
            width: 100%;
            padding: 10px;
            border: 0;
            border-radius: 9px;
            cursor: pointer;
            color: white;
            background: linear-gradient(90deg, #8126ce, #bd35f5);
            font-weight: bold;
            letter-spacing: 1px;
        }

        .neon-shop-action:hover {
            filter: brightness(1.25);
        }

        .neon-shop-action.equipped {
            background: #176b49;
            cursor: default;
        }

        .neon-shop-action.locked {
            background: #454052;
        }

        .neon-shop-close {
            display: block;
            margin: 23px auto 0;
            padding: 11px 35px;
            border: 1px solid #a52cff;
            border-radius: 10px;
            color: white;
            background: #28133e;
            cursor: pointer;
            font-weight: bold;
        }

        .neon-shop-close:hover {
            background: #6520a0;
        }

        .neon-shop-message {
            text-align: center;
            min-height: 22px;
            color: #ffdc68;
            margin-top: 12px;
            font-size: 13px;
        }

        #diamondRewardMessage {
            position: fixed;
            z-index: 99998;
            top: 18%;
            left: 50%;
            transform: translateX(-50%);
            padding: 13px 25px;
            border: 1px solid #48eaff;
            border-radius: 14px;
            background: #071b2fee;
            color: #68edff;
            font-size: 20px;
            font-weight: 900;
            text-shadow: 0 0 12px #00dfff;
            box-shadow: 0 0 25px #00cfff77;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s;
        }

        @media(max-width: 500px) {
            .neon-shop-panel {
                padding: 15px;
            }

            .neon-shop-tab {
                padding: 11px 20px;
            }
        }
    `;

    document.head.appendChild(style);
}

// ======================================================
// CRÉATION HTML BOUTIQUE
// ======================================================

function createShop() {
    if (document.getElementById("neonShop")) {
        shopElement = document.getElementById("neonShop");
        return;
    }

    createShopStyles();

    shopElement = document.createElement("div");
    shopElement.id = "neonShop";

    shopElement.innerHTML = `
        <div class="neon-shop-panel">

            <h1 class="neon-shop-title">NEON SHOP</h1>

            <div class="neon-shop-subtitle">
                PERSONNALISE TON PERSONNAGE ET DEVIENS UNE LÉGENDE
            </div>

            <div class="neon-shop-wallet">
                <span class="neon-shop-coins">
                    🪙 <span id="shopWallet">0</span> PIÈCES
                </span>

                <span class="neon-shop-diamonds">
                    💎 <span id="shopDiamonds">0</span> DIAMANTS
                </span>
            </div>

            <div class="neon-shop-tabs">
                <button class="neon-shop-tab active"
                    id="shopSkinsTab">
                    🧑 SKINS
                </button>

                <button class="neon-shop-tab"
                    id="shopCapesTab">
                    🦸 CAPES
                </button>
            </div>

            <div class="neon-shop-grid" id="shopItems"></div>

            <div class="neon-shop-message" id="shopMessage"></div>

            <button class="neon-shop-close" id="closeNeonShop">
                ✕ FERMER LA BOUTIQUE
            </button>

        </div>
    `;

    document.body.appendChild(shopElement);

    document.getElementById("shopSkinsTab").onclick = () => {
        changeShopTab("skins");
    };

    document.getElementById("shopCapesTab").onclick = () => {
        changeShopTab("capes");
    };

    document.getElementById("closeNeonShop").onclick = closeShop;

    shopElement.addEventListener("click", event => {
        if (event.target === shopElement) closeShop();
    });

    renderShop();
}

// ======================================================
// CHANGER D'ONGLET
// ======================================================

function changeShopTab(tab) {
    currentShopTab = tab;

    document.getElementById("shopSkinsTab").classList.toggle(
        "active",
        tab === "skins"
    );

    document.getElementById("shopCapesTab").classList.toggle(
        "active",
        tab === "capes"
    );

    renderShop();
}

// ======================================================
// AFFICHER LES ARTICLES
// ======================================================

function renderShop() {
    if (!shopElement) return;

    updateShopWallet();

    const container = document.getElementById("shopItems");
    const catalog = SHOP_CATALOG[currentShopTab];

    container.innerHTML = "";

    catalog.forEach(item => {
        const isSkin = currentShopTab === "skins";

        const owned = isSkin
            ? ownedSkins.includes(item.id)
            : ownedCapes.includes(item.id);

        const equipped = isSkin
            ? equippedSkin === item.id
            : equippedCape === item.id;

        let buttonText = "";
        let buttonClass = "";

        if (equipped) {
            buttonText = "✓ ÉQUIPÉ";
            buttonClass = "equipped";
        } else if (owned) {
            buttonText = "ÉQUIPER";
        } else {
            buttonText = "ACHETER";
            buttonClass = "locked";
        }

        const card = document.createElement("div");
        card.className = "neon-shop-card";

        const icon = isSkin ? "🧑" : "🦸";

        let priceText = "GRATUIT";

        if (item.price > 0) {
            priceText = item.currency === "diamonds"
                ? "💎 " + item.price + " DIAMANTS"
                : "🪙 " + item.price + " PIÈCES";
        }

        card.innerHTML = `
            <div class="neon-shop-preview"
                style="color:#${item.color.toString(16).padStart(6, "0")}">
                ${icon}
            </div>

            <h3>${item.name}</h3>

            <p>${item.description}</p>

            <div class="neon-shop-price">
                ${priceText}
            </div>

            <button class="neon-shop-action ${buttonClass}">
                ${buttonText}
            </button>
        `;

        card.querySelector("button").onclick = () => {
            handleShopItem(item, isSkin);
        };

        container.appendChild(card);
    });
}

// ======================================================
// ACHETER OU ÉQUIPER
// ======================================================

function handleShopItem(item, isSkin) {
    const ownedList = isSkin ? ownedSkins : ownedCapes;
    const equipped = isSkin ? equippedSkin : equippedCape;

    const message = document.getElementById("shopMessage");

    if (equipped === item.id) return;

    // Achat
    if (!ownedList.includes(item.id)) {
        if (item.currency === "diamonds") {
            if (shopDiamonds < item.price) {
                message.textContent =
                    "❌ Il te faut " + item.price + " diamants pour acheter cet article !";
                return;
            }

            shopDiamonds -= item.price;
        } else {
            if (shopWallet < item.price) {
                message.textContent =
                    "❌ Tu n'as pas assez de pièces !";
                return;
            }

            shopWallet -= item.price;
        }

        ownedList.push(item.id);

        message.textContent =
            "🎉 " + item.name + " acheté !";
    }

    // Équipement
    if (isSkin) {
        equippedSkin = item.id;
        applyShopSkin();
    } else {
        equippedCape = item.id;
        applyShopCape();
    }

    saveShop();
    renderShop();
}

window.handleShopItem = handleShopItem;

// ======================================================
// APPLIQUER LE SKIN
// ======================================================

function applyShopSkin() {
    if (!player) return;

    player.traverse(object => {
        if (!object.isMesh || !object.material) return;

        const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];

        materials.forEach(material => {
            if (!material.color) return;

            if (!originalPlayerMaterials.has(material)) {
                originalPlayerMaterials.set(material, {
                    color: material.color.clone(),
                    emissive: material.emissive
                        ? material.emissive.clone()
                        : null,
                    emissiveIntensity: material.emissiveIntensity
                });
            }
        });
    });

    if (equippedSkin === "default") {
        originalPlayerMaterials.forEach((original, material) => {
            material.color.copy(original.color);

            if (material.emissive && original.emissive) {
                material.emissive.copy(original.emissive);
            }

            material.emissiveIntensity = original.emissiveIntensity;
        });

        return;
    }
if (equippedSkin === "electric") {
    originalPlayerMaterials.forEach((original, material) => {
        material.color.set(0x00eaff);
        if (material.emissive) material.emissive.set(0x00eaff);
        material.emissiveIntensity = 0.6;
    });
}

if (equippedSkin === "inferno") {
    originalPlayerMaterials.forEach((original, material) => {
        material.color.set(0xff3300);
        if (material.emissive) material.emissive.set(0xff3300);
        material.emissiveIntensity = 0.6;
    });
}

if (equippedSkin === "royal") {
    originalPlayerMaterials.forEach((original, material) => {
        material.color.set(0xffd700);
        if (material.emissive) material.emissive.set(0xffd700);
        material.emissiveIntensity = 0.5;
    });
}

if (equippedSkin === "galaxy") {
    originalPlayerMaterials.forEach((original, material) => {
        material.color.set(0x8a2be2);
        if (material.emissive) material.emissive.set(0x8a2be2);
        material.emissiveIntensity = 0.7;
    });
}

if (equippedSkin === "diamond") {
    originalPlayerMaterials.forEach((original, material) => {
        material.color.set(0xffffff);
        if (material.emissive) material.emissive.set(0x66ccff);
        material.emissiveIntensity = 0.8;
    });
}
    if (equippedSkin === "el_blackito") {
        originalPlayerMaterials.forEach((original, material) => {
            const originalColor = original.color;

            const isDetail =
                originalColor.r > 0.25 ||
                originalColor.g > 0.35 ||
                originalColor.b > 0.25;

            if (isDetail) {
                material.color.set(0xffffff);

                if (material.emissive) {
                    material.emissive.set(0xffffff);
                }

                material.emissiveIntensity = 0.35;
            } else {
                material.color.set(0x050505);

                if (material.emissive) {
                    material.emissive.set(0x000000);
                }

                material.emissiveIntensity = 0;
            }
        });
    }
}

// ======================================================
// CRÉER LA CAPE NR
// ======================================================

function createCape() {
    if (!player) return;

    if (shopCapeObject) {
        player.remove(shopCapeObject);

        shopCapeObject.traverse(object => {
            if (object.geometry) object.geometry.dispose();

            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => {
                        if (material.map) material.map.dispose();
                        material.dispose();
                    });
                } else {
                    if (object.material.map) object.material.map.dispose();
                    object.material.dispose();
                }
            }
        });

        shopCapeObject = null;
    }

    // La cape apparaît uniquement si elle est achetée et équipée.
    if (
        equippedCape !== "nr" ||
        !ownedCapes.includes("nr")
    ) {
        return;
    }

    const cape = new THREE.Group();

    const geometry = new THREE.BufferGeometry();

    const vertices = new Float32Array([
        -0.38, 2.25, 0.34,
         0.38, 2.25, 0.34,
        -0.62, 0.25, 0.48,
         0.62, 0.25, 0.48
    ]);

    geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(vertices, 3)
    );

    geometry.setIndex([0, 2, 1, 1, 2, 3]);
    geometry.computeVertexNormals();

    const capeMaterial = new THREE.MeshStandardMaterial({
        color: 0x030303,
        roughness: 0.85,
        metalness: 0.1,
        side: THREE.DoubleSide
    });

    const cloth = new THREE.Mesh(geometry, capeMaterial);
    cape.add(cloth);
cloth.position.set(0, 0, 0);
cloth.userData.originalPosition = cloth.position.clone();
    // Logo NR blanc
    const logoCanvas = document.createElement("canvas");
    logoCanvas.width = 512;
    logoCanvas.height = 256;

    const ctx = logoCanvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 230px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("NR", 256, 128);

    const texture = new THREE.CanvasTexture(logoCanvas);

    const logoMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const logo = new THREE.Mesh(
        new THREE.PlaneGeometry(0.95, 0.48),
        logoMaterial
    );

    logo.position.set(0, 1.35, 0.52);
    cape.add(logo);

    player.add(cape);

    shopCapeObject = cape;

    // Permet à l'animation de faire bouger le tissu.
    shopCapeObject.userData.cloth = cloth;
}

// ======================================================
// ANIMATION CAPE
// ======================================================

function animateCape() {
    if (!shopCapeObject || !player) return;

    const time = performance.now() * 0.001;

    shopCapeObject.rotation.z = Math.sin(time * 4) * 0.045;
    shopCapeObject.rotation.x = Math.sin(time * 3) * 0.035;
}

// ======================================================
// APPLIQUER LA CAPE
// ======================================================

function applyShopCape() {
    createCape();
}

// ======================================================
// OUVRIR BOUTIQUE
// ======================================================

function openShop() {
    createShop();

    shopWallet = Number(localStorage.getItem("neonWallet") || 0);
    shopDiamonds = Number(localStorage.getItem("neonDiamonds") || 0);

    shopElement.classList.add("open");

    renderShop();
}

window.openShop = openShop;

// ======================================================
// FERMER BOUTIQUE
// ======================================================

function closeShop() {
    if (shopElement) {
        shopElement.classList.remove("open");
        shopElement.classList.add("hidden");
    }

    document.getElementById("menu").classList.remove("hidden");
}

window.closeShop = closeShop;

// ======================================================
// CONNECTER LE BOUTON BOUTIQUE EXISTANT
// ======================================================

function connectShopButton() {
    const buttons = document.querySelectorAll("button");

    buttons.forEach(button => {
        const text = button.textContent.trim().toLowerCase();

        const isShopButton =
            text.includes("boutique") ||
            text.includes("shop") ||
            button.id.toLowerCase().includes("shop") ||
            button.id.toLowerCase().includes("boutique");

        if (!isShopButton) return;

        if (button.dataset.neonShopConnected === "true") return;

        button.dataset.neonShopConnected = "true";

        button.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            openShop();
        });
    });
}

// ======================================================
// INITIALISATION COSMÉTIQUES
// ======================================================

function initShop() {
    createShopStyles();
    createShop();

    connectShopButton();

    applyShopSkin();
    applyShopCape();

    updateShopWallet();

    // Sauvegarde les équipements et achats.
    saveShop();
}
// ======================================================
// AUTHENTIFICATION DÉVELOPPEUR SUPABASE
// ======================================================

async function verifyDeveloper(user) {
    if (!user) return false;

    const { data, error } = await supabaseClient
        .from("developer_access")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (error) {
        console.error("Erreur de vérification :", error);
        return false;
    }

    return !!data;
}

async function loginDeveloper() {
    const email = prompt("Adresse e-mail développeur :");

    if (!email) return;

    const password = prompt("Mot de passe développeur :");

    if (!password) return;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        alert("❌ Connexion refusée : " + error.message);
        return;
    }

    const authorized = await verifyDeveloper(data.user);

    if (!authorized) {
        await supabaseClient.auth.signOut();
        alert("⛔ Tu n'es pas autorisé à accéder à cet espace !");
        return;
    }

    isDeveloper = true;

    createDeveloperTools();

    alert("👑 Bienvenue, développeur !");
}

async function restoreDeveloperSession() {
    const { data } = await supabaseClient.auth.getSession();

    if (!data.session) return;

    const authorized = await verifyDeveloper(data.session.user);

    if (authorized) {
        isDeveloper = true;
        createDeveloperTools();
    }
}

// Raccourci CTRL + MAJ + D pour se connecter
window.addEventListener("keydown", event => {
    if (
        event.ctrlKey &&
        event.shiftKey &&
        event.key.toLowerCase() === "d"
    ) {
        event.preventDefault();

        if (isDeveloper) {
            document.getElementById("neonDeveloperBadge")?.click();
        } else {
            loginDeveloper();
        }
    }
});
// ======================================================
// INITIALISATION
// ======================================================

async function initNeonRun() {
    applyDifficultySettings(true);
    updateHUD();

    initShop();

    await restoreDeveloperSession();

    renderer.render(scene, camera);

    console.log("NEON RUN - SPACE GALAXY chargé !");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNeonRun);
} else {
    initNeonRun();
}

// Si le bouton boutique est ajouté plus tard.
const shopButtonObserver = new MutationObserver(() => {
    connectShopButton();
});

shopButtonObserver.observe(document.body, {
    childList: true,
    subtree: true
});

// ======================================================
// FIN NEON RUN
// ======================================================
async function savePlayerPseudo() {

    const input = document.getElementById("playerPseudo");
    const error = document.getElementById("pseudoError");
    const button = document.querySelector("#profileSetup button");

    const pseudo = input.value.trim();

    error.textContent = "";

    if (pseudo.length < 3 || pseudo.length > 16) {
        error.textContent = "Le pseudo doit contenir entre 3 et 16 caractères.";
        return;
    }

    button.disabled = true;
    button.textContent = "VÉRIFICATION...";

    try {

        const { data: existing } = await supabaseClient
            .from("neon_players")
            .select("id")
            .ilike("pseudo", pseudo)
            .limit(1);

        if (existing && existing.length > 0) {
            error.textContent = "❌ Ce pseudo est déjà utilisé !";
            return;
        }

        const { error: insertError } = await supabaseClient
            .from("neon_players")
            .insert([{ pseudo: pseudo }]);

        if (insertError) {
            if (insertError.code === "23505") {
                error.textContent = "❌ Ce pseudo est déjà utilisé !";
            } else {
                error.textContent = "Erreur de création du profil.";
                console.error(insertError);
            }
            return;
        }

        localStorage.setItem("neonPlayerPseudo", pseudo);

        document.getElementById("profileSetup").style.display = "none";

        updatePlayerPseudo();

    } catch (err) {
        console.error(err);
        error.textContent = "Impossible de vérifier le pseudo.";
    } finally {
        button.disabled = false;
        button.textContent = "🚀 COMMENCER";
    }
}
// ======================================================
// CLASSEMENT MONDIAL
// ======================================================
function changeLeaderboardMode(mode) {

    selectedLeaderboardMode = mode;

    document.getElementById("classicLeaderboardBtn")
        .classList.toggle("active", mode === "classic");

    document.getElementById("noCoinLeaderboardBtn")
        .classList.toggle("active", mode === "nocoin");

    openLeaderboard();
}
async function openLeaderboard() {

    const screen = document.getElementById("leaderboardScreen");
    const players = document.getElementById("leaderboardPlayers");
    const podium = document.getElementById("leaderboardPodium");

    document.getElementById("menu").classList.add("hidden");
    document.getElementById("gameScreen").classList.add("hidden");

    screen.classList.remove("hidden");

    players.textContent = "Chargement...";

    const leaderboardMode = selectedLeaderboardMode || "classic";
const isNoCoin = leaderboardMode === "nocoin";
const leaderboardDifficulty = window.selectedLeaderboardDifficulty || "facile";

    // RÉCUPÉRER LES SCORES
    const { data, error } = await supabaseClient
        .from("neon_scores")
        .select("player_pseudo, score, game_mode, time_seconds, difficulty")
        .eq("game_mode", leaderboardMode)
.eq("difficulty", leaderboardDifficulty)
.limit(1000);

    if (error) {
        players.textContent = "Erreur de chargement.";
        console.error(error);
        return;
    }

    podium.replaceChildren();
    players.replaceChildren();

    if (!data || data.length === 0) {
        players.textContent = "Aucun joueur pour le moment.";
        return;
    }

    // GARDER UNIQUEMENT LE MEILLEUR RECORD DE CHAQUE JOUEUR
    const bestPlayers = new Map();

    data.forEach(joueur => {

        const key = joueur.player_pseudo.toLowerCase();
        const previous = bestPlayers.get(key);

        if (!previous) {
            bestPlayers.set(key, joueur);
            return;
        }

        if (isNoCoin) {

            if (Number(joueur.time_seconds) > Number(previous.time_seconds)) {
                bestPlayers.set(key, joueur);
            }

        } else {

            if (Number(joueur.score) > Number(previous.score)) {
                bestPlayers.set(key, joueur);
            }
        }
    });

    // TRIER LES MEILLEURS RECORDS
    const rankedPlayers = [...bestPlayers.values()].sort((a, b) => {

        if (isNoCoin) {
            return Number(b.time_seconds) - Number(a.time_seconds);
        }

        return Number(b.score) - Number(a.score);
    });

    // RÉCUPÉRER LES BADGES
    const pseudos = [...new Set(rankedPlayers.map(j => j.player_pseudo))];

    const { data: verifiedPlayers, error: verifiedError } =
        await supabaseClient
            .from("neon_players")
            .select("pseudo, verified")
            .in("pseudo", pseudos)
            .eq("verified", true);

    if (verifiedError) {
        console.error("Erreur badges :", verifiedError);
    }

    const verifiedPseudos = new Set(
        (verifiedPlayers || []).map(j => j.pseudo.toLowerCase())
    );

    function createPlayerName(pseudo) {

        const name = document.createElement("span");
        name.textContent = pseudo;

        if (verifiedPseudos.has(pseudo.toLowerCase())) {

            const badge = document.createElement("span");

            badge.textContent = "✓";
            badge.title = "Joueur certifié";

            badge.style.cssText = `
                display:inline-flex;
                align-items:center;
                justify-content:center;
                width:17px;
                height:17px;
                margin-left:6px;
                border-radius:50%;
                background:#1DA1F2;
                color:white;
                font-size:12px;
                font-weight:bold;
            `;

            name.appendChild(badge);
        }

        return name;
    }

    // PODIUM
    [1, 0, 2].forEach(index => {

        const joueur = rankedPlayers[index];

        const card = document.createElement("div");
        card.className = "podium-player";

        if (joueur) {

            const rank = document.createElement("strong");
            rank.textContent = ["🥇", "🥈", "🥉"][index];

            const name = createPlayerName(joueur.player_pseudo);

            const points = document.createElement("div");

            points.textContent = isNoCoin
                ? Number(joueur.time_seconds).toFixed(2) + " s"
                : joueur.score + " points";

            card.append(rank, name, points);

        } else {
            card.textContent = "—";
        }

        podium.appendChild(card);
    });

    // LISTE DU CLASSEMENT
    rankedPlayers.forEach((joueur, index) => {

        const row = document.createElement("div");
        row.className = "leaderboard-row";

        const rank = document.createElement("span");
        rank.textContent = "#" + (index + 1);

        const name = createPlayerName(joueur.player_pseudo);

        const result = document.createElement("span");

        result.textContent = isNoCoin
            ? Number(joueur.time_seconds).toFixed(2) + " s"
            : joueur.score;

        row.append(rank, name, result);

        players.appendChild(row);
    });
}
// ==========================================
// SYSTÈME DE COMPTES NEON RUN
// ==========================================

function showAuthForm(type) {
    document.getElementById("registerForm").style.display =
        type === "register" ? "block" : "none";

    document.getElementById("loginForm").style.display =
        type === "login" ? "block" : "none";

    document.getElementById("pseudoError").textContent = "";
}


// INSCRIPTION
async function registerPlayer() {

    const pseudo = document.getElementById("registerPseudo").value.trim();
    const password = document.getElementById("registerPassword").value;
    const confirmation = document.getElementById("confirmPassword").value;
    const error = document.getElementById("pseudoError");

    error.textContent = "";

    if (pseudo.length < 3 || pseudo.length > 16) {
        error.textContent = "Le pseudo doit contenir entre 3 et 16 caractères.";
        return;
    }

    if (password.length < 10) {
        error.textContent = "Le mot de passe doit contenir au moins 10 caractères.";
        return;
    }

    if (password !== confirmation) {
        error.textContent = "Les mots de passe ne correspondent pas.";
        return;
    }

    if (!supabaseClient) {
        error.textContent = "Connexion au serveur impossible.";
        return;
    }

    try {

        const { data: existing } = await supabaseClient
            .from("neon_players")
            .select("id")
            .ilike("pseudo", pseudo)
            .limit(1);

        if (existing && existing.length > 0) {
            error.textContent = "Ce pseudo est déjà utilisé !";
            return;
        }

        const email = pseudo.toLowerCase() + "@accounts.neonrun.invalid";

        const { data, error: authError } =
            await supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: { pseudo: pseudo }
                }
            });

        if (authError) {
            error.textContent = authError.message;
            return;
        }

        if (!data.user) {
            error.textContent = "Impossible de créer le compte.";
            return;
        }

        const { error: insertError } = await supabaseClient
            .from("neon_players")
            .insert([{
                pseudo: pseudo,
                auth_user_id: data.user.id
            }]);

        if (insertError) {
            console.error(insertError);
            error.textContent = "Compte créé, mais erreur lors de la création du profil.";
            return;
        }

        localStorage.setItem("neonPlayerPseudo", pseudo);

        document.getElementById("profileSetup").style.display = "none";
        document.getElementById("menu").classList.remove("hidden");

        updatePlayerPseudo();

    } catch (err) {
        console.error(err);
        error.textContent = "Une erreur est survenue.";
    }
}


// CONNEXION
async function loginPlayer() {

    const pseudo = document.getElementById("loginPseudo").value.trim();
    const password = document.getElementById("loginPassword").value;
    const error = document.getElementById("pseudoError");

    error.textContent = "";

    if (!pseudo || !password) {
        error.textContent = "Remplis tous les champs.";
        return;
    }

    try {

        const email = pseudo.toLowerCase() + "@accounts.neonrun.invalid";

        const { data, error: loginError } =
            await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

        if (loginError) {
            error.textContent = "Pseudo ou mot de passe incorrect.";
            return;
        }

        const { data: player, error: playerError } =
            await supabaseClient
                .from("neon_players")
                .select("id, pseudo")
                .eq("auth_user_id", data.user.id)
                .single();

        if (playerError || !player) {
            error.textContent = "Profil joueur introuvable.";
            return;
        }

        localStorage.setItem("neonPlayerPseudo", player.pseudo);

        document.getElementById("profileSetup").style.display = "none";
        document.getElementById("menu").classList.remove("hidden");

        updatePlayerPseudo();

    } catch (err) {
        console.error(err);
        error.textContent = "Erreur de connexion.";
    }
}
async function logoutPlayer() {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        alert("Erreur lors de la déconnexion : " + error.message);
        return;
    }

    localStorage.removeItem("neonPlayerPseudo");

    document.getElementById("profileSetup").style.display = "block";
    document.getElementById("menu").style.display = "none";

    updatePlayerPseudo();

    console.log("Déconnexion réussie !");
}
// RETOUR AU MENU DEPUIS LE CLASSEMENT
function closeLeaderboard() {
    document.getElementById("leaderboardScreen").classList.add("hidden");
    document.getElementById("menu").classList.remove("hidden");
}

window.closeLeaderboard = closeLeaderboard;
async function openAccount() {
    document.getElementById("menu").classList.add("hidden");
    document.getElementById("accountScreen").classList.remove("hidden");

    const pseudo = localStorage.getItem("neonPlayerPseudo") || "RUNNER";

    document.getElementById("accountPseudo").textContent = pseudo;
    document.getElementById("accountRuns").textContent =
        localStorage.getItem("neonRunsPlayed") || 0;

    document.getElementById("accountClassic").textContent = "Chargement...";
    document.getElementById("accountNoCoin").textContent = "Chargement...";

    if (!supabaseClient) {
        document.getElementById("accountClassic").textContent = "—";
        document.getElementById("accountNoCoin").textContent = "—";
        return;
    }

    const { data, error } = await supabaseClient
        .from("neon_scores")
        .select("score, time_seconds, game_mode")
        .eq("player_pseudo", pseudo);

    if (error) {
        console.error("Erreur profil :", error);
        document.getElementById("accountClassic").textContent = "Erreur";
        document.getElementById("accountNoCoin").textContent = "Erreur";
        return;
    }

    const scores = data || [];

    const classic = scores.filter(s => s.game_mode === "classic");
    const noCoin = scores.filter(s => s.game_mode === "nocoin");

    const bestClassic = classic.length
        ? Math.max(...classic.map(s => Number(s.score) || 0))
        : 0;

    const bestNoCoin = noCoin.length
        ? Math.max(...noCoin.map(s => Number(s.time_seconds) || 0))
        : 0;

    document.getElementById("accountClassic").textContent = bestClassic;
    document.getElementById("accountNoCoin").textContent =
        bestNoCoin.toFixed(2) + " s";
}
window.selectedLeaderboardDifficulty = "facile";

function changeLeaderboardDifficulty(level, button) {

    window.selectedLeaderboardDifficulty = level;

    document.querySelectorAll(".difficulty-leaderboard-tabs button")
        .forEach(b => b.classList.remove("active"));

    button.classList.add("active");

    openLeaderboard();
}

window.changeLeaderboardDifficulty = changeLeaderboardDifficulty;
// ===============================
// DÉFIS QUOTIDIENS
// ===============================

const dailyChallengePool = [
    { id: "score1000", name: "🏃 Atteindre 1000 points", reward: 30, target: 1000 },
    { id: "score5000", name: "🏃 Atteindre 5000 points", reward: 100, target: 5000 },
    { id: "score10000", name: "🏆 Atteindre 10000 points", reward: 200, target: 10000 },
    { id: "coins20", name: "🪙 Récolter 20 pièces", reward: 30, target: 20 },
    { id: "coins50", name: "🪙 Récolter 50 pièces", reward: 75, target: 75 },
    { id: "coins100", name: "💰 Récolter 100 pièces", reward: 150, target: 100 },
    { id: "runs3", name: "🎮 Jouer 3 parties", reward: 40, target: 3 },
    { id: "runs5", name: "🎮 Jouer 5 parties", reward: 80, target: 5 },
    { id: "runs10", name: "🔥 Jouer 10 parties", reward: 150, target: 10 }
];

function getDailyChallenges() {
    const today = new Date().toLocaleDateString("fr-CA");
    const saved = JSON.parse(localStorage.getItem("dailyChallengesData") || "{}");

    if (saved.date === today) return saved.challenges;

    const shuffled = [...dailyChallengePool].sort(() => Math.random() - 0.5);
    const challenges = shuffled.slice(0, 3);

    localStorage.setItem("dailyChallengesData", JSON.stringify({
        date: today,
        challenges: challenges
    }));

    return challenges;
}
function openDailyChallenges() {
    document.getElementById("menu").classList.add("hidden");
    document.getElementById("dailyChallengesScreen").classList.remove("hidden");

    renderDailyChallenges();
}

function renderDailyChallenges() {
    const challenges = getDailyChallenges();
    const data = JSON.parse(localStorage.getItem("dailyChallengesData") || "{}");

    if (!data.progress) data.progress = {};
    if (!data.claimed) data.claimed = [];

    localStorage.setItem("dailyChallengesData", JSON.stringify(data));

    document.getElementById("dailyChallengesList").innerHTML =
        challenges.map(challenge => {
            const progress = Math.min(
                data.progress[challenge.id] || 0,
                challenge.target
            );

            const claimed = data.claimed.includes(challenge.id);
            const completed = progress >= challenge.target;

            return `
                <div class="account-card">
                    <h3>${challenge.name}</h3>
                    <p>💎 ${challenge.reward} diamants</p>
                    <p>Progression : ${progress} / ${challenge.target}</p>

                    <div style="background:#222;border-radius:10px;height:10px;margin:12px 0;">
                        <div style="background:#00eaff;width:${progress / challenge.target * 100}%;height:10px;border-radius:10px;"></div>
                    </div>

                    ${
                        claimed
                        ? '<p>✅ RÉCOMPENSE RÉCUPÉRÉE</p>'
                        : completed
                            ? `<button onclick="claimDailyChallenge('${challenge.id}')">💎 RÉCUPÉRER</button>`
                            : '<p>🔒 EN COURS</p>'
                    }
                </div>
            `;
        }).join("");
}

function claimDailyChallenge(id) {
    const data = JSON.parse(localStorage.getItem("dailyChallengesData") || "{}");
    const challenge = getDailyChallenges().find(c => c.id === id);

    if (!challenge || !data.progress || !data.claimed) return;
    if (data.claimed.includes(id)) return;
    if ((data.progress[id] || 0) < challenge.target) return;

    data.claimed.push(id);

    shopDiamonds += challenge.reward;
    localStorage.setItem("neonDiamonds", shopDiamonds);
    localStorage.setItem("dailyChallengesData", JSON.stringify(data));

    updateShopWallet();
    renderDailyChallenges();
}

window.claimDailyChallenge = claimDailyChallenge;
function updateDailyChallengeProgress(type, amount) {
    const data = JSON.parse(
        localStorage.getItem("dailyChallengesData") || "{}"
    );

    if (!data.progress) data.progress = {};
    if (!data.claimed) data.claimed = [];

    const challenges = getDailyChallenges();

    challenges.forEach(challenge => {
        const challengeType = challenge.id.replace(/[0-9]/g, "");

        if (challengeType !== type) return;
        if (data.claimed.includes(challenge.id)) return;

        data.progress[challenge.id] =
            (data.progress[challenge.id] || 0) + amount;
    });

    localStorage.setItem("dailyChallengesData", JSON.stringify(data));
}
function closeDailyChallenges() {
    document.getElementById("dailyChallengesScreen").classList.add("hidden");
    document.getElementById("menu").classList.remove("hidden");
}

function closeDailyChallenges() {
    document.getElementById("dailyChallengesScreen").classList.add("hidden");
    document.getElementById("menu").classList.remove("hidden");
}

window.closeDailyChallenges = closeDailyChallenges;
