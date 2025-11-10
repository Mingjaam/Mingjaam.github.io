// 상호작용 관련 코드
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
let scrollTimeout = null;

// 상호작용 잠금
function lockInteraction(duration) {
  interactionLocked = true;
  if (interactionLockTimeout) {
    clearTimeout(interactionLockTimeout);
  }
  interactionLockTimeout = setTimeout(() => {
    interactionLocked = false;
  }, duration);
}

// 스크롤 이벤트 처리
function handleScroll(event) {
  const now = Date.now();
  if (now - lastScrollTime < scrollDebounceDelay) return;
  lastScrollTime = now;
  
  if (interactionLocked) return;
  
  const deltaY = event.deltaY;
  
  if (deltaY > 0) { // 아래로 스크롤
    if (interactionStep < MAX_INTERACTION_STEP) {
      interactionStep++;
      enterStep(interactionStep, interactionStep - 1);
    } else {
      // 포트폴리오 페이지 전환
      if (!nextPortfolioPage()) {
        console.log('마지막 페이지입니다.');
      }
    }
  } else if (deltaY < 0) { // 위로 스크롤
    if (interactionStep > 0) {
      interactionStep--;
      enterStep(interactionStep, interactionStep + 1);
    } else {
      // 포트폴리오 페이지 전환
      if (!prevPortfolioPage()) {
        console.log('첫 번째 페이지입니다.');
      }
    }
  }
}

// 단계 진입 처리
function enterStep(step, prevStep) {
  console.log(`단계 ${step} 진입 (이전: ${prevStep})`);
  
  switch(step) {
    case 0:
      enterStep0(prevStep);
      break;
    case 1:
      enterStep1(prevStep);
      break;
    case 2:
      enterStep2(prevStep);
      break;
  }
}

// 단계 0: 기본 상태
function enterStep0(prevStep) {
  lockInteraction(600);
  
  if (prevStep === 1) {
    hideNameTexts();
  } else if (prevStep === 2) {
    const portfolioSection = document.querySelector('.portfolio-section');
    if (portfolioSection) {
      portfolioSection.classList.remove('active');
    }
    disablePhysics();
    resumeMorphLoop();
  }
}

// 단계 1: 이름 텍스트 표시
function enterStep1(prevStep) {
  lockInteraction(600);
  
  if (prevStep === 0) {
    showNameTexts();
  } else if (prevStep === 2) {
    const portfolioSection = document.querySelector('.portfolio-section');
    if (portfolioSection) {
      portfolioSection.classList.remove('active');
    }
    disablePhysics();
    resumeMorphLoop();
  }
}

// 단계 2: 포트폴리오/물리 활성화
function enterStep2(prevStep) {
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
        physicsMorphMode = true;
      }
    }, 1000);
  });
}

// 키보드 이벤트 처리
function handleKeyPress(event) {
  if (interactionLocked) return;
  
  switch(event.key) {
    case 'ArrowDown':
    case ' ':
      event.preventDefault();
      if (interactionStep < MAX_INTERACTION_STEP) {
        interactionStep++;
        enterStep(interactionStep, interactionStep - 1);
      } else {
        nextPortfolioPage();
      }
      break;
    case 'ArrowUp':
      event.preventDefault();
      if (interactionStep > 0) {
        interactionStep--;
        enterStep(interactionStep, interactionStep + 1);
      } else {
        prevPortfolioPage();
      }
      break;
    case 'ArrowLeft':
      event.preventDefault();
      prevPortfolioPage();
      break;
    case 'ArrowRight':
      event.preventDefault();
      nextPortfolioPage();
      break;
  }
}

// 터치 시작 이벤트 처리
function handleTouchStart(event) {
  if (interactionLocked) return;
  
  const touch = event.touches[0];
  touchStartY = touch.clientY;
  touchStartX = touch.clientX;
  touchStartTime = Date.now();
  isScrolling = false;
  
  // 스크롤 상태 리셋
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }
}

// 터치 이동 이벤트 처리
function handleTouchMove(event) {
  if (interactionLocked) return;
  
  const touch = event.touches[0];
  const deltaY = touch.clientY - touchStartY;
  const deltaX = touch.clientX - touchStartX;
  
  // 수직 스크롤이 수평 스크롤보다 크면 스크롤로 간주
  if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
    isScrolling = true;
    event.preventDefault(); // 기본 스크롤 방지
  }
}

// 터치 종료 이벤트 처리
function handleTouchEnd(event) {
  if (interactionLocked || !isScrolling) return;
  
  const touch = event.changedTouches[0];
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
      if (deltaY > 0) {
        // 아래로 스와이프 (다음 단계 또는 다음 페이지)
        if (interactionStep < MAX_INTERACTION_STEP) {
          interactionStep++;
          enterStep(interactionStep, interactionStep - 1);
        } else {
          nextPortfolioPage();
        }
      } else {
        // 위로 스와이프 (이전 단계 또는 이전 페이지)
        if (interactionStep > 0) {
          interactionStep--;
          enterStep(interactionStep, interactionStep + 1);
        } else {
          prevPortfolioPage();
        }
      }
    }
  } else if (deltaTime <= maxSwipeTime && Math.abs(deltaX) >= minSwipeDistance) {
    // 수평 스와이프 (포트폴리오 페이지 전환)
    if (deltaX > 0) {
      // 오른쪽으로 스와이프 (이전 페이지)
      prevPortfolioPage();
    } else {
      // 왼쪽으로 스와이프 (다음 페이지)
      nextPortfolioPage();
    }
  }
  
  // 스크롤 상태 리셋
  isScrolling = false;
  scrollTimeout = setTimeout(() => {
    isScrolling = false;
  }, 100);
}

// 더블 탭 이벤트 처리 (모바일에서 빠른 전환)
function handleDoubleTap(event) {
  if (interactionLocked) return;
  
  event.preventDefault();
  
  // 현재 단계에서 다음 단계로 빠르게 이동
  if (interactionStep < MAX_INTERACTION_STEP) {
    interactionStep++;
    enterStep(interactionStep, interactionStep - 1);
  } else {
    nextPortfolioPage();
  }
}
