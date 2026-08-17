/* ==========================================================================
   scroll-bar.js — the scroll indicator on the right edge
   --------------------------------------------------------------------------
   A clean rectangle that shows how far down the page you are and, by its
   height, how long the page is. It fades in while you scroll and fades out a
   beat after you stop, so the hero and the closing card stay clear at rest.

   Indicator only — it is deliberately NOT draggable and does not take pointer
   events at all, so there is no second source of scroll truth to keep in sync
   and nothing invisible sitting at the right edge waiting to swallow a click.

   It REPLACES the native scrollbar (hidden in style.css) rather than sitting
   beside it. That replacement is the reason it can't just be a styled native
   bar: ScrollSmoother lags the visible content behind the real scroll position
   by SMOOTH.smooth seconds, so a native scrollbar tracks a number the page
   hasn't reached yet and visibly runs ahead of what you're reading. Driving
   this off ScrollTrigger instead reports the SMOOTHED position — the one
   actually on screen.

   Colour comes from mix-blend-mode: difference (see style.css), the same trick
   #pill-nav uses — white marks render light over the dark bands and flip to dark
   over the light panel, with no scroll logic of its own.

   Degrades to nothing on a coarse pointer (phones keep their native scrollbars —
   style.css only hides those for pointer:fine) and works without GSAP.

   TUNABLES: see TUNE.
   ========================================================================== */

(function () {
  'use strict';

  var TUNE = {
    minThumb: 42,   // px — never let the rectangle shrink to a sliver
    idleMs: 900     // how long after the last scroll before it fades out
  };

  var docEl = document.documentElement;

  // phones get nothing: CSS hides it there, and this avoids the work as well
  if (window.matchMedia('(pointer: coarse)').matches) return;

  var bar = document.createElement('div');
  bar.id = 'scroll-bar';
  bar.setAttribute('aria-hidden', 'true');

  var thumb = document.createElement('div');
  thumb.id = 'scroll-thumb';
  bar.appendChild(thumb);

  // outside #smooth-wrapper: ScrollSmoother transforms the content, and a
  // transform makes an element a containing block, which would break fixed
  document.body.appendChild(bar);

  var idleTimer = null;
  var trackH = 0, thumbH = 0;

  function maxScroll() {
    return (window.ScrollTrigger && ScrollTrigger.maxScroll(window)) ||
           (docEl.scrollHeight - window.innerHeight);
  }

  function measure() {
    trackH = bar.clientHeight;
    var max = maxScroll();

    // thumb height mirrors the share of the page you can see at once
    var ratio = max > 0 ? window.innerHeight / (window.innerHeight + max) : 1;
    thumbH = Math.max(TUNE.minThumb, Math.round(trackH * ratio));

    // a page that doesn't scroll has nothing to indicate
    bar.style.display = max > 10 ? '' : 'none';
    thumb.style.height = thumbH + 'px';
  }

  function place(p) {
    thumb.style.transform = 'translateY(' + ((trackH - thumbH) * Math.min(Math.max(p, 0), 1)) + 'px)';
  }

  function render(p) {
    place(p);

    bar.classList.add('is-scrolling');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      bar.classList.remove('is-scrolling');
    }, TUNE.idleMs);
  }

  /* ── scroll source ─────────────────────────────────────────────────────── */

  measure();

  if (window.gsap && window.ScrollTrigger) {
    /* Under ScrollSmoother this progress is the SMOOTHED scroll position, which
       is the whole point — it matches what's on screen rather than where the
       raw scroll has already jumped to. */
    ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: function (self) { render(self.progress); },
      onRefresh: function (self) { measure(); render(self.progress); }
    });
  } else {
    // no GSAP: plain native scroll, still correct, just unsmoothed
    var onScroll = function () {
      var max = maxScroll();
      render(max > 0 ? window.scrollY / max : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { measure(); onScroll(); }, 200);
    }, { passive: true });

    onScroll();
  }
})();
