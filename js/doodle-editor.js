/* ==========================================================================
   doodle-editor.js — drag the hand-drawn .doodle images into place
   --------------------------------------------------------------------------
   Dormant unless the page is opened with ?doodles (e.g. index.html?doodles).
   Then every <img class="doodle"> becomes editable on the live page:

     drag            move
     wheel / + −     resize around the centre (Shift = 10px steps)
     arrow keys      nudge the selected doodle 1px (Shift = 10px)
     F               flip horizontally

   Nothing is saved — this is a static site. The panel shows the selected
   doodle's <img> tag with its new inline style; copy it back into
   index.html over the old tag. Everything is relative to the doodle's
   parent's top-left corner, so it stays put if the page reflows.
   ========================================================================== */

(() => {
  if (!new URLSearchParams(location.search).has('doodles')) return;

  const doodles = [...document.querySelectorAll('.doodle')];
  let selected = null;

  // ── editor styles ─────────────────────────────────────────────────────────
  const css = document.createElement('style');
  css.textContent = `
    .doodle {
      pointer-events: auto !important;
      cursor: grab;
      touch-action: none;
      outline: 1px dashed rgba(230, 60, 40, 0.7);
      outline-offset: 2px;
      user-select: none;
      -webkit-user-drag: none;
    }
    .doodle.doodle-selected { outline: 2px solid rgb(230, 60, 40); }
    .doodle.doodle-dragging { cursor: grabbing; }
    #doodle-panel {
      position: fixed; left: 16px; bottom: 16px; z-index: 99999;
      width: min(420px, calc(100vw - 32px));
      background: #111; color: #eee; border-radius: 12px;
      padding: 12px 14px; font: 12px/1.45 ui-monospace, Menlo, Consolas, monospace;
      box-shadow: 0 10px 30px rgba(0,0,0,0.35);
    }
    #doodle-panel b { color: #fff; }
    #doodle-panel textarea {
      width: 100%; height: 86px; margin: 8px 0; resize: vertical;
      background: #1d1d1d; color: #9fe39f; border: 1px solid #333;
      border-radius: 6px; padding: 6px; font: inherit;
    }
    #doodle-panel button {
      background: #eee; color: #111; border: 0; border-radius: 6px;
      padding: 5px 10px; font: inherit; cursor: pointer; margin-right: 6px;
    }
    #doodle-panel .hint { color: #888; margin-top: 6px; }
  `;
  document.head.appendChild(css);

  // ── panel ─────────────────────────────────────────────────────────────────
  // appended to <body>, outside #smooth-wrapper, so ScrollSmoother's transform
  // doesn't drag a position:fixed panel along with the content
  const panel = document.createElement('div');
  panel.id = 'doodle-panel';
  panel.innerHTML = `
    <div><b>doodle editor</b> · <span id="doodle-name">${doodles.length} doodle(s) — click one</span></div>
    <textarea id="doodle-out" readonly spellcheck="false"></textarea>
    <button id="doodle-copy">copy tag</button>
    <button id="doodle-copy-all">copy all tags</button>
    <div class="hint">drag · wheel or +/− resize · arrows nudge · F flip · Shift = ×10</div>
  `;
  document.body.appendChild(panel);
  const nameEl = panel.querySelector('#doodle-name');
  const out = panel.querySelector('#doodle-out');

  // ── reading / writing a doodle's box ───────────────────────────────────────
  const px = v => Math.round(parseFloat(v) || 0);

  // a doodle pinned to its parent's right edge (inline `right:` instead of
  // `left:`) stays pinned there when the parent's width changes. `left` here
  // is always the on-screen x, so drag/nudge maths is the same either way;
  // apply() converts back to `right` for those doodles.
  const fromRight = el => el.style.right !== '';

  function box(el) {
    const cs = getComputedStyle(el);
    const left = fromRight(el)
      ? el.offsetParent.clientWidth - px(cs.right) - px(cs.width)
      : px(cs.left);
    return { left, top: px(cs.top), width: px(cs.width) };
  }

  function apply(el, b) {
    const width = Math.max(8, b.width);
    if (fromRight(el)) el.style.right = `${el.offsetParent.clientWidth - b.left - width}px`;
    else el.style.left = `${b.left}px`;
    el.style.top = `${b.top}px`;
    el.style.width = `${width}px`;
    refresh();
  }

  // the tag as it should appear in index.html — editor-only class stripped
  function tagFor(el) {
    const clone = el.cloneNode(false);
    clone.classList.remove('doodle-selected', 'doodle-dragging');
    return clone.outerHTML;
  }

  function label(el) {
    return el.dataset.doodle || el.getAttribute('src').split('/').pop();
  }

  function refresh() {
    if (!selected) return;
    const b = box(selected);
    const x = fromRight(selected) ? `right ${px(selected.style.right)}` : `left ${b.left}`;
    nameEl.textContent = `${label(selected)} — ${x}, top ${b.top}, width ${b.width}`;
    out.value = tagFor(selected);
  }

  function select(el) {
    if (selected) selected.classList.remove('doodle-selected');
    selected = el;
    el.classList.add('doodle-selected');
    refresh();
  }

  function resize(el, delta) {
    const b = box(el);
    const ratio = el.offsetHeight / el.offsetWidth || 1;
    const width = Math.max(8, b.width + delta);
    const dw = width - b.width;
    apply(el, {
      width,
      left: Math.round(b.left - dw / 2),
      top: Math.round(b.top - (dw * ratio) / 2),
    });
  }

  // ── wiring ────────────────────────────────────────────────────────────────
  doodles.forEach(el => {
    el.draggable = false;

    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      e.stopPropagation();
      select(el);
      el.setPointerCapture(e.pointerId);
      el.classList.add('doodle-dragging');
      const start = { x: e.clientX, y: e.clientY, ...box(el) };

      const move = ev => apply(el, {
        width: start.width,
        left: start.left + Math.round(ev.clientX - start.x),
        top: start.top + Math.round(ev.clientY - start.y),
      });
      const up = () => {
        el.classList.remove('doodle-dragging');
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });

    el.addEventListener('wheel', e => {
      e.preventDefault();
      select(el);
      resize(el, (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 10 : 2));
    }, { passive: false });
  });

  // a doodle usually lives inside something clickable (a timeline card) —
  // swallow the click so editing doesn't toggle the card open and shut
  document.addEventListener('click', e => {
    if (e.target.closest('.doodle')) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  document.addEventListener('keydown', e => {
    if (!selected || e.target.closest('input, textarea')) return;
    const step = e.shiftKey ? 10 : 1;
    const b = box(selected);
    const moves = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0],
      ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      apply(selected, { ...b, left: b.left + moves[e.key][0], top: b.top + moves[e.key][1] });
    } else if (e.key === '+' || e.key === '=') {
      resize(selected, step);
    } else if (e.key === '-' || e.key === '_') {
      resize(selected, -step);
    } else if (e.key === 'f' || e.key === 'F') {
      selected.style.transform = selected.style.transform ? '' : 'scaleX(-1)';
      refresh();
    } else if (e.key === 'Escape') {
      selected.classList.remove('doodle-selected');
      selected = null;
    }
  });

  // ── copy ──────────────────────────────────────────────────────────────────
  // clipboard API can be unavailable (e.g. some file:// setups) — the textarea
  // is the fallback, already holding the text, so select it for a manual copy
  function copy(text) {
    out.value = text;
    const fallback = () => { out.focus(); out.select(); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(fallback);
    else fallback();
  }

  panel.querySelector('#doodle-copy').addEventListener('click', () => {
    if (selected) copy(tagFor(selected));
  });
  panel.querySelector('#doodle-copy-all').addEventListener('click', () => {
    copy(doodles.map(tagFor).join('\n'));
  });
})();
