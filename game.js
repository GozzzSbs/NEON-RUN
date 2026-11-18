// ======================================================
// NEON RUN 3D - MOTEUR COMPLET AMÉLIORÉ
// ======================================================

const canvas = document.getElementById("game");

if (!window.THREE) {
    alert("Erreur : Three.js n'est pas chargé.");
    throw new Error("Three.js missing");
}

if (!canvas) {
    throw new Error("Canvas #game introuvable");
}

// ======================================================
// SCÈNE ET CAMÉRA
// ======================================================

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x101b42);
scene.fog = new THREE.Fog(0x101b42, 35, 155);

const camera = new THREE.PerspectiveCamera(
    65,
    canvas.clientWidth / canvas.clientHeight || 1,
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

const sun = new THREE.DirectionalLight(0xffffff, 2);

sun.position.set(-10, 20, 10);
sun.castShadow = true;

scene.add(sun);

// ======================================================
// VARIABLES DU JEU
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
let difficulty = "normal";
let selectedMode = "classic";

let frame = 0;
let spawnTimer = 0;

let animationStarted = false;

const lanePositions = [-3, 0, 3];

let obstacles = [];
let coinObjects = [];

let movingBuildings = [];
let movingTrees = [];
let movingSleepers = [];
let movingStones = [];

let player;
let playerParts = {};

const normalTrackMeshes = [];

let roadMesh;
let lavaGroup;
let lavaPlatforms = [];

let lavaPlatformTimer = 0;
let lavaLastLane = 1;
let lavaDistance = 0;

const LAVA_PLATFORM_TOP = 0.42;

// ======================================================
// MATÉRIAUX
// ======================================================

function material(color, roughness = 0.8, metalness = 0) {

    return new THREE.MeshStandardMaterial({
        color: color,
        roughness: roughness,
        metalness: metalness
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
// OUTILS DE CRÉATION
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

roadMesh = box(
    12,
    0.3,
    200,
    roadMaterial,
    0,
    -0.25,
    -75
);

normalTrackMeshes.push(roadMesh);

function createTrack() {

    for (let i = 0; i < 3; i++) {

        const x = lanePositions[i];

        normalTrackMeshes.push(box(
            0.12, 0.16, 200,
            railMaterial,
            x - 0.85, 0, -75
        ));

        normalTrackMeshes.push(box(
            0.12, 0.16, 200,
            railMaterial,
            x + 0.85, 0, -75
        ));

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

    for (let i = 0; i < 500; i++) {

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
        normalTrackMeshes.push(stone);

    }

}

createTrack();

// ======================================================
// IMMEUBLES
// ======================================================

function createBuilding(x, z) {

    const height = 12 + Math.random() * 20;
    const width = 5 + Math.random() * 3;

    const building = new THREE.Group();

    box(
        width, height, 6,
        0x30334d,
        0, height / 2, 0,
        building
    );

    for (let y = 1; y < height - 1; y += 2.5) {

        for (let w = -1; w <= 1; w++) {

            if (Math.random() > 0.25) {

                const win = box(
                    0.65, 1.1, 0.12,
                    Math.random() > 0.5 ? 0xffd77a : 0x8fdfff,
                    w * 1.4, y, 3.07,
                    building
                );

                win.material.emissive = win.material.color;
                win.material.emissiveIntensity = 0.7;

            }

        }

    }

    building.position.set(x, 0, z);

    scene.add(building);
    movingBuildings.push(building);

}

for (let i = 0; i < 22; i++) {
    createBuilding(-9, -i * 9);
    createBuilding(9, -i * 9);
}

// ======================================================
// ARBRES
// ======================================================

function createTree(x, z) {

    const tree = new THREE.Group();

    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.35, 2),
        material(0x65402b)
    );

    trunk.position.y = 1;
    tree.add(trunk);

    for (let i = 0; i < 3; i++) {

        const leaves = new THREE.Mesh(
            new THREE.ConeGeometry(1.8 - i * 0.3, 3, 8),
            material(0x148d48)
        );

        leaves.position.y = 2.5 + i * 1.5;
        tree.add(leaves);

    }

    tree.position.set(x, 0, z);

    scene.add(tree);
    movingTrees.push(tree);

}

for (let i = 0; i < 18; i++) {
    createTree(-6, -i * 10);
    createTree(6, -i * 10);
}

// ======================================================
// PERSONNAGE
// ======================================================

function createPlayer() {

    player = new THREE.Group();

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 1.1, 0.45),
        shirtMaterial
    );

    body.position.y = 1.8;
    player.add(body);

    playerParts.body = body;

    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 16, 16),
        skinMaterial
    );

    head.position.y = 2.65;
    player.add(head);

    const hair = new THREE.Mesh(
        new THREE.SphereGeometry(
            0.36, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2
        ),
        material(0x173b69)
    );

    hair.position.y = 2.76;
    player.add(hair);

    const hood = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 16, 16),
        material(0x168fc1)
    );

    hood.position.set(0, 2.58, 0.05);
    player.add(hood);

    playerParts.arms = [];
    playerParts.legs = [];

    for (const side of [-1, 1]) {

        const arm = new THREE.Group();

        arm.position.set(side * 0.55, 2.1, 0);

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

        const leg = new THREE.Group();

        leg.position.set(side * 0.23, 1.2, 0);

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
// TRAINS
// ======================================================

function createTrain(laneIndex, z) {

    const train = new THREE.Group();

    // Corps du train
    box(2.5, 3.5, 13, 0x087f9c, 0, 2, 0, train);

    // Partie supérieure avant
    box(2.3, 1.1, 0.15, 0x12c5e5, 0, 3, 6.55, train);

    // Pare-brise
    box(1.6, 0.8, 0.1, 0x15213c, 0, 2.8, 6.65, train);

    // Fenêtres latérales
    for (let zPos = -5; zPos <= 4; zPos += 3) {

        box(0.08, 1, 1.5, 0x9eeaff, -1.27, 2.8, zPos, train);
        box(0.08, 1, 1.5, 0x9eeaff, 1.27, 2.8, zPos, train);

    }

    // Lumières avant
    for (const side of [-1, 1]) {

        const light = new THREE.PointLight(0xffeeaa, 3, 10);

        light.position.set(side * 0.8, 0.8, 7);
        train.add(light);

        box(
            0.35, 0.35, 0.15,
            0xffee99,
            side * 0.8, 0.8, 6.7,
            train
        );

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

        lavaGroup.add(crack);
        crack.userData.isLavaCrack = true;

    }

    scene.add(lavaGroup);

    const lavaLight = new THREE.PointLight(0xff3b12, 2.2, 38);

    lavaLight.position.set(0, 2.5, -8);
    lavaGroup.add(lavaLight);

}

function setLavaVisuals(enabled) {

    createLavaEnvironment();

    normalTrackMeshes.forEach(mesh => {
        mesh.visible = !enabled;
    });

    if (lavaGroup) {
        lavaGroup.visible = enabled;
    }

    scene.background = new THREE.Color(
        enabled ? 0x260b12 : 0x101b42
    );

    scene.fog.color.set(
        enabled ? 0x3b1010 : 0x101b42
    );

    scene.fog.near = enabled ? 18 : 35;
    scene.fog.far = enabled ? 115 : 155;

}

// ======================================================
// PLATEFORMES DE LAVE
// ======================================================

function createLavaPlatform(
    laneIndex,
    z,
    width = 2.55,
    depth = 5.2
) {

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

        edge.position.set(
            side * (width / 2 - 0.1),
            0.34,
            0
        );

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

    if (lavaLastLane > 0) {
        choices.push(lavaLastLane - 1);
    }

    if (lavaLastLane < 2) {
        choices.push(lavaLastLane + 1);
    }

    const nextLane =
        choices[Math.floor(Math.random() * choices.length)];

    lavaLastLane = nextLane;

    createLavaPlatform(nextLane, z);

    if (Math.random() < 0.38) {

        const otherLanes = [0, 1, 2].filter(
            value => value !== nextLane
        );

        const other =
            otherLanes[Math.floor(Math.random() * otherLanes.length)];

        createLavaPlatform(other, z);

    }

}

function resetLavaPlatforms() {

    lavaPlatforms.forEach(item => {
        scene.remove(item.object);
    });

    lavaPlatforms = [];

    lavaPlatformTimer = 0;
    lavaLastLane = 1;
    lavaDistance = 0;

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

    lavaDistance += speed;
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
            (minimum, item) => Math.min(
                minimum,
                item.object.position.z
            ),
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
            Math.abs(platform.position.x - player.position.x) < width / 2 - 0.15;

        const insideZ =
            Math.abs(platform.position.z) < depth / 2 - 0.15;

        return insideX && insideZ;

    });

}

