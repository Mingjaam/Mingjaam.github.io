const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const speedDisplay = document.getElementById('speed-display');

// 모바일 감지
const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// 모바일/데스크톱에 따른 요소 크기 설정
const CIRCLE_LINE_WIDTH = isMobile ? 4 : 8;
const PLAYER_RADIUS = isMobile ? 10 : 15;
const OBSTACLE_SIZE = isMobile ? 8 : 12;
const PLAYER_DISTANCE_FROM_CIRCLE = isMobile ? 15 : 20;

// 원의 반지름에 따른 속도 조정
let outerMoveSpeed, innerMoveSpeed; // resizeCanvas에서 초기화됨

// 게임 상수
const INITIAL_SPEED = 0.05; // 초기 속도
const SPEED_INCREASE = 0.001; // 속도 증가량

// 변수 선언 (resizeCanvas에서 초기화됨)
let centerX, centerY, outerRadius, innerRadius;

// 게임 상태 변수들
let running = false; 
let angle = 0;
let speed = INITIAL_SPEED;
let score = 0;
let level = 1;

// 프레임레이트 독립적인 속도를 위한 변수
let lastTime = 0;
// 캔버스 크기 설정 - 모바일 친화적 정사각형으로 고정
function resizeCanvas() {
    const minDimension = Math.min(window.innerWidth, window.innerHeight);
    const size = Math.floor(minDimension * 0.9); // 화면의 90% 사용
    
    canvas.width = size;
    canvas.height = size;
    
    // 캔버스 스타일도 동일하게 설정
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    
    // 중심점과 반지름 재계산
    centerX = canvas.width / 2;
    centerY = canvas.height / 2;
    outerRadius = canvas.width * 0.35; // 큰 원 (바깥쪽)
    innerRadius = canvas.width * 0.15; // 작은 원 (안쪽)
    
    // 속도 재계산 (반지름이 변경되었으므로)
    outerMoveSpeed = speed * (innerRadius / outerRadius);
    innerMoveSpeed = speed;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let player = {
    angle: -Math.PI / 2, // 상단에서 시작 (12시 방향)
    isOnOuterCircle: true, // true: 큰 원 안쪽, false: 작은 원 바깥쪽
    moveSpeed: 0.05,
    switching: false, // 원 전환 중인지
    switchProgress: 0 // 전환 진행도 (0~1)
};

let obstacles = [];
let gameOver = false;

// 디버깅 모드 (히트박스 표시)
let debugMode = false;

// 장애물 개수 시스템 (30점마다 증가)
const INITIAL_OBSTACLE_COUNT = 3; // 초기 장애물 개수
const OBSTACLE_INCREASE_INTERVAL = 30; // 30점마다 장애물 증가
const MAX_OBSTACLE_COUNT = 6; // 최대 장애물 개수 제한
const MAX_TOTAL_OBSTACLES = 6; // 전체 최대 장애물 개수 제한

function createObstacles() {
    obstacles = [];
    
    // 현재 점수에 따른 장애물 개수 계산
    const currentObstacleCount = Math.min(
        INITIAL_OBSTACLE_COUNT + Math.floor(score / OBSTACLE_INCREASE_INTERVAL),
        MAX_OBSTACLE_COUNT
    );
    
    // 안쪽과 바깥쪽 원의 장애물 개수 분배
    const innerCount = Math.floor(currentObstacleCount * 0.33); // 33%는 안쪽 원
    const outerCount = currentObstacleCount - innerCount; // 나머지는 바깥쪽 원
    
    // 플레이어 위치를 피해서 장애물 배치
    const playerAngle = player.angle;
    const safeZone = Math.PI / 3; // 60도 안전 구역
    const minDistanceBetweenCircles = Math.PI / 3; // 60도 최소 거리 (바깥쪽과 안쪽 원 장애물 간)
    
    // 바깥쪽 원 장애물 생성
    for (let i = 0; i < outerCount; i++) {
        let obstacleAngle;
        let attempts = 0;
        let isValid = false;
        
        do {
            // 전체 각도 범위에서 랜덤 각도 생성 (0~360도)
            obstacleAngle = Math.random() * Math.PI * 2;
            
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
                onInnerCircle: false,
                passed: false // 통과 여부
            });
        }
    }
    
    // 안쪽 원 장애물 생성 (바깥쪽과 다른 각도에)
    for (let i = 0; i < innerCount; i++) {
        let obstacleAngle;
        let attempts = 0;
        let isValid = false;
        
        do {
            // 전체 각도 범위에서 랜덤 각도 생성 (0~360도)
            obstacleAngle = Math.random() * Math.PI * 2;
            
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
            
            // 바깥쪽 원 장애물과의 거리 체크 (겹치지 않도록)
            let tooCloseToOuterObstacle = false;
            for (let existingObstacle of obstacles) {
                if (existingObstacle.onOuterCircle) {
                    const outerDistance = Math.min(Math.abs(obstacleAngle - existingObstacle.angle), Math.PI * 2 - Math.abs(obstacleAngle - existingObstacle.angle));
                    if (outerDistance < minDistanceBetweenCircles) { // 60도 이내에 바깥쪽 장애물이 있으면 안됨
                        tooCloseToOuterObstacle = true;
                        break;
                    }
                }
            }
            
            isValid = playerDistance >= safeZone && !tooCloseToExisting && !tooCloseToOuterObstacle;
            attempts++;
        } while (!isValid && attempts < 50);
        
        if (isValid) {
            // 안쪽 원에만 장애물 생성
            obstacles.push({
                angle: obstacleAngle,
                onOuterCircle: false,
                onInnerCircle: true,  // 작은 원 바깥쪽 장애물
                passed: false // 통과 여부
            });
        }
    }
}

