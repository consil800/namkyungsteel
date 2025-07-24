/**
* Custom JavaScript for Steel Company Website
* Copyright-free custom functionality
* Based on standard web practices and vanilla JavaScript
*/

(function() {
  "use strict";

  /**
   * Apply .scrolled class to the body as the page is scrolled down
   */
  function toggleScrolled() {
    const selectBody = document.querySelector('body');
    const selectHeader = document.querySelector('#header');
    if (!selectHeader.classList.contains('scroll-up-sticky') && !selectHeader.classList.contains('sticky-top') && !selectHeader.classList.contains('fixed-top')) return;
    window.scrollY > 100 ? selectBody.classList.add('scrolled') : selectBody.classList.remove('scrolled');
  }

  document.addEventListener('scroll', toggleScrolled);
  window.addEventListener('load', toggleScrolled);

  /**
   * Mobile nav toggle
   */
  const mobileNavToggleBtn = document.querySelector('.mobile-nav-toggle');

  function mobileNavToogle() {
    document.querySelector('body').classList.toggle('mobile-nav-active');
    mobileNavToggleBtn.classList.toggle('bi-list');
    mobileNavToggleBtn.classList.toggle('bi-x');
  }
  if (mobileNavToggleBtn) {
    mobileNavToggleBtn.addEventListener('click', mobileNavToogle);
  }

  /**
   * Hide mobile nav on same-page/hash links
   */
  document.querySelectorAll('#navmenu a').forEach(navmenu => {
    navmenu.addEventListener('click', (e) => {
      if (document.querySelector('.mobile-nav-active')) {
        // 드롭다운 토글이 아닌 일반 링크인 경우에만 메뉴 닫기
        if (!e.target.classList.contains('toggle-dropdown')) {
          mobileNavToogle();
        }
      }
    });
  });
  
  /**
   * Prevent click event issues on mobile devices
   */
  if ('ontouchstart' in window) {
    document.addEventListener('touchstart', function() {}, {passive: true});
    
    // 모바일에서 링크 클릭 이벤트 보장
    document.querySelectorAll('a').forEach(link => {
      link.addEventListener('touchend', function(e) {
        if (this.href && this.href !== '#' && !this.classList.contains('toggle-dropdown')) {
          // 터치 이벤트 후 클릭 이벤트 방지
          e.preventDefault();
          const href = this.href;
          
          // 모바일 메뉴가 열려있으면 닫기
          if (document.querySelector('.mobile-nav-active') && this.closest('#navmenu')) {
            mobileNavToogle();
            // 메뉴 닫힌 후 페이지 이동
            setTimeout(() => {
              window.location.href = href;
            }, 300);
          } else {
            window.location.href = href;
          }
        }
      });
    });
  }

  /**
   * Toggle mobile nav dropdowns
   */
  document.querySelectorAll('.navmenu .toggle-dropdown').forEach(navmenu => {
    navmenu.addEventListener('click', function(e) {
      e.preventDefault();
      
      // 모바일 메뉴가 활성화된 경우에만 드롭다운 토글
      if (document.querySelector('.mobile-nav-active')) {
        const dropdownParent = this.parentNode;
        const dropdownMenu = dropdownParent.querySelector('ul');
        
        if (dropdownMenu) {
          // 현재 드롭다운 상태 확인
          const isActive = dropdownMenu.classList.contains('dropdown-active');
          
          // 다른 모든 드롭다운 닫기
          document.querySelectorAll('.navmenu .dropdown ul').forEach(ul => {
            ul.classList.remove('dropdown-active');
          });
          document.querySelectorAll('.navmenu .dropdown').forEach(dropdown => {
            dropdown.classList.remove('active');
          });
          
          // 현재 드롭다운 토글
          if (!isActive) {
            dropdownMenu.classList.add('dropdown-active');
            dropdownParent.classList.add('active');
          }
        }
        
        e.stopImmediatePropagation();
      }
    });
  });

  /**
   * Scroll top button
   */
  let scrollTop = document.querySelector('.scroll-top');

  function toggleScrollTop() {
    if (scrollTop) {
      window.scrollY > 100 ? scrollTop.classList.add('active') : scrollTop.classList.remove('active');
    }
  }
  if (scrollTop) {
    scrollTop.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  window.addEventListener('load', toggleScrollTop);
  document.addEventListener('scroll', toggleScrollTop);

  /**
   * Animation on scroll function and init
   */
  function aosInit() {
    if (typeof AOS !== 'undefined') {
      AOS.init({
        duration: 600,
        easing: 'ease-in-out',
        once: true,
        mirror: false
      });
    }
  }
  window.addEventListener('load', aosInit);

  /**
   * Initiate Pure Counter
   */
  if (typeof PureCounter !== 'undefined') {
    new PureCounter();
  }

  /**
   * Smooth scroll for anchor links
   */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      
      // href가 '#'만 있거나 비어있으면 스크롤 처리 안함
      if (href === '#' || href.length <= 1) {
        return;
      }
      
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
        
        // 모바일 메뉴가 열려있으면 닫기
        if (document.querySelector('.mobile-nav-active')) {
          mobileNavToogle();
        }
      }
    });
  });

  /**
   * Auto hide navbar on scroll (optional feature)
   */
  let lastScrollTop = 0;
  const navbar = document.querySelector('.header');
  
  window.addEventListener('scroll', function() {
    // 모바일 메뉴가 열려있을 때는 navbar 숨기기 비활성화
    if (document.querySelector('.mobile-nav-active')) {
      return;
    }
    
    let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop > lastScrollTop && scrollTop > 100) {
      // Scroll down - hide navbar
      if (navbar) navbar.style.top = '-100px';
    } else {
      // Scroll up - show navbar
      if (navbar) navbar.style.top = '0';
    }
    lastScrollTop = scrollTop;
  });

  /**
   * Form validation helper
   */
  function validateForm(formElement) {
    const requiredFields = formElement.querySelectorAll('[required]');
    let isValid = true;

    requiredFields.forEach(field => {
      if (!field.value.trim()) {
        field.classList.add('is-invalid');
        isValid = false;
      } else {
        field.classList.remove('is-invalid');
      }
    });

    return isValid;
  }

  /**
   * Generic form handler
   */
  document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', function(e) {
      if (!validateForm(this)) {
        e.preventDefault();
        alert('필수 항목을 모두 입력해주세요.');
      }
    });
  });

  /**
   * Card hover effects
   */
  document.querySelectorAll('.service-item, .info-item').forEach(card => {
    card.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-5px)';
    });
    
    card.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0)';
    });
  });

  /**
   * Loading animation
   */
  window.addEventListener('load', function() {
    const loader = document.querySelector('.loader');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => {
        loader.style.display = 'none';
      }, 500);
    }
  });

  /**
   * Responsive image loading
   */
  function loadImages() {
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.remove('lazy');
          imageObserver.unobserve(img);
        }
      });
    });

    images.forEach(img => imageObserver.observe(img));
  }

  document.addEventListener('DOMContentLoaded', loadImages);

})();