// ======================================================
// GÉNÉRATION DES OBSTACLES ET DES PIÈCES
// ======================================================

function spawnObjects() {

    const laneIndex = Math.floor(Math.random() * 3);
    const random = Math.random();

    // 55 % de chances de faire apparaître un train
    if (random < 0.55) {

        createTrain(laneIndex, -110);

    } else {

        createBarrier(laneIndex, -110);

    }

    // Pas de pièces en mode lave
    if (selectedMode === "lava") return;

    // Beaucoup plus de pièces !
    if (Math.random() < 0.95) {

        const possibleLanes = [0, 1, 2].filter(
            l => l !== laneIndex
        );

        const coinLane =
            possibleLanes[
                Math.floor(Math.random() * possibleLanes.length)
            ];

        // Grande rangée de 9 pièces
        for (let i = 0; i < 9; i++) {

            createCoin(coinLane, -65 - i * 2.5);

        }

        // Deuxième rangée occasionnelle
        if (Math.random() < 0.55) {

            const otherLanes = [0, 1, 2].filter(
                l => l !== laneIndex && l !== coinLane
            );

            const secondLane = otherLanes[0];

            for (let i = 0; i < 6; i++) {

                createCoin(secondLane, -75 - i * 3);

            }

        }

    }

}

// ======================================================
// SÉLECTION DES MODES
// ======================================================

