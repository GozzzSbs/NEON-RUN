// ======================================================
// NEON RUN 3D - VERSION BEACH SUMMER
// Décor plage : sable, mer, palmiers, lampadaires et feux verts
// Three.js r128 requis avant ce fichier.
// Placer skin.webp dans le même dossier que game.js si nécessaire.
// ======================================================

const canvas = document.getElementById("game");

if (!window.THREE) {
    alert("Erreur : Three.js n'est pas chargé.");
    throw new Error("Three.js missing");
}
if (!canvas) throw new Error("Canvas #game introuvable");

// ======================================================
// SCÈNE ET CAMÉRA
// ======================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x75d9ff);
scene.fog = new THREE.Fog(0x75d9ff, 65, 190);

const camera = new THREE.PerspectiveCamera(
    65, (canvas.clientWidth / canvas.clientHeight) || 1, 0.1, 350
);
camera.position.set(0, 5, 9);
camera.lookAt(0, 1.5, -20);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
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

scene.add(new THREE.HemisphereLight(0xdaf5ff, 0x9c784b, 2.2));

const sunLight = new THREE.DirectionalLight(0xfff0ce, 2.2);
sunLight.position.set(-15, 30, 10);
sunLight.castShadow = true;
scene.add(sunLight);

// Soleil décoratif
const sunBall = new THREE.Mesh(
    new THREE.SphereGeometry(7, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe17a })
);
sunBall.position.set(-45, 35, -120);
scene.add(sunBall);

// ======================================================
// VARIABLES
// ======================================================

let running = false;
let paused = false;
let gameEnded = false;

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
let animationStarted = false;

const lanePositions = [-3, 0, 3];

let obstacles = [];
let coinObjects = [];

let movingSleepers = [];
let movingStones = [];
let movingPalms = [];
let movingLampPosts = [];
let movingTrafficLights = [];

let player;
let playerParts;

let roadMesh;
let lavaGroup;
let lavaPlatforms = [];
let lavaPlatformTimer = 0;
let lavaLastLane = 1;

const LAVA_PLATFORM_TOP = 0.42;
const normalTrackMeshes = [];

const DIFFICULTY_SETTINGS = {
    facile:    { base: 0.45, start: 1,   max: 1.5 },
    normal:    { base: 0.65, start: 1.5, max: 2 },
    difficile: { base: 0.85, start: 2,   max: 2.5 },
    extreme:   { base: 1.1,  start: 2.5, max: 3 }
};

function applyDifficultySettings(resetProgress = true) {
    const settings =
        DIFFICULTY_SETTINGS[difficulty] || DIFFICULTY_SETTINGS.normal;

    baseSpeed = settings.base;
    maxSpeedMultiplier = settings.max;

    if (resetProgress) {
        speedMultiplier = settings.start;
    }

    speed = baseSpeed * speedMultiplier;
}

// ======================================================
// MATÉRIAUX ET OUTILS
// ======================================================

function material(color, roughness = 0.8, metalness = 0) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness
    });
}

const roadMaterial = material(0xe6c78e);
const railMaterial = material(0xaaaaaa, 0.3, 0.8);
const woodMaterial = material(0x9b7048);

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
// DÉCOR DE PLAGE : SABLE ET MER
// ======================================================

// Grand sol de sable
const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 350),
    material(0xf2d39b)
);

sand.rotation.x = -Math.PI / 2;
sand.position.set(0, -0.48, -100);
sand.receiveShadow = true;
scene.add(sand);

// Mer à gauche
const seaMaterial = new THREE.MeshStandardMaterial({
    color: 0x16c9df,
    roughness: 0.28,
    metalness: 0.05,
    emissive: 0x087caa,
    emissiveIntensity: 0.18
});

const seaLeft = new THREE.Mesh(
    new THREE.PlaneGeometry(130, 350),
    seaMaterial
);

seaLeft.rotation.x = -Math.PI / 2;
seaLeft.position.set(-85, -0.43, -100);
scene.add(seaLeft);

