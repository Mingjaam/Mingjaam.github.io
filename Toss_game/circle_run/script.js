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
const outerRadius = canvas.width * 0.35; // 큰 원 (바깥쪽)
const innerRadius = canvas.width * 0.15; // 작은 원 (안쪽)

let running = false;
let angle = 0;
let speed = 0.02;
let score = 0;
let level = 1;

let player = {
    angle: -Math.PI / 2, // 상단에서 시작 (12시 방향)
    isOnOuterCircle: true, // true: 큰 원 안쪽, false: 작은 원 바깥쪽
    moveSpeed: 0.05,
    switching: false, // 원 전환 중인지
    switchProgress: 0 // 전환 진행도 (0~1)
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
    
    // 바깥쪽 원 장애물 생성
    for (let i = 0; i < count; i++) {
        let obstacleAngle;
        let attempts = 0;
        let isValid = false;
        
        do {
            // 0~90도와 340~360도(-20도~0도) 제외하고 랜덤 각도 생성
            obstacleAngle = (Math.random() * (Math.PI * 2 - Math.PI / 2 - Math.PI / 9)) + Math.PI / 2;
            
            // 플레이어와의 거리 체크
            const playerDistance = Math.min(Math.abs(obstacleAngle - playerAngle), Math.PI * 2 - Math.abs(obstacleAngle - playerAngle));
            
            // 기존 바깥쪽 장애물과의 거리 체크
            let tooCloseToExisting = false;
            for (let existingObstacle of obstacles) {
                if (existingObstacle.onOuterCircle) {
                    const existingDistance = Math.min(Math.abs(obstacleAngle - existingObstacle.angle), Math.PI * 2 - Math.abs(obstacleAngle - existingObstacle.angle));
                    if (existingDistance < Math.PI / 6) { // 30도 이내에 다른 장애물이 있으면 안됨
                        tooCloseToExisting = true;
                        break;
                    }
                }
            }
            
            isValid = playerDistance >= safeZone && !tooCloseToExisting;
            attempts++;
        } while (!isValid && attempts < 50);
        
        if (isValid) {
            // 바깥쪽 원에만 장애물 생성
            obstacles.push({
                angle: obstacleAngle,
                onOuterCircle: true, // 큰 원 안쪽 장애물
                onInnerCircle: false
            });
        }
    }
    
    // 안쪽 원 장애물 생성 (바깥쪽과 다른 각도에)
    for (let i = 0; i < count; i++) {
        let obstacleAngle;
        let attempts = 0;
        let isValid = false;
        
        do {
            // 0~90도와 340~360도(-20도~0도) 제외하고 랜덤 각도 생성
            obstacleAngle = (Math.random() * (Math.PI * 2 - Math.PI / 2 - Math.PI / 9)) + Math.PI / 2;
            
            // 플레이어와의 거리 체크
            const playerDistance = Math.min(Math.abs(obstacleAngle - playerAngle), Math.PI * 2 - Math.abs(obstacleAngle - playerAngle));
            
            // 기존 안쪽 장애물과의 거리 체크
            let tooCloseToExisting = false;
            for (let existingObstacle of obstacles) {
                if (existingObstacle.onInnerCircle) {
                    const existingDistance = Math.min(Math.abs(obstacleAngle - existingObstacle.angle), Math.PI * 2 - Math.abs(obstacleAngle - existingObstacle.angle));
                    if (existingDistance < Math.PI / 6) { // 30도 이내에 다른 장애물이 있으면 안됨
                        tooCloseToExisting = true;
                        break;
                    }
                }
            }
            
            isValid = playerDistance >= safeZone && !tooCloseToExisting;
            attempts++;
        } while (!isValid && attempts < 50);
        
        if (isValid) {
            // 안쪽 원에만 장애물 생성
            obstacles.push({
                angle: obstacleAngle,
                onOuterCircle: false,
                onInnerCircle: true  // 작은 원 바깥쪽 장애물
            });
        }
    }
}

// 게임 시작 시 장애물 생성은 나중에 함

function drawCircles() {
    // 큰 원 (바깥쪽)
    ctx.beginPath();
    ctx.lineWidth = 8;
    ctx.strokeStyle = "black";
    ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // 작은 원 (안쪽)
    ctx.beginPath();
    ctx.lineWidth = 8;
    ctx.strokeStyle = "black";
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.stroke();
}

