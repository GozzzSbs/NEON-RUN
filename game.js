// ======================================================
// NEON RUN 3D - SPACE GALAXY
// Galaxy, aliens, flying UFOs, trains coming towards player
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

let running = false;
let paused = false;
let gameEnded = false;
let animationStarted = false;

let score = 0;
let coins = 0;
let best = Number(localStorage.getItem("neonBest") || 0);

let lane = 1;
let targetX = 0;

let jumping = false;
let sliding = false;
let jumpVelocity = 0;
let slideTimer = 0;

let speed = 0.65;
let baseSpeed = 0.65;
let speedMultiplier = 1.5;
let maxSpeedMultiplier = 2;

const SPEED_INCREASE = 0.00015;

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
    facile: { base: 0.45, start: 1, max: 1.5 },
    normal: { base: 0.65, start: 1.5, max: 2 },
    difficile: { base: 0.85, start: 2, max: 2.5 },
    extreme: { base: 1.1, start: 2.5, max: 3 }
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

// Fond spatial étoilé
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

// Grandes nébuleuses décoratives
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

// Voie centrale
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

    // Corps du vaisseau
    const body = new THREE.Mesh(
        new THREE.SphereGeometry(1, 24, 16),
        bodyMaterial
    );

    body.scale.set(1.8, 0.35, 1);
    ship.add(body);

    // Cockpit
    const cockpit = new THREE.Mesh(
        new THREE.SphereGeometry(0.65, 20, 16),
        glassMaterial
    );

    cockpit.position.y = 0.35;
    cockpit.scale.set(0.9, 0.75, 0.9);
    ship.add(cockpit);

    // Lumières latérales
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

    // Réacteur
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

        limb(0.28, 0.48, 0.3, side === -1 ? purple : lime,
            0, -0.24, 0, arm);

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

    const bodyMaterial = mat(0x183e80, 0x102b66, 0.7);
    const windowMaterial = mat(0x20dfff, 0x00aaff, 1.7);
    const neonMaterial = mat(0x9b31ff, 0x7800ff, 2);

    // Corps principal du train
    box(2.55, 3.4, 13, bodyMaterial, 0, 2, 0, train);

    // Face avant
    box(2.4, 1.1, 0.2, neonMaterial, 0, 3, 6.55, train);
    box(1.7, 0.85, 0.12, windowMaterial, 0, 2.8, 6.68, train);

    // Fenêtres latérales
    for (let zPos = -5; zPos <= 4; zPos += 3) {
        box(0.08, 1, 1.5, windowMaterial, -1.3, 2.8, zPos, train);
        box(0.08, 1, 1.5, windowMaterial, 1.3, 2.8, zPos, train);
    }

    // Bandes lumineuses
    for (const side of [-1, 1]) {
        box(0.12, 0.12, 12, neonMaterial, side * 1.3, 1.2, 0, train);

        const headlight = new THREE.PointLight(0x22ddff, 3, 18);
        headlight.position.set(side * 0.8, 0.8, 7);
        train.add(headlight);

        box(0.4, 0.4, 0.15, 0x9fffff,
            side * 0.8, 0.8, 6.7, train);
    }

    // Dessous du train
    box(2.3, 0.4, 11, 0x090914, 0, 0.2, 0, train);

    // Roues
    for (const zPos of [-4, 4]) {
        for (const side of [-1, 1]) {
            const wheel = new THREE.Mesh(
                new THREE.CylinderGeometry(0.38, 0.38, 0.25, 12),
                mat(0x222233)
            );

            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(side * 1.35, 0.45, zPos);
            train.add(wheel);
        }
    }

    train.position.set(lanePositions[laneIndex], 0, z);
    scene.add(train);

    const data = {
        object: train,
        type: "train",
        lane: laneIndex
    };

    obstacles.push(data);
    movingTrains.push(data);
}

// ======================================================
// BARRIÈRES FUTURISTES
// ======================================================

