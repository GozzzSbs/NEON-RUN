// ============================================
// NEON RUN - MOTEUR DE JEU
// Vue de dos en perspective, style endless runner
// ============================================

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;

// ============================================
// SKINS
// ============================================

const skins = [
    {name:"VOLT",icon:"⚡",color:"#46f3e5",dark:"#087d83"},
    {name:"BLAZE",icon:"🔥",color:"#ff704d",dark:"#a52d25"},
    {name:"PIXEL",icon:"👾",color:"#b58cff",dark:"#6238a3"},
    {name:"NINJA",icon:"🥷",color:"#c3d0e8",dark:"#39445d"},
    {name:"LIME",icon:"🍀",color:"#a8f05b",dark:"#477c23"},
    {name:"ROSE",icon:"💗",color:"#ff70b7",dark:"#a52d70"},
    {name:"FROST",icon:"❄️",color:"#8edbff",dark:"#397ba9"},
    {name:"GOLD",icon:"👑",color:"#ffd36a",dark:"#9c6a15"}
];

let selectedSkin = 0;
let selectedMode = "classic";

// ============================================
// VARIABLES
// ============================================

let player;

let obstacles = [];
let coins = [];

let score = 0;
let coinCount = 0;
let speed = 1;
let frame = 0;

let running = false;
let paused = false;
let animation = null;

let roadOffset = 0;

const LANE_COUNT = 3;

// ============================================
// MENU
// ============================================

function selectMode(mode, button) {

    selectedMode = mode;

    document.querySelectorAll(".mode").forEach(b => {
        b.classList.remove("selected");
    });

    if(button) {
        button.classList.add("selected");
    }
}

function chooseSkin(index) {

    selectedSkin = index;

    document.getElementById("character").textContent =
        skins[index].icon;

    document.getElementById("skinName").textContent =
        skins[index].name;
}

// ============================================
// DÉMARRER
// ============================================

function startGame() {

    cancelAnimationFrame(animation);

    document.getElementById("menu").classList.add("hidden");
    document.getElementById("gameScreen").classList.remove("hidden");
    document.getElementById("gameOver").classList.add("hidden");

    const names = {
        classic:"CLASSIC RUN",
        nocoin:"NO COIN CHALLENGE",
        lava:"THE FLOOR IS LAVA"
    };

    document.getElementById("modeName").textContent =
        names[selectedMode];

    score = 0;
    coinCount = 0;
    speed = 1;
    frame = 0;
    roadOffset = 0;

    obstacles = [];
    coins = [];

    player = {
        lane:1,
        visualLane:1,

        jumping:false,
        jumpTimer:0,

        sliding:false,
        slideTimer:0,

        animation:0
    };

    running = true;
    paused = false;

    updateStats();
    draw();

    animation = requestAnimationFrame(loop);
}

// ============================================
// DÉPLACEMENT
// ============================================

function moveLeft() {

    if(!running || paused) return;

    player.lane = Math.max(0, player.lane - 1);
}

function moveRight() {

    if(!running || paused) return;

    player.lane = Math.min(2, player.lane + 1);
}

function jump() {

    if(!running || paused) return;

    if(!player.jumping && !player.sliding) {

        player.jumping = true;
        player.jumpTimer = 0;
    }
}

function slide() {

    if(!running || paused) return;

    if(!player.jumping && !player.sliding) {

        player.sliding = true;
        player.slideTimer = 0;
    }
}

// ============================================
// PAUSE
// ============================================

function pauseGame() {

    if(!running) return;

    paused = !paused;

    if(!paused) {
        animation = requestAnimationFrame(loop);
    } else {
        draw();
    }
}

// ============================================
// STATISTIQUES
// ============================================

function updateStats() {

    document.getElementById("score").textContent = score;
    document.getElementById("coins").textContent = coinCount;

    document.getElementById("best").textContent =
        localStorage.getItem("neonBest") || 0;
}

// ============================================
// GÉOMÉTRIE DE LA ROUTE
// ============================================

function roadWidthAt(t) {

    return W * (0.10 + t * 0.39);
}

function roadCenterAt(t) {

    return W / 2;
}

function laneX(lane, t) {

    const width = roadWidthAt(t);
    const center = roadCenterAt(t);

    return center + (lane - 1) * width * 0.31;
}

function projectY(t) {

    const horizon = H * 0.24;
    const bottom = H * 0.91;

    return horizon + (bottom - horizon) * t;
}

