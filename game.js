// ======================================================
// NEON RUN 3D - CHRISTMAS EDITION 🎄
// ======================================================

const canvas = document.getElementById("game");

if (!window.THREE) {
    alert("Three.js n'est pas chargé !");
    throw new Error("Three.js missing");
}

if (!canvas) {
    throw new Error("Canvas #game introuvable");
}

// ======================================================
// SCÈNE
// ======================================================

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x07152f);
scene.fog = new THREE.Fog(0x14284b, 40, 160);

const camera = new THREE.PerspectiveCamera(
    65,
    1,
    0.1,
    300
);

camera.position.set(0, 5, 9);
camera.lookAt(0, 1.5, -20);

const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
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

scene.add(
    new THREE.HemisphereLight(
        0xb8d8ff,
        0x29202b,
        2
    )
);

const sun = new THREE.DirectionalLight(0xb9d9ff, 1.8);

sun.position.set(-10, 20, 10);
sun.castShadow = true;

scene.add(sun);

// Lumières décoratives de Noël

const christmasLight1 = new THREE.PointLight(
    0x268aff,
    2,
    35
);

christmasLight1.position.set(-8, 8, -15);
scene.add(christmasLight1);

const christmasLight2 = new THREE.PointLight(
    0xff3344,
    2,
    35
);

christmasLight2.position.set(8, 7, -35);
scene.add(christmasLight2);

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
let difficulty = "normal";
let selectedMode = "classic";

let frame = 0;
let spawnTimer = 0;

const lanePositions = [-3, 0, 3];

let obstacles = [];
let coinObjects = [];

let movingBuildings = [];
let movingTrees = [];
let movingSleepers = [];
let movingStones = [];

let snowParticles;
let snowPositions;
let snowVelocities = [];

const SNOW_COUNT = 1200;

let player;
let playerParts = {
    arms: [],
    legs: []
};

// ======================================================
// MATÉRIAUX
// ======================================================

function material(color, roughness = 0.8, metalness = 0) {

    return new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness
    });

}

const roadMaterial = material(0x45413d);
const railMaterial = material(0xaaaaaa, 0.3, 0.8);
const woodMaterial = material(0x59402d);

const skinMaterial = material(0xd99b79);
const shirtMaterial = material(0x13b9e5);
const pantsMaterial = material(0x26334f);
const shoeMaterial = material(0xffffff);

// ======================================================
// OUTIL POUR CRÉER DES BLOCS 3D
// ======================================================

function box(w, h, d, color, x, y, z, parent = scene) {

    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        typeof color === "number" ? material(color) : color
    );

    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    parent.add(mesh);

    return mesh;
}

// ======================================================
// SOL ET RAILS
// ======================================================

box(
    12,
    0.3,
    200,
    roadMaterial,
    0,
    -0.25,
    -75
);

function createTrack() {

    for (let i = 0; i < 3; i++) {

        const x = lanePositions[i];

        // Rails métalliques

        box(0.12, 0.16, 200, railMaterial, x - 0.85, 0, -75);
        box(0.12, 0.16, 200, railMaterial, x + 0.85, 0, -75);

        // Traverses

        for (let j = 0; j < 50; j++) {

            const sleeper = box(
                2.05,
                0.18,
                0.45,
                woodMaterial,
                x,
                -0.05,
                15 - j * 4
            );

            movingSleepers.push(sleeper);
        }
    }

    // Gravier

    for (let i = 0; i < 350; i++) {

        const stone = new THREE.Mesh(
            new THREE.BoxGeometry(
                0.1 + Math.random() * 0.2,
                0.08,
                0.1 + Math.random() * 0.2
            ),
            material(0x77716a)
        );

        stone.position.set(
            (Math.random() - 0.5) * 11,
            -0.02,
            Math.random() * -180
        );

        scene.add(stone);
        movingStones.push(stone);
    }
}

createTrack();

// ======================================================
// IMMEUBLES DÉTAILLÉS
// ======================================================