// 게임 시작 시 장애물 생성은 나중에 함

function drawCircles() {
    // 큰 원 (바깥쪽)
    ctx.beginPath();
    ctx.lineWidth = CIRCLE_LINE_WIDTH;
    ctx.strokeStyle = "black";
    ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // 작은 원 (안쪽)
    ctx.beginPath();
    ctx.lineWidth = CIRCLE_LINE_WIDTH;
    ctx.strokeStyle = "black";
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.stroke();
}

function drawPlayer() {
    let r;
    
    if (player.switching) {
        // 원 전환 중일 때는 중간 위치에 그리기
        const outerR = outerRadius - PLAYER_DISTANCE_FROM_CIRCLE; // 큰 원 안쪽
        const innerR = innerRadius + PLAYER_DISTANCE_FROM_CIRCLE; // 작은 원 바깥쪽
        r = player.isOnOuterCircle ? 
            outerR + (innerR - outerR) * player.switchProgress :
            innerR + (outerR - innerR) * player.switchProgress;
    } else {
        // 일반 상태일 때
        r = player.isOnOuterCircle ? outerRadius - PLAYER_DISTANCE_FROM_CIRCLE : innerRadius + PLAYER_DISTANCE_FROM_CIRCLE;
    }
    
    const x = centerX + Math.cos(player.angle) * r;
    const y = centerY + Math.sin(player.angle) * r;

    ctx.beginPath();
    ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = "gray"; // 색상 고정
    ctx.fill();
    
    // 플레이어 테두리
    ctx.beginPath();
    ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "black";
    ctx.stroke();
    
    // 디버깅 모드: 히트박스 표시
    if (debugMode) {
        // 플레이어 히트박스 (각도 범위)
        const hitboxAngle = 0.2; // 충돌 감지 각도
        const startAngle = player.angle - hitboxAngle;
        const endAngle = player.angle + hitboxAngle;
        
        ctx.beginPath();
        ctx.arc(x, y, PLAYER_RADIUS + 5, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 각도 히트박스 표시
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + Math.cos(startAngle) * (r + PLAYER_RADIUS + 10), 
                   centerY + Math.sin(startAngle) * (r + PLAYER_RADIUS + 10));
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + Math.cos(endAngle) * (r + PLAYER_RADIUS + 10), 
                   centerY + Math.sin(endAngle) * (r + PLAYER_RADIUS + 10));
        ctx.strokeStyle = "rgba(255, 0, 0, 0.7)";
        ctx.lineWidth = 3;
        ctx.stroke();
    }
}

