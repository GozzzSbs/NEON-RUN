// =====================================================
// NEON RUN - CHRISTMAS OPTIMIZED EDITION
// Three.js r128
// =====================================================

const canvas = document.getElementById("game");

if (!window.THREE || !canvas) {
    throw new Error("Three.js ou canvas introuvable !");
}

// =====================================================
// SCÈNE ET RENDU
// =====================================================

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x09152b);
scene.fog = new THREE.Fog(0x09152b, 45, 135);

const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 200);
camera.position.set(0, 5, 9);
camera.lookAt(0, 1.5, -15);

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: "high-performance"
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
renderer.shadowMap.enabled = false;
renderer.setSize(
    canvas.clientWidth || 900,
    canvas.clientHeight || 450
);

// =====================================================
// LUMIÈRES
// =====================================================

scene.add(new THREE.HemisphereLight(0xb9d9ff, 0x282033, 1.8));

const mainLight = new THREE.DirectionalLight(0xc6dcff, 1.1);
mainLight.position.set(-5, 12, 8);
scene.add(mainLight);

// =====================================================
// VARIABLES
// =====================================================

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

let speed = 0.55;
let difficulty = "normal";
let selectedMode = "classic";

let frame = 0;
let spawnTimer = 0;

const lanes = [-3, 0, 3];

let obstacles = [];
let coinObjects = [];

let movingBuildings = [];
let movingTrees = [];
let movingSleepers = [];
let movingStones = [];

let snowParticles = null;
let snowPositions = null;

const SNOW_COUNT = 250;

let player;
let playerParts = {
    arms: [],
    legs: []
};

let animationId = null;

// =====================================================
// MATÉRIAUX PARTAGÉS
// =====================================================

function mat(color, roughness = 0.8, metalness = 0) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness
    });
}

const materials = {
    road: mat(0x45424a),
    rail: mat(0x9ba9ba, 0.35, 0.7),
    wood: mat(0x65462e),
    snow: mat(0xeaf5ff),
    skin: mat(0xd99b79),
    shirt: mat(0x12a9db),
    pants: mat(0x25334c),
    shoes: mat(0xffffff),
    building: mat(0x29334b),
    tree: mat(0x08783c),
    trunk: mat(0x65402b),
    red: mat(0xe52e3d),
    white: mat(0xffffff),
    train: mat(0x087f9c),
    glass: mat(0x8edcff, 0.3, 0.2)
};

// =====================================================
// OUTILS 3D
// =====================================================

function box(w, h, d, material, x, y, z, parent = scene) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        typeof material === "number" ? mat(material) : material
    );

    mesh.position.set(x, y, z);
    parent.add(mesh);

    return mesh;
}

function sphere(radius, material, x, y, z, parent = scene) {
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 8, 8),
        material,
    );

    mesh.position.set(x, y, z);
    parent.add(mesh);

    return mesh;
}

// =====================================================
// SOL
// =====================================================

box(12, 0.3, 200, materials.road, 0, -0.25, -75);

// =====================================================
// RAILS ET TRAVERSES
// =====================================================

function createTracks() {
    for (let i = 0; i < 3; i++) {
        const x = lanes[i];

        box(0.12, 0.16, 200, materials.rail, x - 0.85, 0, -75);
        box(0.12, 0.16, 200, materials.rail, x + 0.85, 0, -75);

        for (let j = 0; j < 30; j++) {
            const sleeper = box(
                2.05, 0.15, 0.4,
                materials.wood,
                x, -0.05, 12 - j * 6
            );

            movingSleepers.push(sleeper);
        }
    }

    for (let i = 0; i < 65; i++) {
        const stone = box(
            0.16 + Math.random() * 0.12,
            0.07,
            0.16 + Math.random() * 0.12,
            0x77716a,
            (Math.random() - 0.5) * 10,
            -0.05,
            -Math.random() * 180
        );

        movingStones.push(stone);
    }
}

createTracks();

// =====================================================
// IMMEUBLES
// =====================================================

