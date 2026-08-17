/* ==========================================================================
   hero-sweep.js — the serpentine that crosses the hero and opens the "w"
   --------------------------------------------------------------------------
   A single line enters off-screen left, meanders through two undulations, and
   as its head crosses the "w" of "Matthew Diep" it pops that letter's photo —
   the same reveal a hover produces. The tail then follows the head out along
   the identical path, so the line leaves by retracing itself rather than fading.

   Two ideas make it robust:

     1. The curve is BUILT to pass through the "w", not aimed near it. A sine
        wave supplies the shape; a Gaussian bump centred on the letter cancels
        whatever error is left, so the curve is bent onto the glyph without
        flattening the wave elsewhere. One spline sample is forced exactly onto
        the letter's centre, and Catmull-Rom interpolates its control points —
        so the rendered path passes through it to floating-point precision.

     2. The strike moment is MEASURED off the rendered geometry with
        getPointAtLength, not derived. There is no closed form for "how far
        along a Bezier is this point", and a formula would silently drift the
        moment the shape changed.

   The photo is opened by dispatching a synthetic mouseenter on the letter.
   js/hero-letters.js exposes no API — its reveal lives inside per-letter
   closures — but it binds listeners directly to the element, so this drives the
   real thing rather than a copy that could drift from it. NB: that also sets
   its `discovered` flag, which permanently stops the idle wiggle hint. That is
   deliberate: the sweep is a louder hint than the wiggle ever was.

   Degrades to nothing: reduced motion, a blocked GSAP CDN, or a hero that
   hero-letters.js never split all leave the page exactly as it would have been.

   TUNABLES: see TUNE, plus the MOBILE overrides below it.
   ========================================================================== */

