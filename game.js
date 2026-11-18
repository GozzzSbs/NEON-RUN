// ============================================
// NEON RUN 3D - THREE.JS
// ============================================

const canvas = document.getElementById("game");

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x101b42);
scene.fog = new THREE.Fog(0x101b42, 35, 150);

const camera = new THREE.PerspectiveCamera(
    65,
    window.innerWidth / window.innerHeight,
    0.1,
    300
);

camera.position.set(0, 5, 9);
camera.lookAt(0, 1, -20);

const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ============================================
// LUMIÈRES
// ============================================

scene.add(new THREE.HemisphereLight(
    0xb8d8ff,
    0x29202b,
    2
));

const sun = new THREE.DirectionalLight(0xffffff, 2);

sun.position.set(-10, 20, 10);
sun.castShadow = true;

scene.add(sun);

// ============================================
// VARIABLES
// ============================================

let running = false;
let paused = false;

let score = 0;
let coins = 0;

let lane = 1;
let targetX = 0;

let jumping = false;
let sliding = false;

let jumpVelocity = 0;
let slideTimer = 0;

let speed = 0.65;

let obstacles = [];
let coinObjects = [];

let player;
let playerParts = {};

const lanePositions = [-3, 0, 3];

// ============================================
// MATÉRIAUX
// ============================================

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

// ============================================
// CRÉER UN OBJET 3D
// ============================================

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

// ============================================
// SOL ET RAILS
// ============================================

box(12, 0.3, 180, roadMaterial, 0, -0.25, -65);

function createTrack() {

    for (let laneIndex = 0; laneIndex < 3; laneIndex++) {

        const x = lanePositions[laneIndex];

        // Deux rails par voie

        box(0.12, 0.16, 180, railMaterial, x - 0.85, 0, -65);
        box(0.12, 0.16, 180, railMaterial, x + 0.85, 0, -65);

        // Traverses

        for (let i = 0; i < 45; i++) {

            box(
                2.05,
                0.18,
                0.45,
                woodMaterial,
                x,
                -0.05,
                15 - i * 4
            );
        }
    }

    // Gravier

    for (let i = 0; i < 450; i++) {

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
            Math.random() * -150
        );

        scene.add(stone);
    }
}

createTrack();

// ============================================
// IMMEUBLES
// ============================================

function createBuilding(x, z) {

    const height = 12 + Math.random() * 20;
    const width = 5 + Math.random() * 3;

    const building = new THREE.Group();

    const body = box(
        width,
        height,
        6,
        0x30334d,
        0,
        height / 2,
        0,
        building
    );

    // Fenêtres lumineuses

    for (let y = 1; y < height - 1; y += 2.5) {

        for (let w = -1; w <= 1; w++) {

            if (Math.random() > 0.25) {

                const windowMesh = box(
                    0.65,
                    1.1,
                    0.12,
                    Math.random() > 0.5 ? 0xffd77a : 0x8fdfff,
                    w * 1.4,
                    y,
                    3.07,
                    building
                );

                windowMesh.material.emissive =
                    windowMesh.material.color;

                windowMesh.material.emissiveIntensity = 0.7;
            }
        }
    }

    building.position.set(x, 0, z);

    scene.add(building);

}

for (let i = 0; i < 22; i++) {

    createBuilding(-9, -i * 9);
    createBuilding(9, -i * 9);
}

// ============================================
// ARBRES
// ============================================

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
}

for (let i = 0; i < 18; i++) {

    createTree(-6, -i * 10);
    createTree(6, -i * 10);
}

