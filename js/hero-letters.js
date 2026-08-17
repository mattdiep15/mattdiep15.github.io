/* ==========================================================================
   hero-letters.js — photos that pop out of the hero name on hover
   --------------------------------------------------------------------------
   "Matthew Diep" is split into one .letter span per character. Three of them
   carry a hidden photo thumbnail: the first "t", the first "e", and the "i".

   Every letter renders as plain --ink at rest. Hovering one of the three
   swaps the glyph for its photo — the thumbnail scales up with a slight
   overshoot while the letter itself fades out, and the surrounding letters
   slide outward to make room. On leave the photo lingers briefly, shrinks
   away, the glyph fades back, and the row springs back to its resting
   positions.

   The markup in index.html is plain text; this file does the splitting, so
   with JS off (or reduced motion) the heading is just a heading. The flex row
   that makes the sliding possible is gated behind html.hero-split, added
   below, for the same reason.

   TUNABLES: see TUNE.
   ========================================================================== */

(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.gsap) return; // CDN blocked

  var nameEl = document.querySelector('.hero-name');
  if (!nameEl) return;

  var TUNE = {
    // character indices in "Matthew Diep" that get a photo:
    //   M0 a1 t2 t3 h4 e5 w6 _7 D8 i9 e10 p11
    // Paired positionally with `images` below — the split loop walks characters
    // in order and pulls images[mediaCount++], so ascending indices map to the
    // array in order.
    media: [1, 3, 6, 10],
    images: [
      'images/chopper.avif',          // a
      'images/PalaceFineArts.jpg',    // the SECOND t
      'images/MOMA.jpg',              // w
      'images/abandonedhutphoto.jpg'  // the e next to p
    ],
    // [width, height] in em — index-matched to media/images above, so the four
    // photos aren't identical squares. WIDTH feeds shiftFor(): a wider photo
    // pushes its neighbours further, which eats into the collision margin the
    // .letter padding absorbs. Measured safe at these values; the worst case is
    // driven by 't' (Satoshi's narrowest of the four at 0.298em), so the 'e'
    // photo only becomes the constraint past ~1.35em wide.
    sizes: [
      [0.89, 0.89],   // a — chopper, 15% smaller
      [1.05, 1.18],   // t — PalaceFineArts, slightly taller
      [1.02, 1.00],   // w — MOMA
      [1.25, 1.05]    // e — abandonedhut, wider
    ],
    // px of breathing room either side of a photo. Lowered from 10 because the
    // natural-aspect photos are up to 50% wider than the old squares, and this
    // feeds directly into how far neighbours are pushed (see shiftFor).
    pad: 6,

    // The photo popping in. It's absolutely positioned, so a big elastic
    // overshoot here costs nothing — it can't push anything around.
    openDur: 0.6,
    openEase: 'elastic.out(1, 0.6)',

    hold: 1,                        // seconds the photo lingers after you leave
    outDur: 0.22,                   // photo shrinking away
    outEase: 'power2.in',

    // Neighbours springing APART. This is where the elasticity lives, because
    // separating letters cannot collide — the overshoot just moves them
    // further apart before they settle. (Contrast settleEase below, where an
    // overshoot drives them together instead.) 11.6% overshoot; measured to
    // stay inside the viewport at every width from 320px up.
    shiftDur: 0.6,
    shiftEase: 'elastic.out(1, 0.7)',

    settleDur: 0.35,                // neighbours springing back
    // LOAD-BEARING, not taste. On close, letters left of the opened one travel
    // back rightward and letters right of it travel back leftward, while the
    // opened letter itself never moves — so an overshooting ease drives both
    // groups INTO it. elastic.out(1, 0.4) overshoots 27.5% and made the letters
    // visibly collide; back.out(0.5) overshoots ~1.4%, which the 0.015em
    // padding on .letter (css/style.css) absorbs. The two are coupled: a
    // livelier ease here needs more padding there, which spaces the wordmark
    // out — that tradeoff is why both are deliberately small. It was 0.8 until
    // the photos went natural-aspect; the wider photos push neighbours further,
    // so the same overshoot percentage started colliding on small screens.
    settleEase: 'back.out(0.5)',
    charFade: 0.18                  // glyph fading back in
  };

  /* Idle hint: nothing distinguishes a photo letter from a plain one, so the
     four that DO something nudge themselves occasionally. Only those four —
     wiggling a letter with no photo would be a false affordance. */
  var WIGGLE = {
    // The cadence ramps: eager right after the hero appears, easing to a
    // calmer steady rate once there's been a chance to notice. The wait for
    // hint i interpolates between these two ranges at min(i/rampHints, 1).
    gapStart: [0.5, 1.0], // seconds between hints, on arrival
    gapEnd: [1.6, 3.0],   // ...and once settled
    rampHints: 7,         // hints taken to travel from one to the other
    rot: 6,               // degrees
    lift: -3,             // px
    dur: 0.5,
    stopOnDiscovery: true // stop for good once the user has hovered one
  };

  /* ── split the name into letters ── */
  var text = nameEl.textContent;
  nameEl.setAttribute('aria-label', text);
  nameEl.textContent = '';

  var letters = [];
  var mediaCount = 0;

  for (var i = 0; i < text.length; i++) {
    var ch = text.charAt(i);

    var letter = document.createElement('span');
    letter.className = 'letter';

    var charSpan = document.createElement('span');
    charSpan.className = 'char';
    // a real space would collapse between flex items — use nbsp
    charSpan.textContent = (ch === ' ') ? ' ' : ch;
    letter.appendChild(charSpan);

    if (ch !== ' ' && TUNE.media.indexOf(i) !== -1) {
      letter.classList.add('has-media');
      var thumb = document.createElement('span');
      thumb.className = 'thumb';
      // per-photo dimensions; .thumb's CSS 1.05em square is the fallback
      var size = TUNE.sizes[mediaCount];
      if (size) {
        thumb.style.width = size[0] + 'em';
        thumb.style.height = size[1] + 'em';
      }
      var img = document.createElement('img');
      img.src = TUNE.images[mediaCount % TUNE.images.length];
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      thumb.appendChild(img);
      letter.appendChild(thumb);
      mediaCount++;
    }

    nameEl.appendChild(letter);
    letters.push(letter);
  }

  document.documentElement.classList.add('hero-split'); // turns on the flex row

  /* ── measurement ──
     How far a neighbour must move is (photo width + padding − the letter's own
     width) / 2. Both depend on the rendered font, so measure only after Satoshi
     has loaded, and again on resize since the size is a vw-based clamp. */
  var baseWidths = [];
  var thumbWidths = {};

  function measure() {
    baseWidths = letters.map(function (el) { return el.offsetWidth; });
    letters.forEach(function (el, k) {
      var t = el.querySelector('.thumb');
      if (t) thumbWidths[k] = t.offsetWidth;
    });
  }

  function shiftFor(k) {
    return Math.max(0, ((thumbWidths[k] || 0) + TUNE.pad * 2 - baseWidths[k]) / 2);
  }

  var openSet = [];

  // every letter's offset is the sum of the pushes from each open photo:
  // letters before it move left, letters after it move right
  function layout(duration, ease) {
    letters.forEach(function (el, j) {
      var x = 0;
      openSet.forEach(function (k) {
        if (k === j) return;
        x += (j < k ? -1 : 1) * shiftFor(k);
      });
      gsap.killTweensOf(el);
      gsap.to(el, { x: x, duration: duration, ease: ease });
    });
  }

  /* Only the font gates measurement. The thumbs are a fixed square in CSS, so
     their width is known whether or not the photo has loaded — no need to wait
     on the images (which would hold the whole effect behind several MB). */
  document.fonts.ready.then(function () {
    measure();

    /* Width-only: every measurement here is a horizontal one, so a height change
       cannot invalidate it. That matters on mobile, where the URL bar sliding
       fires resize constantly — each one would otherwise read offsetWidth on all
       12 letters (a forced layout) and issue 24 GSAP calls, mid-scroll. */
    var lastWidth = window.innerWidth;
    var resizeTimer;
    window.addEventListener('resize', function () {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        measure();
        layout(0, 'none'); // re-apply offsets against the new widths
      }, 200);
    }, { passive: true });

    letters.forEach(function (el, index) {
      if (!el.classList.contains('has-media')) return;

      var thumb = el.querySelector('.thumb');
      var charEl = el.querySelector('.char');
      var openTween = null;
      var exitTween = null;

      // GSAP owns the whole transform, so the -50%/-50% centring lives here
      // rather than in CSS where a scale tween would overwrite it
      gsap.set(thumb, { xPercent: -50, yPercent: -50, scale: 0.3, opacity: 0 });

      el.addEventListener('mouseenter', function () {
        if (exitTween) { exitTween.kill(); exitTween = null; }

        discovered = true; // the hint has done its job

        // rotation/y as well as opacity: killing a wiggle mid-tween would
        // otherwise leave the glyph crooked while hidden, then fade it back
        // in still rotated
        gsap.killTweensOf(charEl);
        gsap.set(charEl, { opacity: 0, rotation: 0, y: 0 });

        if (!openTween || !openTween.isActive()) {
          openTween = gsap.to(thumb, {
            scale: 1,
            opacity: 1,
            duration: TUNE.openDur,
            ease: TUNE.openEase
          });
        }

        if (openSet.indexOf(index) === -1) openSet.push(index);
        layout(TUNE.shiftDur, TUNE.shiftEase);
      });

      el.addEventListener('mouseleave', function () {
        // let an in-flight open finish before starting the hold
        var remaining = (openTween && openTween.isActive())
          ? openTween.duration() - openTween.time()
          : 0;

        exitTween = gsap.to(thumb, {
          scale: 0.3,
          opacity: 0,
          duration: TUNE.outDur,
          delay: remaining + TUNE.hold,
          ease: TUNE.outEase,
          onComplete: function () {
            exitTween = null;
            var at = openSet.indexOf(index);
            if (at !== -1) openSet.splice(at, 1);
            gsap.to(charEl, { opacity: 1, duration: TUNE.charFade, ease: 'power2.out' });
            layout(TUNE.settleDur, TUNE.settleEase);
          }
        });
      });
    });

    // not here directly — the intro may still be covering the hero
    whenHeroRevealed(startWiggle);
  });

  /* ── idle hint ──
     Targets .char, NOT .letter: layout() calls killTweensOf on every .letter
     whenever anything opens or closes, so a wiggle there would be destroyed
     constantly. .char is only touched by the hover handler, which is exactly
     when we want the hint to stop.

     Transforms don't affect offsetWidth, so this cannot disturb the measured
     shift distances or the collision margins. */
  var discovered = false;
  var wiggleTimer = null;

  function heroVisible() {
    var pin = document.querySelector('.hero-pin');
    if (!pin) return true;
    var r = pin.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  }

  /* The intro preloader covers the screen for ~1.75s of counting plus a 0.7s
     wipe, and holds .hero-content at opacity:0 the whole time. document.fonts
     .ready resolves long before that, so starting the hints there would spend
     the eager ones on a hero nobody can see. heroVisible() doesn't catch it —
     it only tests the scroll rect, and the intro is a fixed overlay.

     Repeat visits, reduced motion and no-JS all skip the intro, so
     intro-pending is absent and this runs straight through. */
  function whenHeroRevealed(cb) {
    var d = document.documentElement;
    if (!d.classList.contains('intro-pending')) return cb();
    var obs = new MutationObserver(function () {
      if (d.classList.contains('intro-done')) { obs.disconnect(); cb(); }
    });
    obs.observe(d, { attributes: true, attributeFilter: ['class'] });
  }

  function startWiggle() {
    var media = letters.filter(function (el) {
      return el.classList.contains('has-media');
    });
    if (!media.length) return;

    var fired = 0;
    var lastIndex = -1;

    function schedule() {
      // ease from the eager range toward the settled one
      var t = Math.min(fired / WIGGLE.rampHints, 1);
      var lo = WIGGLE.gapStart[0] + (WIGGLE.gapEnd[0] - WIGGLE.gapStart[0]) * t;
      var hi = WIGGLE.gapStart[1] + (WIGGLE.gapEnd[1] - WIGGLE.gapStart[1]) * t;
      var wait = gsap.utils.random(lo, hi) * 1000;

      wiggleTimer = setTimeout(function () {
        if (WIGGLE.stopOnDiscovery && discovered) return; // stop for good

        // don't compete with an open photo, and don't animate off-screen
        if (!openSet.length && heroVisible()) {
          // re-roll once on a repeat — with only four candidates at this
          // cadence, straight random visibly picks the same letter twice
          var n = Math.floor(Math.random() * media.length);
          if (n === lastIndex) n = (n + 1 + Math.floor(Math.random() * (media.length - 1))) % media.length;
          lastIndex = n;
          fired++;

          var el = media[n];
          var ch = el.querySelector('.char');
          gsap.timeline()
            .to(ch, {
              rotation: WIGGLE.rot,
              y: WIGGLE.lift,
              duration: WIGGLE.dur * 0.4,
              ease: 'power2.out'
            })
            .to(ch, {
              rotation: 0,
              y: 0,
              duration: WIGGLE.dur * 0.6,
              ease: 'elastic.out(1, 0.4)'
            });
        }
        schedule();
      }, wait);
    }

    schedule();
  }
})();
