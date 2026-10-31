/* ==========================================================================
   reveal.js — letter-by-letter text reveal
   --------------------------------------------------------------------------
   Two attributes, one observer:

     data-reveal        split into per-letter spans; each letter rises, fades
                        and un-blurs left to right when the element scrolls
                        into view (threshold 0.3), once.
     data-reveal="load" same, but plays as soon as the page is showing —
                        after the intro iris or the page-enter curtain, if
                        either is up. For the hero.
     data-reveal-after="<id>"
                        not split. Its children fade/slide in, staggered,
                        once the letters of #<id> have mostly landed.

   Words stay intact (each word is a nowrap inline-block holding its letters,
   and the spaces between them are left as plain text), so lines wrap exactly
   where they did before. The full text goes on the element's aria-label and
   the letter spans are aria-hidden, so it still reads as one string.

   Already-split markup is fine: it walks text nodes, so the hero's .letter >
   .char structure from js/hero-letters.js just gets a span inside each .char.
   That keeps this module's transform/opacity off .char, which hero-letters
   animates with GSAP on hover.

   All timing lives in CSS variables (css/style.css, REVEAL) — --stagger,
   --duration, --blur, --distance and --max-stagger — tunable globally or per
   element, e.g. style="--stagger: 40ms".

   Degrades: no JS → plain text (nothing is hidden without html.js). Reduced
   motion → returns before splitting, and the CSS only hides under
   prefers-reduced-motion: no-preference. If this file fails to load, a CSS
   failsafe un-hides the text after 2.5s.
   ========================================================================== */

(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var docEl = document.documentElement;

  /* ── split ── */
  function split(el) {
    var label = el.getAttribute('aria-label') || el.textContent.replace(/\s+/g, ' ').trim();
    el.setAttribute('aria-label', label);

    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue.trim()) nodes.push(walker.currentNode);
    }

    var i = 0;
    nodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      // keep whitespace runs as text so wrapping is untouched
      node.nodeValue.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        var word = document.createElement('span');
        word.className = 'rv-w';
        word.setAttribute('aria-hidden', 'true');
        Array.from(part).forEach(function (ch) {
          var c = document.createElement('span');
          c.className = 'rv-c';
          c.textContent = ch;
          c.style.setProperty('--i', i++);
          word.appendChild(c);
        });
        frag.appendChild(word);
      });
      node.parentNode.replaceChild(frag, node);
    });

    // steps between the first and last letter; --max-stagger divides by it
    el.style.setProperty('--n', Math.max(i - 1, 1));
    el.classList.add('rv-split');
  }

  /* ── timing, read back from the CSS variables ── */
  function ms(el, name, fallback) {
    var v = getComputedStyle(el).getPropertyValue(name).trim();
    if (!v) return fallback;
    var n = parseFloat(v);
    return /ms$/.test(v) ? n : /s$/.test(v) ? n * 1000 : fallback;
  }

  // total time from the first letter starting to the last one landing
  function timing(el) {
    var steps = parseFloat(el.style.getPropertyValue('--n')) || 1;
    var step = Math.min(ms(el, '--stagger', 25), ms(el, '--max-stagger', 600) / steps);
    var spread = step * steps;
    var duration = ms(el, '--duration', 800);
    return { spread: spread, duration: duration, total: spread + duration };
  }

  /* ── play ── */
  function play(el) {
    el.classList.add('rv-in');
    var t = timing(el);

    // followers start once the last letter is under way
    if (el.id) {
      document.querySelectorAll('[data-reveal-after="' + el.id + '"]').forEach(function (f) {
        showFollower(f, Math.round(t.spread + t.duration * 0.35));
      });
    }

    // drop the compositor hints once everything has landed
    setTimeout(function () { el.classList.add('rv-done'); }, t.total + 100);
  }

  function showFollower(f, delay) {
    if (f.classList.contains('rv-in')) return;
    f.style.setProperty('--delay', delay + 'ms');
    f.classList.add('rv-in');
    // last child's delay + duration, then hand transitions back (see CSS)
    var last = delay + (f.children.length - 1) * 60 + ms(f, '--duration', 800);
    setTimeout(function () { f.classList.add('rv-done'); }, last + 100);
  }

  /* ── the hero waits for whatever is covering it ── */
  function whenPageShowing(cb) {
    function covered() {
      return (docEl.classList.contains('intro-pending') && !docEl.classList.contains('intro-done')) ||
             docEl.classList.contains('page-enter');
    }
    if (!covered()) return cb();
    var obs = new MutationObserver(function () {
      if (!covered()) { obs.disconnect(); cb(); }
    });
    obs.observe(docEl, { attributes: true, attributeFilter: ['class'] });
  }

  /* ── wire up ── */
  var targets = document.querySelectorAll('[data-reveal]');
  if (!targets.length) return;

  targets.forEach(split);

  document.querySelectorAll('[data-reveal-after]').forEach(function (f) {
    Array.prototype.forEach.call(f.children, function (child, i) {
      child.style.setProperty('--i', i);
    });
    f.classList.add('rv-split');
    // a keyboard user can Tab onto a link before its heading has played —
    // never leave focus on something invisible
    f.addEventListener('focusin', function () { showFollower(f, 0); });
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      play(entry.target);
    });
  }, { threshold: 0.3 });

  targets.forEach(function (el) {
    // two frames: the hidden letters must be painted once before .rv-in
    // lands, or there's no start state to transition from and they just appear
    if (el.getAttribute('data-reveal') === 'load') whenPageShowing(function () {
      requestAnimationFrame(function () { requestAnimationFrame(function () { play(el); }); });
    });
    else io.observe(el);
  });
})();
