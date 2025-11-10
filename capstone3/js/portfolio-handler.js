// 포트폴리오 관련 코드
let portfolioElements = [];
let portfolioSizes = [];
let currentPortfolioPage = 0;
let portfolioPages = [];
let isTransitioning = false;

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

// 다음 포트폴리오 페이지로 이동
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

// 이전 포트폴리오 페이지로 이동
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

// 포트폴리오 물리 바디 제거
function clearPortfolioBodies() {
  if (portfolioBodies.length && world) {
    portfolioBodies.forEach(body => Matter.World.remove(world, body));
  }
  portfolioBodies = [];
  portfolioElements = [];
  portfolioSizes = [];
}

// 포트폴리오 바디와 DOM 동기화
function syncPortfolioBodiesToDOM() {
  for (let i = 0; i < portfolioBodies.length; i++) {
    const body = portfolioBodies[i];
    const element = portfolioElements[i];
    const size = portfolioSizes[i];
    
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
        portfolioSizes[i] = { w, h };
      }
    }
  }
}