// ============================================
// CRÉATION DES OBSTACLES
// ============================================

function spawn() {

    const lane = Math.floor(Math.random() * 3);

    if (selectedMode === "lava") {

        obstacles.push({
            lane: lane,
            z: 0.02,
            type: "gap"
        });

    } else {

        const random = Math.random();

        let type;

        if (random < 0.35) {
            type = "train";
        } else if (random < 0.75) {
            type = "barrier";
        } else {
            type = "overhead";
        }

        obstacles.push({
            lane: lane,
            z: 0.02,
            type: type
        });
    }

    if (selectedMode !== "lava" && Math.random() < 0.8) {

        const coinLane = Math.floor(Math.random() * 3);

        for (let i = 0; i < 4; i++) {

            coins.push({
                lane: coinLane,
                z: -0.2 - i * 0.10,
                collected: false
            });
        }
    }
}

    // Pièces

    if(selectedMode !== "lava" && Math.random() < 0.8) {

        const coinLane = Math.floor(Math.random() * 3);

        for(let i=0;i<4;i++) {

            coins.push({
                lane:coinLane,
                z:-0.2 - i*0.10,
                collected:false
            });
        }
    }
}

// ============================================
// FIN DE PARTIE
// ============================================

function endGame(reason) {

    if(!running) return;

    running = false;

    cancelAnimationFrame(animation);

    let best = Number(localStorage.getItem("neonBest") || 0);

    if(score > best) {

        localStorage.setItem("neonBest",score);
    }

    document.getElementById("finalScore").textContent = score;
    document.getElementById("finalCoins").textContent = coinCount;

    document.getElementById("gameOverTitle").textContent =
        reason === "coin" ? "COIN TOUCHÉE !" : "GAME OVER";

    document.getElementById("gameOverReason").textContent =
        reason === "coin"
        ? "Tu as ramassé une pièce dans le mode No Coin !"
        : reason === "lava"
        ? "Tu es tombé dans la lave !"
        : reason === "obstacle"
        ? "Tu as percuté un obstacle !"
        : "Fin de la partie !";

    document.getElementById("gameOver").classList.remove("hidden");
}

// ============================================
// MISE À JOUR DU JEU
// ============================================

function update() {

    frame++;

    score++;

    speed = Math.min(2.4, 1 + score / 12000);

    roadOffset += speed * 0.015;

    // Déplacement fluide entre les voies

    player.visualLane +=
        (player.lane - player.visualLane) * 0.22;

    player.animation += 0.22 * speed;

    // Saut

    if(player.jumping) {

        player.jumpTimer++;

        if(player.jumpTimer > 38) {

            player.jumping = false;
            player.jumpTimer = 0;
        }
    }

    // Glissade

    if(player.sliding) {

        player.slideTimer++;

        if(player.slideTimer > 35) {

            player.sliding = false;
            player.slideTimer = 0;
        }
    }

    // Apparition des obstacles

    if(frame % Math.max(35,Math.floor(85/speed)) === 0) {

        spawn();
    }

    // Déplacement des obstacles

    obstacles.forEach(o => {

        o.z += 0.009 * speed;

        if(o.z > 0.88 && o.z < 1.02) {

            if(o.lane === player.lane) {

                if(o.type === "gap" && !player.jumping) {
                    endGame("lava");
                }

                if(o.type === "barrier" && !player.jumping) {
                    endGame("obstacle");
                }

                if(o.type === "overhead" && !player.sliding) {
                    endGame("obstacle");
                }
            }
        }
    });

    obstacles = obstacles.filter(o => o.z < 1.12);

    // Pièces

    coins.forEach(c => {

        c.z += 0.009 * speed;

        if(
            !c.collected &&
            c.z > 0.88 &&
            c.z < 1.03 &&
            c.lane === player.lane
        ) {

            if(selectedMode === "nocoin") {

                endGame("coin");

            } else {

                c.collected = true;
                coinCount++;
                score += 100;
            }
        }
    });

    coins = coins.filter(c => c.z < 1.10 && !c.collected);

    updateStats();
}

// ============================================
// DÉCOR : CIEL
// ============================================

