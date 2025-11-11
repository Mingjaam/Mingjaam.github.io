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
let leftWallBody = null;
let rightWallBody = null;

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

// 터치 이벤트 관련 변수
let touchStartY = 0;
let touchStartX = 0;
let touchEndY = 0;
let touchEndX = 0;
let touchStartTime = 0;
let minSwipeDistance = 50; // 최소 스와이프 거리
let maxSwipeTime = 500; // 최대 스와이프 시간 (ms)
let isScrolling = false;

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

// UI Showcase 슬라이드 전환
let currentUISlide = 0;
let uiSlides = [];
let isUISliding = false;

// 그래프 관련 변수
let graphParticles = []; // 그래프에 사용될 particles 인덱스들
let graphData = {
  1: { 
    percentage: 98, 
    label: '무한 캔버스',
    description: ['전반적인 무한 캔버스 모두 구현.', 'UI 추후에 더 나은 방향으로 수정 가능한지 논의 할 예정']
  }, // Page 1: Canvas
  2: { 
    percentage: 80, 
    label: 'AI 클러스터링',
    description: ['임베딩 및 클러스터링 모델을 이용한 테스트 완료.', 'api화 시켜 프론트에 연결 남음.']
  }, // Page 2: AI
  3: { 
    percentage: 84, 
    label: '실시간 협업',
    description: ['관련 api 개발 완료. 서버 배포후 프론트와 연결 시 완료.']
  } // Page 3: Collab
};
let graphEnabled = false;
let graphAnimationStartTime = null; // 그래프 애니메이션 시작 시간
let graphAnimationDuration = 2000; // 애니메이션 지속 시간 (ms)
let graphCurrentPercentage = 0; // 현재 표시되는 퍼센트
let graphTargetPercentage = 0; // 목표 퍼센트
let graphPercentageElement = null; // 퍼센트 텍스트 요소

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
  // 실제 보이는 뷰포트 높이 계산 (모바일 주소창/버튼 제외)
  const actualHeight = window.innerHeight;
  
  // CSS 변수로 설정
  document.documentElement.style.setProperty('--vh', `${actualHeight * 0.01}px`);
  
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
  gfxEng.text('ON - IT', width/2, height/2);
  
  // 영어 텍스트의 실제 픽셀 영역 중앙 계산
  let engMinY = height, engMaxY = 0;
  for(let y=0;y<height;y+=GRID_STEP){
    for(let x=0;x<width;x+=GRID_STEP){
      if(gfxEng.get(x,y)[0] >127){
        if(y < engMinY) engMinY = y;
        if(y > engMaxY) engMaxY = y;
      }
    }
  }
  const engCenterY = (engMinY + engMaxY) / 2;
  const engOffsetY = height/2 - engCenterY; // 화면 중앙으로 이동하기 위한 오프셋

  let gfxKor = createGraphics(width, height);
  gfxKor.pixelDensity(1);
  gfxKor.background(0);
  gfxKor.fill(255);
  gfxKor.textFont(font);
  gfxKor.textSize(sizeConfig.textSizeKor);
  gfxKor.textAlign(CENTER, CENTER);
  gfxKor.text('온 잇', width/2, height/2);
  
  // 한글 텍스트의 실제 픽셀 영역 중앙 계산
  let korMinY = height, korMaxY = 0;
  for(let y=0;y<height;y+=GRID_STEP){
    for(let x=0;x<width;x+=GRID_STEP){
      if(gfxKor.get(x,y)[0] >127){
        if(y < korMinY) korMinY = y;
        if(y > korMaxY) korMaxY = y;
      }
    }
  }
  const korCenterY = (korMinY + korMaxY) / 2;
  const korOffsetY = height/2 - korCenterY; // 화면 중앙으로 이동하기 위한 오프셋

  // 영어 점 추출 (오프셋 적용하여 화면 중앙에 맞춤)
  for(let y=0;y<height;y+=GRID_STEP){
    for(let x=0;x<width;x+=GRID_STEP){
      if(gfxEng.get(x,y)[0] >127){
        engPoints.push({x:x, y:y + engOffsetY}); // 오프셋 적용
      }
    }
  }

  // 한글 점 추출 (오프셋 적용하여 화면 중앙에 맞춤)
  for(let y=0;y<height;y+=GRID_STEP){
    for(let x=0;x<width;x+=GRID_STEP){
      if(gfxKor.get(x,y)[0] >127){
        korPoints.push({x:x, y:y + korOffsetY}); // 오프셋 적용
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
      body: null, // 물리 바디는 나중에 생성
      isGraphParticle: false, // 그래프용 particle인지 여부
      graphTargetX: null, // 그래프 목표 X 위치
      graphTargetY: null // 그래프 목표 Y 위치
    });
  }

  // 전역 휠/키 입력으로 단계 전환
  window.addEventListener('wheel', handleInteractionWheel, { passive: false });
  window.addEventListener('keydown', handleInteractionKey);
  
  // 모바일 터치 이벤트 핸들러 추가
  window.addEventListener('touchstart', handleTouchStart, { passive: true });
  window.addEventListener('touchmove', handleTouchMove, { passive: false });
  window.addEventListener('touchend', handleTouchEnd, { passive: true });
  
  // 모바일에서 뷰포트 높이 변경 감지 (주소창 표시/숨김, 화면 회전 등)
  let resizeTimer;
  function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const actualHeight = window.innerHeight;
      document.documentElement.style.setProperty('--vh', `${actualHeight * 0.01}px`);
      if (typeof windowResized === 'function') {
        windowResized();
      }
    }, 100);
  }
  window.addEventListener('resize', handleResize);
  window.addEventListener('orientationchange', handleResize);
  // 초기 로드 후에도 업데이트
  setTimeout(handleResize, 100);

  // 포트폴리오 페이지 초기화
  initPortfolioPages();

  // 초기 모핑 시작 (영어 → 한글)
  scheduleMorphTransition(() => morphToKor(), 1000);
}