function selectMode(mode, button) {

    selectedMode = mode;

    document.querySelectorAll(".mode-buttons button").forEach(b => {
        b.classList.remove("active");
    });

    if (button) {
        button.classList.add("active");
    }

    const descriptions = {

        classic:
            "Évite les trains et les barrières. Ramasse les pièces et bats ton record !",

        nocoin:
            "Attention : toucher une seule pièce provoque immédiatement un GAME OVER !",

        lava:
            "Le sol est de la lave ! Saute de plateforme en plateforme pour survivre."

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

    if (!running || paused) return;

    if (!jumping) {

        sliding = false;
        slideTimer = 0;

        player.scale.y = 1;

        jumping = true;

        jumpVelocity =
            selectedMode === "lava" ? 0.32 : 0.22;

    }

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
        ["arrowleft", "arrowright", "arrowup", "arrowdown", " "]
        .includes(key)
    ) {
        e.preventDefault();
    }

    if (key === "q" || key === "arrowleft") {
        moveLeft();
    }

    if (key === "d" || key === "arrowright") {
        moveRight();
    }

    if (key === "z" || key === "arrowup" || key === " ") {
        jump();
    }

    if (key === "s" || key === "arrowdown") {
        slide();
    }

    if (key === "escape") {
        pauseGame();
    }

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

        if (
            obstacle.type === "train" &&
            distance > -7 &&
            distance < 2
        ) {

            endGame("Tu as percuté un train !");
            return;

        }

        if (
            obstacle.type === "barrier" &&
            distance > -1.3 &&
            distance < 1.3
        ) {

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

                endGame(
                    "Tu as ramassé une pièce : interdit en mode No Coin !"
                );

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
        selectedMode === "lava"
            ? LAVA_PLATFORM_TOP
            : Math.abs(Math.sin(frame * 0.18)) * 0.08;

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
// DÉPLACEMENT DES OBSTACLES ET DES TRAINS
// ======================================================

function moveObstacles() {

    obstacles.forEach(obstacle => {

        // Les trains foncent vers le joueur
        if (obstacle.type === "train") {

            obstacle.object.position.z += speed * 1.35;

            // Léger mouvement pour donner une impression de vibration
            obstacle.object.position.y =
                Math.sin(frame * 0.12) * 0.035;

        } else {

            obstacle.object.position.z += speed;

        }

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

    if (reasonElement) {
        reasonElement.textContent = reason || "Fin de la partie !";
    }

    if (finalScore) finalScore.textContent = score;
    if (finalCoins) finalCoins.textContent = coins;

    if (gameOver) {
        gameOver.classList.remove("hidden");
    }

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

    // Déplacement latéral
    player.position.x +=
        (targetX - player.position.x) * 0.18;

    // ==================================================
    // SAUT ET DESCENTE RAPIDE
    // ==================================================

    if (jumping) {

        player.position.y += jumpVelocity;

        jumpVelocity -=
            selectedMode === "lava" ? 0.035 : 0.012;

        const landingHeight =
            selectedMode === "lava"
                ? LAVA_PLATFORM_TOP
                : 0;

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

    // ==================================================
    // GLISSADE
    // ==================================================

    if (sliding) {

        slideTimer--;

        player.scale.y = 0.55;

        if (slideTimer <= 0) {

            sliding = false;

            player.scale.y = 1;

        }

    }

    // Mode lave : position sur les plateformes
    if (selectedMode === "lava" && !jumping) {

        player.position.y = LAVA_PLATFORM_TOP;

    }

    // Animation du personnage
    animateRunner();

    // Décor
    moveEnvironment();
    moveLavaPlatforms();

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

    player.position.set(
        0,
        selectedMode === "lava" ? LAVA_PLATFORM_TOP : 0,
        0
    );

    player.rotation.set(0, 0, 0);
    player.scale.set(1, 1, 1);

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

    const buttons = document.querySelectorAll(".gameHeader button");

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

updateHUD();

renderer.render(scene, camera);

console.log("NEON RUN 3D chargé correctement ! 🚆🪙");