// Mer à droite
const seaRight = new THREE.Mesh(
    new THREE.PlaneGeometry(130, 350),
    seaMaterial
);

seaRight.rotation.x = -Math.PI / 2;
seaRight.position.set(85, -0.43, -100);
scene.add(seaRight);

// Petites vagues décoratives
const waveMaterial = new THREE.MeshBasicMaterial({
    color: 0xb5faff,
    transparent: true,
    opacity: 0.65
});

for (let i = 0; i < 45; i++) {
    for (const side of [-1, 1]) {
        const wave = new THREE.Mesh(
            new THREE.BoxGeometry(
                2 + Math.random() * 4,
                0.025,
                0.15
            ),
            waveMaterial
        );

        wave.position.set(
            side * (35 + Math.random() * 90),
            -0.38,
            -Math.random() * 230
        );

        scene.add(wave);
        movingStones.push(wave);
    }
}

// ======================================================
// SOL ET VOIE DE COURSE
// ======================================================

roadMesh = box(12, 0.3, 200, roadMaterial, 0, -0.25, -75);
normalTrackMeshes.push(roadMesh);

function createTrack() {
    for (let i = 0; i < 3; i++) {
        const x = lanePositions[i];

        normalTrackMeshes.push(
            box(0.12, 0.16, 200, railMaterial, x - 0.85, 0, -75)
        );

        normalTrackMeshes.push(
            box(0.12, 0.16, 200, railMaterial, x + 0.85, 0, -75)
        );

        for (let j = 0; j < 50; j++) {
            const sleeper = box(
                2.05, 0.18, 0.45,
                woodMaterial,
                x, -0.05, 15 - j * 4
            );

            movingSleepers.push(sleeper);
            normalTrackMeshes.push(sleeper);
        }
    }

    for (let i = 0; i < 250; i++) {
        const stone = new THREE.Mesh(
            new THREE.BoxGeometry(
                0.1 + Math.random() * 0.2,
                0.08,
                0.1 + Math.random() * 0.2
            ),
            material(0xc4a878)
        );

        stone.position.set(
            (Math.random() - 0.5) * 11,
            -0.02,
            Math.random() * -180
        );

        scene.add(stone);
        movingStones.push(stone);
        normalTrackMeshes.push(stone);
    }
}

createTrack();

// ======================================================
// PALMIERS
// ======================================================

function createPalm(x, z) {
    const palm = new THREE.Group();

    // Tronc
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.38, 6, 10),
        material(0x946039)
    );

    trunk.position.y = 3;
    trunk.rotation.z = 0.08;
    trunk.castShadow = true;
    palm.add(trunk);

    // Feuilles
    const leafMaterial = material(0x168b43);

    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;

        const leaf = new THREE.Mesh(
            new THREE.ConeGeometry(0.45, 4.5, 6),
            leafMaterial
        );

        leaf.position.set(
            Math.cos(angle) * 1.4,
            6,
            Math.sin(angle) * 1.4
        );

        leaf.rotation.z = -Math.cos(angle) * 0.8;
        leaf.rotation.x = Math.sin(angle) * 0.8;

        palm.add(leaf);
    }

    // Noix de coco
    for (let i = 0; i < 3; i++) {
        const coconut = new THREE.Mesh(
            new THREE.SphereGeometry(0.25, 10, 10),
            material(0x654024)
        );

        coconut.position.set(
            Math.cos(i * 2.1) * 0.3,
            5.8,
            Math.sin(i * 2.1) * 0.3
        );

        palm.add(coconut);
    }

    palm.position.set(x, 0, z);
    scene.add(palm);
    movingPalms.push(palm);
}

for (let i = 0; i < 22; i++) {
    createPalm(-9, -i * 10);
    createPalm(9, -i * 10);
}

// ======================================================
// LAMPADAIRES
// ======================================================