function createBarrier(laneIndex, z) {
    const barrier = new THREE.Group();

    const red = mat(0xff263f, 0x990018, 0.8);
    const white = mat(0xffffff, 0x555555, 0.3);

    box(2.1, 0.8, 0.3, red, 0, 1, 0, barrier);

    for (const side of [-1, 1]) {
        box(0.15, 1.3, 0.2, white, side * 0.8, 0.65, 0, barrier);
    }

    for (let i = -2; i <= 2; i++) {
        box(0.2, 0.85, 0.32, white, i * 0.4, 1, 0, barrier);
    }

    // Barre lumineuse
    const glow = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, 0.08, 0.35),
        new THREE.MeshBasicMaterial({ color: 0xff2020 })
    );

    glow.position.y = 1.5;
    barrier.add(glow);

    barrier.position.set(lanePositions[laneIndex], 0, z);
    scene.add(barrier);

    obstacles.push({
        object: barrier,
        type: "barrier",
        lane: laneIndex
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

    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.4, 0.12, 12, 24),
        goldMaterial
    );

    coin.add(ring);

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

    // Les trains arrivent régulièrement !
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
    if (!running || paused || jumping) return;

    sliding = false;
    slideTimer = 0;
    player.scale.y = 1;

    jumping = true;
    jumpVelocity = selectedMode === "lava" ? 0.32 : 0.22;
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
});

// ======================================================
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

        // Collision avec le train
        if (
            obstacle.type === "train" &&
            distance > -8 &&
            distance < 2
        ) {
            endGame("Un train spatial t'a percuté !");
            return;
        }

        // Collision avec une barrière
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
            score += 100;
        }
    }
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

    // Les vaisseaux aliens traversent le ciel
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
        // Les trains et barrières foncent vers le joueur
        const extraSpeed = obstacle.type === "train" ? 1.15 : 1;

        obstacle.object.position.z += speed * extraSpeed;
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
// BOUCLE PRINCIPALE
// ======================================================

function animate() {
    requestAnimationFrame(animate);

    if (!running || paused || gameEnded) return;

    frame++;
    score++;

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

    // Déplacement du joueur
    player.position.x += (targetX - player.position.x) * 0.18;

    // Saut
    if (jumping) {
        player.position.y += jumpVelocity;

        jumpVelocity -= selectedMode === "lava" ? 0.035 : 0.012;

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

    // Glissade
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

function startGame() {
    score = 0;
    coins = 0;

    lane = 1;
    targetX = 0;

    jumping = false;
    sliding = false;

    jumpVelocity = 0;
    slideTimer = 0;

    frame = 0;
    spawnTimer = 0;

    applyDifficultySettings(true);

    player.position.set(
        0,
        selectedMode === "lava" ? LAVA_PLATFORM_TOP : 0,
        0
    );

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

    setLavaVisuals(selectedMode === "lava");
    resetLavaPlatforms();

    camera.position.set(0, 5, 9);
    camera.lookAt(0, 1.5, -20);

    running = true;
    paused = false;
    gameEnded = false;

    const menu = document.getElementById("menu");
    const gameScreen = document.getElementById("gameScreen");
    const gameOver = document.getElementById("gameOver");

    if (menu) menu.classList.add("hidden");
    if (gameScreen) gameScreen.classList.remove("hidden");
    if (gameOver) gameOver.classList.add("hidden");

    const modeName = document.getElementById("modeName");

    if (modeName) {
        if (selectedMode === "nocoin") {
            modeName.textContent = "NO COIN";
        } else if (selectedMode === "lava") {
            modeName.textContent = "THE FLOOR IS LAVA";
        } else {
            modeName.textContent = "SPACE GALAXY";
        }
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

    setLavaVisuals(false);

    lavaPlatforms.forEach(item => scene.remove(item.object));
    lavaPlatforms = [];

    const menu = document.getElementById("menu");
    const gameScreen = document.getElementById("gameScreen");
    const gameOver = document.getElementById("gameOver");

    if (menu) menu.classList.remove("hidden");
    if (gameScreen) gameScreen.classList.add("hidden");
    if (gameOver) gameOver.classList.add("hidden");
}

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
});

// ======================================================
// INITIALISATION
// ======================================================

applyDifficultySettings(true);
updateHUD();

renderer.render(scene, camera);

console.log("NEON RUN - SPACE GALAXY chargé !");
