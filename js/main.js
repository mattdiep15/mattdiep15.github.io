/* ==========================================================================
   main.js — nav, hero photo cycling, expanders, page-transition curtain
   ========================================================================== */

(function () {
  'use strict';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* The nav lives in js/pill-nav.js now — it owns its own open/close state via
     a single interruptible timeline, so nothing here touches it. */

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

  /* The hero's circular photo (click to cycle through four images, with a
     particle burst) was removed — the photos now pop out of individual letters
     of the name on hover instead. See js/hero-letters.js. */

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
        // the lift transitions BOTH transform and border-radius, so pin this
        // to transform — otherwise whichever fires first tears down the class
        curtain.addEventListener('transitionend', function onLift(e) {
          if (e.propertyName !== 'transform') return;
          curtain.removeEventListener('transitionend', onLift);
          document.documentElement.classList.remove('page-enter');
          curtain.classList.remove('curtain-lift');
        });
      });
    });
  }
})();
