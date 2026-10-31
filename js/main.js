/* ==========================================================================
   main.js — expanding experience / education cards
   ========================================================================== */

(function () {
  'use strict';

  /* The nav lives in js/pill-nav.js now — it owns its own open/close state via
     a single interruptible timeline, so nothing here touches it. The page
     curtain moved to js/curtain.js, which also serves the anchor sweep that
     js/smooth.js plays for the nav's in-page tabs. */

  /* ── experience / education expanding cards ── */
  /* The real control is the <button class="tl-card-head">; it supplies the
     keyboard behaviour natively. The click listener sits on the whole card so
     the rest of it stays clickable too, and a button click simply bubbles up. */
  document.querySelectorAll('.tl-card').forEach(function (card) {
    var head = card.querySelector('.tl-card-head');
    var details = card.querySelector('.tl-details');
    if (!head || !details) return;
    details.setAttribute('aria-hidden', String(!card.classList.contains('open')));
    function toggleCard() {
      var isOpen = card.classList.toggle('open');
      head.setAttribute('aria-expanded', String(isOpen));
      details.setAttribute('aria-hidden', String(!isOpen));
    }
    card.addEventListener('click', function (e) {
      if (e.target.closest('a')) return;
      // the bullets are selectable text — finishing a selection inside the
      // card shouldn't snap it shut
      if (!e.target.closest('.tl-card-head') && String(window.getSelection())) return;
      toggleCard();
    });
  });

  /* The hero's circular photo (click to cycle through four images, with a
     particle burst) was removed — the photos now pop out of individual letters
     of the name on hover instead. See js/hero-letters.js. */

})();
