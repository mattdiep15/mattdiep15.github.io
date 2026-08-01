/* ==========================================================================
   pill-nav.js — floating nav that collapses to a circle, expands to a pill
   --------------------------------------------------------------------------
   ONE paused timeline drives both directions. This is the whole design, and
   it's what makes the toggle interruptible:

     [0] ─ segment 1: pill widens, links stagger in, bars become an X
           │
           ├─ addPause()   ← "open and resting". Playhead sits here.
           │
           └─ segment 2: links stagger OUT in the SAME order, bars return,
              pill narrows. This runs FORWARD — it is a real exit animation,
              not .reverse() of segment 1 and not a second timeline.
     [end] onComplete → seek(0) + pause() → armed for the next cycle.

   The toggle is literally tl.play(), in both directions:
     • before the pause  → keeps running to the pause
     • at the pause      → resumes past it into the exit
     • inside segment 2  → keeps running to the end, which re-arms at 0
   play() on an already-playing timeline is a no-op, so hammering the button
   can never snap, jump or strand the panel. The playhead only moves forward
   around the loop.

   The boolean below is NOT the source of truth for the animation — the
   playhead is. isOpen flips only as the playhead crosses each boundary, and
   exists purely to drive aria-expanded and the button label.

   TUNABLES: see TUNE.
   ========================================================================== */

(function () {
  'use strict';

  var pill = document.getElementById('pill-nav');
  var toggle = document.getElementById('pill-toggle');
  var list = document.getElementById('pill-items');
  if (!pill || !toggle || !list || !window.gsap) return;

  var items = Array.prototype.slice.call(list.querySelectorAll('li'));
  var bars = Array.prototype.slice.call(pill.querySelectorAll('.pill-bars i'));

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var TUNE = {
    collapsed: 64,        // px — the circle's diameter, matches CSS
    stagger: 0.05,        // between links
    itemY: 10,            // px offset links animate through
    openDur: 0.45,
    openEase: 'power3.out',
    exitDur: 0.3,
    exitEase: 'power2.in'
  };

  // Reduced motion collapses durations to near-zero rather than disabling the
  // toggle — the nav still works, it just arrives instantly.
  if (reduced) {
    TUNE.openDur = TUNE.exitDur = 0.001;
    TUNE.stagger = 0;
  }

  /* ── measurement ──
     The expanded width depends on the rendered text, so measure after the font
     lands: briefly render expanded, read the natural width, then collapse. */
  var expandedW = 0;

  function measure() {
    pill.classList.add('measuring');
    pill.style.width = 'auto';
    expandedW = pill.getBoundingClientRect().width;
    pill.style.width = '';
    pill.classList.remove('measuring');
  }

  function setOpen(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    list.setAttribute('aria-hidden', String(!open));
    pill.classList.toggle('is-open', open);
    isOpen = open;
  }

  var isOpen = false;
  var tl = null;

  function build() {
    if (tl) tl.kill();

    gsap.set(pill, { width: TUNE.collapsed });
    gsap.set(items, { y: TUNE.itemY, opacity: 0 });

    tl = gsap.timeline({
      paused: true,
      onComplete: function () {
        // playhead crossed the closing boundary — re-arm at the start
        tl.seek(0).pause();
        setOpen(false);
      }
    });

    /* ── segment 1: open ── */
    tl.to(pill, {
        width: expandedW,
        duration: TUNE.openDur,
        ease: TUNE.openEase
      })
      .to(items, {
        y: 0,
        opacity: 1,
        stagger: TUNE.stagger,
        duration: TUNE.openDur,
        ease: TUNE.openEase
      }, '<0.08')
      .to(bars[0], { y: 6, rotate: 45, duration: TUNE.openDur, ease: TUNE.openEase }, '<')
      .to(bars[1], { opacity: 0, duration: TUNE.openDur * 0.4 }, '<')
      .to(bars[2], { y: -6, rotate: -45, duration: TUNE.openDur, ease: TUNE.openEase }, '<');

    /* ── the resting-open state ── */
    tl.addPause(undefined, function () { setOpen(true); });

    /* ── segment 2: close. Forward, not a rewind.
          Same stagger ORDER as the entrance — first link leaves first. ── */
    tl.to(items, {
        y: -TUNE.itemY,
        opacity: 0,
        stagger: TUNE.stagger,
        duration: TUNE.exitDur,
        ease: TUNE.exitEase
      })
      .to(bars[0], { y: 0, rotate: 0, duration: TUNE.exitDur, ease: TUNE.exitEase }, '<')
      .to(bars[1], { opacity: 1, duration: TUNE.exitDur * 0.6 }, '<')
      .to(bars[2], { y: 0, rotate: 0, duration: TUNE.exitDur, ease: TUNE.exitEase }, '<')
      .to(pill, {
        width: TUNE.collapsed,
        duration: TUNE.exitDur,
        ease: TUNE.exitEase
      }, '<0.06');
  }

  /* ── the only control surface ── */
  function advance() { tl.play(); }

  toggle.addEventListener('click', function (e) {
    e.stopPropagation();
    advance();
  });

  // Escape and outside-click CLOSE only — guarded on isOpen so they can never
  // open a closed pill, and so they no-op harmlessly mid-animation.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) advance();
  });

  document.addEventListener('click', function (e) {
    if (isOpen && !pill.contains(e.target)) advance();
  });

  // a link click closes it too, so the pill isn't left open over the target
  list.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () { if (isOpen) advance(); });
  });

  /* ── focus trap while open ── */
  pill.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab' || !isOpen) return;
    var focusable = [toggle].concat(Array.prototype.slice.call(list.querySelectorAll('a')));
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });

  document.fonts.ready.then(function () {
    measure();
    build();
    setOpen(false);

    var t;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        // only re-measure while closed and armed — rebuilding mid-flight would
        // be exactly the snap this pattern exists to avoid
        if (tl.isActive() || isOpen) return;
        measure();
        build();
      }, 200);
    }, { passive: true });
  });
})();
