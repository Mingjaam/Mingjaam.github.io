// 페이지 리로드 시 항상 최상단으로 스크롤
try { if ('scrollRestoration' in history) { history.scrollRestoration = 'manual'; } } catch (e) {}
window.addEventListener('load', () => {
  window.scrollTo(0, 0);
  setTimeout(() => window.scrollTo(0, 0), 0); // 일부 브라우저 보정
});

let font;
let particles = [];
let state = 'eng'; // 'eng' 또는 'kor'
let POINT_SIZE;
let GRID_STEP;
let engPoints = [];
let korPoints = [];
let canvasLayer; // 포트폴리오 배경 위, 텍스트 아래에 두기 위한 캔버스 레이어
let portfolioElements = [];
let portfolioSizes = [];
let groundBody = null;

// 이름 섹션 관련
let nameTextBodies = []; // 이름 텍스트 물리 바디들
let nameTextElements = [];
let nameTextSizes = [];
let nameTextsVisible = false;

// 상호작용 단계 (스크롤 횟수 기반)
let interactionStep = 0; // 0: 기본, 1: 이름 텍스트, 2: 포트폴리오/물리
const MAX_INTERACTION_STEP = 2;
let lastScrollTime = 0;
let scrollDebounceDelay = 300; // 0.3초 디바운스
let nameStageMorphTimeout = null;
let interactionLockTimeout = null;
let interactionLocked = false;

// 모핑 루프 제어
let morphLoopEnabled = true;
let morphTimeout = null;
let currentMorphState = 'eng';

// 물리 상태 제어
let physicsMorphMode = false; // true면 물리 상태에서도 목표 위치로 끌어당김

// 포트폴리오 페이지 전환
let currentPortfolioPage = 0;
let portfolioPages = [];
let isTransitioning = false;

// Matter.js 물리 엔진
let engine;
let world;
let bodies = [];
let portfolioBodies = []; // 포트폴리오 텍스트 바디들
let physicsEnabled = false;

// 물리 상수 (공/장애물/중력 등)
// - 값 조절로 낙하 속도, 탄성, 마찰, 정확도 등을 쉽게 변경합니다.
const PHYSICS = {
  GRAVITY_Y: 1.6,          // 전역 중력 가속도(아래 방향). 값↑ = 더 빠른 낙하
  POSITION_ITER: 12,       // 충돌 지오메트리 해결 반복 횟수(값↑ = 정확↑, 성능↓)
  VELOCITY_ITER: 8,        // 속도/마찰 해결 반복 횟수
  CONSTRAINT_ITER: 2,      // 제약(조인트 등) 해결 반복 횟수
  TIMESTEP_MS: 1000 / 120, // 물리 업데이트 간격(ms). 작을수록 부드럽고 정확(성능 비용↑)
  
  // 공(파티클) 기본 물성치
  BALL: {
    RESTITUTION: 0.3,   // 탄성(0=흡수, 1=완전탄성). 값↑ = 더 많이 튕김
    FRICTION: 0.01,      // 표면 마찰(접촉 중 감속)
    FRICTION_AIR: 0.01,// 공기 저항(값↑ = 공중에서 빨리 감속)
    DENSITY: 0.1,      // 밀도(질량). 값↑ = 더 무거움
  },

  // 텍스트(장애물) 물성치
  OBSTACLE: {
    FRICTION: 0.2,      // 접촉 마찰
    RESTITUTION: 0.01,   // 탄성(튕김 정도)
    HITBOX_MIN: 10,     // 텍스트 히트박스 최소 크기(px)
    HITBOX_PADDING: 15,  // 텍스트 히트박스 여유(px)
  },

  // 바닥 물성치
  GROUND: {
    FRICTION: 0.6,      // 접촉 마찰
    RESTITUTION: 0.1,   // 탄성
    THICKNESS: 40,      // 바닥 두께(px, 보이지 않음)
    WIDTH_MULTIPLIER: 2,// 창 너비 대비 바닥 폭 배수
    WIDTH_TOLERANCE: 1, // 바닥 폭 보정 허용 오차(px)
  },

  // 모핑 시 물리 바디를 목표 지점으로 끌어당기는 힘 계수
  MORPH: {

    FORCE: 0.0006,      // 목표 지점으로 당기는 기본 힘 계수
    MAX_FORCE: 0.004,   // 한 프레임당 적용할 수 있는 최대 힘
  },
};