function drawObstacles() {
    obstacles.forEach(o => {
        // 큰 원 안쪽 장애물 그리기 (안쪽을 향하도록)
        if (o.onOuterCircle) {
            const r = outerRadius - PLAYER_DISTANCE_FROM_CIRCLE;
            const x = centerX + Math.cos(o.angle) * r;
            const y = centerY + Math.sin(o.angle) * r;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(o.angle + Math.PI / 2 + Math.PI); // 180도 회전해서 안쪽을 향하도록
            ctx.beginPath();
            ctx.moveTo(0, -OBSTACLE_SIZE);
            ctx.lineTo(OBSTACLE_SIZE, OBSTACLE_SIZE);
            ctx.lineTo(-OBSTACLE_SIZE, OBSTACLE_SIZE);
            ctx.closePath();
            ctx.fillStyle = "red";
            ctx.fill();
            
            ctx.lineWidth = 3;
            ctx.strokeStyle = "darkred";
            ctx.stroke();
            ctx.restore();
            
            // 디버깅 모드: 장애물 히트박스 표시
            if (debugMode) {
                const hitboxAngle = 0.2; // 충돌 감지 각도
                const startAngle = o.angle - hitboxAngle;
                const endAngle = o.angle + hitboxAngle;
                
                // 장애물 히트박스 원
                ctx.beginPath();
                ctx.arc(x, y, OBSTACLE_SIZE + 5, 0, Math.PI * 2);
                ctx.strokeStyle = "rgba(0, 255, 0, 0.5)";
                ctx.lineWidth = 2;
                ctx.stroke();
                
                // 각도 히트박스 표시
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.lineTo(centerX + Math.cos(startAngle) * (r + OBSTACLE_SIZE + 10), 
                           centerY + Math.sin(startAngle) * (r + OBSTACLE_SIZE + 10));
                ctx.moveTo(centerX, centerY);
                ctx.lineTo(centerX + Math.cos(endAngle) * (r + OBSTACLE_SIZE + 10), 
                           centerY + Math.sin(endAngle) * (r + OBSTACLE_SIZE + 10));
                ctx.strokeStyle = "rgba(0, 255, 0, 0.7)";
                ctx.lineWidth = 3;
                ctx.stroke();
            }
        }
        
        // 작은 원 바깥쪽 장애물 그리기
        if (o.onInnerCircle) {
            const r = innerRadius + PLAYER_DISTANCE_FROM_CIRCLE;
            const x = centerX + Math.cos(o.angle) * r;
            const y = centerY + Math.sin(o.angle) * r;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(o.angle + Math.PI / 2);
            ctx.beginPath();
            ctx.moveTo(0, -OBSTACLE_SIZE);
            ctx.lineTo(OBSTACLE_SIZE, OBSTACLE_SIZE);
            ctx.lineTo(-OBSTACLE_SIZE, OBSTACLE_SIZE);
            ctx.closePath();
            ctx.fillStyle = "red"; // 색상 통일
            ctx.fill();
            
            ctx.lineWidth = 3;
            ctx.strokeStyle = "darkred"; // 색상 통일
            ctx.stroke();
            ctx.restore();
            
            // 디버깅 모드: 장애물 히트박스 표시
            if (debugMode) {
                const hitboxAngle = 0.2; // 충돌 감지 각도
                const startAngle = o.angle - hitboxAngle;
                const endAngle = o.angle + hitboxAngle;
                
                // 장애물 히트박스 원
                ctx.beginPath();
                ctx.arc(x, y, OBSTACLE_SIZE + 5, 0, Math.PI * 2);
                ctx.strokeStyle = "rgba(0, 255, 0, 0.5)";
                ctx.lineWidth = 2;
                ctx.stroke();
                
                // 각도 히트박스 표시
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.lineTo(centerX + Math.cos(startAngle) * (r + OBSTACLE_SIZE + 10), 
                           centerY + Math.sin(startAngle) * (r + OBSTACLE_SIZE + 10));
                ctx.moveTo(centerX, centerY);
                ctx.lineTo(centerX + Math.cos(endAngle) * (r + OBSTACLE_SIZE + 10), 
                           centerY + Math.sin(endAngle) * (r + OBSTACLE_SIZE + 10));
                ctx.strokeStyle = "rgba(0, 255, 0, 0.7)";
                ctx.lineWidth = 3;
                ctx.stroke();
            }
        }
    });
}