function createBuilding(x, z) {

    const building = new THREE.Group();

    const height = 15 + Math.random() * 18;
    const width = 5 + Math.random() * 3;

    const facadeColors = [
        0x292d48,
        0x34334e,
        0x303c54,
        0x393348
    ];

    const facadeColor =
        facadeColors[Math.floor(Math.random() * facadeColors.length)];

    // Façade

    box(
        width,
        height,
        6,
        facadeColor,
        0,
        height / 2,
        0,
        building
    );

    // Toit

    box(
        width + 0.5,
        0.45,
        6.5,
        0x171d32,
        0,
        height + 0.2,
        0,
        building
    );

    // Corniche

    box(
        width + 0.25,
        0.25,
        0.25,
        0x65708c,
        0,
        height - 0.5,
        3.1,
        building
    );

    // Fenêtres

    for (let y = 1.5; y < height - 2; y += 2.5) {

        for (let w = -1; w <= 1; w++) {

            if (Math.random() > 0.12) {

                const wx = w * 1.35;

                box(
                    0.95,
                    1.55,
                    0.16,
                    0x151c30,
                    wx,
                    y,
                    3.08,
                    building
                );

                const colors = [
                    0xffd477,
                    0xffe7a6,
                    0x8edcff,
                    0xffbd70
                ];

                const windowColor =
                    colors[Math.floor(Math.random() * colors.length)];

                const windowMesh = box(
                    0.7,
                    1.25,
                    0.08,
                    windowColor,
                    wx,
                    y,
                    3.18,
                    building
                );

                windowMesh.material.emissive =
                    new THREE.Color(windowColor);

                windowMesh.material.emissiveIntensity = 0.8;

                // Séparations des vitres

                box(
                    0.06,
                    1.3,
                    0.04,
                    0x242b40,
                    wx,
                    y,
                    3.24,
                    building
                );

                box(
                    0.8,
                    0.06,
                    0.04,
                    0x242b40,
                    wx,
                    y,
                    3.24,
                    building
                );
            }
        }
    }

    // Balcons

    if (Math.random() > 0.4) {

        for (let y = 4; y < height - 3; y += 7) {

            box(
                width * 0.8,
                0.15,
                0.8,
                0x65708c,
                0,
                y,
                3.5,
                building
            );
        }
    }

    // Guirlandes lumineuses

    if (Math.random() > 0.5) {

        const lightColors = [
            0xff3333,
            0x33ff99,
            0x44bbff,
            0xffdd33
        ];

        for (let i = -2; i <= 2; i++) {

            const color =
                lightColors[Math.floor(Math.random() * lightColors.length)];

            const light = new THREE.Mesh(
                new THREE.SphereGeometry(0.09, 8, 8),
                new THREE.MeshBasicMaterial({ color })
            );

            light.position.set(i * 0.8, height - 1, 3.35);
            building.add(light);
        }
    }

    building.position.set(x, 0, z);

    scene.add(building);
    movingBuildings.push(building);
}

// Création des immeubles

for (let i = 0; i < 22; i++) {

    createBuilding(-9, -i * 9);
    createBuilding(9, -i * 9);
}

// ======================================================
// SAPINS DE NOËL 🎄
// ======================================================

