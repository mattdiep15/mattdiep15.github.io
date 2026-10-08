/* ==========================================================================
   now-line.js — the Wind River statement
   --------------------------------------------------------------------------
   .now-sticky is pinned for the length of the section while a single scrubbed
   timeline runs the whole choreography:

     • each statement line glides in from off-screen right, DECELERATES
       into its resting position in the middle of the screen, and stays put
     • lines accumulate — one arrives while the previous ones hold still
     • all three sit together for a beat
     • then all three leave at once, continuing left

   Because the timeline is scrubbed, the easing resolves against scroll
   POSITION rather than elapsed time: a line covers most of its distance early
   in its scroll segment and creeps the last part, so the slowdown is something
   you feel as you scroll — and the whole thing reverses cleanly on the way
   back up, like the rest of the site.

   The pin's length is DERIVED from the finished timeline (TUNE.vhPerUnit)
   rather than hardcoded, so adding or retiming a beat keeps the same scroll
   pacing instead of quietly compressing everything else.

   Degrades to a plain wrapped statement whenever this doesn't run — reduced
   motion, GSAP CDN blocked, missing elements. The animated layout only
   switches on via html.now-anim, added below.

   TUNABLES: see TUNE.
   ========================================================================== */

(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.gsap || !window.ScrollTrigger) return; // CDN blocked

  var sticky = document.querySelector('.now-sticky');
  var pin = document.querySelector('.now-pin');
  var lines = Array.prototype.slice.call(document.querySelectorAll('.now-l'));
  if (!sticky || !pin || !lines.length) return;

  var TUNE = {
    enterX: 0.62,            // line starts this fraction of viewport width right
    stagger: 0.14,           // timeline gap between consecutive lines arriving
    enterDur: 0.5,           // how long one line's glide takes
    enterEase: 'power2.out', // the gradual slowdown into rest. GSAP's scale is
                             // offset from the usual names — power2 IS cubic,
                             // so this matches the easeOutCubic this section
                             // used before. power3/power4 decelerate harder.
    hold: 0.5,               // dwell with all three up before they leave
    exitDur: 0.42,           // the collective exit
    exitEase: 'power2.in',   // mirror of the entrance: accelerates away
    vhPerUnit: 1.29          // pin runway, in viewport heights per timeline
                             // second (the statement alone used to be 1.7
                             // units over 2.2vh — this preserves that pacing)
  };

  gsap.registerPlugin(ScrollTrigger);

  // widths are font-dependent and everything here is set to nowrap, so wait for
  // Satoshi before measuring anything or committing to the nowrap layout
  document.fonts.ready.then(function () {
    // switches the CSS from the wrapped fallback to the animated layout
    document.documentElement.classList.add('now-anim');

    var tl = gsap.timeline({ paused: true }); // ScrollTrigger drives it below

    // fromTo rather than from: `from` defaults to immediateRender, which in a
    // staggered timeline fires every start state at build time and flickers
    lines.forEach(function (l, i) {
      tl.fromTo(l,
        { x: function () { return window.innerWidth * TUNE.enterX; }, opacity: 0 },
        { x: 0, opacity: 1, ease: TUNE.enterEase, duration: TUNE.enterDur },
        i * TUNE.stagger);
    });

    // positioned explicitly rather than appended, so `hold` is a real dwell
    // that's independent of how long the entrances took
    var lastIn = (lines.length - 1) * TUNE.stagger + TUNE.enterDur;

    tl.to(lines, {
      x: function () { return -window.innerWidth * TUNE.enterX; },
      opacity: 0,
      ease: TUNE.exitEase,
      duration: TUNE.exitDur
    }, lastIn + TUNE.hold);

    ScrollTrigger.create({
      trigger: pin,
      start: 'top top',
      end: function () {
        return '+=' + window.innerHeight * tl.duration() * TUNE.vhPerUnit;
      },
      pin: sticky,
      scrub: true,              // scrub: 1 would add catch-up lag on top
      animation: tl,
      // Mobile browsers scroll asynchronously, so the pin can latch a frame late
      // and visibly jolt at the handoff from the hero. This looks ahead by one
      // frame's worth of scroll to catch it in time.
      anticipatePin: 1,
      invalidateOnRefresh: true // re-evaluate the x offsets on resize
    });
  });
})();
