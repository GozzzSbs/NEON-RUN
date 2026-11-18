// ======================================================
// NEON RUN 3D - NEON KING EDITION 👑
// Three.js r128 - skin 3D + animations + aura
// Modes: CLASSIC / NO COIN / FLOOR IS LAVA
// Controls: Z/Q/D/S or arrows
// ======================================================

const canvas = document.getElementById("game");
if (!window.THREE) {
    alert("Erreur : Three.js n'est pas chargé.");
    throw new Error("Three.js missing");
}
if (!canvas) throw new Error("Canvas #game introuvable");

// ---------------- SCENE / CAMERA / RENDERER ----------------

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101b42);
scene.fog = new THREE.Fog(0x101b42, 35, 155);

const camera = new THREE.PerspectiveCamera(
    65, (canvas.clientWidth / canvas.clientHeight) || 1, 0.1, 300
);
camera.position.set(0, 5, 9);
camera.lookAt(0, 1.5, -20);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(canvas.clientWidth || window.innerWidth,
                 canvas.clientHeight || window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

scene.add(new THREE.HemisphereLight(0xb8d8ff, 0x29202b, 2));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(-10, 20, 10);
sun.castShadow = true;
scene.add(sun);

// ---------------- GAME STATE ----------------

let running = false, paused = false, gameEnded = false;
let score = 0, coins = 0;
let best = Number(localStorage.getItem("neonBest") || 0);
let lane = 1, targetX = 0;
let jumping = false, sliding = false;
let jumpVelocity = 0, slideTimer = 0;
let speed = 0.65, difficulty = "normal", selectedMode = "classic";
let frame = 0, spawnTimer = 0, animationStarted = false;

const lanePositions = [-3, 0, 3];
let obstacles = [], coinObjects = [];
let movingBuildings = [], movingTrees = [], movingSleepers = [], movingStones = [];
let lavaPlatforms = [], lavaPlatformTimer = 0, lavaLastLane = 1;
let player, playerParts = {};
let lavaGroup = null;
const normalTrackMeshes = [];
const LAVA_PLATFORM_TOP = 0.42;

// ---------------- MATERIAL / HELPERS ----------------

function mat(color, roughness = 0.8, metalness = 0) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
function box(w, h, d, materialOrColor, x, y, z, parent = scene) {
    const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        typeof materialOrColor === "number" ? mat(materialOrColor) : materialOrColor
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
}
function sphere(radius, material, x, y, z, parent, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 14), material);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    parent.add(m);
    return m;
}

const roadMaterial = mat(0x45413d);
const railMaterial = mat(0xaaaaaa, 0.3, 0.8);
const woodMaterial = mat(0x59402d);

// ---------------- TRACK ----------------

const roadMesh = box(12, 0.3, 200, roadMaterial, 0, -0.25, -75);
normalTrackMeshes.push(roadMesh);

function createTrack() {
    for (let i = 0; i < 3; i++) {
        const x = lanePositions[i];
        normalTrackMeshes.push(box(0.12, 0.16, 200, railMaterial, x - 0.85, 0, -75));
        normalTrackMeshes.push(box(0.12, 0.16, 200, railMaterial, x + 0.85, 0, -75));
        for (let j = 0; j < 50; j++) {
            const sleeper = box(2.05, 0.18, 0.45, woodMaterial, x, -0.05, 15 - j * 4);
            movingSleepers.push(sleeper);
            normalTrackMeshes.push(sleeper);
        }
    }
    for (let i = 0; i < 300; i++) {
        const stone = new THREE.Mesh(
            new THREE.BoxGeometry(0.1 + Math.random() * 0.2, 0.08, 0.1 + Math.random() * 0.2),
            mat(0x77716a)
        );
        stone.position.set((Math.random() - 0.5) * 11, -0.02, Math.random() * -180);
        scene.add(stone);
        movingStones.push(stone);
        normalTrackMeshes.push(stone);
    }
}
createTrack();

