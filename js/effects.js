/* ==========================================================================
   effects.js — pointer effects engine
   --------------------------------------------------------------------------
   Everything cursor-related runs through ONE requestAnimationFrame loop:
     • magnetic elements (.magnetic pull toward the cursor on hover;
       per-element strength via data-magnet="0.1")
     • hero pointer parallax (photo / name / subtitle drift)

   Two effects that used to live here are gone: the custom dot cursor (which
   also set `cursor: none` site-wide) and the cursor-following dot-grid
   spotlight. The native cursor and a plain background are used instead.

   TUNABLES — adjust the CONFIG object below:
     magnetStrength  default magnetic pull (override per element w/ data-magnet)
     parallax        hero drift distances in px
   Grain opacity lives in css/style.css (:root).
   ========================================================================== */

(function () {
  'use strict';

  var CONFIG = {
    /* Fraction of the cursor's distance-from-centre that the element travels, so
       the displacement scales with the element's own size. At 0.32 a text link
       like .view-project slid ~22px and could walk out from under the pointer;
       the contact pills never showed it because they set data-magnet="0.1"
       explicitly. This brings the un-overridden elements into the same range,
       so the whole site pulls by roughly the same amount. */
    magnetStrength: 0.12,
    // a touch slower to follow, which reads as softer rather than twitchy
    magnetLerp: 0.14,
    parallax: { name: 6, lerp: 0.06 }
  };

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touchDevice = window.matchMedia('(hover: none), (pointer: coarse)').matches;

  // Non-negotiable: no pointer effects on touch devices or for reduced motion.
  if (reducedMotion || touchDevice) return;

  /* ── shared pointer state ── */
  var mx = window.innerWidth / 2;   // raw cursor position (target)
  var my = window.innerHeight / 2;

  document.addEventListener('mousemove', function (e) {
    mx = e.clientX;
    my = e.clientY;
  }, { passive: true });

  /* ── magnetic elements ── */
  // Each .magnetic element stores its own current/target offset; while
  // hovered the target follows the cursor, on leave it springs back to 0.
  var magnets = [];
  document.querySelectorAll('.magnetic').forEach(function (el) {
    var strength = parseFloat(el.getAttribute('data-magnet'));
    if (isNaN(strength)) strength = CONFIG.magnetStrength;
    var m = { el: el, strength: strength, active: false, cx: 0, cy: 0, tx: 0, ty: 0, rect: null };
    el.addEventListener('mouseenter', function () {
      m.rect = el.getBoundingClientRect();
      m.active = true;
    });
    el.addEventListener('mouseleave', function () {
      m.active = false;
      m.tx = 0;
      m.ty = 0;
    });
    magnets.push(m);
  });

  /* ── hero parallax ──
     The circular photo and the subtitle are gone; the name is all that drifts. */
  var heroName = document.querySelector('.hero-name');
  var heroPin = document.querySelector('.hero-pin');
  var px = 0, py = 0; // lerped normalized (-1..1) pointer

  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ── THE loop ── */
  function frame() {
    // magnetic pull
    for (var i = 0; i < magnets.length; i++) {
      var m = magnets[i];
      if (m.active && m.rect) {
        var mcx = m.rect.left + m.rect.width / 2;
        var mcy = m.rect.top + m.rect.height / 2;
        m.tx = (mx - mcx) * m.strength;
        m.ty = (my - mcy) * m.strength;
      }
      m.cx = lerp(m.cx, m.tx, CONFIG.magnetLerp);
      m.cy = lerp(m.cy, m.ty, CONFIG.magnetLerp);
      if (Math.abs(m.cx) > 0.05 || Math.abs(m.cy) > 0.05) {
        m.el.style.transform = 'translate(' + m.cx.toFixed(2) + 'px,' + m.cy.toFixed(2) + 'px)';
      } else if (!m.active) {
        m.el.style.transform = '';
      }
    }

    // hero parallax — only while the hero is on screen
    if (heroPin && heroName) {
      var rect = heroPin.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) {
        var ntx = (mx - window.innerWidth / 2) / (window.innerWidth / 2);
        var nty = (my - window.innerHeight / 2) / (window.innerHeight / 2);
        px = lerp(px, ntx, CONFIG.parallax.lerp);
        py = lerp(py, nty, CONFIG.parallax.lerp);
        heroName.style.transform = 'translate(' + (px * CONFIG.parallax.name) + 'px,' + (py * CONFIG.parallax.name) + 'px)';
      }
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
