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
let lastScrollY = 0;
let groundBody = null;

// Matter.js 물리 엔진
let engine;
let world;
let bodies = [];
let portfolioBodies = []; // 포트폴리오 텍스트 바디들
let physicsEnabled = false;
let scrollThreshold = 100; // 스크롤 임계값

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
    HITBOX_PADDING: 8,  // 텍스트 히트박스 여유(px)
  },

  // 바닥 물성치
  GROUND: {
    FRICTION: 0.6,      // 접촉 마찰
    RESTITUTION: 0.1,   // 탄성
    THICKNESS: 40,      // 바닥 두께(px, 보이지 않음)
    WIDTH_MULTIPLIER: 2,// 창 너비 대비 바닥 폭 배수
    WIDTH_TOLERANCE: 1, // 바닥 폭 보정 허용 오차(px)
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
  canvasLayer.style('z-index', '2');
  canvasLayer.style('pointer-events', 'none');
  noStroke();
  fill(255);

  // 모바일/PC에 따른 점 크기와 그리드 설정
  if (windowWidth < 768) {
    POINT_SIZE = 5;
    GRID_STEP = 6;
  } else {
    POINT_SIZE = 10;
    GRID_STEP = 10;
  }

  // Matter.js 물리 엔진 초기화
  engine = Matter.Engine.create();
  world = engine.world;
  // 더 빠르게 떨어지도록 중력 증가
  engine.world.gravity.y = PHYSICS.GRAVITY_Y; // 중력 설정
  // 충돌 안정성 향상
  engine.positionIterations = PHYSICS.POSITION_ITER;
  engine.velocityIterations = PHYSICS.VELOCITY_ITER;
  engine.constraintIterations = PHYSICS.CONSTRAINT_ITER;
  
  // 포트폴리오 텍스트를 물리 바디로 생성
  createPortfolioBodies();

  // offscreen graphics 생성
  let gfxEng = createGraphics(width, height);
  gfxEng.pixelDensity(1);
  gfxEng.background(0);
  gfxEng.fill(255);
  gfxEng.textFont(font);
  gfxEng.textSize(width*0.12);
  gfxEng.textAlign(CENTER, CENTER);
  gfxEng.text('KIM MIN JAE', width/2, height/2);

  let gfxKor = createGraphics(width, height);
  gfxKor.pixelDensity(1);
  gfxKor.background(0);
  gfxKor.fill(255);
  gfxKor.textFont(font);
  gfxKor.textSize(width*0.12);
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

  // 초기 particles 생성 (영어 글자 위치)
  for(let i=0;i<engPoints.length;i++){
    let p = engPoints[i];
    particles.push({
      x:p.x, y:p.y,
      tx:p.x, ty:p.y,
      body: null // 물리 바디는 나중에 생성
    });
  }

  // 스크롤 이벤트 리스너 추가
  window.addEventListener('scroll', handleScroll);
  lastScrollY = window.scrollY || 0;

  // 페이지 로드 후 자동 모핑 시작 (1초 후 첫 모핑)
  setTimeout(() => morphToKor(), 1000);
}