// ---------------- CITY / TREES ----------------

function createBuilding(x, z) {
    const height = 12 + Math.random() * 20;
    const width = 5 + Math.random() * 3;
    const g = new THREE.Group();
    box(width, height, 6, 0x30334d, 0, height / 2, 0, g);
    for (let y = 1; y < height - 1; y += 2.5) {
        for (let w = -1; w <= 1; w++) {
            if (Math.random() > 0.25) {
                const win = box(0.65, 1.1, 0.12,
                    Math.random() > 0.5 ? 0xffd77a : 0x8fdfff,
                    w * 1.4, y, 3.07, g);
                win.material.emissive = win.material.color;
                win.material.emissiveIntensity = 0.7;
            }
        }
    }
    g.position.set(x, 0, z);
    scene.add(g);
    movingBuildings.push(g);
}
for (let i = 0; i < 22; i++) {
    createBuilding(-9, -i * 9);
    createBuilding(9, -i * 9);
}

function createTree(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2), mat(0x65402b));
    trunk.position.y = 1;
    g.add(trunk);
    for (let i = 0; i < 3; i++) {
        const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.8 - i * 0.3, 3, 8), mat(0x148d48));
        leaves.position.y = 2.5 + i * 1.5;
        g.add(leaves);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    movingTrees.push(g);
}
for (let i = 0; i < 18; i++) {
    createTree(-6, -i * 10);
    createTree(6, -i * 10);
}

// ---------------- NEON KING PLAYER MODEL ----------------