function createTree(x, z) {

    const tree = new THREE.Group();

    // Tronc

    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.4, 1.8, 12),
        material(0x65402b)
    );

    trunk.position.y = 0.9;
    tree.add(trunk);

    // Branches

    for (let i = 0; i < 4; i++) {

        const leaves = new THREE.Mesh(
            new THREE.ConeGeometry(
                2.1 - i * 0.32,
                3.2,
                12
            ),
            material(i % 2 === 0 ? 0x08763b : 0x0a9147)
        );

        leaves.position.y = 2.2 + i * 1.35;
        leaves.castShadow = true;

        tree.add(leaves);
    }

    // Guirlande lumineuse

    for (let i = 0; i < 35; i++) {

        const angle = i * 0.65;
        const y = 1.6 + i * 0.19;
        const radius = 1.8 - i * 0.035;

        const bulb = new THREE.Mesh(
            new THREE.SphereGeometry(0.09, 8, 8),
            new THREE.MeshBasicMaterial({
                color: [
                    0xff3333,
                    0xffdd33,
                    0x33ddff,
                    0xffffff
                ][i % 4]
            })
        );

        bulb.position.set(
            Math.cos(angle) * radius,
            y,
            Math.sin(angle) * radius
        );

        tree.add(bulb);
    }

    // Boules de Noël

    const ornamentColors = [
        0xff3333,
        0xffd700,
        0x3399ff,
        0xff66bb
    ];

    for (let i = 0; i < 18; i++) {

        const angle = Math.random() * Math.PI * 2;
        const y = 1.8 + Math.random() * 4.5;
        const radius = 1.5 - (y - 1.8) * 0.2;

        const ornament = new THREE.Mesh(
            new THREE.SphereGeometry(0.16, 12, 12),
            new THREE.MeshStandardMaterial({
                color: ornamentColors[i % 4],
                metalness: 0.65,
                roughness: 0.2,
                emissive: ornamentColors[i % 4],
                emissiveIntensity: 0.25
            })
        );

        ornament.position.set(
            Math.cos(angle) * radius,
            y,
            Math.sin(angle) * radius
        );

        tree.add(ornament);
    }

    // Étoile au sommet

    const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.45),
        new THREE.MeshBasicMaterial({
            color: 0xffdf55
        })
    );

    star.position.y = 7.2;
    tree.add(star);

    tree.position.set(x, 0, z);
    tree.scale.setScalar(0.85 + Math.random() * 0.3);

    scene.add(tree);
    movingTrees.push(tree);
}

// Création des sapins

for (let i = 0; i < 18; i++) {

    createTree(-6, -i * 10);
    createTree(6, -i * 10);
}

// ======================================================
// NEIGE 3D ❄️
// ======================================================

function createSnow() {

    snowPositions = new Float32Array(SNOW_COUNT * 3);

    for (let i = 0; i < SNOW_COUNT; i++) {

        snowPositions[i * 3] =
            (Math.random() - 0.5) * 40;

        snowPositions[i * 3 + 1] =
            Math.random() * 25;

        snowPositions[i * 3 + 2] =
            Math.random() * -120 + 15;

        snowVelocities.push(
            0.04 + Math.random() * 0.08
        );
    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(snowPositions, 3)
    );

    const snowMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.16,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        sizeAttenuation: true
    });

    snowParticles = new THREE.Points(
        geometry,
        snowMaterial
    );

    scene.add(snowParticles);
}

function updateSnow() {

    if (!snowParticles) return;

    for (let i = 0; i < SNOW_COUNT; i++) {

        const index = i * 3;

        snowPositions[index + 1] -= snowVelocities[i];

        snowPositions[index] +=
            Math.sin(frame * 0.015 + i) * 0.018;

        snowPositions[index + 2] += speed * 0.25;

        if (
            snowPositions[index + 1] < -1 ||
            snowPositions[index + 2] > 15
        ) {

            snowPositions[index] =
                (Math.random() - 0.5) * 40;

            snowPositions[index + 1] =
                18 + Math.random() * 10;

            snowPositions[index + 2] =
                -100 - Math.random() * 30;
        }
    }

    snowParticles.geometry.attributes.position.needsUpdate = true;
}

createSnow();

// ======================================================
// PERSONNAGE 3D
// ======================================================

