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

  var SMOOTH = {
    smooth: 1.5,       // seconds the content takes to catch up to real scroll
    speed: 1,          // overall scroll speed multiplier
    anchorOffset: 60   // px gap above an anchor target (was scroll-margin-top)
  };

  gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

  var smoother = ScrollSmoother.create({
    wrapper: '#smooth-wrapper',
    content: '#smooth-content',
    smooth: SMOOTH.smooth,
    speed: SMOOTH.speed,
    effects: true,            // activates [data-speed] / [data-lag]
    ignoreMobileResize: true  // don't re-measure when mobile toolbars slide
  });

  // lets CSS hand the .now-sticky pin over to ScrollTrigger (see style.css)
  document.documentElement.classList.add('smoothing');

  /* The Wind River statement's pin lives in js/now-line.js — it belongs to the
     horizontal tween that drives the section, and two pins on one element
     would fight. Nothing to pin here. */

  /* ── anchor links ──
     The smoother bypasses native hash scrolling, so #experience etc. would
     jump or land short. Route them through smoother.scrollTo instead.
     Links marked data-transition are cross-page and belong to the curtain
     handler in js/main.js — leave those alone. */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    if (link.hasAttribute('data-transition')) return;
    link.addEventListener('click', function (e) {
      var href = link.getAttribute('href');
      if (!href || href === '#') return;
      var target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      smoother.scrollTo(target, true, 'top ' + SMOOTH.anchorOffset + 'px');
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