function preload(){
  font = loadFont('NotoSansKR-Bold.ttf');
}

function setup(){
  canvasLayer = createCanvas(windowWidth, windowHeight);
  // 캔버스를 화면 고정 레이어로 설정 (배경 위, 텍스트 아래)
  canvasLayer.position(0, 0);
  canvasLayer.style('position', 'fixed');
  canvasLayer.style('top', '0');
  canvasLayer.style('left', '0');
  canvasLayer.style('z-index', '1');
  canvasLayer.style('pointer-events', 'none');
  noStroke();
  fill(255);

  // 모바일/PC에 따른 점 크기와 그리드 설정
  const sizeConfig = computeSizing(windowWidth, width);
  POINT_SIZE = sizeConfig.pointSize;
  GRID_STEP = sizeConfig.gridStep;

  // Matter.js 물리 엔진 초기화
  engine = Matter.Engine.create();
  world = engine.world;
  // 더 빠르게 떨어지도록 중력 증가
  engine.world.gravity.y = PHYSICS.GRAVITY_Y; // 중력 설정
  // 충돌 안정성 향상
  engine.positionIterations = PHYSICS.POSITION_ITER;
  engine.velocityIterations = PHYSICS.VELOCITY_ITER;
  engine.constraintIterations = PHYSICS.CONSTRAINT_ITER;
  
  // 충돌 이벤트 리스너 추가 (공과 텍스트 충돌 시 퍼지는 효과)
  Matter.Events.on(engine, 'collisionStart', function(event) {
    const pairs = event.pairs;
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;
      
      // 공과 텍스트 충돌 감지
      let ballBody = null;
      let textBody = null;
      
      // 공 바디 찾기
      for (let j = 0; j < bodies.length; j++) {
        if (bodies[j] === bodyA || bodies[j] === bodyB) {
          ballBody = bodies[j];
          break;
        }
      }
      
      // 텍스트 바디 찾기 (이름 텍스트 또는 포트폴리오 텍스트)
      if (nameTextBodies.includes(bodyA) || nameTextBodies.includes(bodyB)) {
        textBody = nameTextBodies.includes(bodyA) ? bodyA : bodyB;
      } else if (portfolioBodies.includes(bodyA) || portfolioBodies.includes(bodyB)) {
        textBody = portfolioBodies.includes(bodyA) ? bodyA : bodyB;
      }
      
      // 충돌 시 공에 임펄스 추가 (퍼지는 효과)
      if (ballBody && textBody) {
        const impulse = {
          x: (Math.random() - 0.5) * 0.1,
          y: (Math.random() - 0.5) * 0.1
        };
        Matter.Body.applyForce(ballBody, ballBody.position, impulse);
      }
    }
  });
  
  // 포트폴리오 텍스트를 물리 바디로 생성
  createPortfolioBodies();

  // offscreen graphics 생성
  let gfxEng = createGraphics(width, height);
  gfxEng.pixelDensity(1);
  gfxEng.background(0);
  gfxEng.fill(255);
  gfxEng.textFont(font);
  gfxEng.textSize(sizeConfig.textSizeEng);
  gfxEng.textAlign(CENTER, CENTER);
  gfxEng.text('KIM MIN JAE', width/2, height/2);

  let gfxKor = createGraphics(width, height);
  gfxKor.pixelDensity(1);
  gfxKor.background(0);
  gfxKor.fill(255);
  gfxKor.textFont(font);
  gfxKor.textSize(sizeConfig.textSizeKor);
  gfxKor.textAlign(CENTER, CENTER);
  gfxKor.text('김민재', width/2, height/2);

  // 영어 점 추출
  for(let y=0;y<height;y+=GRID_STEP){
    for(let x=0;x<width;x+=GRID_STEP){
      if(gfxEng.get(x,y)[0] >127){
        engPoints.push({x:x,y:y});
      }
    }
  }

  // 한글 점 추출
  for(let y=0;y<height;y+=GRID_STEP){
    for(let x=0;x<width;x+=GRID_STEP){
      if(gfxKor.get(x,y)[0] >127){
        korPoints.push({x:x,y:y});
      }
    }
  }

  // 정렬된 모핑을 위해 포인트를 행(y) 우선, 열(x) 순으로 정렬
  const pointSorter = (a, b) => (a.y - b.y) || (a.x - b.x);
  engPoints.sort(pointSorter);
  korPoints.sort(pointSorter);

  // 초기 particles 생성 (영어 글자 위치)
  for(let i=0;i<engPoints.length;i++){
    let p = engPoints[i];
    particles.push({
      x:p.x, y:p.y,
      tx:p.x, ty:p.y,
      body: null // 물리 바디는 나중에 생성
    });
  }

  // 전역 휠/키 입력으로 단계 전환
  window.addEventListener('wheel', handleInteractionWheel, { passive: false });
  window.addEventListener('keydown', handleInteractionKey);

  // 포트폴리오 페이지 초기화
  initPortfolioPages();

  // 초기 모핑 시작 (영어 → 한글)
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
    syncNameTextBodiesToDOM();
    syncPortfolioBodiesToDOM();
    
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
  if (!morphLoopEnabled) return;
  morphTimeout = setTimeout(() => {
    morphTimeout = null;
    if (morphLoopEnabled) fn();
  }, delay);
}

