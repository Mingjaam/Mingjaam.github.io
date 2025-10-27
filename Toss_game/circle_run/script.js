const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');

// 캔버스 크기 설정 - 정사각형으로 고정
function resizeCanvas() {
    const size = Math.min(window.innerWidth, window.innerHeight) * 0.8;
    canvas.width = size;
    canvas.height = size;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const centerX = canvas.width / 2;
const centerY = canvas.height / 2;
const radius = canvas.width * 0.25; // 원 크기 줄임

let running = false;
let angle = 0;
let speed = 0.02;
let score = 0;
let level = 1;

let player = {
    angle: -Math.PI / 2, // 상단에서 시작 (12시 방향)
    jumpPower: 0,
    radiusOffset: 0,
    jumping: false,
    moveSpeed: 0.05
};

let obstacles = [];
let gameOver = false;

// 레벨에 따른 장애물 개수 확률 계산
function getObstacleCount() {
    const probabilities = [
        [1, 0, 0, 0], // 레벨 1: 1개만
        [0.7, 0.3, 0, 0], // 레벨 2: 1개 70%, 2개 30%
        [0.4, 0.5, 0.1, 0], // 레벨 3: 1개 40%, 2개 50%, 3개 10%
        [0.2, 0.4, 0.3, 0.1], // 레벨 4: 1개 20%, 2개 40%, 3개 30%, 4개 10%
        [0.1, 0.3, 0.4, 0.2], // 레벨 5+: 1개 10%, 2개 30%, 3개 40%, 4개 20%
    ];
    
    const levelIndex = Math.min(level - 1, 4);
    const probs = probabilities[levelIndex];
    const random = Math.random();
    
    let cumulative = 0;
    for (let i = 0; i < probs.length; i++) {
        cumulative += probs[i];
        if (random <= cumulative) {
            return i + 1;
        }
    }
    return 1;
}

function createObstacles() {
    obstacles = [];
    const count = getObstacleCount();
    
    // 플레이어 위치를 피해서 장애물 배치
    const playerAngle = player.angle;
    const safeZone = Math.PI / 3; // 60도 안전 구역
    
    for (let i = 0; i < count; i++) {
        let obstacleAngle;
        let attempts = 0;
        
        do {
            // 0~90도와 340~360도(-20도~0도) 제외하고 랜덤 각도 생성
            // 90도~340도 범위에서 생성
            obstacleAngle = (Math.random() * (Math.PI * 2 - Math.PI / 2 - Math.PI / 9)) + Math.PI / 2;
            attempts++;
        } while (
            Math.min(Math.abs(obstacleAngle - playerAngle), Math.PI * 2 - Math.abs(obstacleAngle - playerAngle)) < safeZone && 
            attempts < 20
        );
        
        obstacles.push({
            angle: obstacleAngle,
        });
    }
}

createObstacles();

function drawCircle() {
    ctx.beginPath();
    ctx.lineWidth = 8;
    ctx.strokeStyle = "black";
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
}

function drawPlayer() {
    const r = radius + player.radiusOffset;
    const x = centerX + Math.cos(player.angle) * r;
    const y = centerY + Math.sin(player.angle) * r;

    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fillStyle = "gray";
    ctx.fill();
    
    // 플레이어 테두리
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "black";
    ctx.stroke();
}

function drawObstacles() {
    obstacles.forEach(o => {
        const r = radius;
        const x = centerX + Math.cos(o.angle) * r; // angle 제거 - 장애물 고정
        const y = centerY + Math.sin(o.angle) * r;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(o.angle + Math.PI / 2); // angle 제거 - 장애물 고정
        ctx.beginPath();
        ctx.moveTo(0, -15);
        ctx.lineTo(12, 15);
        ctx.lineTo(-12, 15);
        ctx.closePath();
        ctx.fillStyle = "red";
        ctx.fill();
        
        // 장애물 테두리
        ctx.lineWidth = 3;
        ctx.strokeStyle = "darkred";
        ctx.stroke();
        ctx.restore();
    });
}

function checkCollision() {
    for (let o of obstacles) {
        const diff = Math.abs(((player.angle - o.angle) + Math.PI * 2) % (Math.PI * 2));
        if (diff < 0.2 && player.radiusOffset < 8) {
            gameOver = true;
        }
    }
}

function update() {
    if (!running) return;
    if (gameOver) return;

    angle += speed;

    // 플레이어가 원을 따라 움직임
    player.angle += player.moveSpeed;

    if (player.jumping) {
        player.jumpPower -= 0.4;
        player.radiusOffset += player.jumpPower;
        if (player.radiusOffset <= 0) {
            player.radiusOffset = 0;
            player.jumping = false;
        }
    }

    // 플레이어가 한바퀴 돌았는지 체크 (상단에서 시작해서 다시 상단으로)
    if (player.angle >= Math.PI * 1.5) { // 270도 지점에서 체크
        player.angle = -Math.PI / 2; // 상단으로 즉시 리셋
        score++;
        level = Math.floor(score / 3) + 1; // 3점마다 레벨업
        speed += 0.003;
        createObstacles();
    }
    
    // 플레이어 각도 정규화
    if (player.angle > Math.PI * 2) {
        player.angle -= Math.PI * 2;
    }

    checkCollision();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCircle();
    drawObstacles();
    drawPlayer();
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

loop();

// 터치 이벤트 추가
function handleInput() {
    if (!running) {
        running = true;
        overlay.innerText = score;
        overlay.style.pointerEvents = "none";
    } else if (gameOver) {
        // restart
        running = true;
        gameOver = false;
        score = 0;
        level = 1;
        angle = 0;
        speed = 0.02;
        player.angle = -Math.PI / 2; // 상단에서 시작
        player.radiusOffset = 0;
        overlay.innerText = score;
    } else {
        // jump
        if (!player.jumping) {
            player.jumping = true;
            player.jumpPower = 8;
        }
    }
}

canvas.addEventListener("click", handleInput);
canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    handleInput();
});

function gameOverScreen() {
    if (gameOver) {
        overlay.innerText = score;
        overlay.style.whiteSpace = "normal";
    } else {
        overlay.innerText = score;
    }
    requestAnimationFrame(gameOverScreen);
}
gameOverScreen();
