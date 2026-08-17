/* ==========================================================================
   now-line.js — the greeting, then the Wind River statement
   --------------------------------------------------------------------------
   .now-sticky is pinned for the length of the section while a single scrubbed
   timeline runs the whole choreography:

     • "Welcome to my Website!" glides in from off-screen right, decelerates
       into the centre, holds there briefly, then accelerates away to the left
     • each statement line then glides in from off-screen right, DECELERATES
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
   switches on via html.now-anim, and the greeting via html.welcome-anim,
   both added below.

   TUNABLES: see TUNE and WELCOME.
   ========================================================================== */

(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.gsap || !window.ScrollTrigger) return; // CDN blocked

  var sticky = document.querySelector('.now-sticky');
  var pin = document.querySelector('.now-pin');
  var lines = Array.prototype.slice.call(document.querySelectorAll('.now-l'));
  var welcomeText = document.querySelector('.now-welcome .now-w');
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

  /* The greeting is a plain slide: in from the right, dwell, out to the left.
     It used to arrive as a per-character scatter (GreenSock's
     "ContainerAnimation SplitText" pen) that settled in a wave and came apart
     again on the way out — dropped because the character wave has to finish
     while the phrase is still crossing, which left it either assembling in
     mid-air or frozen in a scattered arrangement for the rest of the trip.

     What's left matches the statement lines' easing exactly: same pair,
     decelerating in and accelerating out, just over a longer distance (a full
     edge-to-centre crossing rather than TUNE.enterX). */
  var WELCOME = {
    enterDur: 0.62,     // the phrase's travel from the right edge to centre
    exitDur: 0.52,      // ...and off to the left. Both a touch longer than the
                        // statement's 0.5/0.42, in the same proportion as the
                        // extra distance, so the two read at the same speed.
    hold: 0.22          // the centred dwell. NOT TUNE.hold — it used to share
                        // that beat with the statement, but the two aren't
                        // comparable: the statement earns its dwell by holding
                        // three accumulated lines, while the greeting is four
                        // words that are read the moment they land. The real
                        // pause is longer than this number looks, too, since
                        // power2.out creeps the last of the entrance and
                        // power2.in barely moves off the mark, so the phrase
                        // reads as stationary either side of the hold itself.
  };

  gsap.registerPlugin(ScrollTrigger);

  // widths are font-dependent and everything here is set to nowrap, so wait for
  // Satoshi before measuring anything or committing to the nowrap layout
  document.fonts.ready.then(function () {
    // switches the CSS from the wrapped fallback to the animated layout
    document.documentElement.classList.add('now-anim');

    var tl = gsap.timeline({ paused: true }); // ScrollTrigger drives it below
    var offset = 0; // where the statement's own choreography begins

    /* ── greeting ──
       The class is what un-hides it, so if this block doesn't run nothing is
       shown and the statement plays on its own. No SplitText dependency any
       more — the phrase moves as one element. */
    if (welcomeText) {
      document.documentElement.classList.add('welcome-anim');

      /* Park the phrase exactly one leading edge beyond the viewport, not a
         whole innerWidth out: half the viewport plus half the phrase puts its
         left edge precisely on the right edge of the screen, so it starts
         moving into view immediately instead of covering dead ground first.
         A function so it re-measures on refresh (invalidateOnRefresh). */
      function offRight() {
        return (window.innerWidth + welcomeText.offsetWidth) / 2;
      }

      // in from the right edge, decelerating into centre
      tl.fromTo(welcomeText,
        { x: offRight },
        { x: 0, ease: TUNE.enterEase, duration: WELCOME.enterDur }, 0);

      var leaves = WELCOME.enterDur + WELCOME.hold;

      // ...and out to the left, accelerating away
      tl.to(welcomeText, {
        x: function () { return -offRight(); },
        ease: TUNE.exitEase,
        duration: WELCOME.exitDur
      }, leaves);

      offset = leaves + WELCOME.exitDur;
    }

    // fromTo rather than from: `from` defaults to immediateRender, which in a
    // staggered timeline fires every start state at build time and flickers
    lines.forEach(function (l, i) {
      tl.fromTo(l,
        { x: function () { return window.innerWidth * TUNE.enterX; }, opacity: 0 },
        { x: 0, opacity: 1, ease: TUNE.enterEase, duration: TUNE.enterDur },
        offset + i * TUNE.stagger);
    });

    // positioned explicitly rather than appended, so `hold` is a real dwell
    // that's independent of how long the entrances took
    var lastIn = offset + (lines.length - 1) * TUNE.stagger + TUNE.enterDur;

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
