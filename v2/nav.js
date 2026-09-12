/* ざつね屋 グローバルナビゲーション制御 */
(function () {
  'use strict';
  document.documentElement.classList.add('js-nav');

  /* ── スキップリンクから本文へキーボードフォーカスを移す ── */
  document.querySelectorAll('a.skip-link[href^="#"]').forEach(function (link) {
    var temporaryTarget = null;
    var cleanupTarget = function () {
      if (!temporaryTarget) return;
      temporaryTarget.removeAttribute('tabindex');
      temporaryTarget = null;
    };
    link.addEventListener('click', function () {
      cleanupTarget();
      var target = document.getElementById(link.getAttribute('href').slice(1));
      if (!target) return;
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
        temporaryTarget = target;
        target.addEventListener('blur', cleanupTarget, { once: true });
      }
      target.focus({ preventScroll: false });
    });
  });

  /* ── 診断CTAをheadの単一URLから安全に有効化 ── */
  var diagnosisUrl = null;
  var diagnosisUrlMeta = document.querySelector('meta[name="zatuneya:diagnosis-url"]');
  if (diagnosisUrlMeta) {
    try {
      var parsedDiagnosisUrl = new URL(diagnosisUrlMeta.getAttribute('content') || '');
      if (parsedDiagnosisUrl.protocol === 'https:' && !parsedDiagnosisUrl.username && !parsedDiagnosisUrl.password) {
        diagnosisUrl = parsedDiagnosisUrl.href;
      }
    } catch (error) {
      diagnosisUrl = null;
    }
  }
  document.querySelectorAll('a[data-diagnosis-link]').forEach(function (link) {
    if (diagnosisUrl) {
      link.setAttribute('href', diagnosisUrl);
      link.removeAttribute('aria-disabled');
    } else {
      link.removeAttribute('href');
      link.setAttribute('aria-disabled', 'true');
    }
  });

  /* ── ハンバーガーメニュー ── */
  var hamburger = document.getElementById('nav-hamburger');
  var siteNav   = document.getElementById('site-nav');

  if (hamburger && siteNav) {
    hamburger.addEventListener('click', function () {
      var isOpen = hamburger.getAttribute('aria-expanded') === 'true';
      hamburger.setAttribute('aria-expanded', String(!isOpen));
      hamburger.classList.toggle('is-open', !isOpen);
      siteNav.classList.toggle('is-open', !isOpen);
    });
  }

  /* ── ドロップダウンメニュー ── */
  document.querySelectorAll('.site-nav__dropdown-trigger').forEach(function (trigger) {
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = trigger.getAttribute('aria-expanded') === 'true';

      /* 他のドロップダウンをすべて閉じる */
      document.querySelectorAll('.site-nav__item--dropdown.is-open').forEach(function (el) {
        el.classList.remove('is-open');
        el.querySelector('.site-nav__dropdown-trigger').setAttribute('aria-expanded', 'false');
      });

      if (!isOpen) {
        trigger.setAttribute('aria-expanded', 'true');
        var parent = trigger.closest('.site-nav__item--dropdown');
        if (parent) parent.classList.add('is-open');
      }
    });
  });

  /* ナビ外クリックでメニュー・ドロップダウンを閉じる */
  document.addEventListener('click', function (e) {
    /* ハンバーガーメニューを閉じる */
    if (hamburger && siteNav && siteNav.classList.contains('is-open') &&
        !siteNav.contains(e.target) && !hamburger.contains(e.target)) {
      siteNav.classList.remove('is-open');
      hamburger.classList.remove('is-open');
      hamburger.setAttribute('aria-expanded', 'false');
    }
    /* ドロップダウンを閉じる */
    if (!e.target.closest('.site-nav__item--dropdown')) {
      document.querySelectorAll('.site-nav__item--dropdown.is-open').forEach(function (el) {
        el.classList.remove('is-open');
        el.querySelector('.site-nav__dropdown-trigger').setAttribute('aria-expanded', 'false');
      });
    }
  });

  /* ── スティッキーCTAバナーを閉じる ── */
  var closeBtn = document.getElementById('sticky-cta-close');
  var banner   = document.getElementById('sticky-cta');
  var hero     = document.getElementById('hero') || document.querySelector('main > section');
  var heroAction = hero ? hero.querySelector('[data-diagnosis-link]') : null;
  var terminalAreas = document.querySelectorAll('#final-cta, .bottom-cta, .svc-cta-band, .status-band, .offer-cta-row, .fc-reassure, .comp-footer');

  var readSessionValue = function (key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch (error) {
      return null;
    }
  };
  var writeSessionValue = function (key, value) {
    try {
      window.sessionStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  };

  if (closeBtn && banner) {
    /* セッション内で閉じた場合は再表示しない */
    if (readSessionValue('sticky-cta-closed') === '1') {
      banner.classList.add('is-closed');
      banner.setAttribute('aria-hidden', 'true');
    } else if (hero) {
      var stickyFrame = null;
      var stickyListenersRegistered = false;
      var navStateObserver = null;
      var isInViewport = function (element) {
        var rect = element.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight;
      };
      var rectsOverlap = function (first, second) {
        return first.right > second.left && first.left < second.right &&
          first.bottom > second.top && first.top < second.bottom;
      };
      var updateStickyCta = function () {
        stickyFrame = null;
        if (banner.classList.contains('is-closed')) return;
        var heroTrigger = heroAction || hero;
        var afterHero = heroTrigger.getBoundingClientRect().bottom <= 0;
        banner.classList.toggle('is-after-hero', afterHero);

        var terminalVisible = Array.prototype.some.call(terminalAreas, isInViewport);
        var navIsOpen = Boolean(siteNav && (
          siteNav.classList.contains('is-open') ||
          siteNav.querySelector('.site-nav__item--dropdown.is-open')
        ));
        var activeElement = document.activeElement;
        var focusOverlap = false;
        if (afterHero && activeElement && activeElement !== document.body &&
            !banner.contains(activeElement)) {
          focusOverlap = rectsOverlap(activeElement.getBoundingClientRect(), banner.getBoundingClientRect());
        }
        var suppressed = terminalVisible || navIsOpen || focusOverlap;
        banner.classList.toggle('is-suppressed', suppressed);
        if (afterHero && !suppressed) {
          banner.removeAttribute('aria-hidden');
        } else {
          banner.setAttribute('aria-hidden', 'true');
        }
      };
      var scheduleStickyCtaUpdate = function () {
        if (stickyFrame !== null) return;
        stickyFrame = window.requestAnimationFrame(updateStickyCta);
      };
      var unregisterStickyCtaListeners = function () {
        if (!stickyListenersRegistered) return;
        window.removeEventListener('scroll', scheduleStickyCtaUpdate);
        window.removeEventListener('resize', scheduleStickyCtaUpdate);
        window.removeEventListener('pagehide', unregisterStickyCtaListeners);
        document.removeEventListener('focusin', scheduleStickyCtaUpdate);
        document.removeEventListener('focusout', scheduleStickyCtaUpdate);
        if (navStateObserver) navStateObserver.disconnect();
        stickyListenersRegistered = false;
        if (stickyFrame !== null) {
          window.cancelAnimationFrame(stickyFrame);
          stickyFrame = null;
        }
      };
      var registerStickyCtaListeners = function () {
        if (stickyListenersRegistered || banner.classList.contains('is-closed')) return;
        window.addEventListener('scroll', scheduleStickyCtaUpdate, { passive: true });
        window.addEventListener('resize', scheduleStickyCtaUpdate);
        window.addEventListener('pagehide', unregisterStickyCtaListeners);
        document.addEventListener('focusin', scheduleStickyCtaUpdate);
        document.addEventListener('focusout', scheduleStickyCtaUpdate);
        if (siteNav) {
          if (!navStateObserver) navStateObserver = new MutationObserver(scheduleStickyCtaUpdate);
          navStateObserver.observe(siteNav, { attributes: true, attributeFilter: ['class'], subtree: true });
        }
        stickyListenersRegistered = true;
      };
      var restoreStickyCtaAfterPageShow = function () {
        if (banner.classList.contains('is-closed')) return;
        if (readSessionValue('sticky-cta-closed') === '1') {
          banner.classList.add('is-closed');
          banner.classList.remove('is-after-hero', 'is-suppressed');
          banner.setAttribute('aria-hidden', 'true');
          unregisterStickyCtaListeners();
          window.removeEventListener('pageshow', restoreStickyCtaAfterPageShow);
          return;
        }
        registerStickyCtaListeners();
        updateStickyCta();
      };

      updateStickyCta();
      registerStickyCtaListeners();
      window.addEventListener('pageshow', restoreStickyCtaAfterPageShow);
      closeBtn.addEventListener('click', function () {
        banner.classList.add('is-closed');
        banner.classList.remove('is-after-hero');
        banner.classList.remove('is-suppressed');
        banner.setAttribute('aria-hidden', 'true');
        writeSessionValue('sticky-cta-closed', '1');
        unregisterStickyCtaListeners();
        window.removeEventListener('pageshow', restoreStickyCtaAfterPageShow);
      });
    } else {
      closeBtn.addEventListener('click', function () {
        banner.classList.add('is-closed');
        writeSessionValue('sticky-cta-closed', '1');
      });
    }
  }

  /* ── アクティブなナビリンクのハイライト ── */
  var here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.site-nav__link[href]').forEach(function (a) {
    var href = a.getAttribute('href') || '';
    if (href.startsWith('http')) return; /* 絶対URLはスキップ */
    var file = href.split('#')[0].split('/').pop();
    if (file && file === here) {
      a.classList.add('is-active');
    }
  });
})();