function createPlayer() {

    player = new THREE.Group();

    // Torse

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 1.1, 0.45),
        shirtMaterial
    );

    body.position.y = 1.8;
    player.add(body);

    playerParts.body = body;

    // Tête

    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 16, 16),
        skinMaterial
    );

    head.position.y = 2.65;
    player.add(head);

    // Cheveux

    const hair = new THREE.Mesh(
        new THREE.SphereGeometry(
            0.36,
            16,
            16,
            0,
            Math.PI * 2,
            0,
            Math.PI / 2
        ),
        material(0x173b69)
    );

    hair.position.y = 2.76;
    player.add(hair);

    // Capuche

    const hood = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 16, 16),
        material(0x168fc1)
    );

    hood.position.set(0, 2.58, 0.05);
    player.add(hood);

    // Bras et jambes

    for (const side of [-1, 1]) {

        // Bras

        const arm = new THREE.Group();

        arm.position.set(
            side * 0.55,
            2.1,
            0
        );

        const armMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.23, 0.9, 0.25),
            shirtMaterial
        );

        armMesh.position.y = -0.4;
        arm.add(armMesh);

        const hand = new THREE.Mesh(
            new THREE.SphereGeometry(0.13, 10, 10),
            skinMaterial
        );

        hand.position.y = -0.9;
        arm.add(hand);

        player.add(arm);
        playerParts.arms.push(arm);

        // Jambes

        const leg = new THREE.Group();

        leg.position.set(
            side * 0.23,
            1.2,
            0
        );

        const legMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.9, 0.35),
            pantsMaterial
        );

        legMesh.position.y = -0.4;
        leg.add(legMesh);

        const shoe = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 0.2, 0.55),
            shoeMaterial
        );

        shoe.position.set(0, -0.85, -0.1);
        leg.add(shoe);

        player.add(leg);
        playerParts.legs.push(leg);
    }

    // Cape

    const cape = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 1.3, 0.08),
        material(0xe52b40)
    );

    cape.position.set(0, 1.45, 0.3);
    player.add(cape);

    player.position.set(0, 0, 0);

    scene.add(player);
}

createPlayer();

// ======================================================
// TRAINS 3D 🚆
// ======================================================

function createTrain(laneIndex, z) {

    const train = new THREE.Group();

    // Corps

    box(2.5, 3.5, 13, 0x087f9c, 0, 2, 0, train);

    // Face avant

    box(2.3, 1.1, 0.15, 0x12c5e5, 0, 3, 6.55, train);

    // Pare-brise

    box(1.6, 0.8, 0.1, 0x15213c, 0, 2.8, 6.65, train);

    // Fenêtres latérales

    for (let zPos = -5; zPos <= 4; zPos += 3) {

        box(0.08, 1, 1.5, 0x9eeaff, -1.27, 2.8, zPos, train);
        box(0.08, 1, 1.5, 0x9eeaff, 1.27, 2.8, zPos, train);
    }

    // Phares

    for (const side of [-1, 1]) {

        const light = new THREE.PointLight(
            0xffeeaa,
            3,
            10
        );

        light.position.set(side * 0.8, 0.8, 7);
        train.add(light);

        box(
            0.35,
            0.35,
            0.15,
            0xffee99,
            side * 0.8,
            0.8,
            6.7,
            train
        );
    }

    train.position.set(
        lanePositions[laneIndex],
        0,
        z
    );

    scene.add(train);

    obstacles.push({
        object: train,
        type: "train",
        lane: laneIndex
    });
}

// ======================================================
// BARRIÈRES 3D 🚧
// ======================================================

function createBarrier(laneIndex, z) {

    const barrier = new THREE.Group();

    // Barre rouge

    box(2.1, 0.8, 0.3, 0xe52e3d, 0, 1, 0, barrier);

    // Pieds

    for (const side of [-1, 1]) {

        box(
            0.15,
            1.3,
            0.2,
            0xdddddd,
            side * 0.8,
            0.65,
            0,
            barrier
        );
    }

    // Bandes blanches

    for (let i = -2; i <= 2; i++) {

        box(
            0.2,
            0.85,
            0.32,
            0xffffff,
            i * 0.4,
            1,
            0,
            barrier
        );
    }

    barrier.position.set(
        lanePositions[laneIndex],
        0,
        z
    );

    scene.add(barrier);

    obstacles.push({
        object: barrier,
        type: "barrier",
        lane: laneIndex
    });
}