function createBuilding(x, z) {
    const group = new THREE.Group();

    const height = 14 + Math.random() * 12;
    const width = 5 + Math.random() * 2;

    const facade = mat([
        0x29334b,
        0x34344f,
        0x303c54
    ][Math.floor(Math.random() * 3)]);

    box(width, height, 5, facade, 0, height / 2, 0, group);

    box(
        width + 0.4, 0.4, 5.4,
        0x171d32,
        0, height, 0, group
    );

    // Fenêtres simplifiées
    const windowMaterials = [
        mat(0xffd477, 0.4, 0, ),
        mat(0x8edcff, 0.4),
        mat(0xffbd70, 0.4)
    ];

    for (let y = 2; y < height - 2; y += 3) {
        for (let w = -1; w <= 1; w++) {
            if (Math.random() > 0.2) {
                box(
                    0.8, 1.2, 0.08,
                    windowMaterials[Math.floor(Math.random() * 3)],
                    w * 1.35,
                    y,
                    2.55,
                    group
                );
            }
        }
    }

    // Petite guirlande
    for (let i = 0; i < 5; i++) {
        sphere(
            0.09,
            new THREE.MeshBasicMaterial({
                color: [0xff3333, 0xffdd33, 0x33ff99][i % 3]
            }),
            (i - 2) * 0.8,
            height - 1,
            2.7,
            group
        );
    }

    group.position.set(x, 0, z);
    scene.add(group);

    movingBuildings.push(group);
}

for (let i = 0; i < 10; i++) {
    createBuilding(-9, -i * 19);
    createBuilding(9, -i * 19);
}

// =====================================================
// SAPINS DE NOËL
// =====================================================

const treeMaterials = [
    mat(0x08783c),
    mat(0x0a9147),
    mat(0x086534)
];

const ornamentMaterials = [
    new THREE.MeshBasicMaterial({ color: 0xff3333 }),
    new THREE.MeshBasicMaterial({ color: 0xffd700 }),
    new THREE.MeshBasicMaterial({ color: 0x33ccff })
];

function createTree(x, z) {
    const group = new THREE.Group();

    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.3, 1.4, 7),
        materials.trunk
    );

    trunk.position.y = 0.7;
    group.add(trunk);

    for (let i = 0; i < 3; i++) {
        const leaves = new THREE.Mesh(
            new THREE.ConeGeometry(1.7 - i * 0.35, 2.8, 7),
            treeMaterials[i]
        );

        leaves.position.y = 2 + i * 1.15;
        group.add(leaves);
    }

    // Boules
    for (let i = 0; i < 7; i++) {
        const angle = i * 2.4;
        const y = 2 + Math.random() * 3.5;
        const radius = 1.2 - (y - 2) * 0.15;

        sphere(
            0.13,
            ornamentMaterials[i % 3],
            Math.cos(angle) * radius,
            y,
            Math.sin(angle) * radius,
            group
        );
    }

    // Étoile
    const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.3),
        new THREE.MeshBasicMaterial({ color: 0xffdf55 })
    );

    star.position.y = 5.8;
    group.add(star);

    group.position.set(x, 0, z);
    scene.add(group);

    movingTrees.push(group);
}

for (let i = 0; i < 7; i++) {
    createTree(-6, -i * 27);
    createTree(6, -i * 27);
}

// =====================================================
// NEIGE OPTIMISÉE
// =====================================================

function createSnow() {
    snowPositions = new Float32Array(SNOW_COUNT * 3);

    for (let i = 0; i < SNOW_COUNT; i++) {
        snowPositions[i * 3] = (Math.random() - 0.5) * 35;
        snowPositions[i * 3 + 1] = Math.random() * 22;
        snowPositions[i * 3 + 2] = -Math.random() * 100;
    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(snowPositions, 3)
    );

    const materialSnow = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.13,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true,
        depthWrite: false
    });

    snowParticles = new THREE.Points(geometry, materialSnow);
    scene.add(snowParticles);
}

function updateSnow() {
    if (!snowParticles) return;

    for (let i = 0; i < SNOW_COUNT; i++) {
        const index = i * 3;

        snowPositions[index + 1] -= 0.045;
        snowPositions[index] += Math.sin(frame * 0.01 + i) * 0.008;
        snowPositions[index + 2] += speed * 0.15;

        if (
            snowPositions[index + 1] < -1 ||
            snowPositions[index + 2] > 12
        ) {
            snowPositions[index] = (Math.random() - 0.5) * 35;
            snowPositions[index + 1] = 18 + Math.random() * 8;
            snowPositions[index + 2] = -90 - Math.random() * 20;
        }
    }

    snowParticles.geometry.attributes.position.needsUpdate = true;
}