function draw(){
  // 잔상 감소: 배경 알파를 높여 이전 프레임을 더 많이 지움
  background(0, 200);
  fill(255);
  
  // 그래프 애니메이션 업데이트
  updateGraphAnimation();
  
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
    
    // particles 그리기
    for(let p of particles){
      // 그래프용 particle은 물리 바디 없이 목표 위치로 애니메이션
      if(p.isGraphParticle && p.graphTargetX !== null && p.graphTargetY !== null) {
        // 애니메이션 지연 시간 확인
        if(p.graphAnimationDelay !== undefined && graphAnimationStartTime !== null) {
          const elapsed = millis() - graphAnimationStartTime;
          if(elapsed >= p.graphAnimationDelay) {
            // 애니메이션 시작 시간
            const animElapsed = elapsed - p.graphAnimationDelay;
            const animProgress = Math.min(1, animElapsed / 300); // 각 particle 애니메이션 시간 (300ms)
            const easedProgress = easeOutCubic(animProgress);
            
            // 시작 위치에서 목표 위치로 보간
            const startX = p.graphStartX !== undefined ? p.graphStartX : p.x;
            const startY = p.graphStartY !== undefined ? p.graphStartY : p.y;
            p.x = lerp(startX, p.graphTargetX, easedProgress);
            p.y = lerp(startY, p.graphTargetY, easedProgress);
          }
        } else {
          // 애니메이션 지연이 없으면 즉시 이동
          let step = 0.05;
          p.x = lerp(p.x, p.graphTargetX, step);
          p.y = lerp(p.y, p.graphTargetY, step);
        }
        // 물리 바디가 있으면 제거
        if(p.body) {
          Matter.World.remove(world, p.body);
          bodies = bodies.filter(b => b !== p.body);
          p.body = null;
        }
      } else if(p.body) {
        // 일반 물리 particle
        p.x = p.body.position.x;
        p.y = p.body.position.y;
      }
      ellipse(p.x, p.y, POINT_SIZE, POINT_SIZE);
    }
  } else {
    // 일반 모핑 애니메이션
    let step = 0.05;
    for(let p of particles){
      // 그래프용 particle 처리
      if(p.isGraphParticle && p.graphTargetX !== null && p.graphTargetY !== null) {
        // 애니메이션 지연 시간 확인
        if(p.graphAnimationDelay !== undefined && graphAnimationStartTime !== null) {
          const elapsed = millis() - graphAnimationStartTime;
          if(elapsed >= p.graphAnimationDelay) {
            // 애니메이션 시작 시간
            const animElapsed = elapsed - p.graphAnimationDelay;
            const animProgress = Math.min(1, animElapsed / 300); // 각 particle 애니메이션 시간 (300ms)
            const easedProgress = easeOutCubic(animProgress);
            
            // 시작 위치에서 목표 위치로 보간
            const startX = p.graphStartX !== undefined ? p.graphStartX : p.x;
            const startY = p.graphStartY !== undefined ? p.graphStartY : p.y;
            p.x = lerp(startX, p.graphTargetX, easedProgress);
            p.y = lerp(startY, p.graphTargetY, easedProgress);
          }
        } else {
          p.x = lerp(p.x, p.graphTargetX, step);
          p.y = lerp(p.y, p.graphTargetY, step);
        }
      } else {
        p.x = lerp(p.x, p.tx, step);
        p.y = lerp(p.y, p.ty, step);
      }
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
  const gridStep = lerp(6, 12, t);
  const textSizeEng = lerp(canvasW * 0.15, canvasW * 0.2, t);
  const textSizeKor = lerp(canvasW * 0.13, canvasW * 0.17, t);
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
  
  // 각 feature-text를 개별 충돌체로 처리 (보이는 것만)
  const featureTexts = activePage.querySelectorAll('.feature-text');
  if (featureTexts.length > 0) {
    featureTexts.forEach(featureText => {
      // opacity가 0이거나 화면 밖에 있는 것은 제외
      const style = window.getComputedStyle(featureText);
      const opacity = parseFloat(style.opacity);
      const transform = style.transform;
      
      // opacity가 0이면 물리 바디 생성하지 않음
      if (opacity === 0) return;
      
      const rect = featureText.getBoundingClientRect();
      // 화면 밖에 있는지 확인 (왼쪽으로 많이 벗어난 경우)
      if (rect.right < -100 || rect.left > window.innerWidth + 100) return;
      
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
      portfolioElements.push(featureText);
      portfolioSizes.push({ w, h });
    });
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

  // 팀원 이름 다시 보이게 하기
  const teamMembers = document.querySelector('.team-members');
  if (teamMembers) {
    teamMembers.classList.remove('hidden');
  }

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

  // 팀원 이름 숨기기
  const teamMembers = document.querySelector('.team-members');
  if (teamMembers) {
    teamMembers.classList.add('hidden');
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
        // 현재 페이지의 그래프 생성
        if (currentPortfolioPage > 0) {
          createGraph(currentPortfolioPage);
        }
      }
    }, 180);
  });
}

