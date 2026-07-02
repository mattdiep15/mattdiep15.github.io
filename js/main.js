/* ==========================================================================
   main.js — nav, hero photo cycling, expanders, page-transition curtain
   ========================================================================== */

(function () {
  'use strict';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── nav: inline links hide on scroll, circular menu button takes over ── */
  var mainNav = document.getElementById('main-nav');
  var menuBtn = document.getElementById('menu-btn');
  var navDropdown = document.getElementById('nav-dropdown');
  var SCROLL_THRESHOLD = 80;

  function closeDropdown() {
    navDropdown.classList.remove('open');
    menuBtn.querySelector('i').className = 'fas fa-bars';
    menuBtn.setAttribute('aria-expanded', 'false');
  }

  if (mainNav && menuBtn && navDropdown) {
    window.addEventListener('scroll', function () {
      var scrolled = window.scrollY > SCROLL_THRESHOLD;
      mainNav.classList.toggle('hidden', scrolled);
      menuBtn.classList.toggle('visible', scrolled);
      if (!scrolled) closeDropdown();
    }, { passive: true });

    menuBtn.addEventListener('click', function () {
      var isOpen = navDropdown.classList.toggle('open');
      menuBtn.querySelector('i').className = isOpen ? 'fas fa-times' : 'fas fa-bars';
      menuBtn.setAttribute('aria-expanded', String(isOpen));
    });

    document.addEventListener('click', function (e) {
      if (!menuBtn.contains(e.target) && !navDropdown.contains(e.target)) closeDropdown();
    });

    navDropdown.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeDropdown);
    });
  }

  /* ── experience / education expanding cards ── */
  document.querySelectorAll('.tl-card[role="button"]').forEach(function (card) {
    var initialDetails = card.querySelector('.tl-details');
    if (initialDetails) initialDetails.setAttribute('aria-hidden', 'true');
    function toggleCard() {
      var isOpen = card.classList.toggle('open');
      card.setAttribute('aria-expanded', String(isOpen));
      var details = card.querySelector('.tl-details');
      if (details) details.setAttribute('aria-hidden', String(!isOpen));
    }
    card.addEventListener('click', function (e) {
      if (!e.target.closest('a')) toggleCard();
    });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCard(); }
    });
  });

  /* ── hero photo: click to cycle, with a particle burst ── */
  var heroPhotos = ['images/PalaceFineArts.jpg', 'images/WRportrait.jpg', 'images/abandonedhutphoto.jpg', 'images/chatpfp.png'];
  var heroIndex = 0;
  var heroFlipping = false;
  var heroCircle = document.getElementById('hero-circle');

  function spawnParticles(circleEl) {
    if (reducedMotion) return;
    var rect = circleEl.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var radius = rect.width / 2;
    var colors = ['#131313', '#222222', '#333333', '#2b4cff', '#1a1a1a'];
    var count = 22;
    for (var i = 0; i < count; i++) {
      (function (idx) {
        var angle = (idx / count) * 2 * Math.PI + (Math.random() - 0.5) * 0.3;
        var sx = cx + Math.cos(angle) * radius;
        var sy = cy + Math.sin(angle) * radius;
        var p = document.createElement('div');
        var size = 4 + Math.random() * 5;
        p.style.cssText = 'position:fixed;left:' + sx + 'px;top:' + sy + 'px;'
          + 'width:' + size + 'px;height:' + size + 'px;border-radius:50%;'
          + 'background:' + colors[Math.floor(Math.random() * colors.length)] + ';'
          + 'pointer-events:none;z-index:9998;';
        document.body.appendChild(p);

        var dist = 50 + Math.random() * 80;
        var dx = Math.cos(angle) * dist;
        var dy = Math.sin(angle) * dist;
        var dur = 480 + Math.random() * 280;

        var anim = p.animate([
          { transform: 'translate(-50%,-50%)', opacity: 1 },
          { transform: 'translate(calc(-50% + ' + dx + 'px),calc(-50% + ' + dy + 'px)) scale(0.3)', opacity: 0 }
        ], { duration: dur, easing: 'cubic-bezier(0.2,0.9,0.4,1)', fill: 'forwards' });

        anim.onfinish = function () { p.remove(); };
      })(i);
    }
  }

  function cycleHeroPhoto() {
    if (heroFlipping) return;
    heroFlipping = true;

    var img = document.getElementById('hero-img');
    spawnParticles(heroCircle);

    img.style.opacity = '0';
    setTimeout(function () {
      heroIndex = (heroIndex + 1) % heroPhotos.length;
      img.src = heroPhotos[heroIndex];
      img.style.opacity = '1';
      setTimeout(function () { heroFlipping = false; }, 280);
    }, 280);
  }

  if (heroCircle) {
    heroCircle.addEventListener('click', cycleHeroPhoto);
    heroCircle.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycleHeroPhoto(); }
    });
  }

  /* ── page-transition curtain (home ⇄ projects) ──
     Links with data-transition play a quick curtain cover, then navigate;
     the inline <head> script on the next page sets html.page-enter (from
     the sessionStorage flag) so the curtain starts covered and lifts. */
  var curtain = document.getElementById('curtain');

  if (curtain && !reducedMotion) {
    document.querySelectorAll('a[data-transition]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        // let modified clicks (new tab etc.) behave natively
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        var href = link.getAttribute('href');
        try { sessionStorage.setItem('pageTransition', '1'); } catch (err) {}
        curtain.classList.add('curtain-cover');
        setTimeout(function () { window.location.href = href; }, 430);
      });
    });
  }

  // arriving with the curtain down → lift it
  if (curtain && document.documentElement.classList.contains('page-enter')) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        curtain.classList.add('curtain-lift');
        curtain.addEventListener('transitionend', function () {
          document.documentElement.classList.remove('page-enter');
          curtain.classList.remove('curtain-lift');
        }, { once: true });
      });
    });
  }
})();