function createLampPost(x, z) {
    const lamp = new THREE.Group();

    const poleMaterial = material(0x343d4b, 0.4, 0.7);
    const lightMaterial = new THREE.MeshStandardMaterial({
        color: 0xfff1c2,
        emissive: 0xffd77a,
        emissiveIntensity: 1.5
    });

    // Poteau
    const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 7, 10),
        poleMaterial
    );

    pole.position.y = 3.5;
    lamp.add(pole);

    // Bras du lampadaire
    const arm = box(
        1.5, 0.12, 0.12,
        poleMaterial,
        0.65, 6.8, 0,
        lamp
    );

    // Lampe
    const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 12, 12),
        lightMaterial
    );

    bulb.position.set(1.35, 6.65, 0);
    lamp.add(bulb);

    const light = new THREE.PointLight(0xffe4a1, 1.2, 13);
    light.position.set(1.35, 6.4, 0);
    lamp.add(light);

    lamp.position.set(x, 0, z);
    scene.add(lamp);

    movingLampPosts.push(lamp);
}

for (let i = 0; i < 18; i++) {
    createLampPost(-7.5, -i * 13);
    createLampPost(7.5, -i * 13);
}

// ======================================================
// FEUX DE CIRCULATION VERTS
// ======================================================

function createTrafficLight(x, z) {
    const traffic = new THREE.Group();

    const poleMaterial = material(0x303943);
    const housingMaterial = material(0x20252c);

    // Poteau
    const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.14, 4.5, 8),
        poleMaterial
    );

    pole.position.y = 2.25;
    traffic.add(pole);

    // Boîtier du feu
    const housing = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 1.8, 0.5),
        housingMaterial
    );

    housing.position.set(0, 4.2, 0);
    traffic.add(housing);

    // Lumières rouge, orange et verte
    const colors = [0xff3333, 0xffb52e, 0x32ff68];

    for (let i = 0; i < 3; i++) {
        const bulbMaterial = new THREE.MeshStandardMaterial({
            color: colors[i],
            emissive: colors[i],
            emissiveIntensity: i === 2 ? 1.8 : 0.15
        });

        const bulb = new THREE.Mesh(
            new THREE.SphereGeometry(0.19, 12, 12),
            bulbMaterial
        );

        bulb.position.set(0, 4.8 - i * 0.6, 0.28);
        traffic.add(bulb);

        if (i === 2) {
            const greenLight = new THREE.PointLight(0x22ff55, 1.3, 7);
            greenLight.position.set(0, 3.6, 0.5);
            traffic.add(greenLight);
        }
    }

    traffic.position.set(x, 0, z);
    scene.add(traffic);
    movingTrafficLights.push(traffic);
}

for (let i = 0; i < 12; i++) {
    createTrafficLight(-8, -i * 19 - 8);
    createTrafficLight(8, -i * 19 - 8);
}

// ======================================================
// PERSONNAGE 3D AVEC SKIN VIOLET ET ANIMATION
// ======================================================