function draw(){
  // 잔상 감소: 배경 알파를 높여 이전 프레임을 더 많이 지움
  background(0, 200);
  fill(255);
  
  if(physicsEnabled) {
    // 물리 엔진 업데이트 (더 작은 타임스텝)
    Matter.Engine.update(engine, PHYSICS.TIMESTEP_MS);
    
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
function morphToKor(){
  let shuffled = shuffleArray(korPoints.slice());
  for(let i=0;i<particles.length;i++){
    let target = shuffled[i % shuffled.length];
    particles[i].tx = target.x + random(-GRID_STEP/2, GRID_STEP/2);
    particles[i].ty = target.y + random(-GRID_STEP/2, GRID_STEP/2);
  }
  state='kor';

  // 1.5초 후 다시 영어로 모핑
  setTimeout(morphToEng, 2500);
}

// 한글 → 영어 모핑
function morphToEng(){
  let shuffled = shuffleArray(engPoints.slice());
  for(let i=0;i<particles.length;i++){
    let target = shuffled[i % shuffled.length];
    particles[i].tx = target.x + random(-GRID_STEP/2, GRID_STEP/2);
    particles[i].ty = target.y + random(-GRID_STEP/2, GRID_STEP/2);
  }
  state='eng';

  // 1.5초 후 다시 한글로 모핑
  setTimeout(morphToKor, 2500);
}

// 포트폴리오 텍스트를 물리 바디로 생성
function createPortfolioBodies() {
  // 기존 바디 제거
  for (let i = 0; i < portfolioBodies.length; i++) {
    Matter.World.remove(world, portfolioBodies[i]);
  }
  portfolioBodies = [];
  portfolioElements = [];
  portfolioSizes = [];

  // DOM에서 실제 텍스트 요소들의 위치/크기를 가져와 바디 생성
  const elements = document.querySelectorAll('.portfolio-section h1, .portfolio-section h2, .portfolio-section p, .portfolio-section li');
  elements.forEach((el) => {
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;           // viewport 기준 X
    const centerY = rect.top + rect.height / 2;           // viewport 기준 Y (고정 캔버스와 동일 좌표계)
    const w = Math.max(PHYSICS.OBSTACLE.HITBOX_MIN, rect.width) + PHYSICS.OBSTACLE.HITBOX_PADDING;               // 약간 여유
    const h = Math.max(PHYSICS.OBSTACLE.HITBOX_MIN, rect.height) + PHYSICS.OBSTACLE.HITBOX_PADDING;

    const body = Matter.Bodies.rectangle(centerX, centerY, w, h, {
      isStatic: true,
      friction: PHYSICS.OBSTACLE.FRICTION,
      restitution: PHYSICS.OBSTACLE.RESTITUTION,
      render: { visible: false }
    });
    portfolioBodies.push(body);
    portfolioElements.push(el);
    portfolioSizes.push({ w, h });
  });
  if (portfolioBodies.length) {
    Matter.World.add(world, portfolioBodies);
  }

  console.log('포트폴리오 텍스트 DOM 기준 물리 바디 생성 수:', portfolioBodies.length);
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

// 스크롤 이벤트 핸들러
function handleScroll() {
  let scrollY = window.scrollY || 0;
  const deltaY = scrollY - lastScrollY;
  
  if(scrollY > scrollThreshold && !physicsEnabled) {
    enablePhysics();
  } else if(scrollY <= scrollThreshold && physicsEnabled) {
    disablePhysics();
  }

  // 물리 활성 상태에서는 스크롤 양만큼 모든 물리 바디를 반대 방향으로 이동시켜
  // 캔버스(고정)와 DOM(뷰포트 기준) 좌표계를 일치시킴
  if (physicsEnabled && deltaY !== 0) {
    const translateBy = { x: 0, y: -deltaY };
    for (let i = 0; i < bodies.length; i++) {
      Matter.Body.translate(bodies[i], translateBy);
    }
    for (let i = 0; i < portfolioBodies.length; i++) {
      Matter.Body.translate(portfolioBodies[i], translateBy);
    }
    // 바닥은 절대 위치로 업데이트 (페이지 최하단 기준)
    updateGroundPosition();
  }

  lastScrollY = scrollY;
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
function enablePhysics() {
  physicsEnabled = true;
  
  // 포트폴리오 바디들 다시 생성
  createPortfolioBodies();

  // 바닥(페이지 최하단) 생성
  const thickness = PHYSICS.GROUND.THICKNESS;
  groundBody = Matter.Bodies.rectangle(window.innerWidth/2, window.innerHeight + thickness, window.innerWidth * PHYSICS.GROUND.WIDTH_MULTIPLIER, thickness, {
    isStatic: true,
    friction: PHYSICS.GROUND.FRICTION,
    restitution: PHYSICS.GROUND.RESTITUTION,
    render: { visible: false }
  });
  Matter.World.add(world, groundBody);
  updateGroundPosition();
  
  // 모든 점에 물리 바디 생성
  for(let i = 0; i < particles.length; i++) {
    let p = particles[i];
    
    // 원형 물리 바디 생성
    let body = Matter.Bodies.circle(p.x, p.y, POINT_SIZE/2, {
      restitution: PHYSICS.BALL.RESTITUTION,
      friction: PHYSICS.BALL.FRICTION,
      frictionAir: PHYSICS.BALL.FRICTION_AIR,
      density: PHYSICS.BALL.DENSITY,
    });
    
    p.body = body;
    bodies.push(body);
    Matter.World.add(world, body);
  }
  
  console.log('물리 효과 활성화! 모든 점이 떨어집니다.');
}

// 물리 효과 비활성화
function disablePhysics() {
  physicsEnabled = false;
  
  // 모든 물리 바디 제거
  for(let i = 0; i < bodies.length; i++) {
    Matter.World.remove(world, bodies[i]);
  }
  bodies = [];
  
  // 포트폴리오 바디들도 제거
  for(let i = 0; i < portfolioBodies.length; i++) {
    Matter.World.remove(world, portfolioBodies[i]);
  }
  portfolioBodies = [];

  // 바닥 제거
  if (groundBody) {
    Matter.World.remove(world, groundBody);
    groundBody = null;
  }
  
  // 파티클의 물리 바디 참조 제거
  for(let i = 0; i < particles.length; i++) {
    particles[i].body = null;
  }
  
  console.log('물리 효과 비활성화! 점들이 다시 글씨로 모핑됩니다.');
}

function windowResized(){
  resizeCanvas(windowWidth, windowHeight);
  
  // 창 크기 변경 시 점 크기와 그리드 재설정
  if (windowWidth < 768) {
    POINT_SIZE = 5;
    GRID_STEP = 6;
  } else {
    POINT_SIZE = 10;
    GRID_STEP = 10;
  }

  // 캔버스 고정 레이어 스타일 유지
  if (canvasLayer) {
    canvasLayer.position(0, 0);
    canvasLayer.style('position', 'fixed');
    canvasLayer.style('top', '0');
    canvasLayer.style('left', '0');
    canvasLayer.style('z-index', '2');
    canvasLayer.style('pointer-events', 'none');
  }

  // 포트폴리오 텍스트 바디 재계산 (레이아웃 변화 대응)
  if (physicsEnabled) createPortfolioBodies();

  updateGroundPosition();
}