function processPortfolioWheel(deltaY) {
  if (!physicsEnabled) return false;
  if (Math.abs(deltaY) < 5) return false;

  // Page 4 (UI Showcase)에서는 UI 슬라이드 전환
  if (currentPortfolioPage === 4) {
    if (deltaY > 0) {
      return nextUISlide();
    }
    if (deltaY < 0) {
      return prevUISlide();
    }
    return false;
  }

  // 다른 페이지에서는 일반 페이지 전환
  if (deltaY > 0) {
    return nextPortfolioPage();
  }
  if (deltaY < 0) {
    return prevPortfolioPage();
  }
  return false;
}

// UI 슬라이드 다음으로
function nextUISlide() {
  if (uiSlides.length === 0) return false;
  if (isUISliding) return true;
  
  const isLastSlide = currentUISlide >= uiSlides.length - 1;
  if (isLastSlide) {
    // 마지막 슬라이드에서 다음으로 가면 다음 페이지로
    return nextPortfolioPage();
  }

  isUISliding = true;
  
  uiSlides[currentUISlide].classList.remove('active');
  uiSlides[currentUISlide].classList.add('prev');
  
  currentUISlide++;
  uiSlides[currentUISlide].classList.remove('next');
  uiSlides[currentUISlide].classList.add('active');

  setTimeout(() => {
    isUISliding = false;
  }, 1200);

  return true;
}

