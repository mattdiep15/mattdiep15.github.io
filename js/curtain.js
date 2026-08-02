/* ==========================================================================
   curtain.js — the black page-transition curtain
   --------------------------------------------------------------------------
   One panel (#curtain, outside #smooth-wrapper) drives every transition on
   the site. It has two halves, both pure CSS class flips (see style.css):

     cover : .curtain-cover        rises from below, rounded leading edge
     lift  : html.page-enter       holds it covered with NO transition
             + .curtain-lift       exits through the top

   Two things use them:

     1. cross-page (a[data-transition]) — cover, then navigate. The next
        document's inline <head> script reads the sessionStorage flag and
        sets html.page-enter before first paint, so the curtain is already
        down when it renders; on load we play the lift.

     2. same-page (sweep) — cover, run a callback while the page is hidden,
        then lift. js/smooth.js uses this for the nav's #anchor tabs so they
        transition exactly like the Projects tab instead of scrolling.

   Degrades cleanly: on reduced motion (or if #curtain is missing) this bails
   entirely — data-transition links stay ordinary <a>s and smooth.js falls
   back to its animated scroll for anchors.
   ========================================================================== */

(function () {
  'use strict';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var curtain = document.getElementById('curtain');
  if (!curtain || reducedMotion) return;

  var COVER_MS = 420; // keep in sync with --curtain-ms in css/style.css
  var inFlight = false;

  /* ── lift ──
     Shared by the arrival lift and the tail of a same-page sweep. The lift
     transitions BOTH transform and border-radius, so pin the teardown to
     transform — otherwise whichever fires first strips the class mid-flight. */
  function lift() {
    curtain.classList.add('curtain-lift');
    curtain.addEventListener('transitionend', function onLift(e) {
      if (e.propertyName !== 'transform') return;
      curtain.removeEventListener('transitionend', onLift);
      document.documentElement.classList.remove('page-enter');
      curtain.classList.remove('curtain-lift');
    });
  }

  /* ── same-page sweep ──
     cover → onCovered() while nothing is visible → lift. */
  function sweep(onCovered) {
    if (inFlight) return;
    inFlight = true;
    var done = false;

    function covered() {
      if (done) return;
      done = true;
      clearTimeout(fallback);
      curtain.removeEventListener('transitionend', onCover);

      onCovered();

      /* Hand cover → page-enter off in a single recalc. Both rules resolve to
         translateY(0) / radius 0, and page-enter carries no transition, so the
         curtain simply stays put with the lift's start state now in force. */
      document.documentElement.classList.add('page-enter');
      curtain.classList.remove('curtain-cover');

      // two frames so the style flush lands before the lift's transition arms
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          lift();
          inFlight = false;
        });
      });
    }

    function onCover(e) {
      if (e.propertyName === 'transform') covered();
    }

    curtain.addEventListener('transitionend', onCover);
    var fallback = setTimeout(covered, COVER_MS + 80); // if transitionend is dropped
    curtain.classList.add('curtain-cover');
  }

  /* ── cross-page: cover, then navigate ── */
  document.querySelectorAll('a[data-transition]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      // let modified clicks (new tab etc.) behave natively
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      if (inFlight) return;
      inFlight = true;
      var href = link.getAttribute('href');
      try { sessionStorage.setItem('pageTransition', '1'); } catch (err) {}
      curtain.classList.add('curtain-cover');
      setTimeout(function () { window.location.href = href; }, COVER_MS + 10);
    });
  });

  // arriving with the curtain already down → lift it
  if (document.documentElement.classList.contains('page-enter')) {
    requestAnimationFrame(function () {
      requestAnimationFrame(lift); // double rAF: force a flush so the transition runs
    });
  }

  window.PageCurtain = { sweep: sweep };
})();
