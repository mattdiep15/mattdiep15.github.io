/* ==========================================================================
   hero-bounce.js — a line that bounces across the hero, opening three photos
   --------------------------------------------------------------------------
   PROTOTYPE (see bounce-demo.html). A candidate replacement for
   js/hero-sweep.js: the line drops in from the top-left, bounces along
   "Matthew Diep" like a ball — landing on M, w and p and popping each one's
   photo — then skips off the right edge in shrinking bounces, the tail
   following the head out.

   Real ball physics: ONE constant gravity and ONE constant horizontal speed
   for the whole run, with no easing on top. Under those two, the flight
   between two landings is a parabola whose height is fixed by its width
   (apex h = k * span^2), so the bounce heights aren't chosen — they fall out
   of the letter spacing. The only tuned height is the first bounce (M -> w),
   which sets the gravity; everything else follows from it:
     • the entry is a free fall from rest-height at the top-left, so where it
       starts horizontally is solved from the drop and the gravity
     • after p the ball keeps bouncing, each hop losing energy (TUNE.restitution
       scales the span, so the height drops by its square) until it is off the
       right edge.

   Each arc is a quadratic Bezier whose control point sits at the arc's
   horizontal midpoint, which makes x linear in the Bezier parameter — so
   advancing that parameter at a steady rate IS the projectile motion: fast at
   each landing, slow at each apex.

   Motion trail. The line is drawn as a stack of identical layers (default 3):
   the head on top, then a blue and a teal copy beneath it, each running the
   same motion TUNE.trail.stagger seconds later. The gap between layers is
   speed x stagger, so it stretches as the ball accelerates into each landing
   and closes up near each apex. Colours are CSS variables (--trail-1..3 on
   #hero-sweep, see css/style.css).

   Because motion is timed rather than measured along the path, each layer's
   visible stretch (tail..head) is re-sampled into a polyline every frame
   instead of using stroke-dasharray.

   Landings stay on target while photos open. Opening a photo slides its
   neighbours aside (js/hero-letters.js layout()), so later letters move after
   the path was first planned. At each landing the arcs AHEAD of the head are
   re-planned against where the upcoming letters are heading — the x target of
   the tween hero-letters.js just started — with the same gravity and speed.
   The head sits exactly on the landing at that moment and the trailing layers
   are behind it, so nothing already drawn changes.

   Photos are opened the same way hero-sweep.js does it: a synthetic
   mouseenter on the letter drives the real hover code, then a mouseleave.

   Degrades to nothing: reduced motion, a blocked GSAP CDN, or a hero that
   hero-letters.js never split.

   TUNABLES: see TUNE, plus the MOBILE overrides below it.
   ========================================================================== */

