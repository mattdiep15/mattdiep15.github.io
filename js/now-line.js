/* ==========================================================================
   now-line.js — Wind River statement: three lines gliding in from the right
   --------------------------------------------------------------------------
   .now-sticky is pinned for the length of the section while a single scrubbed
   timeline runs the whole choreography:

     • each line glides in from off-screen right, DECELERATES into its resting
       position in the middle of the screen, and stays put
     • lines accumulate — one arrives while the previous ones hold still
     • all three sit together for a beat
     • then all three leave at once, continuing left

   Because the timeline is scrubbed, the easing resolves against scroll
   POSITION rather than elapsed time: a line covers most of its distance early
   in its scroll segment and creeps the last part, so the slowdown is something
   you feel as you scroll — and the whole thing reverses cleanly on the way
   back up, like the rest of the site.

   Degrades to a plain wrapped statement whenever this doesn't run — reduced
   motion, GSAP CDN blocked, missing elements. The animated layout only
   switches on via html.now-anim, which is added below.

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
    pinVh: 2.2               // total pin length, in viewport heights
  };

  gsap.registerPlugin(ScrollTrigger);

  // line widths are font-dependent and they're set to nowrap, so wait for
  // Satoshi before measuring anything or committing to the nowrap layout
  document.fonts.ready.then(function () {
    // switches the CSS from the wrapped fallback to the animated layout
    document.documentElement.classList.add('now-anim');

    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: pin,
        start: 'top top',
        end: function () { return '+=' + window.innerHeight * TUNE.pinVh; },
        pin: sticky,
        scrub: true,              // scrub: 1 would add catch-up lag on top
        invalidateOnRefresh: true // re-evaluate the x offsets on resize
      }
    });

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
  });
})();