// UI 슬라이드 이전으로
function prevUISlide() {
  if (uiSlides.length === 0) return false;
  if (isUISliding) return true;
  
  if (currentUISlide <= 0) {
    // 첫 번째 슬라이드에서 이전으로 가면 이전 페이지로
    return prevPortfolioPage();
  }

  isUISliding = true;
  
  uiSlides[currentUISlide].classList.remove('active');
  uiSlides[currentUISlide].classList.add('next');
  
  currentUISlide--;
  uiSlides[currentUISlide].classList.remove('prev');
  uiSlides[currentUISlide].classList.add('active');

  setTimeout(() => {
    isUISliding = false;
  }, 1200);

  return true;
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
  
  // 좌우 벽 위치 업데이트
  if (leftWallBody && rightWallBody) {
    const wallThickness = thickness;
    const wallHeight = window.innerHeight * 2;
    const wallY = window.innerHeight / 2;
    
    Matter.Body.setPosition(leftWallBody, { x: -wallThickness / 2, y: wallY });
    Matter.Body.setPosition(rightWallBody, { x: window.innerWidth + wallThickness / 2, y: wallY });
    
    // 벽 높이 업데이트
    const currentLeftHeight = leftWallBody.bounds.max.y - leftWallBody.bounds.min.y;
    const currentRightHeight = rightWallBody.bounds.max.y - rightWallBody.bounds.min.y;
    if (Math.abs(currentLeftHeight - wallHeight) > 1) {
      Matter.Body.scale(leftWallBody, 1, wallHeight / currentLeftHeight);
    }
    if (Math.abs(currentRightHeight - wallHeight) > 1) {
      Matter.Body.scale(rightWallBody, 1, wallHeight / currentRightHeight);
    }
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
    
    // particles에 body가 없으면 생성
    let needsBodyCreation = false;
    for (let i = 0; i < particles.length; i++) {
      let p = particles[i];
      if (!p.isGraphParticle && !p.body) {
        needsBodyCreation = true;
        break;
      }
    }
    
    if (needsBodyCreation) {
      for (let i = 0; i < particles.length; i++) {
        let p = particles[i];
        if (p.isGraphParticle || p.body) continue;
        
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
    }
    
    return;
  }

  physicsEnabled = true;

  if (includePortfolio) {
    createPortfolioBodies();
  }

  // 기존 벽 제거 (중복 생성 방지)
  if (leftWallBody) {
    Matter.World.remove(world, leftWallBody);
    leftWallBody = null;
  }
  if (rightWallBody) {
    Matter.World.remove(world, rightWallBody);
    rightWallBody = null;
  }
  
  // 바닥(페이지 최하단) 생성
  const thickness = PHYSICS.GROUND.THICKNESS;
  if (!groundBody) {
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
  }
  
  // 좌우 벽 생성
  const wallThickness = thickness;
  const wallHeight = window.innerHeight * 2; // 충분히 높게
  const wallY = window.innerHeight / 2;
  
  // 왼쪽 벽
  leftWallBody = Matter.Bodies.rectangle(
    -wallThickness / 2,
    wallY,
    wallThickness,
    wallHeight,
    {
      isStatic: true,
      friction: PHYSICS.GROUND.FRICTION,
      restitution: PHYSICS.GROUND.RESTITUTION,
      render: { visible: false }
    }
  );
  Matter.World.add(world, leftWallBody);
  
  // 오른쪽 벽
  rightWallBody = Matter.Bodies.rectangle(
    window.innerWidth + wallThickness / 2,
    wallY,
    wallThickness,
    wallHeight,
    {
      isStatic: true,
      friction: PHYSICS.GROUND.FRICTION,
      restitution: PHYSICS.GROUND.RESTITUTION,
      render: { visible: false }
    }
  );
  Matter.World.add(world, rightWallBody);
  
  updateGroundPosition();

  // 모든 점에 물리 바디 생성 (그래프용 particles 제외)
  for (let i = 0; i < particles.length; i++) {
    let p = particles[i];
    
    // 그래프용 particle은 물리 바디 생성하지 않음
    if (p.isGraphParticle) continue;

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
  clearGraph(); // 그래프도 초기화

  removeNameTextBodies();

  if (groundBody) {
    Matter.World.remove(world, groundBody);
    groundBody = null;
  }
  
  if (leftWallBody) {
    Matter.World.remove(world, leftWallBody);
    leftWallBody = null;
  }
  
  if (rightWallBody) {
    Matter.World.remove(world, rightWallBody);
    rightWallBody = null;
  }

  particles.forEach(p => {
    p.body = null;
  });

  console.log('물리 효과 비활성화! 점들이 다시 글씨로 모핑됩니다.');
}

function windowResized(){
  // 실제 보이는 뷰포트 높이 다시 계산 (모바일 주소창/버튼 제외)
  const actualHeight = window.innerHeight;
  document.documentElement.style.setProperty('--vh', `${actualHeight * 0.01}px`);
  
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
      // 그래프 재생성 (화면 크기 변경 시 위치 재계산)
      if (currentPortfolioPage > 0 && graphEnabled) {
        createGraph(currentPortfolioPage);
      }
    } else {
      clearPortfolioBodies();
      clearGraph();
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
  
  // UI Showcase 슬라이드 초기화
  const uiShowcasePage = document.querySelector('.portfolio-page[data-page="4"]');
  if (uiShowcasePage) {
    uiSlides = uiShowcasePage.querySelectorAll('.ui-slide');
    currentUISlide = 0;
    uiSlides.forEach((slide, index) => {
      slide.classList.remove('active', 'prev', 'next');
      if (index === 0) {
        slide.classList.add('active');
      } else {
        slide.classList.add('next');
      }
    });
  }
  
  console.log('포트폴리오 페이지 초기화 완료:', portfolioPages.length, '페이지');
}

function nextPortfolioPage() {
  if (!portfolioPages || portfolioPages.length === 0) return false;
  if (isTransitioning) return true;
  
  // 마지막 페이지에서 다음으로 가면 새로고침 화면(초기 상태)으로 돌아가기
  const isLastPage = currentPortfolioPage >= portfolioPages.length - 1;
  if (isLastPage) {
    // 초기 상태(interactionStep 0)로 리셋
    isTransitioning = true;
    
    // 페이지 전환 시작 시 즉시 물리 바디 제거
    if (physicsEnabled) clearPortfolioBodies();
    
    // 그래프 초기화
    clearGraph();

    // 현재 페이지 숨기기
    portfolioPages[currentPortfolioPage].classList.remove('active');
    portfolioPages[currentPortfolioPage].classList.add('prev');

    // 포트폴리오 페이지 상태 초기화
    portfolioPages.forEach((page, index) => {
      page.classList.remove('active', 'prev', 'next');
      if (index === 0) {
        page.classList.add('active');
      } else {
        page.classList.add('next');
      }
    });
    
    // 현재 페이지 인덱스 리셋
    currentPortfolioPage = 0;

    // interactionStep을 0으로 리셋하여 초기 화면으로 돌아가기
    setInteractionStep(0);

    setTimeout(() => {
      isTransitioning = false;
    }, 800);

    return true;
  }

  isTransitioning = true;
  
  // 페이지 전환 시작 시 즉시 물리 바디 제거
  if (physicsEnabled) clearPortfolioBodies();
  
  // 그래프 초기화
  clearGraph();

  portfolioPages[currentPortfolioPage].classList.remove('active');
  portfolioPages[currentPortfolioPage].classList.add('prev');

  currentPortfolioPage++;
  portfolioPages[currentPortfolioPage].classList.remove('next');
  portfolioPages[currentPortfolioPage].classList.add('active');

  // Page 4로 진입할 때 UI 슬라이드 초기화
  if (currentPortfolioPage === 4) {
    currentUISlide = 0;
    uiSlides.forEach((slide, index) => {
      slide.classList.remove('active', 'prev', 'next');
      if (index === 0) {
        slide.classList.add('active');
      } else {
        slide.classList.add('next');
      }
    });
  }

  // 페이지 전환 시점에 퍼센트 텍스트 위치 미리 설정 (다음 프레임에서 실행)
  if (currentPortfolioPage > 0 && currentPortfolioPage !== 4) {
    requestAnimationFrame(() => {
      setupGraphPercentagePosition(currentPortfolioPage);
    });
  }

  setTimeout(() => {
    isTransitioning = false;
    if (physicsEnabled) {
      createPortfolioBodies();
      // 새 페이지의 그래프 생성
      if (currentPortfolioPage > 0) {
        createGraph(currentPortfolioPage);
      }
    }
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
  
  // 그래프 초기화
  clearGraph();

  portfolioPages[currentPortfolioPage].classList.remove('active');
  portfolioPages[currentPortfolioPage].classList.add('next');

  currentPortfolioPage--;
  portfolioPages[currentPortfolioPage].classList.remove('prev');
  portfolioPages[currentPortfolioPage].classList.add('active');

  // Page 4로 진입할 때 UI 슬라이드 초기화
  if (currentPortfolioPage === 4) {
    currentUISlide = uiSlides.length - 1;
    uiSlides.forEach((slide, index) => {
      slide.classList.remove('active', 'prev', 'next');
      if (index === currentUISlide) {
        slide.classList.add('active');
      } else if (index < currentUISlide) {
        slide.classList.add('prev');
      } else {
        slide.classList.add('next');
      }
    });
  }

  // 페이지 전환 시점에 퍼센트 텍스트 위치 미리 설정 (다음 프레임에서 실행)
  if (currentPortfolioPage > 0 && currentPortfolioPage !== 4) {
    requestAnimationFrame(() => {
      setupGraphPercentagePosition(currentPortfolioPage);
    });
  }

  setTimeout(() => {
    isTransitioning = false;
    if (physicsEnabled) {
      createPortfolioBodies();
      // 새 페이지의 그래프 생성
      if (currentPortfolioPage > 0) {
        createGraph(currentPortfolioPage);
      }
    }
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

// 터치 시작 이벤트 처리
function handleTouchStart(e) {
  if (interactionLocked) return;
  
  const touch = e.touches[0];
  touchStartY = touch.clientY;
  touchStartX = touch.clientX;
  touchStartTime = Date.now();
  isScrolling = false;
}

// 터치 이동 이벤트 처리
function handleTouchMove(e) {
  if (interactionLocked) return;
  
  const touch = e.touches[0];
  const deltaY = touch.clientY - touchStartY;
  const deltaX = touch.clientX - touchStartX;
  
  // 수직 스와이프가 수평 스와이프보다 크면 스크롤로 간주하고 기본 스크롤 방지
  if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
    isScrolling = true;
    e.preventDefault(); // 기본 스크롤 방지
  }
}

// 터치 종료 이벤트 처리
function handleTouchEnd(e) {
  if (interactionLocked || !isScrolling) return;
  
  const touch = e.changedTouches[0];
  touchEndY = touch.clientY;
  touchEndX = touch.clientX;
  const touchEndTime = Date.now();
  
  const deltaY = touchEndY - touchStartY;
  const deltaX = touchEndX - touchStartX;
  const deltaTime = touchEndTime - touchStartTime;
  
  // 스와이프 조건 확인
  if (deltaTime <= maxSwipeTime && Math.abs(deltaY) >= minSwipeDistance) {
    // 수직 스와이프가 수평 스와이프보다 크면
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      const now = Date.now();
      if (now - lastScrollTime < scrollDebounceDelay) {
        return;
      }
      lastScrollTime = now;
      
      if (deltaY > 0) {
        // 아래로 스와이프 (이전 단계 또는 이전 페이지)
        let handled = false;
        if (interactionStep === 2) {
          handled = processPortfolioWheel(-120);
        }
        
        if (!handled) {
          retreatInteractionStep();
        }
      } else {
        // 위로 스와이프 (다음 단계 또는 다음 페이지)
        let handled = false;
        if (interactionStep === 2) {
          handled = processPortfolioWheel(120);
        }
        
        if (!handled) {
          advanceInteractionStep();
        }
      }
    }
  }
  
  // 스크롤 상태 리셋
  isScrolling = false;
}

// 퍼센트 텍스트 위치 미리 설정 함수 (페이지 슬라이드와 함께 이동하도록)
function setupGraphPercentagePosition(pageNumber) {
  const page = document.querySelector(`.portfolio-page[data-page="${pageNumber}"]`);
  if (!page) return;
  
  const percentageText = page.querySelector('.graph-percentage');
  if (!percentageText) return;
  
  let featureText = null;
  if (pageNumber === 1) {
    featureText = page.querySelector('.feature-text[data-feature="canvas"]');
  } else if (pageNumber === 2) {
    featureText = page.querySelector('.feature-text[data-feature="ai"]');
  } else if (pageNumber === 3) {
    featureText = page.querySelector('.feature-text[data-feature="collab"]');
  }
  
  if (!featureText) return;
  
  // 실제 텍스트 위치 가져오기 (페이지가 active가 된 후)
  const textRect = featureText.getBoundingClientRect();
  const textBottomY = textRect.bottom;
  
  // 그래프 위치 계산
  const graphHeight = POINT_SIZE * 2;
  const graphTopY = textBottomY + POINT_SIZE * 0.5;
  const graphBottomY = graphTopY + graphHeight;
  const graphCenterY = (graphTopY + graphBottomY) / 2;
  
  // 그래프 시작점과 끝점 계산
  const leftOffset = windowWidth * 0.1;
  const graphStartX = textRect.left - leftOffset;
  const graphEndX = graphStartX + windowWidth * 0.25;
  
  // 퍼센트 텍스트 위치 설정
  percentageText.style.left = `${graphEndX + POINT_SIZE * 2}px`;
  percentageText.style.top = `${graphCenterY}px`;
  percentageText.style.transform = 'translateY(-50%)';
  percentageText.style.fontSize = 'clamp(1rem, 2vw, 1.5rem)';
  percentageText.style.textAlign = 'left';
  percentageText.textContent = '0';
  
  // 설명 텍스트 위치 설정
  const descriptionElement = page.querySelector('.graph-description');
  const data = graphData[pageNumber];
  if (descriptionElement && data && data.description && data.description.length > 0) {
    // 여러 줄로 표시 (. 기준으로 줄바꿈)
    const lines = data.description.flatMap(line => {
      // '.' 기준으로 split하고, 각 문장 끝에 '.' 추가
      return line.split('.').filter(s => s.trim().length > 0).map(s => s.trim() + '.');
    });
    descriptionElement.innerHTML = lines.map(line => `<div>${line}</div>`).join('');
    descriptionElement.style.left = `${graphStartX}px`;
    descriptionElement.style.top = `${graphBottomY + POINT_SIZE * 3}px`;
    descriptionElement.style.opacity = '1';
  } else if (descriptionElement) {
    descriptionElement.style.opacity = '0';
  }
}

// 그래프 생성 함수
function createGraph(pageNumber) {
  if (!graphData[pageNumber]) return;
  
  clearGraph();
  
  const data = graphData[pageNumber];
  const percentage = data.percentage;
  
  // 텍스트 요소 찾기
  const activePage = document.querySelector(`.portfolio-page[data-page="${pageNumber}"]`);
  if (!activePage) return;
  
  let featureText = null;
  if (pageNumber === 1) {
    featureText = activePage.querySelector('.feature-text[data-feature="canvas"]');
  } else if (pageNumber === 2) {
    featureText = activePage.querySelector('.feature-text[data-feature="ai"]');
  } else if (pageNumber === 3) {
    featureText = activePage.querySelector('.feature-text[data-feature="collab"]');
  }
  
  if (!featureText) return;
  
  // 텍스트 위치 가져오기
  const textRect = featureText.getBoundingClientRect();
  const textBottomY = textRect.bottom; // 텍스트 아래쪽 끝점
  
  // 그래프 위치 계산: 텍스트 바로 아래에 배치 (통일된 위치)
  const graphHeight = POINT_SIZE * 2; // 공 두 줄 두께
  const graphTopY = textBottomY + POINT_SIZE * 0.5; // 텍스트 아래에 약간의 간격
  const graphBottomY = graphTopY + graphHeight;
  const graphCenterY = (graphTopY + graphBottomY) / 2;
  
  // 직선 그래프 생성 (왼쪽에서 오른쪽으로)
  // 그래프 시작점과 끝점 계산 (텍스트 시작점 기준으로 왼쪽으로 이동)
  let graphStartX, graphEndX;
  // 그래프를 전체적으로 왼쪽으로 이동 (값을 조정하여 위치 변경 가능)
  const leftOffset = windowWidth * 0.1; // 왼쪽으로 이동할 거리 (조정 가능)
  graphStartX = textRect.left - leftOffset; // 그래프 시작점 (왼쪽)
  graphEndX = graphStartX + windowWidth * 0.25; // 그래프 끝점 (오른쪽)
  
  const graphWidth = Math.abs(graphStartX - graphEndX);
  
  // 필요한 particles 수 계산 (그래프 너비에 맞춰)
  const idealSpacing = POINT_SIZE * 0.6; // particles 간 간격 (빽빽하게)
  const maxParticles = Math.floor(graphWidth / idealSpacing);
  const neededParticles = Math.min(maxParticles, Math.floor(particles.length * (percentage / 100)));
  
  // 랜덤으로 particles 선택 (아래쪽에 있는 particles 우선)
  const availableParticles = particles
    .map((p, idx) => ({ particle: p, index: idx, y: p.y }))
    .filter(item => !item.particle.isGraphParticle) // 이미 그래프에 사용된 것 제외
    .sort((a, b) => b.y - a.y); // 아래쪽부터 정렬
  
  const selectedParticles = availableParticles.slice(0, neededParticles);
  
  // 직선 그래프: 왼쪽에서 오른쪽으로 채워지는 형태
  // 2열로 나누기
  const particlesPerRow = Math.ceil(selectedParticles.length / 2);
  const spacingX = graphWidth / Math.max(1, particlesPerRow - 1);
  
  // 퍼센트에 따라 왼쪽에서 오른쪽으로 채워지는 길이 계산
  const filledWidth = graphWidth * (percentage / 100);
  
  // particles를 직선으로 배치 (2열, 왼쪽에서 오른쪽으로)
  // 왼쪽 위부터 순서대로 정렬하기 위해 인덱스 배열 생성
  const particlePositions = [];
  for (let i = 0; i < selectedParticles.length; i++) {
    const row = Math.floor(i / particlesPerRow);
    const col = i % particlesPerRow;
    
    // X 위치: 왼쪽에서 오른쪽으로 (퍼센트에 따라 채워진 부분만)
    const progress = col / Math.max(1, particlesPerRow - 1); // 0 ~ 1
    const localX = graphStartX + (progress * filledWidth);
    
    // Y 위치: 두 줄로 정확히 정렬 (위쪽 줄이 먼저)
    const localY = row === 0 ? graphTopY + POINT_SIZE / 2 : graphBottomY - POINT_SIZE / 2;
    
    particlePositions.push({
      index: i,
      row: row,
      col: col,
      x: localX,
      y: localY,
      sortKey: row * 10000 + col // 위쪽 줄, 왼쪽부터 정렬
    });
  }
  
  // 왼쪽 위부터 순서대로 정렬 (위쪽 줄 먼저, 그 다음 왼쪽에서 오른쪽)
  particlePositions.sort((a, b) => a.sortKey - b.sortKey);
  
  // 애니메이션 시작 시간 설정
  graphAnimationStartTime = millis();
  graphCurrentPercentage = 0;
  graphTargetPercentage = percentage;
  graphPercentageElement = activePage.querySelector('.graph-percentage');
  
  // 각 particle에 위치와 애니메이션 지연 시간 설정
  for (let i = 0; i < particlePositions.length; i++) {
    const pos = particlePositions[i];
    const item = selectedParticles[pos.index];
    const p = item.particle;
    
    // 이미 물리 바디가 있으면 제거
    if (p.body) {
      Matter.World.remove(world, p.body);
      bodies = bodies.filter(b => b !== p.body);
      p.body = null;
    }
    
    // 시작 위치 저장 (현재 위치)
    p.graphStartX = p.x;
    p.graphStartY = p.y;
    
    // 목표 위치 설정
    p.isGraphParticle = true;
    p.graphTargetX = pos.x;
    p.graphTargetY = pos.y;
    
    // 애니메이션 지연 시간 설정 (왼쪽 위부터 순서대로, 각 particle 간격 20ms)
    p.graphAnimationDelay = i * 20;
    
    graphParticles.push(item.index);
  }
  
  graphEnabled = true;
  
  // 퍼센트 텍스트 위치 설정 (그래프 끝점(오른쪽)에 작게 배치)
  if (graphPercentageElement) {
    graphPercentageElement.textContent = '0';
    graphPercentageElement.style.left = `${graphEndX + POINT_SIZE * 2}px`;
    graphPercentageElement.style.top = `${graphCenterY}px`;
    graphPercentageElement.style.transform = 'translateY(-50%)';
    graphPercentageElement.style.fontSize = 'clamp(1rem, 2vw, 1.5rem)';
    graphPercentageElement.style.textAlign = 'left';
  }
  
  // 설명 텍스트 설정 (그래프 아래에 배치)
  const descriptionElement = activePage.querySelector('.graph-description');
  if (descriptionElement && data.description && data.description.length > 0) {
    // 여러 줄로 표시 (. 기준으로 줄바꿈)
    const lines = data.description.flatMap(line => {
      // '.' 기준으로 split하고, 각 문장 끝에 '.' 추가
      return line.split('.').filter(s => s.trim().length > 0).map(s => s.trim() + '.');
    });
    descriptionElement.innerHTML = lines.map(line => `<div>${line}</div>`).join('');
    descriptionElement.style.left = `${graphStartX}px`;
    descriptionElement.style.top = `${graphBottomY + POINT_SIZE * 3}px`;
    descriptionElement.style.opacity = '1';
  } else if (descriptionElement) {
    descriptionElement.style.opacity = '0';
  }
  
  console.log(`그래프 생성 완료: Page ${pageNumber}, ${selectedParticles.length}개 particles 사용`);
}

// 그래프 초기화 함수
function clearGraph() {
  graphParticles.forEach(idx => {
    const p = particles[idx];
    if (p) {
      p.isGraphParticle = false;
      p.graphTargetX = null;
      p.graphTargetY = null;
      p.graphStartX = undefined;
      p.graphStartY = undefined;
      p.graphAnimationDelay = undefined;
      
      // 물리 바디가 없고 물리 엔진이 활성화되어 있으면 다시 생성
      if (!p.body && physicsEnabled && world) {
        const body = Matter.Bodies.circle(p.x, p.y, POINT_SIZE / 2, {
          restitution: PHYSICS.BALL.RESTITUTION,
          friction: PHYSICS.BALL.FRICTION,
          frictionAir: PHYSICS.BALL.FRICTION_AIR,
          density: PHYSICS.BALL.DENSITY,
        });
        
        p.body = body;
        bodies.push(body);
        Matter.World.add(world, body);
      }
    }
  });
  graphParticles = [];
  graphEnabled = false;
  graphAnimationStartTime = null;
  graphCurrentPercentage = 0;
  graphTargetPercentage = 0;
  graphPercentageElement = null;
}

// 그래프 애니메이션 업데이트 함수
function updateGraphAnimation() {
  if (!graphEnabled || graphAnimationStartTime === null) return;
  
  const elapsed = millis() - graphAnimationStartTime;
  const totalDuration = graphAnimationDuration;
  
  // 퍼센트 애니메이션 업데이트
  if (elapsed < totalDuration) {
    const progress = Math.min(1, elapsed / totalDuration);
    const easedProgress = easeOutCubic(progress);
    graphCurrentPercentage = Math.floor(graphTargetPercentage * easedProgress);
    
    if (graphPercentageElement) {
      graphPercentageElement.textContent = `${graphCurrentPercentage}`;
    }
  } else {
    // 애니메이션 완료
    graphCurrentPercentage = graphTargetPercentage;
    if (graphPercentageElement) {
      graphPercentageElement.textContent = `${graphCurrentPercentage}`;
    }
  }
}

// 이징 함수 (ease-out cubic)
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}