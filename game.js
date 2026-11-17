const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;

const skins = [
    {name:"VOLT",icon:"⚡",color:"#46f3e5"},
    {name:"BLAZE",icon:"🔥",color:"#ff704d"},
    {name:"PIXEL",icon:"👾",color:"#b58cff"},
    {name:"NINJA",icon:"🥷",color:"#c3d0e8"},
    {name:"LIME",icon:"🍀",color:"#a8f05b"},
    {name:"ROSE",icon:"💗",color:"#ff70b7"},
    {name:"FROST",icon:"❄️",color:"#8edbff"},
    {name:"GOLD",icon:"👑",color:"#ffd36a"}
];

let selectedSkin = 0;
let selectedMode = "classic";

let player;
let obstacles = [];
let coins = [];
let platforms = [];

let score = 0;
let coinCount = 0;
let speed = 5;
let frame = 0;

let running = false;
let paused = false;
let animation;

let lavaGround = H - 25;

function selectMode(mode,button) {
    selectedMode = mode;

    document.querySelectorAll(".mode").forEach(b => {
        b.classList.remove("selected");
    });

    button.classList.add("selected");
}

function chooseSkin(index) {
    selectedSkin = index;

    document.getElementById("character").textContent =
        skins[index].icon;

    document.getElementById("skinName").textContent =
        skins[index].name;
}

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
    speed = 5;
    frame = 0;

    obstacles = [];
    coins = [];

    platforms = [];

    player = {
        x:120,
        y:300,
        w:35,
        h:45,
        vy:0,
        jumping:false,
        onGround:true,
        platform:null
    };

    if(selectedMode === "lava") {
        platforms = [
            {x:0,y:320,w:230,h:18},
            {x:320,y:270,w:140,h:18},
            {x:550,y:320,w:150,h:18},
            {x:800,y:260,w:160,h:18}
        ];

        player.y = 275;
    }

    running = true;
    paused = false;

    updateStats();

    animation = requestAnimationFrame(loop);
}

function jump() {

    if(!running || paused) return;

    if(player.onGround) {

        player.vy = -14;
        player.onGround = false;
        player.platform = null;

    }
}

function pauseGame() {

    if(!running) return;

    paused = !paused;

    if(!paused) {
        animation = requestAnimationFrame(loop);
    } else {
        draw();
    }
}

function updateStats() {

    document.getElementById("score").textContent = score;
    document.getElementById("coins").textContent = coinCount;

    document.getElementById("best").textContent =
        localStorage.getItem("neonBest") || 0;
}

function spawn() {

    if(selectedMode === "lava") {

        let last = platforms[platforms.length-1];

        if(last.x + last.w < W + 150) {

            platforms.push({
                x:last.x + last.w + 80 + Math.random()*60,
                y:245 + Math.random()*75,
                w:120 + Math.random()*90,
                h:18
            });

        }

    } else {

        if(Math.random() < 0.7) {

            obstacles.push({
                x:W,
                y:lavaGround-45,
                w:35,
                h:45
            });

        }

        if(Math.random() < 0.8) {

            coins.push({
                x:W+Math.random()*100,
                y:170+Math.random()*100,
                r:12
            });

        }

    }
}

function collision(a,b) {

    return (
        a.x < b.x+b.w &&
        a.x+a.w > b.x &&
        a.y < b.y+b.h &&
        a.y+a.h > b.y
    );

}

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
        ? "Tu as touché la lave !"
        : "Un obstacle t'a arrêté !";

    document.getElementById("gameOver").classList.remove("hidden");
}

function update() {

    frame++;

    speed = Math.min(10,5+score/10000);

    score++;

    if(frame % 80 === 0) {
        spawn();
    }

    player.vy += 0.65;
    player.y += player.vy;

    player.onGround = false;

    if(selectedMode === "lava") {

        platforms.forEach(p => {

            p.x -= speed;

            if(
                player.vy >= 0 &&
                player.x+player.w > p.x &&
                player.x < p.x+p.w &&
                player.y+player.h <= p.y &&
                player.y+player.h+player.vy >= p.y
            ) {

                player.y = p.y-player.h;
                player.vy = 0;
                player.onGround = true;
                player.platform = p;

            }

        });

        platforms = platforms.filter(p => p.x+p.w > -20);

        if(player.y+player.h >= lavaGround) {
            endGame("lava");
        }

    } else {

        if(player.y+player.h >= lavaGround) {

            player.y = lavaGround-player.h;
            player.vy = 0;
            player.onGround = true;

        }

        obstacles.forEach(o => {

            o.x -= speed;

            if(collision(player,o)) {
                endGame("obstacle");
            }

        });

        obstacles = obstacles.filter(o => o.x > -50);

    }

    coins.forEach(c => {

        c.x -= speed;

        if(Math.hypot(player.x+17-c.x,player.y+20-c.y)<28) {

            if(selectedMode === "nocoin") {
                endGame("coin");
            } else {
                c.collected = true;
                coinCount++;
                score += 100;
            }

        }

    });

    coins = coins.filter(c => c.x > -30 && !c.collected);

    updateStats();

}

