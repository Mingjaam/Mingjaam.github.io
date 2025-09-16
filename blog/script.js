// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', function() {
    // 모바일 메뉴 토글
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        // 메뉴 링크 클릭 시 모바일 메뉴 닫기
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', function() {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
    }

    // 스크롤 시 네비게이션 스타일 변경
    window.addEventListener('scroll', function() {
        const navbar = document.querySelector('.navbar');
        if (window.scrollY > 100) {
            navbar.style.background = 'rgba(255, 255, 255, 0.98)';
            navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
        } else {
            navbar.style.background = 'rgba(255, 255, 255, 0.95)';
            navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
        }
    });

    // 스무스 스크롤
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // 스크롤 애니메이션
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in-up');
            }
        });
    }, observerOptions);

    // 애니메이션을 적용할 요소들
    const animateElements = document.querySelectorAll('.post-card, .widget, .profile-card');
    animateElements.forEach(el => {
        observer.observe(el);
    });

    // 필터 탭 기능
    const tabBtns = document.querySelectorAll('.tab-btn');
    const postCards = document.querySelectorAll('.post-card');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // 모든 탭에서 active 클래스 제거
            tabBtns.forEach(tab => tab.classList.remove('active'));
            // 클릭된 탭에 active 클래스 추가
            this.classList.add('active');

            const filter = this.getAttribute('data-filter');

            postCards.forEach(card => {
                if (filter === 'all') {
                    card.style.display = 'block';
                } else {
                    const categories = card.getAttribute('data-category');
                    if (categories && categories.includes(filter)) {
                        card.style.display = 'block';
                    } else {
                        card.style.display = 'none';
                    }
                }
            });
        });
    });

    // 태그 클릭 기능
    const tagItems = document.querySelectorAll('.tag-item');
    tagItems.forEach(tag => {
        tag.addEventListener('click', function() {
            const tagText = this.textContent.toLowerCase();
            
            // 해당 태그가 포함된 포스트만 표시
            postCards.forEach(card => {
                const tags = card.querySelectorAll('.tag');
                let hasTag = false;
                
                tags.forEach(tag => {
                    if (tag.textContent.toLowerCase().includes(tagText)) {
                        hasTag = true;
                    }
                });
                
                if (hasTag) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });

            // 필터 탭을 '전체'로 변경
            tabBtns.forEach(btn => btn.classList.remove('active'));
            document.querySelector('[data-filter="all"]').classList.add('active');
        });
    });

    // 구독 폼 제출
    const subscribeForm = document.querySelector('.subscribe-form');
    if (subscribeForm) {
        subscribeForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = this.querySelector('input[type="email"]').value;
            
            // 간단한 이메일 형식 검사
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                alert('올바른 이메일 형식을 입력해주세요.');
                return;
            }
            
            // 성공 메시지 (실제로는 서버로 데이터를 보내야 함)
            alert('구독이 완료되었습니다! 새로운 포스트가 올라오면 알려드릴게요.');
            this.reset();
        });
    }

    // 포스트 카드 호버 효과
    document.querySelectorAll('.post-card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
            this.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.15)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        });
    });

    // 위젯 호버 효과
    document.querySelectorAll('.widget, .profile-card').forEach(widget => {
        widget.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
            this.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.12)';
        });
        
        widget.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        });
    });

    // 로딩 애니메이션
    window.addEventListener('load', function() {
        document.body.style.opacity = '0';
        document.body.style.transition = 'opacity 0.5s ease';
        
        setTimeout(() => {
            document.body.style.opacity = '1';
        }, 100);
    });

    // 타이핑 애니메이션 효과
    function typeWriter(element, text, speed = 100) {
        let i = 0;
        element.innerHTML = '';
        
        function type() {
            if (i < text.length) {
                element.innerHTML += text.charAt(i);
                i++;
                setTimeout(type, speed);
            }
        }
        type();
    }

    // 블로그 제목 타이핑 효과 (데스크톱에서만)
    const blogTitle = document.querySelector('.blog-title');
    if (blogTitle && window.innerWidth > 768) {
        const originalText = blogTitle.textContent;
        setTimeout(() => {
            typeWriter(blogTitle, originalText, 50);
        }, 500);
    }

    // 스크롤 진행률 표시
    function updateScrollProgress() {
        const scrollTop = window.pageYOffset;
        const docHeight = document.body.scrollHeight - window.innerHeight;
        const scrollPercent = (scrollTop / docHeight) * 100;
        
        // 스크롤 진행률을 표시할 요소가 있다면 업데이트
        const progressBar = document.querySelector('.scroll-progress');
        if (progressBar) {
            progressBar.style.width = scrollPercent + '%';
        }
    }

    window.addEventListener('scroll', updateScrollProgress);

    // 다크 모드 토글 (선택사항)
    function createDarkModeToggle() {
        const toggle = document.createElement('button');
        toggle.innerHTML = '🌙';
        toggle.className = 'dark-mode-toggle';
        toggle.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1001;
            background: rgba(255, 255, 255, 0.9);
            border: none;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            font-size: 1.2rem;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
        `;
        
        document.body.appendChild(toggle);
        
        let isDark = false;
        toggle.addEventListener('click', function() {
            isDark = !isDark;
            document.body.classList.toggle('dark-mode');
            toggle.innerHTML = isDark ? '☀️' : '🌙';
        });
    }

    // 다크 모드 스타일 추가
    const darkModeStyles = `
        <style>
            .dark-mode {
                background: #1a1a1a !important;
                color: #ffffff !important;
            }
            .dark-mode .navbar {
                background: rgba(26, 26, 26, 0.95) !important;
            }
            .dark-mode .nav-link {
                color: #ffffff !important;
            }
            .dark-mode .posts-section,
            .dark-mode .profile-card,
            .dark-mode .widget {
                background: #2d2d2d !important;
                color: #ffffff !important;
            }
            .dark-mode .post-card {
                background: #2d2d2d !important;
                color: #ffffff !important;
                border-color: #404040 !important;
            }
            .dark-mode .post-title a {
                color: #ffffff !important;
            }
            .dark-mode .post-excerpt {
                color: #d1d5db !important;
            }
        </style>
    `;
    
    document.head.insertAdjacentHTML('beforeend', darkModeStyles);
    
    // 다크 모드 토글 버튼 생성 (선택사항)
    // createDarkModeToggle();

    // 숫자 카운터 애니메이션
    function animateCounter(element, target, duration = 2000) {
        let start = 0;
        const increment = target / (duration / 16);
        
        function updateCounter() {
            start += increment;
            if (start < target) {
                element.textContent = Math.floor(start);
                requestAnimationFrame(updateCounter);
            } else {
                element.textContent = target;
            }
        }
        updateCounter();
    }

    // 통계 숫자 애니메이션
    const postCount = document.getElementById('post-count');
    if (postCount) {
        const statsObserver = new IntersectionObserver(function(entries) {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const target = parseInt(entry.target.textContent);
                    animateCounter(entry.target, target);
                    statsObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        statsObserver.observe(postCount);
    }

    // 파티클 효과 (선택사항)
    function createParticles() {
        const particlesContainer = document.createElement('div');
        particlesContainer.className = 'particles';
        particlesContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: -1;
        `;
        
        document.body.appendChild(particlesContainer);
        
        for (let i = 0; i < 50; i++) {
            const particle = document.createElement('div');
            particle.style.cssText = `
                position: absolute;
                width: 2px;
                height: 2px;
                background: rgba(37, 99, 235, 0.5);
                border-radius: 50%;
                animation: float 6s ease-in-out infinite;
                left: ${Math.random() * 100}%;
                animation-delay: ${Math.random() * 6}s;
            `;
            particlesContainer.appendChild(particle);
        }
    }

    // 파티클 애니메이션 스타일
    const particleStyles = `
        <style>
            @keyframes float {
                0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 1; }
                50% { transform: translateY(-20px) rotate(180deg); opacity: 0.5; }
            }
        </style>
    `;
    
    document.head.insertAdjacentHTML('beforeend', particleStyles);
    
    // 파티클 효과 활성화 (선택사항)
    // createParticles();
});

// 추가 유틸리티 함수들
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 윈도우 리사이즈 이벤트 최적화
window.addEventListener('resize', debounce(function() {
    // 리사이즈 시 필요한 작업들
    console.log('Window resized');
}, 250));

// 성능 최적화를 위한 스크롤 이벤트 쓰로틀링
let ticking = false;
function updateOnScroll() {
    // 스크롤 관련 업데이트 작업들
    ticking = false;
}

window.addEventListener('scroll', function() {
    if (!ticking) {
        requestAnimationFrame(updateOnScroll);
        ticking = true;
    }
});
