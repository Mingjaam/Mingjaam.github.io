// 이름 텍스트 관련 코드

// 이름 텍스트 표시
function showNameTexts() {
  if (nameTextsVisible) return;
  nameTextsVisible = true;

  const nameText1 = document.getElementById('name-text');
  const nameText2 = document.getElementById('name-text-2');
  
  if (nameText1) nameText1.classList.add('visible');
  if (nameText2) nameText2.classList.add('visible');

  if (physicsEnabled) {
    createNameTextBodies();
  }
}

// 이름 텍스트 숨김
function hideNameTexts() {
  if (!nameTextsVisible) return;
  nameTextsVisible = false;

  const nameText1 = document.getElementById('name-text');
  const nameText2 = document.getElementById('name-text-2');
  
  if (nameText1) nameText1.classList.remove('visible');
  if (nameText2) nameText2.classList.remove('visible');

  clearNameTextBodies();
}

// 이름 텍스트 물리 바디 생성
function createNameTextBodies() {
  clearNameTextBodies();

  const nameText1 = document.getElementById('name-text');
  const nameText2 = document.getElementById('name-text-2');
  
  if (nameText1) {
    const rect = nameText1.getBoundingClientRect();
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
    nameTextElements.push(nameText1);
    nameTextSizes.push({ w, h });
  }
  
  if (nameText2) {
    const rect = nameText2.getBoundingClientRect();
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
    nameTextElements.push(nameText2);
    nameTextSizes.push({ w, h });
  }
  
  Matter.World.add(world, nameTextBodies);
  console.log('이름 텍스트 충돌체 생성 완료:', nameTextBodies.length);
}

// 이름 텍스트 물리 바디 제거
function clearNameTextBodies() {
  if (nameTextBodies.length && world) {
    nameTextBodies.forEach(body => Matter.World.remove(world, body));
  }
  nameTextBodies = [];
  nameTextElements = [];
  nameTextSizes = [];
}

// 이름 텍스트 바디와 DOM 동기화
function syncNameTextBodiesToDOM() {
  for (let i = 0; i < nameTextBodies.length; i++) {
    const body = nameTextBodies[i];
    const element = nameTextElements[i];
    const size = nameTextSizes[i];
    
    if (body && element) {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      Matter.Body.setPosition(body, { x: centerX, y: centerY });
      
      const w = Math.max(PHYSICS.OBSTACLE.HITBOX_MIN, rect.width) + PHYSICS.OBSTACLE.HITBOX_PADDING;
      const h = Math.max(PHYSICS.OBSTACLE.HITBOX_MIN, rect.height) + PHYSICS.OBSTACLE.HITBOX_PADDING;
      
      if (Math.abs(w - size.w) > PHYSICS.GROUND.WIDTH_TOLERANCE || 
          Math.abs(h - size.h) > PHYSICS.GROUND.WIDTH_TOLERANCE) {
        Matter.Body.scale(body, w / size.w, h / size.h);
        nameTextSizes[i] = { w, h };
      }
    }
  }
}