function draw() {

    ctx.clearRect(0,0,W,H);

    const gradient = ctx.createLinearGradient(0,0,0,H);

    gradient.addColorStop(0,"#101a37");
    gradient.addColorStop(1,"#17142b");

    ctx.fillStyle = gradient;
    ctx.fillRect(0,0,W,H);

    // Ville futuriste

    for(let i=0;i<18;i++) {

        let x = ((i*75-frame*0.5)%(W+100)+W+100)%(W+100)-50;

        let height = 80+(i*37%100);

        ctx.fillStyle = "#1b2548";

        ctx.fillRect(x,H-80-height,55,height);

        ctx.fillStyle = "#46f3e533";

        for(let y=H-70-height;y<H-90;y+=18) {
            ctx.fillRect(x+12,y,6,8);
            ctx.fillRect(x+32,y,6,8);
        }

    }

    // Sol

    if(selectedMode === "lava") {

        ctx.fillStyle = "#ff4b28";
        ctx.fillRect(0,lavaGround,W,H-lavaGround);

        for(let i=0;i<15;i++) {

            let x = (i*80-frame*2)%(W+80);

            ctx.fillStyle = "#ffad32";

            ctx.beginPath();
            ctx.moveTo(x,lavaGround);
            ctx.lineTo(x+15,lavaGround-25);
            ctx.lineTo(x+30,lavaGround);
            ctx.fill();

        }

        platforms.forEach(p => {

            ctx.fillStyle = "#283c60";
            ctx.fillRect(p.x,p.y,p.w,p.h);

            ctx.fillStyle = "#46f3e5";
            ctx.fillRect(p.x,p.y,p.w,4);

        });

    } else {

        ctx.fillStyle = "#17213c";
        ctx.fillRect(0,lavaGround,W,H-lavaGround);

        ctx.fillStyle = "#46f3e5";
        ctx.fillRect(0,lavaGround,W,3);

        obstacles.forEach(o => {

            ctx.fillStyle = "#ff4d78";

            ctx.shadowColor = "#ff4d78";
            ctx.shadowBlur = 15;

            ctx.fillRect(o.x,o.y,o.w,o.h);

            ctx.shadowBlur = 0;

        });

    }

    // Pièces

    coins.forEach(c => {

        ctx.fillStyle = "#ffd45c";

        ctx.shadowColor = "#ffd45c";
        ctx.shadowBlur = 18;

        ctx.beginPath();
        ctx.arc(c.x,c.y,12,0,Math.PI*2);
        ctx.fill();

        ctx.shadowBlur = 0;

        ctx.strokeStyle = "#fff2b2";
        ctx.lineWidth = 3;
        ctx.stroke();

    });

    // Joueur

    const skin = skins[selectedSkin];

    ctx.fillStyle = skin.color;

    ctx.shadowColor = skin.color;
    ctx.shadowBlur = 20;

    ctx.fillRect(player.x,player.y,player.w,player.h);

    ctx.shadowBlur = 0;

    ctx.fillStyle = "#07131c";

    ctx.fillRect(player.x+7,player.y+10,5,5);
    ctx.fillRect(player.x+23,player.y+10,5,5);

    // Petit effet de lumière

    ctx.fillStyle = skin.color;

    ctx.fillRect(player.x+5,player.y+player.h,8,7);
    ctx.fillRect(player.x+22,player.y+player.h,8,7);

}

function loop() {

    if(!running || paused) return;

    update();

    if(running) {
        draw();
        animation = requestAnimationFrame(loop);
    }

}

function backToMenu() {

    running = false;

    cancelAnimationFrame(animation);

    document.getElementById("gameScreen").classList.add("hidden");
    document.getElementById("gameOver").classList.add("hidden");
    document.getElementById("menu").classList.remove("hidden");

}

window.addEventListener("keydown",e => {

    if(["Space","ArrowUp","KeyW"].includes(e.code)) {
        e.preventDefault();
        jump();
    }

    if(e.code === "Escape") {
        pauseGame();
    }

});

canvas.addEventListener("pointerdown",jump);