function pauseMorphLoop(){
  morphLoopEnabled = false;
  if (morphTimeout) {
    clearTimeout(morphTimeout);
    morphTimeout = null;
  }
}

function resumeMorphLoop(nextTarget){
  if (morphLoopEnabled) return;
  morphLoopEnabled = true;
  if (nextTarget === 'kor') {
    morphToKor();
  } else if (nextTarget === 'eng') {
    morphToEng();
  } else {
    if (currentMorphState === 'eng') {
      morphToKor();
    } else {
      morphToEng();
    }
  }
}

function computeSizing(windowW, canvasW) {
  const minW = 400;
  const maxW = 1600;
  const clampW = Math.max(minW, Math.min(maxW, windowW));
  const t = (clampW - minW) / (maxW - minW);

  const pointSize = lerp(4, 12, t);
  const gridStep = lerp(3, 12, t);
  const textSizeEng = lerp(canvasW * 0.12, canvasW * 0.15, t);
  const textSizeKor = lerp(canvasW * 0.15, canvasW * 0.18, t);

  return {
    pointSize,
    gridStep,
    textSizeEng,
    textSizeKor
  };
}

function morphToKor(){
  if (!morphLoopEnabled) return;
  const targets = shuffleArray(korPoints.slice()); // 정렬된 포인트의 랜덤 매핑
  for(let i=0;i<particles.length;i++){
    let target = targets[i % targets.length];
    particles[i].tx = target.x; // 정렬된 좌표 그대로 (노 지터)
    particles[i].ty = target.y;
  }
  state='kor';
  currentMorphState = 'kor';

  scheduleMorphTransition(morphToEng, 2500);
}

// 한글 → 영어 모핑
function morphToEng(){
  if (!morphLoopEnabled) return;
  const targets = shuffleArray(engPoints.slice()); // 정렬된 포인트의 랜덤 매핑
  for(let i=0;i<particles.length;i++){
    let target = targets[i % targets.length];
    particles[i].tx = target.x; // 정렬된 좌표 그대로 (노 지터)
    particles[i].ty = target.y;
  }
  state='eng';
  currentMorphState = 'eng';

  scheduleMorphTransition(morphToKor, 2500);
}