(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.gsap) return; // CDN blocked

  var TUNE = {
    // motion
    drawDur: 4,             // seconds for head + tail to complete
    ease: 'power2.out',
    tailLag: 0.40,          // how far the tail trails the head, share of the run
    holdMs: 900,            // photo dwell before the synthetic mouseleave

    // curve
    waves: 2,               // undulation count
    amp: 0.13,              // wave height, fraction of viewport height
    phase: 0,
    startY: 0.16,           // entry height on the left edge
    endY: 0.78,             // exit height on the right edge
    over: 0.08,             // off-screen overshoot at both ends
    sigma: 0.18,            // Gaussian width of the bend onto the "w"

    // ink — colour is NOT here: css/style.css paints the stroke and the labels
    // with var(--paper), so the sweep matches the hero name and follows the
    // palette. CSS overrides SVG presentation attributes, so setting it here
    // would silently do nothing.
    thickness: 20,
    glow: false,

    // words riding the line — set labelCount to 0 to remove them entirely
    labelText: 'hover me!',
    labelCount: 2,
    labelSize: 15,
    labelPad: 14,

    // Ceiling on the wave's steepness, as a gradient. The amplitude above is a
    // share of HEIGHT while the wavelength comes from WIDTH, so a tall narrow
    // screen would otherwise get tall, tightly packed waves: the same numbers
    // that read as 0.79 on a desktop hit 3.05 on a phone. This clamps the
    // amplitude to whatever keeps the slope civil, which fixes tablets and
    // landscape phones too — sizes no breakpoint would have caught.
    maxSlope: 0.9,

    wIndex: 6,              // M0 a1 t2 t3 h4 e5 w6 _7 D8 i9 e10 p11
    samples: 64,
    strikeSamples: 400      // coarse pass when locating the "w" along the path
  };

  /* Narrow screens get their own values on top of the clamp. One big wave reads
     better than two cramped ones across 390px, and a 20px stroke that is 1% of a
     desktop is over 5% of a phone. */
  var MOBILE_Q = '(max-width: 768px)';   // matches the breakpoint in style.css

  var MOBILE = {
    waves: 1,
    thickness: 10,
    drawDur: 3,

    // No words at this size. Beyond the crowding, "hover me!" is a promise a
    // small screen usually can't keep: hero-letters.js reveals its photos on
    // mouseenter, and a touch device has no hover. The line runs unbroken here.
    labelCount: 0,
    labelSize: 13,   // only applies if labels are switched back on

    // 425 synchronous getPointAtLength calls is a real hitch on a phone, and it
    // lands just as the visitor starts scrolling
    strikeSamples: 120
  };

  // active config — TUNE, or TUNE with MOBILE folded over it
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

  var svg, lineEl, glowEl, labelG;
  var wEl = null, geo = null, labels = [], leaveTimer = null;

  /* ── layer ─────────────────────────────────────────────────────────────── */

  function build() {
    svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('id', 'hero-sweep');
    svg.setAttribute('aria-hidden', 'true');

    // fill:none is mandatory on an open path — otherwise the browser fills the
    // implied closed area and washes colour across the hero
    glowEl = document.createElementNS(NS, 'path');
    glowEl.setAttribute('id', 'hero-sweep-glow');
    glowEl.setAttribute('fill', 'none');
    glowEl.setAttribute('stroke-width', C.thickness + 15);
    glowEl.setAttribute('stroke-linecap', 'round');
    glowEl.setAttribute('opacity', 0.18);
    // display:none rather than opacity:0 — an invisible layer would still cost a
    // blur filter pass on every frame
    if (!C.glow) glowEl.style.display = 'none';

    lineEl = document.createElementNS(NS, 'path');
    lineEl.setAttribute('id', 'hero-sweep-line');
    lineEl.setAttribute('fill', 'none');
    lineEl.setAttribute('stroke-width', C.thickness);
    lineEl.setAttribute('stroke-linecap', 'round');

    labelG = document.createElementNS(NS, 'g');

    svg.appendChild(glowEl);
    svg.appendChild(lineEl);
    svg.appendChild(labelG);

    // first child so it paints behind .hero-content (see style.css)
    hero.insertBefore(svg, hero.firstChild);
  }

  /* ── curve ─────────────────────────────────────────────────────────────── */

  function buildPoints() {
    // svg-local coordinates, not viewport: the layer scrolls with the hero, so
    // viewport coords would drift the moment the page moved
    var box = svg.getBoundingClientRect();
    if (!(box.width > 0) || !(box.height > 0)) return null;

    var r = wEl.getBoundingClientRect();
    var cx = r.left + r.width / 2 - box.left;
    var cy = r.top + r.height / 2 - box.top;

    var W = box.width, H = box.height;
    if (!(cx > 0) || !(cy > 0) || cx > W || cy > H) return null;

    var x0 = -C.over * W, x1 = W + C.over * W;
    var y0 = C.startY * H, y1 = C.endY * H;
    var sigma = Math.max(1, C.sigma * W);

    // a sine of amplitude A and wavelength L peaks at gradient 2*pi*A/L, so
    // invert that for the tallest amplitude the slope ceiling allows
    var lambda = (x1 - x0) / C.waves;
    var amp = Math.min(C.amp * H, C.maxSlope * lambda / (2 * Math.PI));

    // sin(pi*u) tapers the wiggle to nothing at both ends, so entry and exit
    // stay clean instead of arriving mid-crest
    function wave(x) {
      var u = (x - x0) / (x1 - x0);
      return y0 + (y1 - y0) * u +
             amp * Math.sin(2 * Math.PI * C.waves * u + C.phase) * Math.sin(Math.PI * u);
    }

    var err = cy - wave(cx);
    function y(x) {
      var d = (x - cx) / sigma;
      return wave(x) + err * Math.exp(-d * d);
    }

    var xs = [], i;
    for (i = 0; i <= C.samples; i++) xs.push(x0 + (x1 - x0) * (i / C.samples));
    xs.push(cx); // the forced sample — this is what guarantees the hit
    xs.sort(function (a, b) { return a - b; });

    return { pts: xs.map(function (x) { return { x: x, y: y(x) }; }), cx: cx, cy: cy };
  }

  function toPath(pts) {
    var d = 'M ' + pts[0].x.toFixed(2) + ',' + pts[0].y.toFixed(2);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ' C ' + (p1.x + (p2.x - p0.x) / 6).toFixed(2) + ',' + (p1.y + (p2.y - p0.y) / 6).toFixed(2) +
           ' '  + (p2.x - (p3.x - p1.x) / 6).toFixed(2) + ',' + (p2.y - (p3.y - p1.y) / 6).toFixed(2) +
           ' '  + p2.x.toFixed(2) + ',' + p2.y.toFixed(2);
    }
    return d;
  }

  function findStrike(cx, cy) {
    var total = lineEl.getTotalLength();
    var best = 0, bestD = Infinity, i, s, p, dx, dy, dd;

    /* This runs synchronously right after fonts.ready — i.e. exactly when the
       visitor is likely to start scrolling — so the coarse pass is cheaper on
       mobile. Precision is unaffected: the coarse pass only has to land in the
       right neighbourhood, and the bisection below is what delivers the
       accuracy. */
    var coarse = C.strikeSamples;

    for (i = 0; i <= coarse; i++) {
      s = total * (i / coarse);
      p = lineEl.getPointAtLength(s);
      dx = p.x - cx; dy = p.y - cy; dd = dx * dx + dy * dy;
      if (dd < bestD) { bestD = dd; best = s; }
    }

    var step = total / coarse;
    for (i = 0; i < 24; i++) {
      step /= 2;
      [best - step, best + step].forEach(function (c) {
        if (c < 0 || c > total) return;
        var q = lineEl.getPointAtLength(c);
        var ex = q.x - cx, ey = q.y - cy, e2 = ex * ex + ey * ey;
        if (e2 < bestD) { bestD = e2; best = c; }
      });
    }

    return { len: total, at: best / total };
  }

  function measure() {
    readConfig();
    // stroke width is a config value, so it has to be re-applied here rather
    // than only at build time — an orientation change can cross the breakpoint
    lineEl.setAttribute('stroke-width', C.thickness);
    glowEl.setAttribute('stroke-width', C.thickness + 15);

    var built = buildPoints();
    if (!built) { geo = null; return; }

    var d = toPath(built.pts);
    lineEl.setAttribute('d', d);
    glowEl.setAttribute('d', d);

    var hit = findStrike(built.cx, built.cy);
    geo = { len: hit.len, strikeAt: hit.at };
    buildLabels();
  }

  /* ── words riding the line ─────────────────────────────────────────────── */

  function buildLabels() {
    labelG.textContent = '';
    labels = [];
    if (!geo || !C.labelCount) return;

    for (var i = 0; i < C.labelCount; i++) {
      var t = document.createElementNS(NS, 'text');
      t.setAttribute('class', 'hero-sweep-label');
      t.setAttribute('font-size', C.labelSize);
      t.style.opacity = 0;

      var tp = document.createElementNS(NS, 'textPath');
      tp.setAttribute('href', '#hero-sweep-line');
      tp.textContent = C.labelText;
      t.appendChild(tp);
      labelG.appendChild(t);

      // spread evenly but off-centre, so no word lands on the strike point
      var centre = geo.len * ((i + 0.5) / C.labelCount);
      var w = 0;
      try { w = t.getComputedTextLength(); } catch (e) {}
      if (!w) w = C.labelText.length * C.labelSize * 0.62;

      // Round linecaps overhang each dash end by half the stroke width, eating
      // into the gap — so the padding has to account for the thickness or a fat
      // line closes in on the words.
      var pad = C.labelPad + C.thickness / 2;

      tp.setAttribute('startOffset', Math.max(0, centre - w / 2));
      labels.push({
        el: t,
        start: centre - w / 2 - pad,
        end: centre + w / 2 + pad
      });
    }
  }

  /* ── the moving window ─────────────────────────────────────────────────── */

  // remove the label gaps from a visible interval, so the stroke opens up
  // exactly where a word sits rather than running through it
  function subtractGaps(win) {
    var out = [win];
    labels.forEach(function (lab) {
      var next = [];
      out.forEach(function (iv) {
        if (lab.end <= iv[0] || lab.start >= iv[1]) { next.push(iv); return; }
        if (lab.start > iv[0]) next.push([iv[0], lab.start]);
        if (lab.end < iv[1]) next.push([lab.end, iv[1]]);
      });
      out = next;
    });
    return out.filter(function (iv) { return iv[1] - iv[0] > 0.5; });
  }

  // stroke-dasharray alternates dash/gap from length 0, so an arbitrary set of
  // visible intervals becomes: 0, gap, dash, gap, dash, … plus a trailing gap
  // long enough that the pattern never repeats
  function dashFor(vis, total) {
    var parts = ['0'], cursor = 0;
    vis.forEach(function (iv) {
      parts.push((iv[0] - cursor).toFixed(2));
      parts.push((iv[1] - iv[0]).toFixed(2));
      cursor = iv[1];
    });
    parts.push(total.toFixed(2));
    return parts.join(' ');
  }

  function setWindow(tail, head) {
    var body = head - tail;
    var hidden = body <= 0.5;
    var dash = hidden ? null : dashFor(subtractGaps([tail, head]), geo.len);

    [lineEl, glowEl].forEach(function (el) {
      // a zero-length dash under round linecaps renders as a dot
      el.style.visibility = hidden ? 'hidden' : 'visible';
      if (hidden) return;
      el.style.strokeDasharray = dash;
      el.style.strokeDashoffset = 0;
    });

    labels.forEach(function (lab) {
      lab.el.style.opacity = hidden ? 0 :
        Math.min(Math.max((head - lab.end) / 30, 0), 1) *
        Math.min(Math.max((lab.start - tail) / 30, 0), 1);
    });
  }

  /* ── run ───────────────────────────────────────────────────────────────── */

  function strike() {
    wEl.dispatchEvent(new MouseEvent('mouseenter'));
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(function () {
      wEl.dispatchEvent(new MouseEvent('mouseleave'));
    }, C.holdMs);
  }

  function play() {
    measure();
    if (!geo) return;
    setWindow(0, 0);

    var p = { t: 0 };
    var struck = false;
    var lag = Math.min(Math.max(C.tailLag, 0.01), 0.9);
    var ease = gsap.parseEase(C.ease) || function (x) { return x; };

    // head and tail run the SAME eased profile, offset in time by `lag`: the
    // head finishes at t = 1-lag, the tail catches up by t = 1
    gsap.to(p, {
      t: 1,
      duration: C.drawDur,
      ease: 'none',
      onUpdate: function () {
        var span = 1 - lag;
        var hp = ease(Math.min(Math.max(p.t / span, 0), 1));
        var tp = ease(Math.min(Math.max((p.t - lag) / span, 0), 1));
        setWindow(geo.len * tp, geo.len * hp);

        // hp is the eased HEAD position — the visible tip, which is what the
        // strike must be compared against, not elapsed time
        if (!struck && hp >= geo.strikeAt) { struck = true; strike(); }
      },
      onComplete: function () {
        setWindow(geo.len, geo.len);
        if (svg.parentNode) svg.parentNode.removeChild(svg); // nothing left to paint
      }
    });
  }

  /* ── boot ──────────────────────────────────────────────────────────────── */

  // mirrors hero-letters.js: wait out the intro so the sweep plays on a hero
  // the visitor can actually see
  function whenHeroRevealed(cb) {
    var docEl = document.documentElement;
    if (!docEl.classList.contains('intro-pending')) { cb(); return; }
    if (docEl.classList.contains('intro-done')) { cb(); return; }
    var obs = new MutationObserver(function () {
      if (docEl.classList.contains('intro-done')) { obs.disconnect(); cb(); }
    });
    obs.observe(docEl, { attributes: true, attributeFilter: ['class'] });
  }

  // hero-letters.js splits the name inside its own document.fonts.ready handler,
  // so this has to land after — a letter with no listener would swallow the
  // synthetic mouseenter silently
  document.fonts.ready.then(function () {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var letters = nameEl.querySelectorAll('.letter');
        var target = letters[C.wIndex];
        if (!document.documentElement.classList.contains('hero-split') ||
            !target || !target.classList.contains('has-media')) return;

        wEl = target;
        readConfig();   // before build(), which reads thickness and glow
        build();
        whenHeroRevealed(play);
      });
    });
  });
})();