function createPlayer() {
    player = new THREE.Group();

    playerParts = {
        arms: [],
        legs: [],
        head: null,
        body: null
    };

    const purple = material(0x7900b8);
    const darkPurple = material(0x35004e);
    const black = material(0x211b28);
    const lime = material(0xb6ff19);
    const skin = material(0xd98a57);
    const white = material(0xffe9d1);

    function sphere(radius, mat, x, y, z, parent) {
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 16, 16),
            mat
        );

        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        parent.add(mesh);

        return mesh;
    }

    function limb(w, h, d, mat, x, y, z, parent) {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            mat
        );

        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        parent.add(mesh);

        return mesh;
    }

    // CORPS
    const torso = new THREE.Group();
    torso.position.y = 1.75;
    player.add(torso);
    playerParts.body = torso;

    limb(0.9, 1.1, 0.48, black, 0, 0, 0, torso);
    limb(0.94, 0.15, 0.5, white, 0, -0.52, 0, torso);

    // Logo couronne
    const logoMaterial = new THREE.LineBasicMaterial({
        color: 0xb6ff19
    });

    const crownPoints = [
        new THREE.Vector3(-0.23, -0.05, 0.251),
        new THREE.Vector3(-0.18, 0.20, 0.251),
        new THREE.Vector3(-0.04, 0.07, 0.251),
        new THREE.Vector3(0.02, 0.23, 0.251),
        new THREE.Vector3(0.12, 0.07, 0.251),
        new THREE.Vector3(0.23, 0.20, 0.251),
        new THREE.Vector3(0.25, -0.05, 0.251),
        new THREE.Vector3(-0.23, -0.05, 0.251)
    ];

    const crownGeometry = new THREE.BufferGeometry()
        .setFromPoints(crownPoints);

    torso.add(new THREE.Line(crownGeometry, logoMaterial));

    // TÊTE
    const head = new THREE.Group();
    head.position.set(0, 2.65, 0);
    player.add(head);
    playerParts.head = head;

    sphere(0.34, skin, 0, 0, 0, head);
    sphere(0.35, black, 0, 0.13, 0, head);
    sphere(0.39, purple, 0, 0.30, 0, head);

    limb(0.74, 0.18, 0.72, darkPurple, 0, 0.17, 0, head);
    limb(0.75, 0.12, 0.74, purple, 0, 0.10, 0, head);

    sphere(0.10, skin, -0.34, -0.05, 0, head);
    sphere(0.10, skin, 0.34, -0.05, 0, head);

    // Casque audio
    for (const side of [-1, 1]) {
        const headphone = new THREE.Mesh(
            new THREE.BoxGeometry(0.16, 0.38, 0.28),
            black
        );

        headphone.position.set(side * 0.39, -0.12, 0);
        head.add(headphone);

        const headphoneLight = new THREE.Mesh(
            new THREE.BoxGeometry(0.17, 0.15, 0.29),
            lime
        );

        headphoneLight.position.set(side * 0.40, -0.12, 0);
        head.add(headphoneLight);
    }

    // BRAS ARTICULÉS
    for (const side of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(side * 0.51, 2.20, 0);
        player.add(arm);

        const sleeveMaterial = side === -1 ? purple : lime;

        limb(0.28, 0.48, 0.30, sleeveMaterial, 0, -0.24, 0, arm);

        const elbow = new THREE.Group();
        elbow.position.y = -0.48;
        arm.add(elbow);

        limb(0.24, 0.43, 0.27, darkPurple, 0, -0.21, 0, elbow);
        sphere(0.14, skin, 0, -0.46, 0, elbow);

        arm.userData.elbow = elbow;
        playerParts.arms.push(arm);
    }

    // JAMBES ARTICULÉES
    for (const side of [-1, 1]) {
        const leg = new THREE.Group();
        leg.position.set(side * 0.24, 1.22, 0);
        player.add(leg);

        limb(0.34, 0.60, 0.38, black, 0, -0.30, 0, leg);

        const knee = new THREE.Group();
        knee.position.y = -0.58;
        leg.add(knee);

        limb(0.32, 0.45, 0.36, black, 0, -0.20, 0, knee);
        limb(0.43, 0.23, 0.60, purple, 0, -0.48, -0.10, knee);
        limb(0.44, 0.08, 0.61, white, 0, -0.60, -0.10, knee);
        limb(0.35, 0.07, 0.12, lime, 0, -0.47, -0.36, knee);

        leg.userData.knee = knee;
        playerParts.legs.push(leg);
    }

    // CAPUCHE
    const hood = new THREE.Mesh(
        new THREE.SphereGeometry(0.40, 16, 16),
        darkPurple
    );

    hood.position.set(0, 2.35, 0.25);
    player.add(hood);

    player.position.set(0, 0, 0);
    scene.add(player);
}

createPlayer();

// ======================================================
// TRAINS
// ======================================================