createSnow();

// =====================================================
// PERSONNAGE 3D
// =====================================================

function createPlayer() {
    player = new THREE.Group();

    // Torse
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 1.1, 0.4),
        materials.shirt
    );

    body.position.y = 1.8;
    player.add(body);

    // Tête
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 10, 10),
        materials.skin
    );

    head.position.y = 2.65;
    player.add(head);

    // Cheveux
    sphere(
        0.35,
        mat(0x173b69),
        0,
        2.78,
        0,
        player
    );

    // Bras et jambes
    for (const side of [-1, 1]) {
        const arm = new THREE.Group();

        arm.position.set(side * 0.5, 2.1, 0);

        box(
            0.22, 0.85, 0.22,
            materials.shirt,
            0, -0.4, 0,
            arm
        );

        sphere(0.12, materials.skin, 0, -0.85, 0, arm);

        player.add(arm);
        playerParts.arms.push(arm);

        const leg = new THREE.Group();

        leg.position.set(side * 0.22, 1.25, 0);

        box(
            0.28, 0.85, 0.3,
            materials.pants,
            0, -0.4, 0,
            leg
        );

        box(
            0.38, 0.18, 0.5,
            materials.shoes,
            0, -0.85, -0.08,
            leg
        );

        player.add(leg);
        playerParts.legs.push(leg);
    }

    // Écharpe rouge
    box(0.85, 0.16, 0.5, 0xe52e3d, 0, 2.35, 0, player);

    player.position.set(0, 0, 0);
    scene.add(player);
}

createPlayer();

// =====================================================
// TRAINS
// =====================================================

function createTrain(laneIndex, z) {
    const train = new THREE.Group();

    // Corps principal
    box(2.5, 3.5, 12, materials.train, 0, 2, 0, train);

    // Avant du train
    box(2.3, 1, 0.15, 0x12c5e5, 0, 3, 6.05, train);

    // Pare-brise
    box(1.6, 0.8, 0.1, 0x15213c, 0, 2.8, 6.15, train);

    // Fenêtres latérales
    for (let zPos = -4; zPos <= 4; zPos += 4) {
        box(0.08, 1, 1.6, materials.glass, -1.27, 2.8, zPos, train);
        box(0.08, 1, 1.6, materials.glass, 1.27, 2.8, zPos, train);
    }

    // Bande jaune
    box(2.52, 0.18, 12.05, 0xffcc33, 0, 1.1, 0, train);

    train.position.set(lanes[laneIndex], 0, z);
    scene.add(train);

    obstacles.push({
        object: train,
        type: "train",
        lane: laneIndex
    });
}

// =====================================================
// BARRIÈRES
// =====================================================

function createBarrier(laneIndex, z) {
    const barrier = new THREE.Group();

    box(2.1, 0.75, 0.3, materials.red, 0, 1, 0, barrier);

    for (const side of [-1, 1]) {
        box(
            0.15, 1.3, 0.2,
            materials.white,
            side * 0.8, 0.65, 0,
            barrier
        );
    }

    for (let i = -2; i <= 2; i++) {
        box(
            0.2, 0.8, 0.32,
            materials.white,
            i * 0.4, 1, 0,
            barrier
        );
    }

    barrier.position.set(lanes[laneIndex], 0, z);
    scene.add(barrier);

    obstacles.push({
        object: barrier,
        type: "barrier",
        lane: laneIndex
    });
}

// =====================================================
// PIÈCES
// =====================================================

const coinMaterial = new THREE.MeshStandardMaterial({
    color: 0xffbd32,
    metalness: 0.8,
    roughness: 0.2,
    emissive: 0x995500
});

function createCoin(laneIndex, z) {
    const coin = new THREE.Mesh(
        new THREE.TorusGeometry(0.35, 0.1, 8, 12),
        coinMaterial
    );

    coin.position.set(lanes[laneIndex], 1.3, z);
    scene.add(coin);

    coinObjects.push(coin);
}

// =====================================================
// APPARITION DES OBSTACLES
// =====================================================