(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.gsap) return; // CDN blocked

  var TUNE = {
    // letters to land on:  M0 a1 t2 t3 h4 e5 w6 _7 D8 i9 e10 p11
    targets: [0, 6, 11],

    startDelayMs: 500,   // pause after the hero is revealed
    // Speed: seconds from entering to landing on the last target. Sets the
    // horizontal speed; gravity is scaled with it so the shape is unchanged.
    toLast: 0.9,
    trailSec: 0.3,       // how far each layer's tail trails its head, in seconds
    holdMs: 700,         // photo dwell before the synthetic mouseleave

    // motion trail: `layers` copies of the line, each `stagger` seconds behind
    // the one above. Colours: --trail-1 (head) .. --trail-N in css/style.css.
    trail: { layers: 3, stagger: 0.1 },

    // Height of the first bounce (M -> w), as a fraction of the hero height.
    // This sets the gravity; every other height is derived from it.
    firstApex: 0.28,
    // ...capped relative to that bounce's width, so tight letter spacing
    // (phones) gives a lower bounce rather than a needle-thin spike
    maxApex: 0.9,
    startY: 0.05,        // height the entry falls from, fraction of hero height
    restitution: 0.7,    // after the last target: each hop's span x this
    exitX: 1.08,         // keep hopping until a landing is past this x fraction

    thickness: 20,       // every layer is the same thickness
    sampleHz: 240        // polyline samples per second of path
  };

  var MOBILE_Q = '(max-width: 768px)';   // matches the breakpoint in style.css

  var MOBILE = {
    thickness: 10,
    toLast: 0.8
  };

  var C = TUNE;

  function readConfig() {
    if (!window.matchMedia(MOBILE_Q).matches) { C = TUNE; return; }
    C = {};
    for (var k in TUNE) C[k] = (k in MOBILE) ? MOBILE[k] : TUNE[k];
  }

  var NS = 'http://www.w3.org/2000/svg';

  var hero = document.querySelector('.hero-pin');
  var nameEl = document.querySelector('.hero-name');
  if (!hero || !nameEl) return;

  var svg, layers = [], targets = [];

  /* ── layer ─────────────────────────────────────────────────────────────── */

  // id="hero-sweep" on purpose: css/style.css already sizes and layers that
  // id. Layers are appended back to front, so later = on top: the teal trail
  // goes in first and the head last.
  function build() {
    svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('id', 'hero-sweep');
    svg.setAttribute('aria-hidden', 'true');

    var n = Math.max(1, C.trail.layers);
    layers = [];
    for (var k = n - 1; k >= 0; k--) {
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('class', 'hero-trail hero-trail-' + (k + 1));
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke-width', C.thickness);
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(p);
      layers[k] = p;   // layers[0] = head
    }

    hero.insertBefore(svg, hero.firstChild); // behind .hero-content
  }

  /* ── geometry ──────────────────────────────────────────────────────────── */

  // Where a letter's centre will be once its current GSAP tween lands, in
  // svg-local coordinates. hero-letters.js tweens each .letter's x on every
  // open/close, so the live rect alone would be stale mid-slide.
  function landingFor(el, box) {
    var r = el.getBoundingClientRect();
    var curX = gsap.getProperty(el, 'x') || 0;
    var tw = gsap.getTweensOf(el)[0];
    var endX = (tw && typeof tw.vars.x === 'number') ? tw.vars.x : curX;
    return {
      x: r.left + r.width / 2 - curX + endX - box.left,
      y: r.top + r.height / 2 - box.top
    };
  }

  // quadratic Bezier arc; c.x is always the midpoint, so x is linear in u
  function arc(p0, p1, apexY) {
    return { p0: p0, p1: p1, c: { x: (p0.x + p1.x) / 2, y: apexY } };
  }

  function point(a, u) {
    var v = 1 - u;
    return {
      x: v * v * a.p0.x + 2 * u * v * a.c.x + u * u * a.p1.x,
      y: v * v * a.p0.y + 2 * u * v * a.c.y + u * u * a.p1.y
    };
  }

  var box, W, H;
  var vx = 0;      // horizontal speed, px/s — fixed for the run
  var k = 0;       // apex height per span^2 — i.e. gravity / (8 vx^2), fixed
  var arcs = [];   // arcs[0] = entry, then landing-to-landing hops

  // a hop between two landings at the same height: under constant gravity and
  // speed its apex is k * span^2 above them; a control point 2h up puts the
  // Bezier's apex exactly h up
  function hop(p0, p1) {
    var span = Math.abs(p1.x - p0.x);
    return arc(p0, p1, Math.min(p0.y, p1.y) - 2 * k * span * span);
  }

  // (re)build every arc after landing `from` (-1 = from the start). Arcs up to
  // and including the one ending at that landing are left alone, and gravity
  // and speed are only set on the first call.
  function plan(from) {
    var pts = targets.map(function (el) { return landingFor(el, box); });
    var keep = arcs.slice(0, from + 1);
    var next = [];
    var i;

    if (from < 0) {
      // gravity from the first bounce: its apex h1 over its span L1
      var L1 = Math.abs(pts[1].x - pts[0].x);
      var h1 = Math.min(C.firstApex * H, C.maxApex * L1);
      k = h1 / (L1 * L1);

      // entry: a free fall from rest-height. Dropping dy under the same gravity
      // covers sqrt(dy / 4k) horizontally — a parabola with its apex at the
      // start point, so the line arrives already falling, with no kink
      var startY = C.startY * H;
      var dx = Math.sqrt(Math.max(pts[0].y - startY, 1) / (4 * k));
      var s = { x: pts[0].x - dx, y: startY };
      next.push(arc(s, pts[0], s.y));
      from = 0;
    }

    var prev = keep.length ? keep[keep.length - 1].p1 : next[0].p1;
    for (i = from + 1; i < pts.length; i++) {
      next.push(hop(prev, pts[i]));
      prev = pts[i];
    }

    // after the last target: keep bouncing, losing energy each hop, until a
    // landing is off the right edge
    var before = next.length ? next[next.length - 1] : keep[keep.length - 1];
    var span = Math.abs(before.p1.x - before.p0.x);
    var edge = C.exitX * W;
    var guard = 0;
    while (prev.x < edge && guard++ < 20) {
      span = Math.max(span * C.restitution, 1);
      var land = { x: prev.x + span, y: prev.y };
      next.push(hop(prev, land));
      prev = land;
    }

    arcs = keep.concat(next);

    // speed from the time budget to the last target landing
    if (!vx) {
      var lastTarget = arcs[targets.length - 1].p1.x;
      vx = (lastTarget - arcs[0].p0.x) / C.toLast;
    }
    var t = 0;
    arcs.forEach(function (a) {
      a.t0 = t;
      t += Math.abs(a.p1.x - a.p0.x) / vx;
      a.t1 = t;
    });
  }

  function at(tau) {
    var last = arcs[arcs.length - 1];
    if (tau <= 0) return point(arcs[0], 0);
    if (tau >= last.t1) return point(last, 1);
    for (var i = 0; i < arcs.length; i++) {
      var a = arcs[i];
      if (tau <= a.t1) return point(a, (tau - a.t0) / (a.t1 - a.t0));
    }
    return point(last, 1);
  }

  /* ── drawing ───────────────────────────────────────────────────────────── */

  // one layer's visible stretch, path-time `tail`..`head`, as a polyline
  function draw(el, tail, head) {
    tail = Math.max(tail, 0);
    if (head - tail <= 0) { el.removeAttribute('d'); return; }

    var times = [];
    var step = 1 / C.sampleHz;
    for (var t = tail; t < head; t += step) times.push(t);
    // landings exactly, so each bounce keeps a crisp vertex
    arcs.forEach(function (a) { if (a.t1 > tail && a.t1 < head) times.push(a.t1); });
    times.push(head);
    times.sort(function (a, b) { return a - b; });

    var d = '';
    for (var i = 0; i < times.length; i++) {
      var p = at(times[i]);
      d += (i ? ' L ' : 'M ') + p.x.toFixed(1) + ',' + p.y.toFixed(1);
    }
    el.setAttribute('d', d);
  }

  /* ── run ───────────────────────────────────────────────────────────────── */

  function strike(el) {
    el.dispatchEvent(new MouseEvent('mouseenter'));
    setTimeout(function () {
      el.dispatchEvent(new MouseEvent('mouseleave'));
    }, C.holdMs);
  }

  function play() {
    box = svg.getBoundingClientRect();
    W = box.width; H = box.height;
    if (!(W > 0) || !(H > 0)) return;

    vx = 0;
    arcs = [];
    plan(-1);

    var stagger = C.trail.stagger;
    var last = layers.length - 1;
    var clock = 0;    // path time = wall time; no easing, physics only
    var landed = 0;   // landings reached so far

    function tick(time, deltaMs) {
      clock += Math.min(deltaMs, 50) / 1000;   // clamp: a background tab shouldn't teleport it

      // landing i is the end of arcs[i]; only the head (layer 0) triggers them
      while (landed < targets.length && clock >= arcs[landed].t1) {
        strike(targets[landed]);
        plan(landed);   // re-aim what's ahead at where the letters are going
        landed++;
      }

      var end = arcs[arcs.length - 1].t1;
      for (var n = 0; n <= last; n++) {
        var lt = clock - n * stagger;
        draw(layers[n], Math.min(lt - C.trailSec, end), Math.min(lt, end));
      }

      // done once the last layer's tail has reached the end
      if (clock - last * stagger - C.trailSec >= end) {
        gsap.ticker.remove(tick);
        if (svg.parentNode) svg.parentNode.removeChild(svg);
      }
    }

    gsap.ticker.add(tick);
  }

  /* ── boot ──────────────────────────────────────────────────────────────── */

  function whenHeroRevealed(cb) {
    var docEl = document.documentElement;
    if (!docEl.classList.contains('intro-pending')) { cb(); return; }
    if (docEl.classList.contains('intro-done')) { cb(); return; }
    var obs = new MutationObserver(function () {
      if (docEl.classList.contains('intro-done')) { obs.disconnect(); cb(); }
    });
    obs.observe(docEl, { attributes: true, attributeFilter: ['class'] });
  }

  // hero-letters.js splits the name inside its own fonts.ready handler, so
  // land after it — a letter with no listener would swallow the mouseenter
  document.fonts.ready.then(function () {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (!document.documentElement.classList.contains('hero-split')) return;
        readConfig();
        var letters = nameEl.querySelectorAll('.letter');
        targets = C.targets.map(function (i) { return letters[i]; });
        if (targets.some(function (el) { return !el || !el.classList.contains('has-media'); })) return;

        build();
        whenHeroRevealed(function () {
          setTimeout(play, C.startDelayMs);
        });
      });
    });
  });
})();