function createTrain(laneIndex, z) {
    const train = new THREE.Group();

    box(2.5, 3.5, 13, 0x087f9c, 0, 2, 0, train);
    box(2.3, 1.1, 0.15, 0x12c5e5, 0, 3, 6.55, train);
    box(1.6, 0.8, 0.1, 0x15213c, 0, 2.8, 6.65, train);

    for (let zPos = -5; zPos <= 4; zPos += 3) {
        box(0.08, 1, 1.5, 0x9eeaff, -1.27, 2.8, zPos, train);
        box(0.08, 1, 1.5, 0x9eeaff, 1.27, 2.8, zPos, train);
    }

    for (const side of [-1, 1]) {
        const light = new THREE.PointLight(0xffeeaa, 3, 10);
        light.position.set(side * 0.8, 0.8, 7);
        train.add(light);

        box(0.35, 0.35, 0.15, 0xffee99, side * 0.8, 0.8, 6.7, train);
    }

    train.position.set(lanePositions[laneIndex], 0, z);
    scene.add(train);

    obstacles.push({
        object: train,
        type: "train",
        lane: laneIndex
    });
}

// ======================================================
// BARRIÈRES
// ======================================================

function createBarrier(laneIndex, z) {
    const barrier = new THREE.Group();

    box(2.1, 0.8, 0.3, 0xe52e3d, 0, 1, 0, barrier);

    for (const side of [-1, 1]) {
        box(0.15, 1.3, 0.2, 0xdddddd, side * 0.8, 0.65, 0, barrier);
    }

    for (let i = -2; i <= 2; i++) {
        box(0.2, 0.85, 0.32, 0xffffff, i * 0.4, 1, 0, barrier);
    }

    barrier.position.set(lanePositions[laneIndex], 0, z);
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

    coin.position.set(lanePositions[laneIndex], 1.3, z);
    scene.add(coin);
    coinObjects.push(coin);
}

// ======================================================
// ENVIRONNEMENT LAVE
// ======================================================

function createLavaEnvironment() {
    if (lavaGroup) return;

    lavaGroup = new THREE.Group();

    const lava = new THREE.Mesh(
        new THREE.PlaneGeometry(22, 230),
        new THREE.MeshStandardMaterial({
            color: 0xff3b08,
            emissive: 0xff2600,
            emissiveIntensity: 1.15,
            roughness: 0.32,
            metalness: 0.05
        })
    );

    lava.rotation.x = -Math.PI / 2;
    lava.position.set(0, -0.48, -78);
    lavaGroup.add(lava);

    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xffa01a,
        transparent: true,
        opacity: 0.8
    });

    for (let i = 0; i < 65; i++) {
        const crack = new THREE.Mesh(
            new THREE.BoxGeometry(
                0.08 + Math.random() * 0.18,
                0.025,
                1.2 + Math.random() * 3
            ),
            glowMaterial
        );

        crack.position.set(
            (Math.random() - 0.5) * 18,
            -0.445,
            -180 + Math.random() * 210
        );

        crack.rotation.y = (Math.random() - 0.5) * 0.8;
        crack.userData.isLavaCrack = true;

        lavaGroup.add(crack);
    }

    const lavaLight = new THREE.PointLight(0xff3b12, 2.2, 38);
    lavaLight.position.set(0, 2.5, -8);
    lavaGroup.add(lavaLight);

    scene.add(lavaGroup);
}

function setLavaVisuals(enabled) {
    createLavaEnvironment();

    normalTrackMeshes.forEach(mesh => {
        mesh.visible = !enabled;
    });

    lavaGroup.visible = enabled;

    scene.background = new THREE.Color(
        enabled ? 0x260b12 : 0x75d9ff
    );

    scene.fog.color.set(
        enabled ? 0x3b1010 : 0x75d9ff
    );

    scene.fog.near = enabled ? 18 : 65;
    scene.fog.far = enabled ? 115 : 190;
}

// ======================================================
// PLATEFORMES DE LAVE
// ======================================================