function spawnObjects() {
    const laneIndex = Math.floor(Math.random() * 3);

    if (Math.random() < 0.4) {
        createTrain(laneIndex, -105);
    } else {
        createBarrier(laneIndex, -105);
    }

    if (Math.random() < 0.7) {
        const otherLanes = [0, 1, 2].filter(l => l !== laneIndex);
        const coinLane = otherLanes[
            Math.floor(Math.random() * otherLanes.length)
        ];

        for (let i = 0; i < 4; i++) {
            createCoin(coinLane, -75 - i * 3);
        }
    }
}

// =====================================================
// MODES
// =====================================================

function selectMode(mode, button) {
    selectedMode = mode;

    document.querySelectorAll(".mode").forEach(b => {
        b.classList.remove("selected");
    });

    if (button) button.classList.add("selected");
}

window.selectMode = selectMode;

// =====================================================
// DIFFICULTÉ
// =====================================================

function setDifficulty(level, button) {
    difficulty = level;

    document.querySelectorAll(".difficulty-buttons button").forEach(b => {
        b.classList.remove("active");
    });

    if (button) button.classList.add("active");
}

window.setDifficulty = setDifficulty;

// =====================================================
// COMMANDES ZQSD
// =====================================================

function moveLeft() {
    if (!running || paused) return;

    lane = Math.max(0, lane - 1);
    targetX = lanes[lane];
}

function moveRight() {
    if (!running || paused) return;

    lane = Math.min(2, lane + 1);
    targetX = lanes[lane];
}

function jump() {
    if (!running || paused || jumping || sliding) return;

    jumping = true;
    jumpVelocity = 0.23;
}

function slide() {
    if (!running || paused || jumping || sliding) return;

    sliding = true;
    slideTimer = 45;
}

window.addEventListener("keydown", e => {
    const key = e.key.toLowerCase();

    if ([
        "arrowleft", "arrowright",
        "arrowup", "arrowdown", " "
    ].includes(key)) {
        e.preventDefault();
    }

    if (key === "q" || key === "arrowleft") moveLeft();
    if (key === "d" || key === "arrowright") moveRight();
    if (key === "z" || key === "arrowup" || key === " ") jump();
    if (key === "s" || key === "arrowdown") slide();
    if (key === "escape") pauseGame();
});

// =====================================================
// COLLISIONS
// =====================================================

function checkCollisions() {
    for (const obstacle of obstacles) {
        const z = obstacle.object.position.z;

        const sameLane =
            Math.abs(obstacle.object.position.x - player.position.x) < 1.25;

        if (!sameLane) continue;

        if (
            obstacle.type === "train" &&
            z > -7 && z < 1.5
        ) {
            endGame("Tu as percuté un train !");
            return;
        }

        if (
            obstacle.type === "barrier" &&
            z > -1.2 && z < 1.2 &&
            !jumping && !sliding
        ) {
            endGame("Tu as heurté une barrière !");
            return;
        }
    }

    for (let i = coinObjects.length - 1; i >= 0; i--) {
        const coin = coinObjects[i];

        const close =
            Math.abs(coin.position.z) < 1.5 &&
            Math.abs(coin.position.x - player.position.x) < 1.2 &&
            Math.abs(coin.position.y - (1.3 + player.position.y)) < 1.5;

        if (close) {
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

// =====================================================
// ANIMATION DU PERSONNAGE
// =====================================================

function animateRunner() {
    if (jumping || sliding) return;

    const movement = Math.sin(frame * 0.2);

    playerParts.arms[0].rotation.x = movement * 0.8;
    playerParts.arms[1].rotation.x = -movement * 0.8;

    playerParts.legs[0].rotation.x = -movement * 0.9;
    playerParts.legs[1].rotation.x = movement * 0.9;

    player.position.y = Math.abs(Math.sin(frame * 0.2)) * 0.06;
}

// =====================================================
// DÉFILEMENT DU DÉCOR
// =====================================================

function moveEnvironment() {
    movingSleepers.forEach(obj => {
        obj.position.z += speed;

        if (obj.position.z > 20) obj.position.z -= 180;
    });

    movingStones.forEach(obj => {
        obj.position.z += speed;

        if (obj.position.z > 20) obj.position.z -= 200;
    });

    movingBuildings.forEach(obj => {
        obj.position.z += speed;

        if (obj.position.z > 25) obj.position.z -= 190;
    });

    movingTrees.forEach(obj => {
        obj.position.z += speed;

        if (obj.position.z > 20) obj.position.z -= 190;
    });
}

// =====================================================
// DÉPLACEMENT DES OBSTACLES
// =====================================================

function moveObstacles() {
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];

        obstacle.object.position.z += speed;

        if (obstacle.object.position.z > 18) {
            scene.remove(obstacle.object);
            obstacles.splice(i, 1);
        }
    }
}

// =====================================================
// DÉPLACEMENT DES PIÈCES
// =====================================================

function moveCoins() {
    for (let i = coinObjects.length - 1; i >= 0; i--) {
        const coin = coinObjects[i];

        coin.position.z += speed;
        coin.rotation.y += 0.07;

        if (coin.position.z > 18) {
            scene.remove(coin);
            coinObjects.splice(i, 1);
        }
    }
}

// =====================================================
// HUD
// =====================================================

function updateHUD() {
    const scoreEl = document.getElementById("score");
    const coinsEl = document.getElementById("coins");
    const bestEl = document.getElementById("best");

    if (scoreEl) scoreEl.textContent = score;
    if (coinsEl) coinsEl.textContent = coins;
    if (bestEl) bestEl.textContent = best;
}

// =====================================================
// GAME OVER
// =====================================================

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
    const reasonEl = document.getElementById("gameOverReason");
    const finalScore = document.getElementById("finalScore");
    const finalCoins = document.getElementById("finalCoins");

    if (title) title.textContent = "GAME OVER";
    if (reasonEl) reasonEl.textContent = reason;
    if (finalScore) finalScore.textContent = score;
    if (finalCoins) finalCoins.textContent = coins;

    if (gameOver) gameOver.classList.remove("hidden");

    updateHUD();
}

