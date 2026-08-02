/* ==========================================================================
   split-lines.js — per-line reveal for display headings
   --------------------------------------------------------------------------
   Headings marked [data-split] are broken into their *visual* lines by GSAP
   SplitText. Each line is wrapped in a clipping mask, and the lines slide up
   from behind that mask with a stagger when the heading scrolls into view.

   This is a one-shot reveal: it plays on entry and stays. It does not reverse
   on scroll-up. Page content has no other scroll entrance — sections and cards
   simply scroll into view untouched — so this and the .now-l glide
   (js/now-line.js) are the only two scroll-driven motions on the site.

   Why GSAP for just this: getting line splits *right* means re-measuring
   whenever the text reflows — on resize, and after the webfont swaps in and
   changes every break point. SplitText's autoSplit does that, reverts
   the old tween, and re-runs onSplit against the new lines.

   Contract:
     data-split   on a block of display type — reveals line by line on entry

   Applies to whatever carries the attribute, but that's deliberately just one
   heading — "Let's Connect!". The other section titles (Experience, Projects,
   Education) had it and gave it up: as a closing flourish it lands, as a thing
   every heading does it's noise. Adding it back to more is a one-attribute
   change, which is exactly the point.

   Degrades to plain static text when: reduced motion is on, JS is off, or the
   GSAP CDN is unreachable. The tween is a `from`, so the heading's resting
   state IS its normal rendered state — nothing is hidden by default.

   TUNABLES: see TUNE below.
   ========================================================================== */

(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.gsap || !window.ScrollTrigger || !window.SplitText) return; // CDN blocked

  var TUNE = {
    rise: 120,          // % of its own height each line starts below the mask
                        // (>100 so no sliver of the line peeks into the
                        // descender padding added in css/style.css)
    duration: 0.9,      // seconds per line
    stagger: 0.09,      // seconds between consecutive lines
    ease: 'power3.out', // fast start, long decelerating settle
    start: 'top 85%'    // heading top hits 85% down the viewport
  };

  gsap.registerPlugin(ScrollTrigger, SplitText);

  // single-word class: SplitText derives the mask's class by appending
  // "-mask" to each word of the line's class, so "split-line" would become
  // the nonsense "split-mask-line-mask".
  var LINE_CLASS = 'sline';

  // fonts first — line breaks measured against the fallback font would be
  // wrong the moment the webfont swaps in (the <link> uses display=swap)
  document.fonts.ready.then(function () {
    gsap.utils.toArray('[data-split]').forEach(function (el) {
      SplitText.create(el, {
        type: 'lines',
        linesClass: LINE_CLASS,
        mask: 'lines',   // wraps each line in an overflow:clip clone
        autoSplit: true, // re-split on resize / late font loads
        onSplit: function (self) {
          // returned tween is tracked by SplitText so it can be reverted and
          // replayed at the right time when the text re-splits
          return gsap.from(self.lines, {
            yPercent: TUNE.rise,
            duration: TUNE.duration,
            stagger: TUNE.stagger,
            ease: TUNE.ease,
            scrollTrigger: {
              trigger: el,
              start: TUNE.start,
              once: true
            }
          });
        }
      });
    });
  });
})();