function createLavaPlatform(laneIndex, z, width = 2.55, depth = 5.2) {
    const platform = new THREE.Group();

    const rock = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.55, depth),
        new THREE.MeshStandardMaterial({
            color: 0x40332e,
            roughness: 0.95
        })
    );

    rock.position.y = -0.02;
    rock.castShadow = true;
    rock.receiveShadow = true;
    platform.add(rock);

    const top = new THREE.Mesh(
        new THREE.BoxGeometry(
            Math.max(0.5, width - 0.2),
            0.12,
            Math.max(0.5, depth - 0.2)
        ),
        new THREE.MeshStandardMaterial({
            color: 0x716052,
            roughness: 1
        })
    );

    top.position.y = 0.31;
    top.receiveShadow = true;
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

    if (Math.random() < 0.38) {
        const otherLanes = [0, 1, 2].filter(value => value !== nextLane);
        const other = otherLanes[Math.floor(Math.random() * otherLanes.length)];

        createLavaPlatform(other, z);
    }
}

function resetLavaPlatforms() {
    lavaPlatforms.forEach(item => scene.remove(item.object));

    lavaPlatforms = [];
    lavaPlatformTimer = 0;
    lavaLastLane = 1;

    if (selectedMode !== "lava") return;

    createLavaEnvironment();

    createLavaPlatform(1, -25, 9.2, 60);
    createLavaPlatform(1, -59, 9.2, 12);

    for (let i = 0; i < 9; i++) {
        spawnLavaSegment(-77 - i * 12);
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

    if (
        lavaPlatformTimer >=
        Math.max(10, Math.round(12 / Math.max(speed, 0.3)))
    ) {
        const furthestZ = lavaPlatforms.reduce(
            (minimum, item) => Math.min(minimum, item.object.position.z),
            0
        );

        spawnLavaSegment(furthestZ - 12);
        lavaPlatformTimer = 0;
    }

    if (lavaGroup) {
        lavaGroup.children.forEach(child => {
            if (child.userData.isLavaCrack) {
                child.position.z += speed * 0.7;

                if (child.position.z > 18) {
                    child.position.z -= 210;
                }
            }
        });
    }
}

function isPlayerAboveLavaPlatform() {
    return lavaPlatforms.some(item => {
        const platform = item.object;
        const width = platform.userData.width || 2.55;
        const depth = platform.userData.depth || 5.2;

        const insideX =
            Math.abs(platform.position.x - player.position.x) <
            width / 2 - 0.15;

        const insideZ =
            Math.abs(platform.position.z) <
            depth / 2 - 0.15;

        return insideX && insideZ;
    });
}

// ======================================================
// GÉNÉRATION DES OBSTACLES ET PIÈCES
// ======================================================

function spawnObjects() {
    const laneIndex = Math.floor(Math.random() * 3);

    if (Math.random() < 0.35) {
        createTrain(laneIndex, -100);
    } else {
        createBarrier(laneIndex, -100);
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
// SÉLECTION DU MODE
// ======================================================

function selectMode(mode, button) {
    selectedMode = mode;

    document.querySelectorAll(".mode-buttons button").forEach(b => {
        b.classList.remove("active");
    });

    if (button) button.classList.add("active");

    const descriptions = {
        classic: "Évite les trains et les barrières. Ramasse les pièces et bats ton record !",
        nocoin: "Attention : toucher une seule pièce provoque immédiatement un GAME OVER !",
        lava: "Le sol est de la lave ! Saute de plateforme en plateforme pour survivre."
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

    if (
        ["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(key)
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
    if (
        selectedMode === "lava" &&
        !jumping &&
        !isPlayerAboveLavaPlatform()
    ) {
        endGame("Tombé dans la lave !");
        return;
    }

    for (const obstacle of obstacles) {
        const distance = obstacle.object.position.z;

        const sameLane =
            Math.abs(obstacle.object.position.x - player.position.x) < 1.25;

        if (!sameLane) continue;

        if (obstacle.type === "train" && distance > -7 && distance < 2) {
            endGame("Tu as percuté un train !");
            return;
        }

        if (obstacle.type === "barrier" && distance > -1.3 && distance < 1.3) {
            if (!jumping && !sliding) {
                endGame(
                    selectedMode === "lava"
                        ? "Tu te cognes aux murs !"
                        : "Tu as heurté une barrière !"
                );

                return;
            }
        }
    }

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
// ANIMATION DE COURSE
// ======================================================

function animateRunner() {
    const movement = frame * 0.18;

    if (!jumping && !sliding) {
        const swing = Math.sin(movement);

        playerParts.arms[0].rotation.x = swing * 0.85;
        playerParts.arms[1].rotation.x = -swing * 0.85;

        playerParts.arms[0].userData.elbow.rotation.x = -0.25;
        playerParts.arms[1].userData.elbow.rotation.x = -0.25;

        playerParts.legs[0].rotation.x = -swing * 0.75;
        playerParts.legs[1].rotation.x = swing * 0.75;

        playerParts.legs[0].userData.knee.rotation.x =
            Math.max(0, swing) * 0.8;

        playerParts.legs[1].userData.knee.rotation.x =
            Math.max(0, -swing) * 0.8;

        playerParts.body.position.y =
            1.75 + Math.abs(Math.sin(movement * 2)) * 0.06;

        playerParts.head.rotation.z =
            Math.sin(movement) * 0.035;
    }

    if (jumping) {
        playerParts.arms[0].rotation.x = -0.9;
        playerParts.arms[1].rotation.x = -0.9;

        playerParts.legs[0].rotation.x = 0.45;
        playerParts.legs[1].rotation.x = -0.45;

        playerParts.body.position.y = 1.75;
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
            sleeper.position.z -= 200;
        }
    });

    movingStones.forEach(stone => {
        stone.position.z += speed;

        if (stone.position.z > 20) {
            stone.position.z -= 200;
        }
    });

    movingPalms.forEach(palm => {
        palm.position.z += speed;

        if (palm.position.z > 25) {
            palm.position.z -= 220;
        }
    });

    movingLampPosts.forEach(lamp => {
        lamp.position.z += speed;

        if (lamp.position.z > 25) {
            lamp.position.z -= 234;
        }
    });

    movingTrafficLights.forEach(traffic => {
        traffic.position.z += speed;

        if (traffic.position.z > 25) {
            traffic.position.z -= 228;
        }
    });
}

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
    if (reasonElement) reasonElement.textContent = reason || "Fin de la partie !";
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

    // ACCÉLÉRATION PROGRESSIVE
    speedMultiplier = Math.min(
        maxSpeedMultiplier,
        speedMultiplier + SPEED_INCREASE
    );

    speed = baseSpeed * speedMultiplier;

    spawnTimer++;

    const spawnDelay = Math.max(55, 100 - speed * 25);

    if (spawnTimer >= spawnDelay) {
        spawnObjects();
        spawnTimer = 0;
    }

    player.position.x += (targetX - player.position.x) * 0.18;

    // SAUT
    if (jumping) {
        player.position.y += jumpVelocity;

        jumpVelocity -= selectedMode === "lava" ? 0.035 : 0.012;

        const landingHeight =
            selectedMode === "lava" ? LAVA_PLATFORM_TOP : 0;

        if (player.position.y <= landingHeight) {
            player.position.y = landingHeight;
            jumping = false;
            jumpVelocity = 0;

            if (sliding) {
                slideTimer = Math.max(slideTimer, 35);
            }

            if (
                selectedMode === "lava" &&
                !isPlayerAboveLavaPlatform()
            ) {
                endGame("Tombé dans la lave !");
                return;
            }
        }
    }

    // GLISSADE
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

    obstacles.forEach(obstacle => {
        scene.remove(obstacle.object);
    });

    coinObjects.forEach(coin => {
        scene.remove(coin);
    });

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
// RETOUR AU MENU
// ======================================================

function backToMenu() {
    running = false;
    paused = false;

    setLavaVisuals(false);

    lavaPlatforms.forEach(item => {
        scene.remove(item.object);
    });

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
// PREMIER AFFICHAGE
// ======================================================

applyDifficultySettings(true);
updateHUD();

renderer.render(scene, camera);

console.log("NEON RUN 3D - BEACH SUMMER chargé correctement !");