// 포트폴리오 텍스트를 물리 바디로 생성
function createPortfolioBodies() {
  clearPortfolioBodies();

  // 활성 페이지의 텍스트 요소들을 충돌체로 생성
  const activePage = document.querySelector('.portfolio-page.active');
  if (!activePage) return;
  
  // 제목 (h2)을 별도로 처리
  const titleElement = activePage.querySelector('h2');
  if (titleElement) {
    const rect = titleElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const w = Math.max(PHYSICS.OBSTACLE.HITBOX_MIN, rect.width) + PHYSICS.OBSTACLE.HITBOX_PADDING;
    const h = Math.max(PHYSICS.OBSTACLE.HITBOX_MIN, rect.height) + PHYSICS.OBSTACLE.HITBOX_PADDING;
    
    const body = Matter.Bodies.rectangle(centerX, centerY, w, h, {
      isStatic: true,
      friction: PHYSICS.OBSTACLE.FRICTION,
      restitution: PHYSICS.OBSTACLE.RESTITUTION,
      render: { visible: false }
    });
    
    portfolioBodies.push(body);
    portfolioElements.push(titleElement);
    portfolioSizes.push({ w, h });
  }
  
  // 내용 박스를 하나의 큰 충돌체로 처리
  const contentBox = activePage.querySelector('.content-box');
  if (contentBox) {
    const rect = contentBox.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const w = Math.max(PHYSICS.OBSTACLE.HITBOX_MIN, rect.width) + PHYSICS.OBSTACLE.HITBOX_PADDING;
    const h = Math.max(PHYSICS.OBSTACLE.HITBOX_MIN, rect.height) + PHYSICS.OBSTACLE.HITBOX_PADDING;
    
    const body = Matter.Bodies.rectangle(centerX, centerY, w, h, {
      isStatic: true,
      friction: PHYSICS.OBSTACLE.FRICTION,
      restitution: PHYSICS.OBSTACLE.RESTITUTION,
      render: { visible: false }
    });
    
    portfolioBodies.push(body);
    portfolioElements.push(contentBox);
    portfolioSizes.push({ w, h });
  }
  
  Matter.World.add(world, portfolioBodies);
  console.log('포트폴리오 텍스트 충돌체 생성 완료:', portfolioBodies.length);
}

function clearPortfolioBodies() {
  if (portfolioBodies.length && world) {
    portfolioBodies.forEach(body => Matter.World.remove(world, body));
  }

  portfolioBodies = [];
  portfolioElements = [];
  portfolioSizes = [];
}

function syncPortfolioBodiesToDOM() {
  for (let i = 0; i < portfolioBodies.length; i++) {
    const el = portfolioElements[i];
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const body = portfolioBodies[i];
    Matter.Body.setPosition(body, { x: centerX, y: centerY });

    // 사이즈 변화가 있으면 스케일 조정
    const prev = portfolioSizes[i];
    const newW = Math.max(PHYSICS.OBSTACLE.HITBOX_MIN, rect.width) + PHYSICS.OBSTACLE.HITBOX_PADDING;
    const newH = Math.max(PHYSICS.OBSTACLE.HITBOX_MIN, rect.height) + PHYSICS.OBSTACLE.HITBOX_PADDING;
    if (Math.abs(prev.w - newW) > 0.5 || Math.abs(prev.h - newH) > 0.5) {
      const sx = newW / prev.w;
      const sy = newH / prev.h;
      Matter.Body.scale(body, sx, sy);
      portfolioSizes[i] = { w: newW, h: newH };
    }
  }
}

