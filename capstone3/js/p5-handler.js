// p5.js 관련 코드
let font;
let state = 'eng'; // 'eng' 또는 'kor'
let canvasLayer; // 포트폴리오 배경 위, 텍스트 아래에 두기 위한 캔버스 레이어

// 모핑 루프 제어
let morphLoopEnabled = true;
let morphTimeout = null;
let currentMorphState = 'eng';

function preload(){
  font = loadFont('NotoSansKR-Bold.ttf');
}

function setup(){
  createCanvas(windowWidth, windowHeight);
  
  // 캔버스를 포트폴리오 배경 위, 텍스트 아래에 배치
  canvasLayer = createGraphics(windowWidth, windowHeight);
  canvasLayer.position(0, 0);
  canvasLayer.style('position', 'fixed');
  canvasLayer.style('top', '0');
  canvasLayer.style('left', '0');
  canvasLayer.style('z-index', '1');
  canvasLayer.style('pointer-events', 'none');
  
  // 점 크기와 그리드 간격 설정
  POINT_SIZE = min(windowWidth, windowHeight) / 80;
  GRID_STEP = POINT_SIZE * 1.5;
  
  // 영어와 한글 점 배열 초기화
  engPoints = [];
  korPoints = [];
  
  // 영어 점 생성
  for(let x = 0; x < width; x += GRID_STEP){
    for(let y = 0; y < height; y += GRID_STEP){
      engPoints.push({x: x, y: y});
    }
  }
  
  // 한글 점 생성 (영어 점과 동일한 위치)
  for(let i = 0; i < engPoints.length; i++){
    korPoints.push({x: engPoints[i].x, y: engPoints[i].y});
  }
  
  // 파티클 배열 초기화
  particles = [];
  for(let i = 0; i < engPoints.length; i++){
    particles.push({
      x: engPoints[i].x,
      y: engPoints[i].y,
      tx: engPoints[i].x,
      ty: engPoints[i].y
    });
  }
  
  // 포트폴리오 페이지 초기화
  setTimeout(() => {
    if (typeof initPortfolioPages === 'function') {
      initPortfolioPages();
    }
  }, 100);
  
  // 첫 번째 모핑 시작
  scheduleMorphTransition(() => morphToKor(), 1000);
}

function draw(){
  // 잔상 감소: 배경 알파를 높여 이전 프레임을 더 많이 지움
  background(0, 200);
  fill(255);
  
  if(physicsEnabled) {
    // 모핑 유지 모드면 목표 지점으로 끌어당기는 힘 적용
    if (physicsMorphMode) {
      applyMorphForces();
    }

    // 물리 엔진 업데이트 (더 작은 타임스텝)
    Matter.Engine.update(engine, PHYSICS.TIMESTEP_MS);

    // DOM 요소와 물리 바디 동기화
    if (typeof syncNameTextBodiesToDOM === 'function') {
      syncNameTextBodiesToDOM();
    }
    if (typeof syncPortfolioBodiesToDOM === 'function') {
      syncPortfolioBodiesToDOM();
    }
    
    // 물리 바디 위치로 점 그리기
    for(let p of particles){
      if(p.body) {
        p.x = p.body.position.x;
        p.y = p.body.position.y;
      }
      ellipse(p.x, p.y, POINT_SIZE, POINT_SIZE);
    }
  } else {
    // 일반 모핑 애니메이션
    let step = 0.05;
    for(let p of particles){
      p.x = lerp(p.x, p.tx, step);
      p.y = lerp(p.y, p.ty, step);
      ellipse(p.x, p.y, POINT_SIZE, POINT_SIZE);
    }
  }
}

// 영어 → 한글 모핑
function scheduleMorphTransition(fn, delay){
  if (morphTimeout) {
    clearTimeout(morphTimeout);
    morphTimeout = null;
  }
  
  morphTimeout = setTimeout(fn, delay);
}

function morphToKor(){
  if (!morphLoopEnabled) return;
  
  currentMorphState = 'kor';
  state = 'kor';
  
  for(let i = 0; i < particles.length; i++){
    particles[i].tx = korPoints[i].x;
    particles[i].ty = korPoints[i].y;
  }

  scheduleMorphTransition(morphToEng, 2500);
}

function morphToEng(){
  if (!morphLoopEnabled) return;
  
  currentMorphState = 'eng';
  state = 'eng';
  
  for(let i = 0; i < particles.length; i++){
    particles[i].tx = engPoints[i].x;
    particles[i].ty = engPoints[i].y;
  }

  scheduleMorphTransition(morphToKor, 2500);
}

// 모핑 루프 일시정지
function pauseMorphLoop() {
  morphLoopEnabled = false;
  if (morphTimeout) {
    clearTimeout(morphTimeout);
    morphTimeout = null;
  }
}

// 모핑 루프 재개
function resumeMorphLoop() {
  morphLoopEnabled = true;
  if (currentMorphState === 'eng') {
    scheduleMorphTransition(morphToKor, 1000);
  } else {
    scheduleMorphTransition(morphToEng, 1000);
  }
}

function windowResized(){
  resizeCanvas(windowWidth, windowHeight);
  
  // 점 크기와 그리드 간격 재계산
  POINT_SIZE = min(windowWidth, windowHeight) / 80;
  GRID_STEP = POINT_SIZE * 1.5;
  
  // 캔버스 레이어 크기 조정
  if (canvasLayer) {
    canvasLayer.resizeCanvas(windowWidth, windowHeight);
    canvasLayer.position(0, 0);
    canvasLayer.style('position', 'fixed');
    canvasLayer.style('top', '0');
    canvasLayer.style('left', '0');
    canvasLayer.style('z-index', '1');
    canvasLayer.style('pointer-events', 'none');
  }

  if (physicsEnabled) {
    if (interactionStep === 2) {
      if (typeof createPortfolioBodies === 'function') {
        createPortfolioBodies();
      }
    } else {
      if (typeof clearPortfolioBodies === 'function') {
        clearPortfolioBodies();
      }
    }

    if (nameTextsVisible) {
      if (typeof createNameTextBodies === 'function') {
        createNameTextBodies();
      }
    }
  }

  if (typeof updateGroundPosition === 'function') {
    updateGroundPosition();
  }
}