/* ── フェードインアニメーション（Intersection Observer） ── */
(function () {
  var els = document.querySelectorAll('.fade-in');
  if (!els.length || typeof window.IntersectionObserver !== 'function') return;
  var io;
  try {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });
    els.forEach(function (el) { io.observe(el); });
    document.documentElement.classList.add('js-reveal');
  } catch (error) {
    if (io) io.disconnect();
    document.documentElement.classList.remove('js-reveal');
  }
})();

/* V2: keyboard-safe FAQ accordion and Escape close behavior. */
(function () {
  'use strict';
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    var button = document.getElementById('nav-hamburger');
    var nav = document.getElementById('site-nav');
    var openDropdownTrigger = document.querySelector('.site-nav__item--dropdown.is-open .site-nav__dropdown-trigger');
    document.querySelectorAll('.site-nav__item--dropdown.is-open').forEach(function (item) {
      item.classList.remove('is-open');
      var trigger = item.querySelector('.site-nav__dropdown-trigger');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
    if (openDropdownTrigger) {
      openDropdownTrigger.focus();
      return;
    }
    if (button && nav && (button.getAttribute('aria-expanded') === 'true' || nav.classList.contains('is-open'))) {
      button.setAttribute('aria-expanded', 'false');
      button.classList.remove('is-open');
      nav.classList.remove('is-open');
      button.focus();
    }
  });
  document.querySelectorAll('.faq-trigger').forEach(function (trigger) {
    trigger.addEventListener('click', function () {
      var answer = document.getElementById(trigger.getAttribute('aria-controls'));
      var open = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', String(!open));
      if (answer) answer.hidden = open;
    });
  });
})();