function checkCollision() {
    for (let o of obstacles) {
        const diff = Math.abs(((player.angle - o.angle) + Math.PI * 2) % (Math.PI * 2));
        
        if (diff < 0.1) { // 충돌 감지 범위를 0.2에서 0.1로 줄임 (더 정확한 충돌 감지)
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

// 장애물 통과 감지 및 새로운 장애물 추가
function checkObstaclePassing() {
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        
        // 플레이어가 장애물을 통과했는지 확인
        const angleDiff = player.angle - o.angle;
        const normalizedDiff = ((angleDiff % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        
        // 전환 중일 때는 실제 위치를 계산
        let actualPlayerOnOuterCircle = player.isOnOuterCircle;
        if (player.switching) {
            // 전환 진행도에 따라 실제 위치 계산
            // switchProgress가 0.5 이상이면 전환된 위치로 간주
            actualPlayerOnOuterCircle = player.switchProgress < 0.5 ? player.isOnOuterCircle : !player.isOnOuterCircle;
        }
        
        // 바깥쪽 원 장애물: 플레이어가 안쪽 원에 있을 때 통과
        // 안쪽 원 장애물: 플레이어가 바깥쪽 원에 있을 때 통과
        const isCorrectPassing = (o.onOuterCircle && !actualPlayerOnOuterCircle) || 
                               (o.onInnerCircle && actualPlayerOnOuterCircle);
        
        if (isCorrectPassing) {
            // 속도에 비례한 감지 범위 계산
            const speedMultiplier = Math.max(1, speed / INITIAL_SPEED); // 속도 배수
            const removalRange = 0.2 * speedMultiplier; // 제거 범위
            const passingRange = 0.05 * speedMultiplier; // 통과 감지 범위
            
            // 이미 지나간 장애물이면 제거 (속도에 비례한 범위에서 체크)
            if (o.passed && normalizedDiff < removalRange && normalizedDiff > -removalRange) {
                obstacles.splice(i, 1);
                console.log(`장애물 제거됨 - 현재 개수: ${obstacles.length}`);
                
                // 장애물이 제거되면 새로운 장애물 추가
                addNewObstacleBehindPlayer();
            }
            // 처음 지나가는 장애물이면 통과 표시하고 점수 추가 (속도에 비례한 범위에서 체크)
            else if (!o.passed && normalizedDiff < passingRange && normalizedDiff > -passingRange) {
                o.passed = true;
                const previousScore = score;
                score++;
                
                // 30점의 배수에 도달했을 때만 새로운 장애물 추가
                const previousMultiple = Math.floor(previousScore / OBSTACLE_INCREASE_INTERVAL);
                const currentMultiple = Math.floor(score / OBSTACLE_INCREASE_INTERVAL);
                
                if (currentMultiple > previousMultiple) {
                    console.log(`30점 배수 달성! 점수: ${score}, 현재 장애물 개수: ${obstacles.length}`);
                    addNewObstacleBehindPlayer();
                    console.log(`장애물 추가 후 개수: ${obstacles.length}`);
                }
            }
        }
    }
}

// 플레이어 뒤쪽에 새로운 장애물 추가
function addNewObstacleBehindPlayer() {
    console.log(`addNewObstacleBehindPlayer 호출됨 - 현재 장애물 개수: ${obstacles.length}, 최대: ${MAX_TOTAL_OBSTACLES}`);
    
    // 전체 최대 개수 제한만 체크
    if (obstacles.length >= MAX_TOTAL_OBSTACLES) {
        console.log("최대 장애물 개수에 도달하여 추가하지 않음");
        return;
    }
    
    const playerAngle = player.angle;
    const behindAngle = playerAngle - Math.PI; // 플레이어 뒤쪽 180도
    
    // 여러 위치를 시도해보기
    const anglesToTry = [
        behindAngle, // 기본 위치 (180도 뒤)
        behindAngle + Math.PI / 4, // 45도 오른쪽
        behindAngle - Math.PI / 4, // 45도 왼쪽
        behindAngle + Math.PI / 2, // 90도 오른쪽
        behindAngle - Math.PI / 2, // 90도 왼쪽
        behindAngle + Math.PI * 3 / 4, // 135도 오른쪽
        behindAngle - Math.PI * 3 / 4, // 135도 왼쪽
    ];
    
    for (let angle of anglesToTry) {
        // 각도를 정규화
        const normalizedAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        
        // 기존 장애물과의 거리 체크 (15도로 완화)
        let isValidPosition = true;
        for (let existingObstacle of obstacles) {
            const distance = Math.min(Math.abs(normalizedAngle - existingObstacle.angle), 
                                     Math.PI * 2 - Math.abs(normalizedAngle - existingObstacle.angle));
            if (distance < Math.PI / 12) { // 15도 이내에 다른 장애물이 있으면 안됨
                isValidPosition = false;
                break;
            }
        }
        
        if (isValidPosition) {
            // 랜덤하게 바깥쪽 또는 안쪽 원에 장애물 추가
            const isOuterCircle = Math.random() < 0.6; // 60% 확률로 바깥쪽 원
            
            obstacles.push({
                angle: normalizedAngle,
                onOuterCircle: isOuterCircle,
                onInnerCircle: !isOuterCircle,
                passed: false
            });
            console.log(`장애물 추가 완료 - 새 장애물 개수: ${obstacles.length}`);
            return; // 성공적으로 추가했으면 함수 종료
        }
    }
    
    // 모든 위치가 실패한 경우, 거리 조건을 더 완화해서 시도
    const fallbackAngle = ((behindAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const isOuterCircle = Math.random() < 0.6;
    
    obstacles.push({
        angle: fallbackAngle,
        onOuterCircle: isOuterCircle,
        onInnerCircle: !isOuterCircle,
        passed: false
    });
    console.log(`Fallback으로 장애물 추가 완료 - 새 장애물 개수: ${obstacles.length}`);
}

// 속도 표시 업데이트
function updateSpeedDisplay() {
    const speedValue = Math.round(speed * 1000); // 소수점 3자리까지 표시
    speedDisplay.textContent = `속도: ${speedValue}`;
}

function update() {
    if (!running) return;
    if (gameOver) return;

    // 프레임레이트 독립적인 속도 계산
    const currentTime = performance.now();
    const deltaTime = lastTime === 0 ? 16.67 : currentTime - lastTime; // 60fps 기준
    lastTime = currentTime;
    
    // deltaTime을 60fps 기준으로 정규화 (16.67ms = 1프레임)
    const normalizedDeltaTime = deltaTime / 16.67;

    angle += speed * normalizedDeltaTime;
    
    // 속도가 변경될 때마다 실제 이동 속도 재계산
    outerMoveSpeed = speed * (innerRadius / outerRadius);
    innerMoveSpeed = speed;

    // 플레이어가 원을 따라 움직임 (원의 반지름에 따라 속도 조정)
    let currentMoveSpeed;
    if (player.switching) {
        // 전환 중일 때는 두 속도를 보간
        const startSpeed = player.isOnOuterCircle ? outerMoveSpeed : innerMoveSpeed;
        const endSpeed = player.isOnOuterCircle ? innerMoveSpeed : outerMoveSpeed;
        currentMoveSpeed = startSpeed + (endSpeed - startSpeed) * player.switchProgress;
    } else {
        // 일반 상태일 때는 현재 원에 맞는 속도 사용
        currentMoveSpeed = player.isOnOuterCircle ? outerMoveSpeed : innerMoveSpeed;
    }
    player.angle += currentMoveSpeed * normalizedDeltaTime;

    // 원 전환 중일 때 처리
    if (player.switching) {
        player.switchProgress += 0.3; // 전환 속도 (더 빠르게)
        if (player.switchProgress >= 1) {
            player.switchProgress = 0;
            player.switching = false;
            player.isOnOuterCircle = !player.isOnOuterCircle; // 원 전환 완료
        }
    }

    // 플레이어가 한바퀴 돌았는지 체크 (상단에서 시작해서 다시 상단으로)
    if (player.angle >= Math.PI * 1.5) { // 270도 지점에서 체크
        player.angle = -Math.PI / 2; // 상단으로 즉시 리셋
        level = Math.floor(score / 3) + 1; // 3점마다 레벨업
        speed += SPEED_INCREASE; // 속도 증가량
        // createObstacles() 제거 - 이제 장애물은 동적으로 추가됨
    }
    
    // 플레이어 각도 정규화
    if (player.angle > Math.PI * 2) {
        player.angle -= Math.PI * 2;
    }

    // 장애물 통과 체크 및 새로운 장애물 추가
    checkObstaclePassing();
    
    // 속도 표시 업데이트
    updateSpeedDisplay();
    
    checkCollision();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCircles();
    drawObstacles();
    drawPlayer();
    
    // 디버깅 모드: 정보 표시
    if (debugMode) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(10, 10, 250, 140);
        
        ctx.fillStyle = "white";
        ctx.font = "14px Arial";
        ctx.fillText(`디버깅 모드 ON`, 20, 30);
        ctx.fillText(`플레이어 각도: ${player.angle.toFixed(2)}`, 20, 50);
        ctx.fillText(`장애물 개수: ${obstacles.length}`, 20, 70);
        ctx.fillText(`점수: ${score}`, 20, 90);
        ctx.fillText(`기본 속도: ${speed.toFixed(3)}`, 20, 110);
        ctx.fillText(`바깥쪽 속도: ${outerMoveSpeed.toFixed(4)}`, 20, 130);
        ctx.fillText(`안쪽 속도: ${innerMoveSpeed.toFixed(4)}`, 20, 150);
        ctx.fillText(`D키로 토글`, 20, 170);
    }
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
        speed = INITIAL_SPEED; // 초기 속도로 초기화
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

// 키보드 이벤트 추가 (스페이스바)
document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
        e.preventDefault(); // 스페이스바로 페이지 스크롤 방지
        handleInput();
    }
    // 디버깅 모드 토글 (D 키)
    else if (e.code === "KeyD") {
        e.preventDefault();
        debugMode = !debugMode;
        console.log(`디버깅 모드: ${debugMode ? 'ON' : 'OFF'}`);
    }
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