// 배열 랜덤 섞기 (Fisher-Yates)
function shuffleArray(array){
  for(let i=array.length-1;i>0;i--){
    let j = floor(random(i+1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function handleInteractionWheel(e) {
  const dy = e.deltaY || 0;
  if (Math.abs(dy) < 5) return;

  if (interactionLocked) {
    e.preventDefault();
    return;
  }

  const now = Date.now();
  if (now - lastScrollTime < scrollDebounceDelay) {
    e.preventDefault();
    return;
  }

  let handled = false;
  if (interactionStep === 2) {
    handled = processPortfolioWheel(dy);
  }

  if (!handled) {
    if (dy > 0) {
      advanceInteractionStep();
    } else {
      retreatInteractionStep();
    }
  }

  lastScrollTime = now;
  e.preventDefault();
}

function handleInteractionKey(e) {
  const key = e.key;
  const now = Date.now();

  if (interactionLocked) {
    e.preventDefault();
    return;
  }

  if (key === 'ArrowDown' || key === 'PageDown' || key === ' ') {
    e.preventDefault();
    if (now - lastScrollTime < scrollDebounceDelay) return;

    if (interactionStep === 2) {
      const handled = processPortfolioWheel(120);
      if (handled) {
        lastScrollTime = now;
        return;
      }
    }

    advanceInteractionStep();
    lastScrollTime = now;
  } else if (key === 'ArrowUp' || key === 'PageUp') {
    e.preventDefault();
    if (now - lastScrollTime < scrollDebounceDelay) return;

    if (interactionStep === 2) {
      const handled = processPortfolioWheel(-120);
      if (handled) {
        lastScrollTime = now;
        return;
      }
    }

    retreatInteractionStep();
    lastScrollTime = now;
  }
}

function advanceInteractionStep() {
  if (interactionStep >= MAX_INTERACTION_STEP) return;
  setInteractionStep(interactionStep + 1);
}

function retreatInteractionStep() {
  if (interactionStep <= 0) return;
  setInteractionStep(interactionStep - 1);
}

function setInteractionStep(step) {
  const target = Math.max(0, Math.min(MAX_INTERACTION_STEP, step));
  if (target === interactionStep) return;

  const previous = interactionStep;
  interactionStep = target;

  switch (interactionStep) {
    case 0:
      enterStep0(previous);
      break;
    case 1:
      enterStep1(previous);
      break;
    case 2:
      enterStep2(previous);
      break;
  }
}

function cleanupNameStageTimeout() {
  if (nameStageMorphTimeout) {
    clearTimeout(nameStageMorphTimeout);
    nameStageMorphTimeout = null;
  }
}

function lockInteraction(duration) {
  if (interactionLockTimeout) {
    clearTimeout(interactionLockTimeout);
  }
  interactionLocked = true;
  interactionLockTimeout = setTimeout(() => {
    interactionLocked = false;
    interactionLockTimeout = null;
  }, duration);
}

function enterStep0(prevStep) {
  cleanupNameStageTimeout();
  lockInteraction(350);
  hideNameTexts();

  const portfolioSection = document.querySelector('.portfolio-section');
  if (portfolioSection) {
    portfolioSection.classList.remove('active');
  }

  physicsMorphMode = false;
  resumeMorphLoop();

  if (physicsEnabled) {
    disablePhysics();
  }
}

function enterStep1(prevStep) {
  cleanupNameStageTimeout();
  lockInteraction(1600);

  const portfolioSection = document.querySelector('.portfolio-section');
  if (portfolioSection) {
    portfolioSection.classList.remove('active');
  }

  if (physicsEnabled) {
    disablePhysics();
  }

  physicsMorphMode = false;
  hideNameTexts();

  pauseMorphLoop();

  requestAnimationFrame(() => {
    if (interactionStep !== 1) return;
    showNameTexts();
    enablePhysics({ includePortfolio: false });
    physicsMorphMode = true;
  });

  nameStageMorphTimeout = setTimeout(() => {
    if (interactionStep === 1) {
      physicsMorphMode = false;
      if (physicsEnabled) {
        disablePhysics();
      }
      resumeMorphLoop();
    }
    nameStageMorphTimeout = null;
  }, 2000);
}

function enterStep2(prevStep) {
  cleanupNameStageTimeout();
  lockInteraction(600);
  hideNameTexts();

  pauseMorphLoop();
  physicsMorphMode = false;

  const portfolioSection = document.querySelector('.portfolio-section');
  if (portfolioSection) {
    portfolioSection.classList.add('active');
  }

  requestAnimationFrame(() => {
    if (interactionStep !== 2) return;
    enablePhysics({ includePortfolio: true });
    createPortfolioBodies();

    setTimeout(() => {
      if (interactionStep === 2 && physicsEnabled) {
        createPortfolioBodies();
      }
    }, 180);
  });
}

function processPortfolioWheel(deltaY) {
  if (!physicsEnabled) return false;
  if (Math.abs(deltaY) < 5) return false;

  if (deltaY > 0) {
    return nextPortfolioPage();
  }
  if (deltaY < 0) {
    return prevPortfolioPage();
  }
  return false;
}

function updateGroundPosition() {
  if (!groundBody) return;
  const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
  const innerH = window.innerHeight;
  const scrollY = window.scrollY || 0;
  const remaining = Math.max(0, scrollHeight - (scrollY + innerH));
  const bottomViewportY = innerH + remaining; // 뷰포트 기준 문서 바닥 위치
  const thickness = PHYSICS.GROUND.THICKNESS;
  Matter.Body.setPosition(groundBody, { x: window.innerWidth/2, y: bottomViewportY + thickness/2 });
  // 바닥 너비도 창 너비 변화에 맞춰 보정
  const currentBoundsWidth = groundBody.bounds.max.x - groundBody.bounds.min.x;
  const desiredWidth = window.innerWidth * PHYSICS.GROUND.WIDTH_MULTIPLIER;
  if (Math.abs(currentBoundsWidth - desiredWidth) > PHYSICS.GROUND.WIDTH_TOLERANCE) {
    const sx = desiredWidth / currentBoundsWidth;
    Matter.Body.scale(groundBody, sx, 1);
  }
}

// 물리 효과 활성화
function enablePhysics(options = {}) {
  const { includePortfolio = true } = options;

  if (physicsEnabled) {
    if (includePortfolio) {
      createPortfolioBodies();
    } else {
      clearPortfolioBodies();
    }

    if (nameTextsVisible) createNameTextBodies();
    updateGroundPosition();
    return;
  }

  physicsEnabled = true;

  if (includePortfolio) {
    createPortfolioBodies();
  }

  // 바닥(페이지 최하단) 생성
  const thickness = PHYSICS.GROUND.THICKNESS;
  groundBody = Matter.Bodies.rectangle(
    window.innerWidth / 2,
    window.innerHeight + thickness,
    window.innerWidth * PHYSICS.GROUND.WIDTH_MULTIPLIER,
    thickness,
    {
      isStatic: true,
      friction: PHYSICS.GROUND.FRICTION,
      restitution: PHYSICS.GROUND.RESTITUTION,
      render: { visible: false }
    }
  );
  Matter.World.add(world, groundBody);
  updateGroundPosition();

  // 모든 점에 물리 바디 생성
  for (let i = 0; i < particles.length; i++) {
    let p = particles[i];

    let body = Matter.Bodies.circle(p.x, p.y, POINT_SIZE / 2, {
      restitution: PHYSICS.BALL.RESTITUTION,
      friction: PHYSICS.BALL.FRICTION,
      frictionAir: PHYSICS.BALL.FRICTION_AIR,
      density: PHYSICS.BALL.DENSITY,
    });

    p.body = body;
    bodies.push(body);
    Matter.World.add(world, body);
  }

  if (nameTextsVisible) {
    createNameTextBodies();
  }

  console.log('물리 효과 활성화! 모든 점이 떨어집니다.');
}

// 물리 효과 비활성화
function disablePhysics() {
  physicsEnabled = false;

  bodies.forEach(body => Matter.World.remove(world, body));
  bodies = [];

  clearPortfolioBodies();

  removeNameTextBodies();

  if (groundBody) {
    Matter.World.remove(world, groundBody);
    groundBody = null;
  }

  particles.forEach(p => {
    p.body = null;
  });

  console.log('물리 효과 비활성화! 점들이 다시 글씨로 모핑됩니다.');
}

function windowResized(){
  resizeCanvas(windowWidth, windowHeight);
  
  const sizeConfig = computeSizing(windowWidth, width);
  POINT_SIZE = sizeConfig.pointSize;
  GRID_STEP = sizeConfig.gridStep;

  // 캔버스 고정 레이어 스타일 유지
  if (canvasLayer) {
    canvasLayer.position(0, 0);
    canvasLayer.style('position', 'fixed');
    canvasLayer.style('top', '0');
    canvasLayer.style('left', '0');
    canvasLayer.style('z-index', '1');
    canvasLayer.style('pointer-events', 'none');
  }

  if (physicsEnabled) {
    if (interactionStep === 2) {
      createPortfolioBodies();
    } else {
      clearPortfolioBodies();
    }

    if (nameTextsVisible) {
      createNameTextBodies();
    }
  }

  updateGroundPosition();
}

// 포트폴리오 페이지 초기화
function initPortfolioPages() {
  portfolioPages = document.querySelectorAll('.portfolio-page');
  currentPortfolioPage = 0;

  portfolioPages.forEach((page, index) => {
    page.classList.remove('active', 'prev', 'next');
    if (index === 0) {
      page.classList.add('active');
    } else {
      page.classList.add('next');
    }
  });
  
  console.log('포트폴리오 페이지 초기화 완료:', portfolioPages.length, '페이지');
}

function nextPortfolioPage() {
  if (!portfolioPages || portfolioPages.length === 0) return false;
  if (isTransitioning) return true;
  if (currentPortfolioPage >= portfolioPages.length - 1) return false;

  isTransitioning = true;
  
  // 페이지 전환 시작 시 즉시 물리 바디 제거
  if (physicsEnabled) clearPortfolioBodies();

  portfolioPages[currentPortfolioPage].classList.remove('active');
  portfolioPages[currentPortfolioPage].classList.add('prev');

  currentPortfolioPage++;
  portfolioPages[currentPortfolioPage].classList.remove('next');
  portfolioPages[currentPortfolioPage].classList.add('active');

  setTimeout(() => {
    isTransitioning = false;
    if (physicsEnabled) createPortfolioBodies();
  }, 800);

  return true;
}

function prevPortfolioPage() {
  if (!portfolioPages || portfolioPages.length === 0) return false;
  if (isTransitioning) return true;
  if (currentPortfolioPage <= 0) return false;

  isTransitioning = true;
  
  // 페이지 전환 시작 시 즉시 물리 바디 제거
  if (physicsEnabled) clearPortfolioBodies();

  portfolioPages[currentPortfolioPage].classList.remove('active');
  portfolioPages[currentPortfolioPage].classList.add('next');

  currentPortfolioPage--;
  portfolioPages[currentPortfolioPage].classList.remove('prev');
  portfolioPages[currentPortfolioPage].classList.add('active');

  setTimeout(() => {
    isTransitioning = false;
    if (physicsEnabled) createPortfolioBodies();
  }, 800);

  return true;
}

function showNameTexts() {
  if (nameTextsVisible) return;
  nameTextsVisible = true;

  const nameText1 = document.getElementById('name-text');
  const nameText2 = document.getElementById('name-text-2');
  if (nameText1) nameText1.classList.add('visible');
  if (nameText2) nameText2.classList.add('visible');

  if (physicsEnabled) {
    setTimeout(() => {
      if (!physicsEnabled || !nameTextsVisible) return;
      createNameTextBodies();
    }, 120);
  }
}

function hideNameTexts() {
  if (!nameTextsVisible) return;
  nameTextsVisible = false;

  const nameText1 = document.getElementById('name-text');
  const nameText2 = document.getElementById('name-text-2');
  if (nameText1) nameText1.classList.remove('visible');
  if (nameText2) nameText2.classList.remove('visible');

  removeNameTextBodies();
}

function createNameTextBodies() {
  if (!physicsEnabled) return;

  removeNameTextBodies();

  const elements = [
    document.getElementById('name-text'),
    document.getElementById('name-text-2')
  ].filter(Boolean);

  elements.forEach(el => {
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const w = Math.max(PHYSICS.OBSTACLE.HITBOX_MIN, rect.width) + PHYSICS.OBSTACLE.HITBOX_PADDING;
    const h = Math.max(PHYSICS.OBSTACLE.HITBOX_MIN, rect.height) + PHYSICS.OBSTACLE.HITBOX_PADDING;

    const body = Matter.Bodies.rectangle(centerX, centerY, w, h, {
      isStatic: true,
      friction: PHYSICS.OBSTACLE.FRICTION,
      restitution: PHYSICS.OBSTACLE.RESTITUTION,
      render: { visible: false }
    });

    nameTextBodies.push(body);
    nameTextElements.push(el);
    nameTextSizes.push({ w, h });
  });

  if (nameTextBodies.length > 0) {
    Matter.World.add(world, nameTextBodies);
  }
}

function removeNameTextBodies() {
  if (nameTextBodies.length && world) {
    nameTextBodies.forEach(body => Matter.World.remove(world, body));
  }

  nameTextBodies = [];
  nameTextElements = [];
  nameTextSizes = [];
}

function syncNameTextBodiesToDOM() {
  if (!nameTextsVisible || !nameTextBodies.length) return;

  for (let i = 0; i < nameTextBodies.length; i++) {
    const el = nameTextElements[i];
    if (!el) continue;

    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const body = nameTextBodies[i];
    Matter.Body.setPosition(body, { x: centerX, y: centerY });

    const newW = Math.max(PHYSICS.OBSTACLE.HITBOX_MIN, rect.width) + PHYSICS.OBSTACLE.HITBOX_PADDING;
    const newH = Math.max(PHYSICS.OBSTACLE.HITBOX_MIN, rect.height) + PHYSICS.OBSTACLE.HITBOX_PADDING;
    const prevSize = nameTextSizes[i];

    if (!prevSize) {
      nameTextSizes[i] = { w: newW, h: newH };
      continue;
    }

    if (Math.abs(prevSize.w - newW) > 0.5 || Math.abs(prevSize.h - newH) > 0.5) {
      const sx = newW / prevSize.w;
      const sy = newH / prevSize.h;
      Matter.Body.scale(body, sx, sy);
      nameTextSizes[i] = { w: newW, h: newH };
    }
  }
}

function applyMorphForces() {
  if (!physicsMorphMode) return;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (!p.body) continue;

    const body = p.body;
    const dx = p.tx - body.position.x;
    const dy = p.ty - body.position.y;
    const fx = Math.max(-PHYSICS.MORPH.MAX_FORCE, Math.min(PHYSICS.MORPH.MAX_FORCE, dx * PHYSICS.MORPH.FORCE));
    const fy = Math.max(-PHYSICS.MORPH.MAX_FORCE, Math.min(PHYSICS.MORPH.MAX_FORCE, dy * PHYSICS.MORPH.FORCE));

    if (Math.abs(fx) > 0 || Math.abs(fy) > 0) {
      Matter.Body.applyForce(body, body.position, { x: fx, y: fy });
    }
  }
}