// ======================================================
// PIÈCES
// ======================================================

function createCoin(laneIndex, z) {

    const coin = new THREE.Mesh(
        new THREE.TorusGeometry(0.4, 0.12, 12, 24),
        new THREE.MeshStandardMaterial({
            color: 0xffbd32,
            metalness: 0.8,
            roughness: 0.2,
            emissive: 0x995500
        })
    );

    coin.position.set(
        lanePositions[laneIndex],
        1.3,
        z
    );

    scene.add(coin);
    coinObjects.push(coin);
}

// ======================================================
// APPARITION DES OBSTACLES ET PIÈCES
// ======================================================

function spawnObjects() {

    const laneIndex = Math.floor(Math.random() * 3);

    if (Math.random() < 0.35) {
        createTrain(laneIndex, -100);
    } else {
        createBarrier(laneIndex, -100);
    }

    if (Math.random() < 0.8) {

        const possibleLanes = [0, 1, 2].filter(
            l => l !== laneIndex
        );

        const coinLane =
            possibleLanes[
                Math.floor(Math.random() * possibleLanes.length)
            ];

        for (let i = 0; i < 5; i++) {
            createCoin(coinLane, -75 - i * 3);
        }
    }
}

// ======================================================
// SÉLECTION DES MODES
// ======================================================

function selectMode(mode, button) {

    selectedMode = mode;

    document.querySelectorAll(".mode").forEach(b => {
        b.classList.remove("selected");
    });

    if (button) {
        button.classList.add("selected");
    }

    const descriptions = {
        classic: "Évite les obstacles et récupère les pièces.",
        nocoin: "Une seule pièce touchée = GAME OVER !",
        lava: "Ne touche jamais le sol !"
    };

    const description =
        document.getElementById("modeDescription");

    if (description) {
        description.textContent =
            descriptions[mode] || descriptions.classic;
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

    if (button) {
        button.classList.add("active");
    }

    const speeds = {
        facile: 0.45,
        normal: 0.65,
        difficile: 0.85,
        extreme: 1.1
    };

    speed = speeds[level] || 0.65;
}

window.setDifficulty = setDifficulty;

// ======================================================
// COMMANDES ZQSD
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

    if (!running || paused) return;

    if (!jumping && !sliding) {
        jumping = true;
        jumpVelocity = 0.22;
    }
}

function slide() {

    if (!running || paused) return;

    if (!sliding && !jumping) {
        sliding = true;
        slideTimer = 50;
    }
}

