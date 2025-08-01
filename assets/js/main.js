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
    
    // 헤더가 아직 로드되지 않았으면 종료
    if (!selectHeader) return;
    
    if (!selectHeader.classList.contains('scroll-up-sticky') && !selectHeader.classList.contains('sticky-top') && !selectHeader.classList.contains('fixed-top')) return;
    window.scrollY > 100 ? selectBody.classList.add('scrolled') : selectBody.classList.remove('scrolled');
  }

  document.addEventListener('scroll', toggleScrolled);
  window.addEventListener('load', toggleScrolled);

  /**
   * Mobile nav toggle - DISABLED (Using drawer instead)
   */
  // const mobileNavToggleBtn = document.querySelector('.mobile-nav-toggle');

  // function mobileNavToogle() {
  //   document.querySelector('body').classList.toggle('mobile-nav-active');
  //   mobileNavToggleBtn.classList.toggle('bi-list');
  //   mobileNavToggleBtn.classList.toggle('bi-x');
  // }
  // if (mobileNavToggleBtn) {
  //   mobileNavToggleBtn.addEventListener('click', mobileNavToogle);
  // }

  /**
   * Hide mobile nav on same-page/hash links and handle navigation - DISABLED
   */
  // Drawer navigation is handled in common.js
  
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
          
          // 페이지 이동
          window.location.href = href;
        }
      });
    });
  }

  /**
   * Toggle mobile nav dropdowns - DISABLED
   */
  // Dropdown navigation is handled in common.js for drawer menu

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
        
        // Mobile menu handling is done in drawer
      }
    });
  });

  /**
   * Auto hide navbar on scroll (optional feature)
   */
  let lastScrollTop = 0;
  const navbar = document.querySelector('.header');
  
  window.addEventListener('scroll', function() {
    // Drawer menu check
    if (document.querySelector('.mobile-drawer.active')) {
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