// =====================================================
// BOUCLE DU JEU
// =====================================================

function animate() {
    animationId = requestAnimationFrame(animate);

    if (!running || paused || gameEnded) return;

    frame++;
    score++;

    spawnTimer++;

    const spawnDelay = Math.max(65, 105 - speed * 20);

    if (spawnTimer >= spawnDelay) {
        spawnObjects();
        spawnTimer = 0;
    }

    // Déplacement latéral
    player.position.x += (targetX - player.position.x) * 0.2;

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

    animateRunner();

    moveEnvironment();
    updateSnow();

    moveObstacles();
    moveCoins();

    checkCollisions();

    if (!running) {
        renderer.render(scene, camera);
        return;
    }

    // Caméra
    camera.position.x +=
        (player.position.x * 0.35 - camera.position.x) * 0.08;

    camera.position.y = 5 + player.position.y * 0.25;

    camera.lookAt(player.position.x * 0.2, 1.5, -18);

    updateHUD();

    renderer.render(scene, camera);
}

// =====================================================
// DÉMARRER
// =====================================================

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

    // Nettoyage des anciens objets
    obstacles.forEach(o => scene.remove(o.object));
    coinObjects.forEach(c => scene.remove(c));

    obstacles = [];
    coinObjects = [];

    camera.position.set(0, 5, 9);
    camera.lookAt(0, 1.5, -15);

    const speeds = {
        facile: 0.42,
        normal: 0.55,
        difficile: 0.75,
        extreme: 0.95
    };

    speed = speeds[difficulty] || 0.55;

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
        modeName.textContent =
            selectedMode === "nocoin" ? "NO COIN CHALLENGE" :
            selectedMode === "lava" ? "THE FLOOR IS LAVA" :
            "CLASSIC RUN";
    }

    updateHUD();

    renderer.render(scene, camera);
}

window.startGame = startGame;

// =====================================================
// PAUSE
// =====================================================

function pauseGame() {
    if (!running || gameEnded) return;

    paused = !paused;

    const button = document.querySelector(".gameHeader button");

    if (button) {
        button.textContent = paused ? "▶" : "Ⅱ";
    }
}

window.pauseGame = pauseGame;

// =====================================================
// RETOUR AU MENU
// =====================================================

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

// =====================================================
// REDIMENSIONNEMENT
// =====================================================

function resizeGame() {
    const width = canvas.clientWidth || 900;
    const height = canvas.clientHeight || 450;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height, false);
}

window.addEventListener("resize", resizeGame);

// =====================================================
// INITIALISATION
// =====================================================

updateHUD();
resizeGame();
renderer.render(scene, camera);

animate();

console.log("NEON RUN - Christmas Optimized Edition chargé !");