// ============================================
// PERSONNAGE 3D
// ============================================

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
        new THREE.SphereGeometry(0.36, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        material(0x173b69)
    );

    hair.position.y = 2.76;
    player.add(hair);

    // Dos du personnage : capuche

    const hood = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 16, 16),
        material(0x168fc1)
    );

    hood.position.set(0, 2.58, 0.05);
    player.add(hood);

    // Bras et jambes articulés

    playerParts.arms = [];
    playerParts.legs = [];

    for (let side of [-1, 1]) {

        // Bras

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

        // Jambes

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

    // Cape décorative

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

// ============================================
// TRAIN 3D
// ============================================

function createTrain(laneIndex, z) {

    const train = new THREE.Group();

    const body = box(
        2.5,
        3.5,
        13,
        0x087f9c,
        0,
        2,
        0,
        train
    );

    // Face avant

    box(
        2.3,
        1.1,
        0.15,
        0x12c5e5,
        0,
        3,
        6.55,
        train
    );

    // Pare-brise

    box(
        1.6,
        0.8,
        0.1,
        0x15213c,
        0,
        2.8,
        6.65,
        train
    );

    // Fenêtres latérales

    for (let zPos = -5; zPos <= 4; zPos += 3) {

        box(
            0.08,
            1,
            1.5,
            0x9eeaff,
            -1.27,
            2.8,
            zPos,
            train
        );

        box(
            0.08,
            1,
            1.5,
            0x9eeaff,
            1.27,
            2.8,
            zPos,
            train
        );
    }

    // Phares

    for (let side of [-1, 1]) {

        const light = new THREE.PointLight(0xffeeaa, 3, 10);

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

    train.position.set(lanePositions[laneIndex], 0, z);

    scene.add(train);

    obstacles.push({
        object: train,
        type: "train",
        lane: laneIndex
    });
}

// ============================================
// BARRIÈRE 3D
// ============================================

function createBarrier(laneIndex, z) {

    const barrier = new THREE.Group();

    box(
        2.1,
        0.8,
        0.3,
        0xe52e3d,
        0,
        1,
        0,
        barrier
    );

    for (let side of [-1, 1]) {

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

    barrier.position.set(lanePositions[laneIndex], 0, z);

    scene.add(barrier);

    obstacles.push({
        object: barrier,
        type: "barrier",
        lane: laneIndex
    });
}

// ============================================
// PIÈCES 3D
// ============================================

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

// ============================================
// GÉNÉRATION
// ============================================

function spawnObjects() {

    const laneIndex = Math.floor(Math.random() * 3);

    const random = Math.random();

    if (random < 0.35) {

        createTrain(laneIndex, -100);

    } else {

        createBarrier(laneIndex, -100);
    }

    if (Math.random() < 0.8) {

        const coinLane = Math.floor(Math.random() * 3);

        for (let i = 0; i < 5; i++) {

            createCoin(coinLane, -75 - i * 3);
        }
    }
}

// ============================================
// CONTRÔLES
// ============================================

function moveLeft() {

    lane = Math.max(0, lane - 1);
    targetX = lanePositions[lane];
}

function moveRight() {

    lane = Math.min(2, lane + 1);
    targetX = lanePositions[lane];
}

function jump() {

    if (!jumping && !sliding) {

        jumping = true;
        jumpVelocity = 0.22;
    }
}

function slide() {

    if (!sliding && !jumping) {

        sliding = true;
        slideTimer = 50;
    }
}

window.addEventListener("keydown", e => {

    const key = e.key.toLowerCase();

    if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(key)) {
        e.preventDefault();
    }

    if (key === "q" || key === "arrowleft") moveLeft();

    if (key === "d" || key === "arrowright") moveRight();

    if (key === "z" || key === "arrowup" || key === " ") jump();

    if (key === "s" || key === "arrowdown") slide();

    if (key === "escape") pauseGame();
});

// ============================================
// COLLISIONS
// ============================================

function checkCollisions() {

    obstacles.forEach(o => {

        if (o.object.position.z > -2 && o.object.position.z < 2) {

            if (o.lane === lane) {

                if (o.type === "train") {

                    endGame();
                }

                if (o.type === "barrier" && !jumping) {

                    endGame();
                }
            }
        }
    });

    coinObjects.forEach((coin, index) => {

        if (
            Math.abs(coin.position.z) < 1.5 &&
            Math.abs(coin.position.x - player.position.x) < 1.5
        ) {

            scene.remove(coin);

            coinObjects.splice(index, 1);

            coins++;
            score += 100;
        }
    });
}

// ============================================
// ANIMATION
// ============================================

let frame = 0;
let spawnTimer = 0;

function animate() {

    requestAnimationFrame(animate);

    if (!running || paused) return;

    frame++;

    score++;

    spawnTimer++;

    if (spawnTimer > 100) {

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

    // Animation de course

    if (!jumping && !sliding) {

        playerParts.arms[0].rotation.x = Math.sin(frame * 0.15) * 0.7;
        playerParts.arms[1].rotation.x = -Math.sin(frame * 0.15) * 0.7;

        playerParts.legs[0].rotation.x = -Math.sin(frame * 0.15) * 0.8;
        playerParts.legs[1].rotation.x = Math.sin(frame * 0.15) * 0.8;
    }

    // Avancer les obstacles

    obstacles.forEach(o => {

        o.object.position.z += speed;
    });

    // Avancer les pièces

    coinObjects.forEach(coin => {

        coin.position.z += speed;

        coin.rotation.y += 0.08;
        coin.rotation.z += 0.04;
    });

    // Nettoyage

    obstacles = obstacles.filter(o => {

        if (o.object.position.z > 15) {

            scene.remove(o.object);

            return false;
        }

        return true;
    });

    coinObjects = coinObjects.filter(coin => {

        if (coin.position.z > 15) {

            scene.remove(coin);

            return false;
        }

        return true;
    });

    checkCollisions();

    // Caméra derrière le joueur

    camera.position.x +=
        (player.position.x * 0.35 - camera.position.x) * 0.08;

    camera.position.y = 5 + player.position.y * 0.3;

    camera.lookAt(
        player.position.x * 0.25,
        1.5,
        -20
    );

    renderer.render(scene, camera);

    updateHUD();
}

// ============================================
// HUD
// ============================================

function updateHUD() {

    const scoreElement = document.getElementById("score");
    const coinElement = document.getElementById("coins");

    if (scoreElement) scoreElement.textContent = score;

    if (coinElement) coinElement.textContent = coins;
}

// ============================================
// FIN DE PARTIE
// ============================================

function endGame() {

    running = false;

    const gameOver = document.getElementById("gameOver");

    if (gameOver) {

        gameOver.classList.remove("hidden");
    }

    const finalScore = document.getElementById("finalScore");

    if (finalScore) {

        finalScore.textContent = score;
    }
}

// ============================================
// DÉMARRAGE
// ============================================

function startGame() {

    score = 0;
    coins = 0;

    lane = 1;
    targetX = 0;

    jumping = false;
    sliding = false;

    player.position.set(0, 0, 0);

    obstacles.forEach(o => scene.remove(o.object));
    coinObjects.forEach(c => scene.remove(c));

    obstacles = [];
    coinObjects = [];

    running = true;
    paused = false;

    const menu = document.getElementById("menu");
    const gameScreen = document.getElementById("gameScreen");
    const gameOver = document.getElementById("gameOver");

    if (menu) menu.classList.add("hidden");
    if (gameScreen) gameScreen.classList.remove("hidden");
    if (gameOver) gameOver.classList.add("hidden");

    animate();
}

// ============================================
// PAUSE
// ============================================

function pauseGame() {

    paused = !paused;
}

// ============================================
// MENU
// ============================================

function backToMenu() {

    running = false;

    const menu = document.getElementById("menu");
    const gameScreen = document.getElementById("gameScreen");

    if (menu) menu.classList.remove("hidden");
    if (gameScreen) gameScreen.classList.add("hidden");
}

// ============================================
// REDIMENSIONNEMENT
// ============================================

window.addEventListener("resize", () => {

    camera.aspect = window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );
});

// Premier rendu

renderer.render(scene, camera);