function drawPlayer() {
    let r;
    
    if (player.switching) {
        // 원 전환 중일 때는 중간 위치에 그리기
        const outerR = outerRadius - 20; // 큰 원 안쪽
        const innerR = innerRadius + 20; // 작은 원 바깥쪽
        r = player.isOnOuterCircle ? 
            outerR + (innerR - outerR) * player.switchProgress :
            innerR + (outerR - innerR) * player.switchProgress;
    } else {
        // 일반 상태일 때
        r = player.isOnOuterCircle ? outerRadius - 20 : innerRadius + 20;
    }
    
    const x = centerX + Math.cos(player.angle) * r;
    const y = centerY + Math.sin(player.angle) * r;

    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fillStyle = "gray"; // 색상 고정
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
        // 큰 원 안쪽 장애물 그리기 (안쪽을 향하도록)
        if (o.onOuterCircle) {
            const r = outerRadius - 20;
            const x = centerX + Math.cos(o.angle) * r;
            const y = centerY + Math.sin(o.angle) * r;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(o.angle + Math.PI / 2 + Math.PI); // 180도 회전해서 안쪽을 향하도록
            ctx.beginPath();
            ctx.moveTo(0, -15);
            ctx.lineTo(12, 15);
            ctx.lineTo(-12, 15);
            ctx.closePath();
            ctx.fillStyle = "red";
            ctx.fill();
            
            ctx.lineWidth = 3;
            ctx.strokeStyle = "darkred";
            ctx.stroke();
            ctx.restore();
        }
        
        // 작은 원 바깥쪽 장애물 그리기
        if (o.onInnerCircle) {
            const r = innerRadius + 20;
            const x = centerX + Math.cos(o.angle) * r;
            const y = centerY + Math.sin(o.angle) * r;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(o.angle + Math.PI / 2);
            ctx.beginPath();
            ctx.moveTo(0, -15);
            ctx.lineTo(12, 15);
            ctx.lineTo(-12, 15);
            ctx.closePath();
            ctx.fillStyle = "red"; // 색상 통일
            ctx.fill();
            
            ctx.lineWidth = 3;
            ctx.strokeStyle = "darkred"; // 색상 통일
            ctx.stroke();
            ctx.restore();
        }
    });
}

function checkCollision() {
    for (let o of obstacles) {
        const diff = Math.abs(((player.angle - o.angle) + Math.PI * 2) % (Math.PI * 2));
        
        if (diff < 0.2) {
            // 플레이어가 큰 원에 있고, 큰 원 장애물과 충돌
            if (player.isOnOuterCircle && o.onOuterCircle && !player.switching) {
                gameOver = true;
            }
            // 플레이어가 작은 원에 있고, 작은 원 장애물과 충돌
            if (!player.isOnOuterCircle && o.onInnerCircle && !player.switching) {
                gameOver = true;
            }
        }
    }
}

function update() {
    if (!running) return;
    if (gameOver) return;

    angle += speed;

    // 플레이어가 원을 따라 움직임
    player.angle += player.moveSpeed;

    // 원 전환 중일 때 처리
    if (player.switching) {
        player.switchProgress += 0.1; // 전환 속도
        if (player.switchProgress >= 1) {
            player.switchProgress = 0;
            player.switching = false;
            player.isOnOuterCircle = !player.isOnOuterCircle; // 원 전환 완료
        }
    }

    // 플레이어가 한바퀴 돌았는지 체크 (상단에서 시작해서 다시 상단으로)
    if (player.angle >= Math.PI * 1.5) { // 270도 지점에서 체크
        player.angle = -Math.PI / 2; // 상단으로 즉시 리셋
        score++;
        level = Math.floor(score / 3) + 1; // 3점마다 레벨업
        speed += 0.003;
        createObstacles(); // 새로운 장애물 생성
    }
    
    // 플레이어 각도 정규화
    if (player.angle > Math.PI * 2) {
        player.angle -= Math.PI * 2;
    }

    checkCollision();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCircles();
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
        createObstacles(); // 게임 시작 시 장애물 생성
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
        player.isOnOuterCircle = true;
        player.switching = false;
        player.switchProgress = 0;
        createObstacles(); // 재시작 시 장애물 생성
        overlay.innerText = score;
    } else {
        // 원 전환 (점프 대신)
        if (!player.switching) {
            player.switching = true;
            player.switchProgress = 0;
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
