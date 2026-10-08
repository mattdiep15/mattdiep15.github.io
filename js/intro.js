/* ==========================================================================
   intro.js — intro preloader
   --------------------------------------------------------------------------
   A dot holds at the center of the screen, then the iris opens outward
   as a growing circle, revealing the hero underneath.

   The decision to SHOW the intro is made by the tiny inline script in
   <head> (html.intro-pending) so no-JS visitors, reduced-motion users,
   repeat visits in the same session (sessionStorage), and projects.html
   never see it. Any click or keypress fast-forwards.

   TUNABLES:
     INTRO.holdMs    how long the dot holds before opening (mirror --intro-hold-ms in CSS)
     INTRO.expandMs  how long the iris takes to open (mirror --intro-iris-ms in CSS)
     (iris size/scale and easing themselves live in the CSS on .intro-iris)
   ========================================================================== */

(function () {
  'use strict';

  var docEl = document.documentElement;
  if (!docEl.classList.contains('intro-pending')) return;

  var INTRO = { holdMs: 1000, expandMs: 1100 };

  var intro = document.getElementById('intro');
  var iris = intro.querySelector('.intro-iris');

  var done = false;

  function finish() {
    if (done) return;
    done = true;

    try { sessionStorage.setItem('introSeen', '1'); } catch (e) { /* private mode */ }

    // iris opens (CSS transition), hero entrance starts underneath
    intro.classList.add('intro-leave');
    docEl.classList.add('intro-done');

    iris.addEventListener('transitionend', function onOpen(e) {
      if (e.propertyName !== 'transform') return;
      iris.removeEventListener('transitionend', onOpen);
      docEl.classList.remove('intro-pending');
      intro.remove();
    });

    // safety net in case transitionend never fires
    setTimeout(function () {
      if (intro.parentNode) {
        docEl.classList.remove('intro-pending');
        intro.remove();
      }
    }, INTRO.expandMs + 500);

    window.removeEventListener('pointerdown', finish);
    window.removeEventListener('keydown', finish);
  }

  // skippable: any click or keypress jumps straight to the reveal
  window.addEventListener('pointerdown', finish);
  window.addEventListener('keydown', finish);

  setTimeout(finish, INTRO.holdMs);
})();