function drawSky() {

    const gradient = ctx.createLinearGradient(0,0,0,H);

    gradient.addColorStop(0,"#090d22");
    gradient.addColorStop(0.55,"#202b50");
    gradient.addColorStop(1,"#10152b");

    ctx.fillStyle = gradient;
    ctx.fillRect(0,0,W,H);

    // Lune

    ctx.fillStyle = "#b6d9ff";
    ctx.globalAlpha = 0.8;

    ctx.beginPath();
    ctx.arc(W*0.78,H*0.13,22,0,Math.PI*2);
    ctx.fill();

    ctx.globalAlpha = 1;

    // Étoiles

    for(let i=0;i<45;i++) {

        const x = (i*137)%W;
        const y = (i*71)%(H*0.24);

        ctx.fillStyle = "#d5e7ff";

        ctx.fillRect(x,y,2,2);
    }
}

// ============================================
// DÉCOR : VILLE
// ============================================

function drawCity() {

    for(let i=0;i<18;i++) {

        const x = (i*75 - frame*0.15) % (W+100);

        const height = 70 + (i*37%100);

        ctx.fillStyle = "#17203d";

        ctx.fillRect(
            x,
            H*0.24-height,
            60,
            height
        );

        ctx.fillStyle = "#46f3e5";

        for(let y=H*0.24-height+12;y<H*0.24-8;y+=17) {

            ctx.fillRect(x+12,y,5,7);
            ctx.fillRect(x+34,y,5,7);
        }
    }
}

// ============================================
// ROUTE EN PERSPECTIVE
// ============================================

function drawRoad() {

    const top = H*0.24;
    const bottom = H*0.94;

    const topWidth = roadWidthAt(0);
    const bottomWidth = roadWidthAt(1);

    // Sol autour de la route

    if(selectedMode === "lava") {

        ctx.fillStyle = "#d63821";
    } else {

        ctx.fillStyle = "#111a2d";
    }

    ctx.fillRect(0,top,W,H-top);

    // Route

    ctx.beginPath();

    ctx.moveTo(W/2-topWidth,top);
    ctx.lineTo(W/2+topWidth,top);
    ctx.lineTo(W/2+bottomWidth,bottom);
    ctx.lineTo(W/2-bottomWidth,bottom);

    ctx.closePath();

    const gradient = ctx.createLinearGradient(0,top,0,bottom);

    gradient.addColorStop(0,"#303a58");
    gradient.addColorStop(1,"#11182a");

    ctx.fillStyle = gradient;
    ctx.fill();

    // Bords lumineux

    ctx.strokeStyle = "#46f3e5";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(W/2-topWidth,top);
    ctx.lineTo(W/2-bottomWidth,bottom);
    ctx.moveTo(W/2+topWidth,top);
    ctx.lineTo(W/2+bottomWidth,bottom);
    ctx.stroke();

    // Lignes des voies

    for(let lane=0;lane<2;lane++) {

        const offset = lane === 0 ? -1/3 : 1/3;

        ctx.strokeStyle = "#ffffff44";
        ctx.lineWidth = 2;

        ctx.beginPath();

        ctx.moveTo(W/2 + offset*topWidth,top);
        ctx.lineTo(W/2 + offset*bottomWidth,bottom);

        ctx.stroke();
    }

    // Marques au sol animées

    for(let i=0;i<12;i++) {

        let t = (i/12 + roadOffset)%1;

        const y = projectY(t);
        const width = roadWidthAt(t)*0.025;

        ctx.fillStyle = "#ffffff55";

        ctx.fillRect(
            W/2-width/2,
            y,
            width,
            3+t*8
        );
    }
}

// ============================================
// PROJECTION DES OBJETS
// ============================================

