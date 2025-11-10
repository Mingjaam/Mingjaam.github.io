// 물리 엔진 관련 코드
let engine;
let world;
let bodies = [];
let physicsEnabled = false;
let groundBody = null;

// 물리 상태 제어
let physicsMorphMode = false; // true면 물리 상태에서도 목표 위치로 끌어당김

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

// 물리 엔진 초기화
function initPhysics() {
  engine = Matter.Engine.create();
  world = engine.world;
  
  // 물리 엔진 설정
  engine.world.gravity.y = PHYSICS.GRAVITY_Y;
  engine.world.bounds = {
    min: { x: -1000, y: -1000 },
    max: { x: windowWidth + 1000, y: windowHeight + 1000 }
  };
  
  // 충돌 해결 반복 횟수 설정
  engine.world.constraintIterations = PHYSICS.CONSTRAINT_ITER;
  engine.world.positionIterations = PHYSICS.POSITION_ITER;
  engine.world.velocityIterations = PHYSICS.VELOCITY_ITER;
  
  console.log('물리 엔진 초기화 완료');
}

// 물리 효과 활성화
function enablePhysics(options = {}) {
  if (physicsEnabled) return;
  
  physicsEnabled = true;
  physicsMorphMode = false;
  
  // 물리 엔진이 없으면 초기화
  if (!engine) {
    initPhysics();
  }
  
  // 바닥 생성
  createGround();
  
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
  
  // 모든 물리 바디 제거
  if (world) {
    Matter.World.clear(world, false);
  }
  
  // 배열 초기화
  bodies = [];
  portfolioBodies = [];
  nameTextBodies = [];
  
  // 파티클에서 물리 바디 참조 제거
  for (let p of particles) {
    p.body = null;
  }
  
  console.log('물리 효과 비활성화');
}

// 바닥 생성
function createGround() {
  if (groundBody) {
    Matter.World.remove(world, groundBody);
  }
  
  const groundWidth = windowWidth * PHYSICS.GROUND.WIDTH_MULTIPLIER;
  const groundHeight = PHYSICS.GROUND.THICKNESS;
  const groundX = windowWidth / 2;
  const groundY = windowHeight + groundHeight / 2;
  
  groundBody = Matter.Bodies.rectangle(groundX, groundY, groundWidth, groundHeight, {
    isStatic: true,
    friction: PHYSICS.GROUND.FRICTION,
    restitution: PHYSICS.GROUND.RESTITUTION,
    render: { visible: false }
  });
  
  Matter.World.add(world, groundBody);
}

// 바닥 위치 업데이트
function updateGroundPosition() {
  if (!groundBody) return;
  
  const groundWidth = windowWidth * PHYSICS.GROUND.WIDTH_MULTIPLIER;
  const groundHeight = PHYSICS.GROUND.THICKNESS;
  const groundX = windowWidth / 2;
  const groundY = windowHeight + groundHeight / 2;
  
  Matter.Body.setPosition(groundBody, { x: groundX, y: groundY });
  Matter.Body.scale(groundBody, groundWidth / groundBody.bounds.max.x, groundHeight / groundBody.bounds.max.y);
}

// 모핑 힘 적용
function applyMorphForces() {
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (!p.body) continue;
    
    const targetX = p.tx;
    const targetY = p.ty;
    const currentX = p.body.position.x;
    const currentY = p.body.position.y;
    
    const dx = targetX - currentX;
    const dy = targetY - currentY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 1) {
      const force = Math.min(distance * PHYSICS.MORPH.FORCE, PHYSICS.MORPH.MAX_FORCE);
      const forceX = (dx / distance) * force;
      const forceY = (dy / distance) * force;
      
      Matter.Body.applyForce(p.body, p.body.position, { x: forceX, y: forceY });
    }
  }
}