function createPlayer() {
    player = new THREE.Group();

    const purple = mat(0x7900c9, 0.55, 0.1);
    const darkPurple = mat(0x35004f);
    const black = mat(0x171522, 0.72);
    const green = mat(0xbaff00, 0.45, 0.05);
    const white = mat(0xffedcf);
    const skin = mat(0xffb17d);
    const brown = mat(0x3b170d);
    const neonGreen = new THREE.MeshStandardMaterial({
        color: 0xbaff00, emissive: 0x83ff00, emissiveIntensity: 1.6,
        roughness: 0.35
    });
    const neonPurple = new THREE.MeshStandardMaterial({
        color: 0x9c00ff, emissive: 0x6600ff, emissiveIntensity: 1.1
    });

    const torso = new THREE.Group();
    torso.position.set(0, 0, 0);
    player.add(torso);
    playerParts.torso = torso;

    box(0.95, 1.05, 0.48, black, 0, 1.85, 0, torso);
    box(0.65, 0.85, 0.08, white, 0, 1.83, 0.27, torso);

    sphere(0.17, neonGreen, 0, 1.91, 0.34, torso, 1.15, 0.8, 0.22);
    box(0.045, 0.07, 0.025, black, -0.07, 1.94, 0.385, torso);
    box(0.045, 0.07, 0.025, black, 0.07, 1.94, 0.385, torso);
    box(0.12, 0.025, 0.02, black, 0, 1.84, 0.385, torso);

    sphere(0.42, skin, 0, 2.75, 0, torso, 1, 1.08, 0.95);
    sphere(0.44, brown, 0, 3.00, -0.04, torso, 1.08, 0.68, 0.95);
    for (const side of [-1, 1]) {
        sphere(0.22, brown, side * 0.37, 2.83, 0.01, torso, 1.25, 0.7, 0.8);
        sphere(0.075, mat(0x24120b), side * 0.15, 2.79, 0.365, torso);
        box(0.17, 0.055, 0.05, brown, side * 0.15, 2.91, 0.36, torso);
    }
    sphere(0.07, skin, 0, 2.68, 0.39, torso);
    box(0.18, 0.035, 0.025, brown, 0, 2.57, 0.38, torso);

    sphere(0.48, purple, 0, 3.25, 0, torso, 1, 0.9, 0.95);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.23, 24), darkPurple);
    brim.position.set(0, 3.05, 0);
    brim.castShadow = true;
    torso.add(brim);
    sphere(0.12, purple, 0, 3.67, 0, torso);
    box(0.34, 0.055, 0.035, neonGreen, 0, 3.35, 0.43, torso);
    for (let i = -1; i <= 1; i++) {
        const point = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 4), neonGreen);
        point.position.set(i * 0.13, 3.45, 0.43);
        torso.add(point);
    }

    for (const side of [-1, 1]) {
        sphere(0.22, black, side * 0.46, 2.55, 0, torso, 0.55, 1, 0.85);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 10, 24), neonGreen);
        ring.position.set(side * 0.49, 2.55, 0.07);
        ring.scale.set(0.7, 1, 1);
        torso.add(ring);
    }

    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.1, 12, 24), darkPurple);
    hood.position.set(0, 2.3, -0.25);
    hood.rotation.x = Math.PI / 2;
    torso.add(hood);

    box(0.42, 0.07, 0.025, neonGreen, 0, 1.95, -0.265, torso);
    box(0.07, 0.22, 0.025, neonGreen, -0.15, 1.83, -0.265, torso);
    box(0.07, 0.22, 0.025, neonGreen, 0.15, 1.83, -0.265, torso);

    playerParts.arms = [];
    for (const side of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(side * 0.52, 2.18, 0);
        const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.68, 12),
            side < 0 ? green : purple);
        sleeve.rotation.z = side * -0.13;
        sleeve.position.y = -0.31;
        arm.add(sleeve);
        const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.15, 12), black);
        cuff.position.y = -0.65;
        arm.add(cuff);
        sphere(0.13, skin, 0, -0.76, 0, arm);
        player.add(arm);
        playerParts.arms.push(arm);
    }

    playerParts.legs = [];
    for (const side of [-1, 1]) {
        const leg = new THREE.Group();
        leg.position.set(side * 0.23, 1.2, 0);

        const pants = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.19, 0.78, 12), black);
        pants.position.y = -0.34;
        leg.add(pants);

        box(0.28, 0.31, 0.12, darkPurple, side * 0.12, -0.30, 0.15, leg);
        box(0.13, 0.07, 0.035, neonGreen, side * 0.12, -0.28, 0.22, leg);

        box(0.46, 0.17, 0.67, white, 0, -0.78, 0.08, leg);
        box(0.43, 0.25, 0.50, purple, 0, -0.59, 0.04, leg);
        box(0.44, 0.08, 0.50, neonGreen, 0, -0.70, 0.04, leg);
        box(0.25, 0.08, 0.08, white, 0, -0.53, 0.31, leg);

        player.add(leg);
        playerParts.legs.push(leg);
    }

    playerParts.aura = new THREE.Group();
    player.add(playerParts.aura);

    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.025, 8, 64), neonPurple);
    ring1.rotation.x = Math.PI / 2;
    ring1.position.y = 0.18;
    playerParts.aura.add(ring1);

    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.018, 8, 64), neonGreen);
    ring2.rotation.x = Math.PI / 2;
    ring2.position.y = 0.28;
    playerParts.aura.add(ring2);

    playerParts.sparkles = [];
    for (let i = 0; i < 8; i++) {
        const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.055), i % 2 ? neonGreen : neonPurple);
        playerParts.aura.add(spark);
        playerParts.sparkles.push(spark);
    }

    player.position.set(0, 0, 0);
    scene.add(player);
}
createPlayer();

// ---------------- TRAINS / BARRIERS ----------------

