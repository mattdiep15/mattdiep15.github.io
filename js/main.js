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
  document.querySelectorAll('.tl-card[role="button"]').forEach(function (card) {
    var initialDetails = card.querySelector('.tl-details');
    if (initialDetails) initialDetails.setAttribute('aria-hidden', 'true');
    function toggleCard() {
      var isOpen = card.classList.toggle('open');
      card.setAttribute('aria-expanded', String(isOpen));
      var details = card.querySelector('.tl-details');
      if (details) details.setAttribute('aria-hidden', String(!isOpen));
    }
    card.addEventListener('click', function (e) {
      if (!e.target.closest('a')) toggleCard();
    });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCard(); }
    });
  });

  /* The hero's circular photo (click to cycle through four images, with a
     particle burst) was removed — the photos now pop out of individual letters
     of the name on hover instead. See js/hero-letters.js. */

})();
