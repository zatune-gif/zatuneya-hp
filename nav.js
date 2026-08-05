/* ざつね屋 グローバルナビゲーション制御 */
(function () {
  'use strict';

  /* ── ハンバーガーメニュー ── */
  var hamburger = document.getElementById('nav-hamburger');
  var siteNav   = document.getElementById('site-nav');

  if (hamburger && siteNav) {
    hamburger.addEventListener('click', function () {
      var isOpen = hamburger.getAttribute('aria-expanded') === 'true';
      hamburger.setAttribute('aria-expanded', String(!isOpen));
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

  if (closeBtn && banner) {
    /* セッション内で閉じた場合は再表示しない */
    if (sessionStorage.getItem('sticky-cta-closed') === '1') {
      banner.classList.add('is-closed');
    }
    closeBtn.addEventListener('click', function () {
      banner.classList.add('is-closed');
      sessionStorage.setItem('sticky-cta-closed', '1');
    });
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
  if (!els.length) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  els.forEach(function (el) { io.observe(el); });
})();