function drawObstacle(o) {

    if (o.z < 0 || o.z > 1.08) return;

    const t = Math.max(0, o.z);

    const x = laneX(o.lane, t);
    const y = projectY(t);

    const scale = 0.25 + t * 1.1;

    const w = 48 * scale;
    const h = 65 * scale;

    // =========================
    // TROU DE LAVE
    // =========================

    if (o.type === "gap") {

        ctx.fillStyle = "#ff351b";
        ctx.fillRect(x - w, y - 4, w * 2, 15 * scale);

        ctx.fillStyle = "#ffbd32";
        ctx.fillRect(x - w * 0.7, y, w * 1.4, 5 * scale);

        return;
    }

    // =========================
    // BARRIÈRE ROUGE ET BLANCHE
    // =========================

    if (o.type === "barrier") {

        const bw = 48 * scale;
        const bh = 24 * scale;

        // Pieds
        ctx.fillStyle = "#343b4b";

        ctx.fillRect(x - bw * 0.42, y - bh, 7 * scale, bh);
        ctx.fillRect(x + bw * 0.28, y - bh, 7 * scale, bh);

        // Corps de la barrière
        ctx.fillStyle = "#ed334d";

        ctx.fillRect(
            x - bw / 2,
            y - bh * 1.65,
            bw,
            bh * 0.75
        );

        // Bandes blanches
        ctx.save();

        ctx.beginPath();
        ctx.rect(
            x - bw / 2,
            y - bh * 1.65,
            bw,
            bh * 0.75
        );

        ctx.clip();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 7 * scale;

        for (let i = -3; i < 6; i++) {

            ctx.beginPath();

            ctx.moveTo(x - bw + i * 17 * scale, y - bh * 0.9);
            ctx.lineTo(x - bw * 0.3 + i * 17 * scale, y - bh * 1.7);

            ctx.stroke();
        }

        ctx.restore();

        // Contour lumineux
        ctx.strokeStyle = "#ff6178";
        ctx.lineWidth = 2 * scale;

        ctx.strokeRect(
            x - bw / 2,
            y - bh * 1.65,
            bw,
            bh * 0.75
        );

        return;
    }

    // =========================
    // TRAIN
    // =========================

    if (o.type === "train") {

        const tw = 67 * scale;
        const th = 125 * scale;

        // Ombre du train
        ctx.fillStyle = "#05071388";

        ctx.beginPath();
        ctx.ellipse(x, y, tw * 0.8, 9 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        // Côté du train
        ctx.fillStyle = "#126b83";

        ctx.beginPath();

        ctx.moveTo(x + tw / 2, y - th);
        ctx.lineTo(x + tw / 2 + 13 * scale, y - th + 12 * scale);
        ctx.lineTo(x + tw / 2 + 13 * scale, y - 5 * scale);
        ctx.lineTo(x + tw / 2, y);

        ctx.closePath();
        ctx.fill();

        // Corps principal
        ctx.fillStyle = "#087e9b";

        ctx.beginPath();

        ctx.moveTo(x - tw / 2, y - th + 12 * scale);
        ctx.lineTo(x + tw / 2, y - th + 12 * scale);
        ctx.lineTo(x + tw / 2, y);
        ctx.lineTo(x - tw / 2, y);

        ctx.closePath();
        ctx.fill();

        // Face avant
        ctx.fillStyle = "#12b5ce";

        ctx.beginPath();

        ctx.moveTo(x - tw / 2, y - th + 12 * scale);
        ctx.lineTo(x - tw / 2 + 9 * scale, y - th);
        ctx.lineTo(x + tw / 2 - 9 * scale, y - th);
        ctx.lineTo(x + tw / 2, y - th + 12 * scale);

        ctx.closePath();
        ctx.fill();

        // Pare-brise
        ctx.fillStyle = "#101d36";

        ctx.fillRect(
            x - tw * 0.35,
            y - th + 19 * scale,
            tw * 0.7,
            27 * scale
        );

        // Reflets des fenêtres
        ctx.strokeStyle = "#8defff";
        ctx.lineWidth = 2 * scale;

        ctx.beginPath();
        ctx.moveTo(x, y - th + 20 * scale);
        ctx.lineTo(x, y - th + 44 * scale);
        ctx.stroke();

        // Bande décorative
        ctx.fillStyle = "#ffce55";

        ctx.fillRect(
            x - tw / 2,
            y - th * 0.38,
            tw,
            7 * scale
        );

        // Phares
        ctx.fillStyle = "#fff2a1";
        ctx.shadowColor = "#fff2a1";
        ctx.shadowBlur = 15 * scale;

        ctx.beginPath();

        ctx.arc(
            x - tw * 0.32,
            y - 19 * scale,
            5 * scale,
            0,
            Math.PI * 2
        );

        ctx.arc(
            x + tw * 0.32,
            y - 19 * scale,
            5 * scale,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.shadowBlur = 0;

        // Contour
        ctx.strokeStyle = "#70edff";
        ctx.lineWidth = 2 * scale;

        ctx.strokeRect(
            x - tw / 2,
            y - th + 12 * scale,
            tw,
            th - 12 * scale
        );

        return;
    }

    // =========================
    // OBSTACLE EN HAUTEUR
    // =========================

    if (o.type === "overhead") {

        ctx.fillStyle = "#7041c7";

        ctx.fillRect(
            x - w / 2,
            y - h * 1.5,
            w,
            h * 0.45
        );

        ctx.fillStyle = "#c7aaff";

        ctx.fillRect(
            x - w / 2,
            y - h * 1.5,
            w,
            5 * scale
        );
    }
}
// ============================================
// PIÈCES
// ============================================

function drawCoin(c) {

    if(c.z < 0 || c.z > 1.05) return;

    const t = Math.max(0,c.z);

    const x = laneX(c.lane,t);
    const y = projectY(t)-30*t;

    const radius = 5 + t*10;

    ctx.save();

    ctx.translate(x,y);

    ctx.rotate(Math.sin(frame*0.08)*0.15);

    ctx.fillStyle = "#ffd45c";
    ctx.shadowColor = "#ffd45c";
    ctx.shadowBlur = 15;

    ctx.beginPath();
    ctx.ellipse(
        0,0,
        radius*0.72,
        radius,
        0,0,Math.PI*2
    );

    ctx.fill();

    ctx.shadowBlur = 0;

    ctx.strokeStyle = "#fff3ad";
    ctx.lineWidth = 2;

    ctx.stroke();

    ctx.restore();
}

// ============================================
// PERSONNAGE : TÊTE
// ============================================

function drawHead(skin) {

    // Cou

    ctx.fillStyle = "#bd866c";

    ctx.fillRect(-7,-42,14,13);

    // Tête

    ctx.fillStyle = "#dba17f";

    ctx.beginPath();
    ctx.ellipse(0,-55,15,19,0,0,Math.PI*2);
    ctx.fill();

    // Cheveux vus de dos

    ctx.fillStyle = skin.dark;

    ctx.beginPath();
    ctx.arc(0,-62,16,Math.PI,Math.PI*2);
    ctx.fill();

    ctx.fillRect(-15,-63,30,9);

    // Oreilles

    ctx.fillStyle = "#c58b6f";

    ctx.beginPath();
    ctx.arc(-15,-53,4,0,Math.PI*2);
    ctx.arc(15,-53,4,0,Math.PI*2);
    ctx.fill();
}

// ============================================
// PERSONNAGE : CORPS
// ============================================

function drawBody(skin) {

    // Torse

    ctx.fillStyle = skin.color;

    ctx.beginPath();

    ctx.moveTo(-15,-42);
    ctx.lineTo(15,-42);
    ctx.lineTo(19,-5);
    ctx.lineTo(-19,-5);

    ctx.closePath();
    ctx.fill();

    // Détails du vêtement

    ctx.fillStyle = skin.dark;

    ctx.fillRect(-13,-13,26,5);

    // Dos du personnage

    ctx.strokeStyle = "#ffffff55";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(0,-39);
    ctx.lineTo(0,-9);
    ctx.stroke();
}

// ============================================
// PERSONNAGE : BRAS
// ============================================

function drawArms(skin) {

    const swing = Math.sin(player.animation)*10;

    ctx.lineCap = "round";

    // Bras gauche

    ctx.strokeStyle = skin.color;
    ctx.lineWidth = 9;

    ctx.beginPath();

    ctx.moveTo(-14,-37);
    ctx.lineTo(-22+swing,-18);

    ctx.stroke();

    // Main gauche

    ctx.fillStyle = "#dba17f";

    ctx.beginPath();
    ctx.arc(-22+swing,-15,5,0,Math.PI*2);
    ctx.fill();

    // Bras droit

    ctx.strokeStyle = skin.color;

    ctx.beginPath();

    ctx.moveTo(14,-37);
    ctx.lineTo(22-swing,-18);

    ctx.stroke();

    // Main droite

    ctx.fillStyle = "#dba17f";

    ctx.beginPath();
    ctx.arc(22-swing,-15,5,0,Math.PI*2);
    ctx.fill();
}

// ============================================
// PERSONNAGE : JAMBES
// ============================================

function drawLegs(skin) {

    const run = Math.sin(player.animation)*9;

    // Jambe gauche

    ctx.strokeStyle = "#27334f";
    ctx.lineWidth = 11;
    ctx.lineCap = "round";

    ctx.beginPath();

    ctx.moveTo(-9,-6);
    ctx.lineTo(-10+run,13);

    ctx.stroke();

    // Chaussure gauche

    ctx.fillStyle = skin.color;

    ctx.fillRect(-17+run,10,16,7);

    // Jambe droite

    ctx.strokeStyle = "#27334f";

    ctx.beginPath();

    ctx.moveTo(9,-6);
    ctx.lineTo(10-run,13);

    ctx.stroke();

    // Chaussure droite

    ctx.fillStyle = skin.color;

    ctx.fillRect(2-run,10,16,7);
}

// ============================================
// PERSONNAGE COMPLET
// ============================================

function drawPlayer() {

    const skin = skins[selectedSkin];

    const x = laneX(player.visualLane,1);
    const groundY = H*0.83;

    let jumpHeight = 0;

    if(player.jumping) {

        const t = player.jumpTimer/38;

        jumpHeight = Math.sin(t*Math.PI)*100;
    }

    const sliding = player.sliding;

    const scale = sliding ? 0.75 : 1;

    ctx.save();

    ctx.translate(x,groundY-jumpHeight);

    ctx.scale(scale,scale);

    // Ombre

    ctx.fillStyle = "#00000066";

    ctx.beginPath();
    ctx.ellipse(0,20,28,8,0,0,Math.PI*2);
    ctx.fill();

    if(sliding) {

        ctx.rotate(-0.25);
        ctx.translate(0,8);
    }

    // Personnage entier

    drawLegs(skin);
    drawBody(skin);
    drawArms(skin);
    drawHead(skin);

    // Lumière autour du personnage

    ctx.shadowColor = skin.color;
    ctx.shadowBlur = 12;

    ctx.strokeStyle = skin.color;
    ctx.lineWidth = 2;

    ctx.strokeRect(-18,-42,36,55);

    ctx.shadowBlur = 0;

    ctx.restore();
}

// ============================================
// AFFICHAGE GLOBAL
// ============================================

function draw() {

    ctx.clearRect(0,0,W,H);

    drawSky();
    drawCity();
    drawRoad();

    // Objets triés du plus éloigné au plus proche

    const objects = [
        ...obstacles.map(o => ({...o,kind:"obstacle"})),
        ...coins.map(c => ({...c,kind:"coin"}))
    ];

    objects.sort((a,b) => a.z-b.z);

    objects.forEach(o => {

        if(o.kind === "obstacle") {
            drawObstacle(o);
        } else {
            drawCoin(o);
        }
    });

    drawPlayer();

    // Indication de la voie

    ctx.fillStyle = "#ffffff88";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";

    ctx.fillText(
        "VOIE " + (player.lane+1),
        W/2,
        H-12
    );
}

// ============================================
// BOUCLE PRINCIPALE
// ============================================

function loop() {

    if(!running || paused) return;

    update();

    if(running) {

        draw();

        animation = requestAnimationFrame(loop);
    }
}

// ============================================
// RETOUR AU MENU
// ============================================

function backToMenu() {

    running = false;

    cancelAnimationFrame(animation);

    document.getElementById("gameScreen").classList.add("hidden");
    document.getElementById("gameOver").classList.add("hidden");
    document.getElementById("menu").classList.remove("hidden");
}

// ============================================
// COMMANDES CLAVIER ZQSD
// ============================================

window.addEventListener("keydown",e => {

    const key = e.key.toLowerCase();

    if([
        "arrowleft",
        "arrowright",
        "arrowup",
        "arrowdown",
        " "
    ].includes(key)) {

        e.preventDefault();
    }

    // GAUCHE

    if(key === "q" || key === "arrowleft") {
        moveLeft();
    }

    // DROITE

    if(key === "d" || key === "arrowright") {
        moveRight();
    }

    // SAUTER

    if(key === "z" || key === "arrowup" || key === " ") {
        jump();
    }

    // GLISSER

    if(key === "s" || key === "arrowdown") {
        slide();
    }

    // PAUSE

    if(key === "escape") {
        pauseGame();
    }
});

// ============================================
// COMMANDES TACTILES : GLISSEMENT DU DOIGT
// ============================================

let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener("pointerdown",e => {

    touchStartX = e.clientX;
    touchStartY = e.clientY;
});

canvas.addEventListener("pointerup",e => {

    const dx = e.clientX-touchStartX;
    const dy = e.clientY-touchStartY;

    if(Math.abs(dx) > Math.abs(dy)) {

        if(dx > 25) {
            moveRight();
        }

        if(dx < -25) {
            moveLeft();
        }

    } else {

        if(dy < -25) {
            jump();
        }

        if(dy > 25) {
            slide();
        }

        if(Math.abs(dy) <= 25) {
            jump();
        }
    }
});

// ============================================
// FIN DU CODE
// ============================================