function createTrain(laneIndex, z) {
    const train = new THREE.Group();
    box(2.5, 3.5, 13, 0x087f9c, 0, 2, 0, train);
    box(2.3, 1.1, 0.15, 0x12c5e5, 0, 3, 6.55, train);
    box(1.6, 0.8, 0.1, 0x15213c, 0, 2.8, 6.65, train);
    for (let zp = -5; zp <= 4; zp += 3) {
        box(0.08, 1, 1.5, 0x9eeaff, -1.27, 2.8, zp, train);
        box(0.08, 1, 1.5, 0x9eeaff, 1.27, 2.8, zp, train);
    }
    for (const side of [-1, 1]) {
        const light = new THREE.PointLight(0xffeeaa, 3, 10);
        light.position.set(side * 0.8, 0.8, 7);
        train.add(light);
        box(0.35, 0.35, 0.15, 0xffee99, side * 0.8, 0.8, 6.7, train);
    }
    train.position.set(lanePositions[laneIndex], 0, z);
    scene.add(train);
    obstacles.push({ object: train, type: "train", lane: laneIndex });
}

function createBarrier(laneIndex, z) {
    const barrier = new THREE.Group();
    box(2.1, 0.8, 0.3, 0xe52e3d, 0, 1, 0, barrier);
    for (const side of [-1, 1]) box(0.15, 1.3, 0.2, 0xdddddd, side * 0.8, 0.65, 0, barrier);
    for (let i = -2; i <= 2; i++) box(0.2, 0.85, 0.32, 0xffffff, i * 0.4, 1, 0, barrier);
    barrier.position.set(lanePositions[laneIndex], 0, z);
    scene.add(barrier);
    obstacles.push({ object: barrier, type: "barrier", lane: laneIndex });
}

// ---------------- COINS ----------------

function createCoin(laneIndex, z) {
    const coin = new THREE.Mesh(
        new THREE.TorusGeometry(0.4, 0.12, 12, 24),
        new THREE.MeshStandardMaterial({
            color: 0xffbd32, metalness: 0.8, roughness: 0.2, emissive: 0x995500
        })
    );
    coin.position.set(lanePositions[laneIndex], 1.3, z);
    scene.add(coin);
    coinObjects.push(coin);
}

// ---------------- LAVA WORLD / PLATFORMS ----------------

function createLavaEnvironment() {
    if (lavaGroup) return;
    lavaGroup = new THREE.Group();

    const lava = new THREE.Mesh(
        new THREE.PlaneGeometry(22, 230),
        new THREE.MeshStandardMaterial({
            color: 0xff3b08, emissive: 0xff2600, emissiveIntensity: 1.15,
            roughness: 0.32, metalness: 0.05
        })
    );
    lava.rotation.x = -Math.PI / 2;
    lava.position.set(0, -0.48, -78);
    lavaGroup.add(lava);

    const glow = new THREE.MeshBasicMaterial({ color: 0xffa01a, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 65; i++) {
        const crack = new THREE.Mesh(
            new THREE.BoxGeometry(0.08 + Math.random() * 0.18, 0.025, 1.2 + Math.random() * 3),
            glow
        );
        crack.position.set((Math.random() - 0.5) * 18, -0.445, -180 + Math.random() * 210);
        crack.rotation.y = (Math.random() - 0.5) * 0.8;
        crack.userData.isLavaCrack = true;
        lavaGroup.add(crack);
    }
    scene.add(lavaGroup);
    const lavaLight = new THREE.PointLight(0xff3b12, 2.2, 38);
    lavaLight.position.set(0, 2.5, -8);
    lavaGroup.add(lavaLight);
}

function setLavaVisuals(enabled) {
    createLavaEnvironment();
    normalTrackMeshes.forEach(m => m.visible = !enabled);
    lavaGroup.visible = enabled;
    scene.background = new THREE.Color(enabled ? 0x260b12 : 0x101b42);
    scene.fog.color.set(enabled ? 0x3b1010 : 0x101b42);
    scene.fog.near = enabled ? 18 : 35;
    scene.fog.far = enabled ? 115 : 155;
}

function createLavaPlatform(laneIndex, z, width = 2.55, depth = 5.2) {
    const platform = new THREE.Group();
    const rock = new THREE.Mesh(new THREE.BoxGeometry(width, 0.55, depth), mat(0x40332e, 0.95));
    rock.position.y = -0.02;
    rock.castShadow = true;
    rock.receiveShadow = true;
    platform.add(rock);

    const top = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(0.5, width - 0.2), 0.12, Math.max(0.5, depth - 0.2)),
        mat(0x716052, 1)
    );
    top.position.y = 0.31;
    platform.add(top);

    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xff5a12 });
    for (const side of [-1, 1]) {
        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, depth), edgeMat);
        edge.position.set(side * (width / 2 - 0.1), 0.34, 0);
        platform.add(edge);
    }

    platform.position.set(lanePositions[laneIndex], 0, z);
    platform.userData.width = width;
    platform.userData.depth = depth;
    scene.add(platform);
    lavaPlatforms.push({ object: platform, lane: laneIndex });
}