window.addEventListener("keydown", e => {

    const key = e.key.toLowerCase();

    if (
        ["arrowleft", "arrowright", "arrowup", "arrowdown", " "]
        .includes(key)
    ) {
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

    for (const obstacle of obstacles) {

        const distance = obstacle.object.position.z;

        const sameLane =
            Math.abs(
                obstacle.object.position.x - player.position.x
            ) < 1.25;

        if (!sameLane) continue;

        // Train

        if (
            obstacle.type === "train" &&
            distance > -7 &&
            distance < 2
        ) {
            endGame("Tu as percuté un train !");
            return;
        }

        // Barrière

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

    // Pièces

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
                endGame("Tu as ramassé une pièce : interdit en mode No Coin !");
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

    if (jumping || sliding) return;

    const movement = Math.sin(frame * 0.18);

    playerParts.arms[0].rotation.x = movement * 0.8;
    playerParts.arms[1].rotation.x = -movement * 0.8;

    playerParts.legs[0].rotation.x = -movement * 0.9;
    playerParts.legs[1].rotation.x = movement * 0.9;

    player.position.y =
        Math.abs(Math.sin(frame * 0.18)) * 0.08;
}

// ======================================================
// DÉFILEMENT DU DÉCOR
// ======================================================

function moveEnvironment() {

    movingSleepers.forEach(sleeper => {

        sleeper.position.z += speed;

        if (sleeper.position.z > 20) {
            sleeper.position.z -= 200;
        }
    });

    movingStones.forEach(stone => {

        stone.position.z += speed;

        if (stone.position.z > 20) {
            stone.position.z -= 200;
        }
    });

    movingBuildings.forEach(building => {

        building.position.z += speed;

        if (building.position.z > 25) {
            building.position.z -= 198;
        }
    });

    movingTrees.forEach(tree => {

        tree.position.z += speed;

        if (tree.position.z > 20) {
            tree.position.z -= 180;
        }
    });
}

// ======================================================
// DÉPLACEMENT DES OBSTACLES
// ======================================================

function moveObstacles() {

    obstacles.forEach(obstacle => {
        obstacle.object.position.z += speed;
    });

    obstacles = obstacles.filter(obstacle => {

        if (obstacle.object.position.z > 18) {

            scene.remove(obstacle.object);
            return false;
        }

        return true;
    });
}

// ======================================================
// DÉPLACEMENT DES PIÈCES
// ======================================================

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
// INTERFACE SCORE
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

    spawnTimer++;

    const spawnDelay = Math.max(55, 100 - speed * 25);

    if (spawnTimer >= spawnDelay) {

        spawnObjects();
        spawnTimer = 0;
    }

    // Déplacement du personnage

    player.position.x +=
        (targetX - player.position.x) * 0.18;

    // Saut

    if (jumping) {

        player.position.y += jumpVelocity;

        jumpVelocity -= 0.012;

        if (player.position.y <= 0) {

            player.position.y = 0;
            jumping = false;
        }
    }

    // Glissade

    if (sliding) {

        slideTimer--;

        player.scale.y = 0.55;

        if (slideTimer <= 0) {

            sliding = false;
            player.scale.y = 1;
        }
    }

    // Animation

    animateRunner();

    // Décor

    moveEnvironment();
    updateSnow();

    // Obstacles et pièces

    moveObstacles();
    moveCoins();

    // Collisions

    checkCollisions();

    if (!running) return;

    // Caméra

    camera.position.x +=
        (player.position.x * 0.35 - camera.position.x) * 0.08;

    camera.position.y = 5 + player.position.y * 0.3;

    camera.lookAt(
        player.position.x * 0.25,
        1.5,
        -20
    );

    updateHUD();

    renderer.render(scene, camera);
}

// ======================================================
// DÉMARRER UNE PARTIE
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

    player.position.set(0, 0, 0);
    player.rotation.set(0, 0, 0);
    player.scale.set(1, 1, 1);

    // Nettoyer les anciens obstacles

    obstacles.forEach(obstacle => {
        scene.remove(obstacle.object);
    });

    coinObjects.forEach(coin => {
        scene.remove(coin);
    });

    obstacles = [];
    coinObjects = [];

    camera.position.set(0, 5, 9);
    camera.lookAt(0, 1.5, -20);

    const speeds = {
        facile: 0.45,
        normal: 0.65,
        difficile: 0.85,
        extreme: 1.1
    };

    speed = speeds[difficulty] || 0.65;

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
            modeName.textContent = "CLASSIC RUN";
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

    const buttons =
        document.querySelectorAll(".gameHeader button");

    buttons.forEach(button => {

        if (
            button.textContent.includes("PAUSE") ||
            button.textContent.includes("REPRENDRE")
        ) {
            button.textContent =
                paused ? "▶ REPRENDRE" : "Ⅱ PAUSE";
        }
    });
}

window.pauseGame = pauseGame;

// ======================================================
// RETOUR AU MENU
// ======================================================

function backToMenu() {

    running = false;
    paused = false;

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

function resizeGame() {

    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
}

window.addEventListener("resize", resizeGame);

// ======================================================
// AFFICHAGE INITIAL
// ======================================================

updateHUD();
resizeGame();
renderer.render(scene, camera);

console.log("🎄 NEON RUN CHRISTMAS EDITION chargé !");
