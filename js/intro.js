/* ==========================================================================
   intro.js — intro preloader (inspired by opacity.com)
   --------------------------------------------------------------------------
   A 0–100 counter runs, then a curtain wipe reveals the hero.

   The decision to SHOW the intro is made by the tiny inline script in
   <head> (html.intro-pending) so no-JS visitors, reduced-motion users,
   repeat visits in the same session (sessionStorage), and projects.html
   never see it. Any click or keypress fast-forwards.

   TUNABLES:
     INTRO.nameMs   how long the 0-100 count takes (mirror --intro-name-ms in CSS)
     INTRO.holdMs   pause at 100 before the curtain lifts
     (curtain speed itself is the CSS clip-path transition on #intro.intro-leave)
   ========================================================================== */

(function () {
  'use strict';

  var docEl = document.documentElement;
  if (!docEl.classList.contains('intro-pending')) return;

  var INTRO = { nameMs: 2000, holdMs: 250 };

  var intro = document.getElementById('intro');
  var counterEl = intro.querySelector('.intro-counter');

  var start = null;
  var done = false;
  var rafId = null;

  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function tick(now) {
    if (start === null) start = now;
    var t = Math.min((now - start) / INTRO.nameMs, 1);
    var e = easeInOut(t);
    counterEl.textContent = Math.round(e * 100);
    if (t < 1) {
      rafId = requestAnimationFrame(tick);
    } else {
      setTimeout(finish, INTRO.holdMs);
    }
  }

  function finish() {
    if (done) return;
    done = true;
    if (rafId) cancelAnimationFrame(rafId);

    try { sessionStorage.setItem('introSeen', '1'); } catch (e) { /* private mode */ }

    counterEl.textContent = '100';

    // curtain wipe (CSS transition), hero entrance starts underneath
    intro.classList.add('intro-leave');
    docEl.classList.add('intro-done');

    intro.addEventListener('transitionend', function () {
      docEl.classList.remove('intro-pending');
      intro.remove();
    }, { once: true });

    // safety net in case transitionend never fires
    setTimeout(function () {
      if (intro.parentNode) {
        docEl.classList.remove('intro-pending');
        intro.remove();
      }
    }, 1200);

    window.removeEventListener('pointerdown', finish);
    window.removeEventListener('keydown', finish);
  }

  // skippable: any click or keypress jumps straight to the reveal
  window.addEventListener('pointerdown', finish);
  window.addEventListener('keydown', finish);

  rafId = requestAnimationFrame(tick);
})();