function spawnLavaSegment(z) {
    const choices = [lavaLastLane];
    if (lavaLastLane > 0) choices.push(lavaLastLane - 1);
    if (lavaLastLane < 2) choices.push(lavaLastLane + 1);
    const nextLane = choices[Math.floor(Math.random() * choices.length)];
    lavaLastLane = nextLane;
    createLavaPlatform(nextLane, z);

    if (Math.random() < 0.38) {
        const others = [0, 1, 2].filter(v => v !== nextLane);
        createLavaPlatform(others[Math.floor(Math.random() * others.length)], z);
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
    for (let i = 0; i < 9; i++) spawnLavaSegment(-77 - i * 12);
}

function moveLavaPlatforms() {
    if (selectedMode !== "lava") return;
    lavaPlatformTimer++;
    lavaPlatforms.forEach(item => item.object.position.z += speed);
    lavaPlatforms = lavaPlatforms.filter(item => {
        if (item.object.position.z > 18) {
            scene.remove(item.object);
            return false;
        }
        return true;
    });

    if (lavaPlatformTimer >= Math.max(10, Math.round(12 / Math.max(speed, 0.3))) && lavaPlatforms.length) {
        const furthestZ = lavaPlatforms.reduce((m, item) => Math.min(m, item.object.position.z), 0);
        spawnLavaSegment(furthestZ - 12);
        lavaPlatformTimer = 0;
    }

    if (lavaGroup) {
        lavaGroup.children.forEach(child => {
            if (child.userData.isLavaCrack) {
                child.position.z += speed * 0.7;
                if (child.position.z > 18) child.position.z -= 210;
            }
        });
    }
}

function isPlayerAboveLavaPlatform() {
    return lavaPlatforms.some(item => {
        const p = item.object;
        const w = p.userData.width || 2.55;
        const d = p.userData.depth || 5.2;
        return Math.abs(p.position.x - player.position.x) < w / 2 - 0.15 &&
               Math.abs(p.position.z) < d / 2 - 0.15;
    });
}// ---------------- SPAWNING ----------------

function spawnObjects() {
    const laneIndex = Math.floor(Math.random() * 3);
    if (Math.random() < 0.55) createTrain(laneIndex, -110);
    else createBarrier(laneIndex, -110);

    if (selectedMode === "lava") return;

    if (Math.random() < 0.95) {
        const possible = [0, 1, 2].filter(l => l !== laneIndex);
        const coinLane = possible[Math.floor(Math.random() * possible.length)];
        for (let i = 0; i < 9; i++) createCoin(coinLane, -65 - i * 2.5);

        if (Math.random() < 0.55) {
            const other = [0, 1, 2].filter(l => l !== laneIndex && l !== coinLane)[0];
            for (let i = 0; i < 6; i++) createCoin(other, -75 - i * 3);
        }
    }
}

// ---------------- MODE / DIFFICULTY ----------------

function selectMode(mode, button) {
    selectedMode = mode;
    document.querySelectorAll(".mode-buttons button").forEach(b => b.classList.remove("active"));
    if (button) button.classList.add("active");

    const descriptions = {
        classic: "Évite les trains et les barrières. Ramasse les pièces et bats ton record !",
        nocoin: "Attention : toucher une seule pièce provoque immédiatement un GAME OVER !",
        lava: "Le sol est de la lave ! Saute de plateforme en plateforme pour survivre."
    };
    const description = document.getElementById("modeDescription");
    if (description) description.textContent = descriptions[mode] || descriptions.classic;
}
window.selectMode = selectMode;

function setDifficulty(level, button) {
    difficulty = level;
    document.querySelectorAll(".difficulty-buttons button").forEach(b => b.classList.remove("active"));
    if (button) button.classList.add("active");
    const speeds = { facile: 0.45, normal: 0.65, difficile: 0.85, extreme: 1.1 };
    speed = speeds[level] || 0.65;
}
window.setDifficulty = setDifficulty;

// ---------------- INPUT ----------------

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
    sliding = true;
    slideTimer = 50;
}

