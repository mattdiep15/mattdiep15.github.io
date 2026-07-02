/* ==========================================================================
   effects.js — pointer effects engine
   --------------------------------------------------------------------------
   Everything cursor-related runs through ONE requestAnimationFrame loop:
     • cursor spotlight (lerped --mx/--my on #spotlight)
     • custom cursor (a dot that grows over interactive elements)
     • magnetic elements (.magnetic pull toward the cursor on hover;
       per-element strength via data-magnet="0.1")
     • card tilt ([data-tilt] rotates slightly toward the cursor)
     • hero pointer parallax (photo / name / subtitle drift)

   TUNABLES — adjust the CONFIG object below:
     spotlightLerp   how loosely the spotlight trails the cursor (0–1; lower = lazier)
     dotLerp         cursor follow speed
     dotHoverScale   how much the dot grows over links/buttons
     magnetStrength  default magnetic pull (override per element w/ data-magnet)
     tiltMax         max card tilt in degrees
     parallax        hero drift distances in px
   Spotlight radius + grain opacity live in css/style.css (:root).
   ========================================================================== */

(function () {
  'use strict';

  var CONFIG = {
    spotlightLerp: 0.08,
    dotLerp: 0.55,
    dotHoverScale: 2.6,
    dotDownScale: 1.4,
    dotScaleLerp: 0.2,
    magnetStrength: 0.32,
    magnetLerp: 0.18,
    tiltMax: 4,        // degrees
    tiltLerp: 0.12,
    parallax: { img: 10, name: 6, sub: 3.5, lerp: 0.06 }
  };

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touchDevice = window.matchMedia('(hover: none), (pointer: coarse)').matches;

  // Non-negotiable: no pointer effects on touch devices or for reduced motion.
  if (reducedMotion || touchDevice) return;

  document.documentElement.classList.add('fx'); // enables layers + cursor:none

  /* ── shared pointer state ── */
  var mx = window.innerWidth / 2;   // raw cursor position (target)
  var my = window.innerHeight / 2;
  var seen = false;                 // don't render cursor until first move

  document.addEventListener('mousemove', function (e) {
    mx = e.clientX;
    my = e.clientY;
    if (!seen) {
      seen = true;
      // snap everything to the pointer and reveal the cursor — avoids the
      // dot sitting in the corner or swooshing in from screen center
      sx = dx = mx;
      sy = dy = my;
      dot.style.opacity = '1';
    }
  }, { passive: true });

  /* ── spotlight ── */
  var spotlight = document.getElementById('spotlight');
  var sx = mx, sy = my;

  /* ── custom cursor ── */
  var dot = document.getElementById('cursor-dot');
  var dx = mx, dy = my;
  var dotScale = 1, dotScaleTarget = 1;
  var hovering = false, pressing = false;

  function updateDotScaleTarget() {
    dotScaleTarget = pressing ? CONFIG.dotDownScale : (hovering ? CONFIG.dotHoverScale : 1);
  }

  // grow the dot over anything interactive
  var HOVERABLE = 'a, button, [role="button"], [tabindex="0"]';
  document.addEventListener('mouseover', function (e) {
    if (e.target.closest(HOVERABLE)) { hovering = true; updateDotScaleTarget(); }
  });
  document.addEventListener('mouseout', function (e) {
    if (e.target.closest(HOVERABLE)) { hovering = false; updateDotScaleTarget(); }
  });
  document.addEventListener('mousedown', function () { pressing = true; updateDotScaleTarget(); });
  document.addEventListener('mouseup', function () { pressing = false; updateDotScaleTarget(); });

  // hide the cursor when the pointer leaves the window
  document.addEventListener('mouseleave', function () { dot.style.opacity = '0'; });
  document.addEventListener('mouseenter', function () { dot.style.opacity = '1'; });

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

  /* ── tilt cards ── */
  var tilts = [];
  document.querySelectorAll('[data-tilt]').forEach(function (el) {
    var t = { el: el, active: false, crx: 0, cry: 0, trx: 0, try_: 0, rect: null };
    el.addEventListener('mouseenter', function () {
      t.rect = el.getBoundingClientRect();
      t.active = true;
    });
    el.addEventListener('mouseleave', function () {
      t.active = false;
      t.trx = 0;
      t.try_ = 0;
    });
    tilts.push(t);
  });

  /* ── hero parallax ── */
  var heroImg = document.querySelector('.hero-circle-wrap');
  var heroName = document.querySelector('.hero-name');
  var heroSub = document.querySelector('.hero-sub');
  var heroPin = document.querySelector('.hero-pin');
  var px = 0, py = 0; // lerped normalized (-1..1) pointer

  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ── THE loop ── */
  function frame() {
    // spotlight trails the cursor with easing
    sx = lerp(sx, mx, CONFIG.spotlightLerp);
    sy = lerp(sy, my, CONFIG.spotlightLerp);
    spotlight.style.setProperty('--mx', sx.toFixed(1) + 'px');
    spotlight.style.setProperty('--my', sy.toFixed(1) + 'px');

    // cursor dot: quick follow + eased grow/shrink over interactive elements
    if (seen) {
      dx = lerp(dx, mx, CONFIG.dotLerp);
      dy = lerp(dy, my, CONFIG.dotLerp);
      dotScale = lerp(dotScale, dotScaleTarget, CONFIG.dotScaleLerp);
      // the trailing -50% centers the dot without reading layout
      dot.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) translate(-50%,-50%) scale(' + dotScale.toFixed(3) + ')';
    }

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

    // card tilt toward the cursor
    for (var j = 0; j < tilts.length; j++) {
      var t = tilts[j];
      if (t.active && t.rect) {
        var nx = (mx - t.rect.left) / t.rect.width - 0.5;  // -0.5 … 0.5
        var ny = (my - t.rect.top) / t.rect.height - 0.5;
        t.try_ = nx * CONFIG.tiltMax * 2;   // rotateY follows horizontal
        t.trx = -ny * CONFIG.tiltMax * 2;   // rotateX follows vertical
      }
      t.crx = lerp(t.crx, t.trx, CONFIG.tiltLerp);
      t.cry = lerp(t.cry, t.try_, CONFIG.tiltLerp);
      if (Math.abs(t.crx) > 0.05 || Math.abs(t.cry) > 0.05) {
        t.el.style.transform = 'perspective(700px) rotateX(' + t.crx.toFixed(2) + 'deg) rotateY(' + t.cry.toFixed(2) + 'deg)';
      } else if (!t.active) {
        t.el.style.transform = '';
      }
    }

    // hero parallax — only while the hero is on screen
    if (heroPin && heroImg) {
      var rect = heroPin.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) {
        var ntx = (mx - window.innerWidth / 2) / (window.innerWidth / 2);
        var nty = (my - window.innerHeight / 2) / (window.innerHeight / 2);
        px = lerp(px, ntx, CONFIG.parallax.lerp);
        py = lerp(py, nty, CONFIG.parallax.lerp);
        heroImg.style.transform = 'translate(' + (px * CONFIG.parallax.img) + 'px,' + (py * CONFIG.parallax.img) + 'px)';
        if (heroName) heroName.style.transform = 'translate(' + (px * CONFIG.parallax.name) + 'px,' + (py * CONFIG.parallax.name) + 'px)';
        if (heroSub) heroSub.style.transform = 'translate(' + (px * CONFIG.parallax.sub) + 'px,' + (py * CONFIG.parallax.sub) + 'px)';
      }
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
