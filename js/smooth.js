/* ==========================================================================
   smooth.js — GSAP ScrollSmoother: smooth scrolling + data-speed parallax
   --------------------------------------------------------------------------
   ScrollSmoother fakes scrolling by translating #smooth-content with a
   transform while #smooth-wrapper is pinned as a fixed, overflow:hidden
   viewport. Two consequences shape the rest of the site:

     1. position:sticky dies inside the content — its scrollport is now a
        fixed box that never scrolls. Only .now-sticky actually relied on it
        (.hero-sticky sits in a 100vh parent, so it has zero sticky travel and
        was always inert), so that one pin is re-created with ScrollTrigger —
        see js/now-line.js, which owns it along with the statement's timeline.

     2. position:fixed layers must live OUTSIDE the wrapper (see index.html).

   Note there are no native CSS scroll timelines (animation-timeline: view())
   anywhere on the site — they'd freeze here, since the native scrollport no
   longer moves. Page content has no scroll entrance at all now, so nothing
   depends on them.

   Degrades cleanly: on reduced motion, or if the GSAP CDN is unreachable,
   this bails and #smooth-wrapper is an inert plain div — native scrolling and
   the CSS sticky pin take back over.

   TUNABLES: see SMOOTH below.
   ========================================================================== */

(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.gsap || !window.ScrollTrigger || !window.ScrollSmoother) return; // CDN blocked
  if (!document.getElementById('smooth-wrapper')) return;

  /* Touch scrolling is a different problem from wheel scrolling. A wheel emits
     small steady deltas that 1.5s of catch-up smooths pleasantly; a flick emits
     one huge delta, and the same 1.5s reads as rubbery overshoot. 0.8 is GSAP's
     own default and is what touch gets. */
  var isTouch = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;

  var SMOOTH = {
    smooth: isTouch ? 0.8 : 1.5,  // seconds the content takes to catch up
    speed: 1,          // overall scroll speed multiplier
    anchorOffset: 60   // px gap above an anchor target (was scroll-margin-top)
  };

  gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

  var smoother = ScrollSmoother.create({
    wrapper: '#smooth-wrapper',
    content: '#smooth-content',
    smooth: SMOOTH.smooth,
    speed: SMOOTH.speed,

    /* The fix for shaky mobile scrolling. Without it the browser scrolls on the
       compositor thread while the smoother writes its transform on the main
       thread; the two disagree every frame and each flick overshoots and
       settles. This hands touch scrolling to GSAP so there is only one source of
       truth, and it absorbs the iOS address-bar jump as a side effect.

       It intercepts touch, so any nested scrollable pane would have to be
       excluded — the site has none (no overflow:auto/scroll anywhere), which is
       what makes this safe here. */
    normalizeScroll: true,

    // load-bearing on projects.html, whose project images carry data-speed="auto"
    effects: true,
    ignoreMobileResize: true  // don't re-measure when mobile toolbars slide
  });

  // lets CSS hand the .now-sticky pin over to ScrollTrigger (see style.css)
  document.documentElement.classList.add('smoothing');

  /* The Wind River statement's pin lives in js/now-line.js — it belongs to the
     horizontal tween that drives the section, and two pins on one element
     would fight. Nothing to pin here. */

  /* ── anchor links ──
     These are the nav's in-page tabs, and they transition rather than scroll:
     the curtain covers, the page jumps to the section instantly while hidden,
     the curtain lifts — the same wipe the cross-page Projects tab plays. The
     jump goes through smoother.scrollTo because the smoother bypasses native
     hash scrolling (#experience would land short otherwise); it's the same
     non-animated call the deep-link path below uses.
     Links marked data-transition are cross-page and belong to js/curtain.js —
     leave those alone. */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    if (link.hasAttribute('data-transition')) return;
    link.addEventListener('click', function (e) {
      var href = link.getAttribute('href');
      if (!href || href === '#') return;
      var target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      function jump() { smoother.scrollTo(target, false, 'top ' + SMOOTH.anchorOffset + 'px'); }
      if (window.PageCurtain) window.PageCurtain.sweep(jump);
      else smoother.scrollTo(target, true, 'top ' + SMOOTH.anchorOffset + 'px'); // no curtain
      if (history.pushState) history.pushState(null, '', href);
    });
  });

  // deep link (index.html#experience from the projects page): the smoother
  // starts at 0, so honour the hash once everything has been measured.
  if (window.location.hash) {
    var deep = document.querySelector(window.location.hash);
    if (deep) {
      ScrollTrigger.addEventListener('refresh', function once() {
        ScrollTrigger.removeEventListener('refresh', once);
        smoother.scrollTo(deep, false, 'top ' + SMOOTH.anchorOffset + 'px');
      });
    }
  }
})();