window.addEventListener("keydown", e => {
    const key = e.key.toLowerCase();
    if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(key)) e.preventDefault();
    if (key === "q" || key === "arrowleft") moveLeft();
    if (key === "d" || key === "arrowright") moveRight();
    if (key === "z" || key === "arrowup" || key === " ") jump();
    if (key === "s" || key === "arrowdown") slide();
    if (key === "escape") pauseGame();
});

// ---------------- COLLISIONS ----------------

function checkCollisions() {
    if (selectedMode === "lava" && !jumping && !isPlayerAboveLavaPlatform()) {
        endGame("Tombé dans la lave !");
        return;
    }

    for (const obstacle of obstacles) {
        const z = obstacle.object.position.z;
        const sameLane = Math.abs(obstacle.object.position.x - player.position.x) < 1.25;
        if (!sameLane) continue;

        if (obstacle.type === "train" && z > -7 && z < 2) {
            endGame("Tu as percuté un train !");
            return;
        }
        if (obstacle.type === "barrier" && z > -1.3 && z < 1.3 && !jumping && !sliding) {
            endGame(selectedMode === "lava" ? "Tu te cognes aux murs !" : "Tu as heurté une barrière !");
            return;
        }
    }

    for (let i = coinObjects.length - 1; i >= 0; i--) {
        const coin = coinObjects[i];
        if (Math.abs(coin.position.z) < 1.5 &&
            Math.abs(coin.position.x - player.position.x) < 1.2 &&
            Math.abs(coin.position.y - (1.3 + player.position.y)) < 1.5) {
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

// ---------------- PLAYER ANIMATIONS ----------------

function animateRunner() {
    const t = frame * 0.18;
    const torso = playerParts.torso;
    const arms = playerParts.arms;
    const legs = playerParts.legs;

    playerParts.aura.rotation.y += 0.035;
    playerParts.aura.children[0].rotation.z += 0.025;
    playerParts.aura.children[1].rotation.z -= 0.02;

    playerParts.sparkles.forEach((spark, i) => {
        const a = t * 0.7 + i * Math.PI * 2 / playerParts.sparkles.length;
        spark.position.set(Math.cos(a) * 0.83, 1.15 + Math.sin(a * 1.4) * 0.45, Math.sin(a) * 0.45);
        spark.rotation.x += 0.06;
        spark.rotation.y += 0.08;
    });

    if (jumping) {
        torso.position.y = THREE.MathUtils.lerp(torso.position.y, 0.03, 0.25);
        torso.rotation.x = THREE.MathUtils.lerp(torso.rotation.x, -0.08, 0.2);
        arms[0].rotation.z = THREE.MathUtils.lerp(arms[0].rotation.z, 0.75, 0.25);
        arms[1].rotation.z = THREE.MathUtils.lerp(arms[1].rotation.z, -0.75, 0.25);
        arms[0].rotation.x = THREE.MathUtils.lerp(arms[0].rotation.x, -0.25, 0.2);
        arms[1].rotation.x = THREE.MathUtils.lerp(arms[1].rotation.x, -0.25, 0.2);
        legs[0].rotation.x = THREE.MathUtils.lerp(legs[0].rotation.x, -0.55, 0.2);
        legs[1].rotation.x = THREE.MathUtils.lerp(legs[1].rotation.x, 0.45, 0.2);
        player.position.y += 0;
    } else if (sliding) {
        torso.position.y = THREE.MathUtils.lerp(torso.position.y, -0.42, 0.3);
        torso.rotation.x = THREE.MathUtils.lerp(torso.rotation.x, 0.55, 0.25);
        arms[0].rotation.z = THREE.MathUtils.lerp(arms[0].rotation.z, 0.2, 0.25);
        arms[1].rotation.z = THREE.MathUtils.lerp(arms[1].rotation.z, -0.2, 0.25);
        arms[0].rotation.x = THREE.MathUtils.lerp(arms[0].rotation.x, -0.8, 0.25);
        arms[1].rotation.x = THREE.MathUtils.lerp(arms[1].rotation.x, -0.8, 0.25);
        legs[0].rotation.x = THREE.MathUtils.lerp(legs[0].rotation.x, -1.0, 0.25);
        legs[1].rotation.x = THREE.MathUtils.lerp(legs[1].rotation.x, 0.8, 0.25);
    } else {
        torso.position.y = THREE.MathUtils.lerp(torso.position.y, 0, 0.25);
        torso.rotation.x = THREE.MathUtils.lerp(torso.rotation.x, 0, 0.25);
        arms[0].rotation.z = THREE.MathUtils.lerp(arms[0].rotation.z, 0, 0.2);
        arms[1].rotation.z = THREE.MathUtils.lerp(arms[1].rotation.z, 0, 0.2);
        arms[0].rotation.x = Math.sin(t) * 0.75;
        arms[1].rotation.x = -Math.sin(t) * 0.75;
        legs[0].rotation.x = -Math.sin(t) * 0.85;
        legs[1].rotation.x = Math.sin(t) * 0.85;
    }

    const pulse = 1 + Math.sin(frame * 0.12) * 0.045;
    playerParts.aura.scale.set(pulse, 1, pulse);
}

// ---------------- WORLD MOVEMENT ----------------

function moveEnvironment() {
    movingSleepers.forEach(s => {
        s.position.z += speed;
        if (s.position.z > 20) s.position.z -= 200;
    });
    movingStones.forEach(s => {
        s.position.z += speed;
        if (s.position.z > 20) s.position.z -= 200;
    });
    movingBuildings.forEach(b => {
        b.position.z += speed;
        if (b.position.z > 25) b.position.z -= 198;
    });
    movingTrees.forEach(t => {
        t.position.z += speed;
        if (t.position.z > 20) t.position.z -= 180;
    });
}

function moveObstacles() {
    obstacles.forEach(o => {
        o.object.position.z += o.type === "train" ? speed * 1.35 : speed;
        if (o.type === "train") o.object.position.y = Math.sin(frame * 0.12) * 0.035;
    });
    obstacles = obstacles.filter(o => {
        if (o.object.position.z > 18) {
            scene.remove(o.object);
            return false;
        }
        return true;
    });
}

function moveCoins() {
    coinObjects.forEach(c => {
        c.position.z += speed;
        c.rotation.y += 0.08;
        c.rotation.z += 0.04;
    });
    coinObjects = coinObjects.filter(c => {
        if (c.position.z > 18) {
            scene.remove(c);
            return false;
        }
        return true;
    });
}

// ---------------- HUD / GAME OVER ----------------

function updateHUD() {
    const scoreEl = document.getElementById("score");
    const coinEl = document.getElementById("coins");
    const bestEl = document.getElementById("best");
    if (scoreEl) scoreEl.textContent = score;
    if (coinEl) coinEl.textContent = coins;
    if (bestEl) bestEl.textContent = best;
}

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
    if (reasonEl) reasonEl.textContent = reason || "Fin de la partie !";
    if (finalScore) finalScore.textContent = score;
    if (finalCoins) finalCoins.textContent = coins;
    if (gameOver) gameOver.classList.remove("hidden");
    updateHUD();
}

// ---------------- MAIN LOOP ----------------

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

    player.position.x += (targetX - player.position.x) * 0.18;

    if (jumping) {
        player.position.y += jumpVelocity;
        jumpVelocity -= selectedMode === "lava" ? 0.035 : 0.012;

        const landingHeight = selectedMode === "lava" ? LAVA_PLATFORM_TOP : 0;
        if (player.position.y <= landingHeight) {
            player.position.y = landingHeight;
            jumping = false;
            jumpVelocity = 0;
            if (sliding) slideTimer = Math.max(slideTimer, 35);

            if (selectedMode === "lava" && !isPlayerAboveLavaPlatform()) {
                endGame("Tombé dans la lave !");
                return;
            }
        }
    }

    if (sliding) {
        slideTimer--;
        if (slideTimer <= 0) {
            sliding = false;
            slideTimer = 0;
        }
    }

    if (selectedMode === "lava" && !jumping) player.position.y = LAVA_PLATFORM_TOP;
    if (selectedMode !== "lava" && !jumping) {
        player.position.y = Math.abs(Math.sin(frame * 0.18)) * 0.06;
    }

    animateRunner();
    moveEnvironment();
    moveLavaPlatforms();
    moveObstacles();
    moveCoins();
    checkCollisions();
    if (!running) return;

    camera.position.x += (player.position.x * 0.35 - camera.position.x) * 0.08;
    camera.position.y = 5 + player.position.y * 0.3;
    camera.lookAt(player.position.x * 0.25, 1.5, -20);

    updateHUD();
    renderer.render(scene, camera);
}

// ---------------- START / PAUSE / MENU ----------------

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

    player.position.set(0, selectedMode === "lava" ? LAVA_PLATFORM_TOP : 0, 0);
    player.rotation.set(0, 0, 0);
    player.scale.set(1, 1, 1);
    playerParts.torso.position.set(0, 0, 0);
    playerParts.torso.rotation.set(0, 0, 0);
    playerParts.arms.forEach(a => a.rotation.set(0, 0, 0));
    playerParts.legs.forEach(l => l.rotation.set(0, 0, 0));

    obstacles.forEach(o => scene.remove(o.object));
    coinObjects.forEach(c => scene.remove(c));
    obstacles = [];
    coinObjects = [];

    setLavaVisuals(selectedMode === "lava");
    resetLavaPlatforms();

    camera.position.set(0, 5, 9);
    camera.lookAt(0, 1.5, -20);

    const speeds = { facile: 0.45, normal: 0.65, difficile: 0.85, extreme: 1.1 };
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
        modeName.textContent =
            selectedMode === "nocoin" ? "NO COIN" :
            selectedMode === "lava" ? "THE FLOOR IS LAVA" : "CLASSIC RUN";
    }

    updateHUD();
    renderer.render(scene, camera);

    if (!animationStarted) {
        animationStarted = true;
        animate();
    }
}
window.startGame = startGame;

function pauseGame() {
    if (!running || gameEnded) return;
    paused = !paused;
    document.querySelectorAll(".gameHeader button").forEach(button => {
        if (button.textContent.includes("PAUSE") || button.textContent.includes("REPRENDRE")) {
            button.textContent = paused ? "▶ REPRENDRE" : "Ⅱ PAUSE";
        }
    });
}
window.pauseGame = pauseGame;

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

// ---------------- RESIZE / FIRST RENDER ----------------

window.addEventListener("resize", () => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
});

updateHUD();
renderer.render(scene, camera);
console.log("NEON RUN 3D - NEON KING chargé correctement !");
