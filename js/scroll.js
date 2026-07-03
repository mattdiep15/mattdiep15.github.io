/* ==========================================================================
   scroll.js — scroll-driven animation engine
   --------------------------------------------------------------------------
   Motion is bound to a normalized scroll-progress value for each element,
   so scrolling back up reverses everything (not one-shot reveals).

   Two paths:
     • If the browser supports native CSS scroll-driven animations
       (animation-timeline: view()), we add html.native and let the
       keyframes in css/style.css do the work on the compositor thread.
     • Otherwise, an IntersectionObserver activates elements and a single
       requestAnimationFrame loop writes eased transforms directly.

   Elements opt in with:
     data-scroll="head"  large display type — grows to full size in the
                         middle of the viewport, shrinks toward the edges
     data-scroll="card"  staggered rise + fade tied to entry progress

   The hero pin (scale/fade of the hero as you scroll past it) is always
   JS-driven — it's one element and needs page-scroll progress.

   TUNABLES:
     STAGGER   per-card progress offset within a container
     CARD_SPAN how much of the traversal the card entry animation uses
   ========================================================================== */

(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var STAGGER = 0.055;
  var CARD_SPAN = 0.34;

  var docEl = document.documentElement;
  var native = (window.CSS && CSS.supports && CSS.supports('animation-timeline: view()'));
  if (native) docEl.classList.add('native');

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  // smooth plateau: 0→1 over [a,b], holds 1, 1→0 over [c,d]
  function plateau(p, a, b, c, d) {
    if (p < b) return smooth(clamp01((p - a) / (b - a)));
    if (p > c) return smooth(clamp01((d - p) / (d - c)));
    return 1;
  }
  function smooth(t) { return t * t * (3 - 2 * t); }

  /* ── hero pin: pinned hero scales down + fades as you scroll into the
        Wind River statement, and reverses on the way back up ── */
  var heroPin = document.querySelector('.hero-pin');
  var heroContent = document.querySelector('.hero-content');
  var vh = window.innerHeight;

  /* ── Wind River statement: each line glides in from ~1/5 of the screen,
        DECELERATES to a stop at the centered resting position, and sits
        there. When the pin releases, the whole statement scrolls away
        naturally with the page (native sticky behavior — no exit animation).
        TUNABLES:
          stagger  progress offset between lines entering (bigger = more separation)
          enter    fraction of the pin each line's glide-in takes (bigger = slower)
          bandIn   screen x (fraction of width) where a line fades in
          fadeIn   part of the glide used by the quick fade-in
          lead     head start (fraction of viewport height): lines begin
                   gliding while the section is still rising into view
        Pin length (hold duration before release) is .now-pin height in CSS. ── */
  var NOW = {
    stagger: 0.12,
    enter: 0.3,
    bandIn: 0.18,
    fadeIn: 0.4,
    lead: 0.15
  };
  var nowPin = document.querySelector('.now-pin');
  var nowLines = Array.prototype.slice.call(document.querySelectorAll('.now-l'));
  var nowWidths = [];
  var nowMaxW = 0;

  function measureNowLines() {
    nowWidths = nowLines.map(function (el) { return el.offsetWidth; });
    nowMaxW = Math.max.apply(null, nowWidths.concat(0));
  }
  if (nowLines.length) measureNowLines();

  window.addEventListener('resize', function () {
    vh = window.innerHeight;
    if (nowLines.length) measureNowLines();
  }, { passive: true });

  function nowFrame() {
    if (!nowPin || !nowLines.length) return;
    var travel = nowPin.offsetHeight - vh;
    if (travel <= 0) return;
    // progress starts `lead` early (while the section is still rising in)
    // and still completes at the pin's release point
    var lead = NOW.lead * vh;
    var p = clamp01((lead - nowPin.getBoundingClientRect().top) / (travel + lead));
    var vw = window.innerWidth;

    // resting position: common left edge, widest line centered on screen
    var xStart = NOW.bandIn * vw;
    var xMid = Math.max((vw - nowMaxW) / 2, xStart);

    // after the pin releases, squish-fade the statement as it exits the top
    var sticky = nowPin.firstElementChild;
    var ex = smooth(clamp01(-sticky.getBoundingClientRect().top / vh));

    for (var i = 0; i < nowLines.length; i++) {
      var q = clamp01((p - i * NOW.stagger) / NOW.enter);
      var e = easeOutCubic(q); // fast at first, decelerating into the stop
      nowLines[i].style.transform = 'translateX(' + (xStart + (xMid - xStart) * e).toFixed(1) + 'px)'
        + ' scale(' + (1 - 0.05 * ex).toFixed(4) + ',' + (1 - 0.22 * ex).toFixed(4) + ')';
      nowLines[i].style.opacity = (smooth(clamp01(q / NOW.fadeIn)) * (1 - ex * 1.05)).toFixed(3);
    }
  }

  function heroFrame() {
    if (!heroPin || !heroContent) return;
    var top = heroPin.getBoundingClientRect().top;
    var travel = heroPin.offsetHeight - vh;
    if (travel > 0) {
      // pinned variant: scale/fade while stuck
      var p = clamp01(-top / travel);
      var e = smooth(p);
      heroContent.style.transform = 'scale(' + (1 - 0.12 * e).toFixed(4) + ') translateY(' + (-34 * e).toFixed(1) + 'px)';
      heroContent.style.opacity = (1 - e * 1.05).toFixed(3);
    } else {
      // no pin: squish-fade the hero as it scrolls past the top
      var ex = smooth(clamp01(-top / vh));
      heroContent.style.transform = 'scale(' + (1 - 0.06 * ex).toFixed(4) + ',' + (1 - 0.2 * ex).toFixed(4) + ')';
      heroContent.style.opacity = (1 - ex * 1.05).toFixed(3);
    }
  }

  /* ── JS fallback engine for [data-scroll] elements ── */
  var tracked = [];

  function initFallback() {
    var els = document.querySelectorAll('[data-scroll]');
    if (!els.length) return;

    // assign stagger indexes within each parent so siblings don't move in lockstep
    var byParent = new Map();
    els.forEach(function (el) {
      var parent = el.parentElement;
      var idx = byParent.get(parent) || 0;
      byParent.set(parent, idx + 1);
      tracked.push({
        el: el,
        kind: el.getAttribute('data-scroll'),
        idx: idx,
        active: false
      });
    });

    // observer only toggles which elements the loop bothers computing
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        for (var i = 0; i < tracked.length; i++) {
          if (tracked[i].el === entry.target) {
            tracked[i].active = entry.isIntersecting;
            break;
          }
        }
      });
      dirty = true; // repaint newly-activated elements even without a new scroll event
    }, { rootMargin: '15% 0px 15% 0px' });

    tracked.forEach(function (t) { io.observe(t.el); });
  }

  function updateTracked() {
    for (var i = 0; i < tracked.length; i++) {
      var t = tracked[i];
      if (!t.active) continue;
      var rect = t.el.getBoundingClientRect();
      // 0 when the top enters the bottom edge → 1 when the bottom leaves the top
      var p = clamp01((vh - rect.top) / (vh + rect.height));

      if (t.kind === 'head') {
        // grow in, hold through the readable middle band, squish-fade out —
        // entry starts well-visible so screens never look empty
        var v = plateau(p, 0, 0.22, 0.75, 1);
        var sy = p < 0.5 ? (0.93 + 0.07 * v) : (0.8 + 0.2 * v); // exit squishes vertically
        t.el.style.opacity = (0.4 + 0.6 * v).toFixed(3);
        t.el.style.transform = 'scale(' + (0.93 + 0.07 * v).toFixed(4) + ',' + sy.toFixed(4) + ') translateY(' + ((1 - v) * (p < 0.5 ? 30 : -24)).toFixed(1) + 'px)';
      } else { // "card"
        var pe = easeOutCubic(clamp01((p - t.idx * STAGGER) / CARD_SPAN));
        // squish-fade over the last 24vh of the crossing (viewport-based so
        // short blocks fade as visibly as tall cards)
        var ex = smooth(clamp01(1 - rect.bottom / (vh * 0.24)));
        t.el.style.opacity = (pe * (1 - ex)).toFixed(3);
        t.el.style.transform = 'translateY(' + ((1 - pe) * 46 - 22 * ex).toFixed(1) + 'px)'
          + ' scale(' + ((0.96 + 0.04 * pe) * (1 - 0.04 * ex)).toFixed(4) + ',' + ((0.96 + 0.04 * pe) * (1 - 0.2 * ex)).toFixed(4) + ')';
      }
    }
  }

  if (!native) initFallback();

  /* ── single scroll-synced rAF loop (runs only after scroll/resize) ── */
  var dirty = true;
  window.addEventListener('scroll', function () { dirty = true; }, { passive: true });
  window.addEventListener('resize', function () { dirty = true; }, { passive: true });

  function loop() {
    if (dirty) {
      dirty = false;
      heroFrame();
      nowFrame();
      if (!native) updateTracked();
    }
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
