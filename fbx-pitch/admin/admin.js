/* ============================================================
   FBX ADMIN — Content Editor
   Same-origin direct DOM access: no postMessage needed.
   Depends on window.DECK from ../js/manifest.js.
   ============================================================ */

(function () {
  'use strict';

  const SLIDE_W     = 1600;
  const SLIDE_H     = 900;
  const STORAGE_KEY = 'fbx-content-overrides';

  // --- DOM refs ------------------------------------------------
  const slideList  = document.getElementById('slide-list');
  const frame      = document.getElementById('slide-frame');
  const stage      = document.getElementById('stage');
  const scaler     = document.getElementById('scaler');
  const editCountEl = document.getElementById('edit-count');

  let currentIndex = 0;
  let activeEditor = null;   // the iframe element currently in edit mode

  // =============================================================
  // INIT
  // =============================================================

  function init() {
    buildSidebar();
    setupToolbar();
    rescale();
    window.addEventListener('resize', rescale);
    loadSlide(0);
  }

  // =============================================================
  // SIDEBAR
  // =============================================================

  function buildSidebar() {
    DECK.slides.forEach((slide, i) => {
      const btn = document.createElement('button');
      btn.className = 'slide-item';
      btn.dataset.index   = i;
      btn.dataset.slideId = slide.id;
      btn.innerHTML =
        `<span class="slide-num">${String(i + 1).padStart(2, '0')}</span>` +
        `<span class="slide-title">${slide.title}</span>` +
        `<span class="edit-dot" hidden aria-label="has edits"></span>`;
      btn.addEventListener('click', () => loadSlide(i));
      slideList.appendChild(btn);
    });
    updateSidebarIndicators();
    updateEditCount();
  }

  // =============================================================
  // SCALING  (mirrors host.js rescale logic)
  // =============================================================

  function rescale() {
    const pad  = 20;
    const sw   = stage.offsetWidth;
    const sh   = stage.offsetHeight;
    const scale = Math.min((sw - pad * 2) / SLIDE_W, (sh - pad * 2) / SLIDE_H);
    const scaledW = SLIDE_W * scale;
    const scaledH = SLIDE_H * scale;
    const tx = (sw - scaledW) / 2;
    const ty = (sh - scaledH) / 2;

    scaler.style.transform       = `translate(${tx}px, ${ty}px) scale(${scale})`;
    scaler.style.transformOrigin = '0 0';
  }

  // =============================================================
  // SLIDE LOADING
  // =============================================================

  function loadSlide(index) {
    currentIndex = index;
    const slide  = DECK.slides[index];

    document.querySelectorAll('.slide-item').forEach((item, i) => {
      item.classList.toggle('active', i === index);
    });

    // file paths in manifest are relative to project root: "slides/01-cover.html"
    frame.src = '../' + slide.file;
    frame.addEventListener('load', onFrameLoad, { once: true });
  }

  function onFrameLoad() {
    const doc = frame.contentDocument;
    if (!doc) return;

    // content-loader fires fbx:content-applied when the JSON is applied.
    // Bind overlay then. Also set a fallback for non-content slides.
    let bound = false;
    const bind = () => {
      if (bound) return;
      bound = true;
      bindOverlay(doc);
      updateSidebarIndicators();
      updateEditCount();
    };

    doc.addEventListener('fbx:content-applied', bind);
    // Fallback: give content-loader 600ms to fetch and apply
    setTimeout(bind, 600);
  }

  // =============================================================
  // OVERLAY — inject hover styles + click handlers into iframe doc
  // =============================================================

  function bindOverlay(doc) {
    if (!doc || !doc.head) return;

    // Inject (or refresh) admin styles inside the slide document
    let styleEl = doc.getElementById('fbx-admin-styles');
    if (!styleEl) {
      styleEl = doc.createElement('style');
      styleEl.id = 'fbx-admin-styles';
      doc.head.appendChild(styleEl);
    }
    styleEl.textContent = `
      [data-content] {
        cursor: pointer !important;
        transition: outline 80ms ease, outline-offset 80ms ease;
      }
      [data-content]:hover {
        outline: 1px dashed rgba(230,57,70,0.75) !important;
        outline-offset: 3px !important;
      }
      [data-content].fbx-editing {
        outline: 2px solid #E63946 !important;
        outline-offset: 3px !important;
        cursor: text !important;
      }
    `;

    // Bind click to each [data-content] element.
    // removeEventListener prevents double-binding on reapply re-calls.
    doc.querySelectorAll('[data-content]').forEach(el => {
      el.removeEventListener('click', handleElementClick);
      el.addEventListener('click', handleElementClick);
    });
  }

  // Named function so removeEventListener can target the exact reference
  function handleElementClick(e) {
    if (this.isContentEditable) return;    // already editing, let browser handle it
    e.preventDefault();
    e.stopPropagation();
    openEditor(this);
  }

  // =============================================================
  // INLINE EDITOR
  // =============================================================

  function openEditor(el) {
    // Commit any previously open editor first
    if (activeEditor && activeEditor !== el) {
      commitEditor(activeEditor);
    }

    const doc = el.ownerDocument;

    el.classList.add('fbx-editing');
    el.contentEditable = 'true';
    el.focus();

    // Select all so the user can type to replace immediately
    const range = doc.createRange();
    range.selectNodeContents(el);
    const sel = doc.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    activeEditor = el;

    function onKeydown(e) {
      if (e.key === 'Enter') {
        // Insert <br> instead of block-level divs
        e.preventDefault();
        insertLineBreak(doc);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        el.removeEventListener('keydown', onKeydown);
        el.removeEventListener('blur', onBlur);
        cancelEditor(el);
      }
    }

    function onBlur() {
      el.removeEventListener('keydown', onKeydown);
      commitEditor(el);
    }

    el.addEventListener('keydown', onKeydown);
    el.addEventListener('blur', onBlur, { once: true });
  }

  function commitEditor(el) {
    if (!el || !el.isContentEditable) return;

    const key      = el.dataset.content;               // "02-thesis.kicker"
    const dot      = key.indexOf('.');
    const slideId  = key.slice(0, dot);
    const fieldKey = key.slice(dot + 1);
    const value    = sanitizeHTML(el.innerHTML);

    el.contentEditable = 'false';
    el.classList.remove('fbx-editing');
    activeEditor = null;

    saveOverride(slideId, fieldKey, value);
  }

  function cancelEditor(el) {
    if (!el) return;
    el.contentEditable = 'false';
    el.classList.remove('fbx-editing');
    activeEditor = null;

    // Reapply to restore the pre-edit value
    if (frame.contentWindow?.FBXContent) {
      frame.contentWindow.FBXContent.reapply();
    }
  }

  // Insert a <br> at the current cursor position inside the contenteditable
  function insertLineBreak(doc) {
    const sel = doc.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const br = doc.createElement('br');
    range.insertNode(br);
    range.setStartAfter(br);
    range.setEndAfter(br);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // Remove trailing <br> and leading/trailing whitespace that contenteditable adds
  function sanitizeHTML(html) {
    return html
      .replace(/<div>/gi, '<br>')      // Chrome wraps new lines in <div>
      .replace(/<\/div>/gi, '')
      .replace(/(<br\s*\/?>\s*)+$/i, '') // strip trailing <br>
      .trim();
  }

  // =============================================================
  // STORAGE
  // =============================================================

  function getOverrides() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveOverride(slideId, fieldKey, value) {
    const overrides = getOverrides();
    if (!overrides[slideId]) overrides[slideId] = {};
    overrides[slideId][fieldKey] = value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));

    // reapply() is async (re-fetches content.json) — it fires fbx:content-applied
    // when done. Element nodes survive reapply (innerHTML swapped, not recreated)
    // so click listeners remain; we only need to update indicators.
    if (frame.contentWindow?.FBXContent) {
      frame.contentWindow.FBXContent.reapply();
    }

    updateSidebarIndicators();
    updateEditCount();
  }

  // =============================================================
  // SIDEBAR INDICATORS
  // =============================================================

  function updateSidebarIndicators() {
    const overrides = getOverrides();
    document.querySelectorAll('.slide-item').forEach(item => {
      const id  = item.dataset.slideId;
      const dot = item.querySelector('.edit-dot');
      const has = overrides[id] && Object.keys(overrides[id]).length > 0;
      dot.hidden = !has;
    });
  }

  function updateEditCount() {
    const overrides = getOverrides();
    let n = 0;
    Object.entries(overrides).forEach(([key, val]) => {
      if (key !== '_meta' && val && typeof val === 'object') {
        n += Object.keys(val).length;
      }
    });
    editCountEl.textContent = n === 0 ? 'no edits' : `${n} edit${n !== 1 ? 's' : ''} in draft`;
  }

  // =============================================================
  // TOOLBAR ACTIONS
  // =============================================================

  function setupToolbar() {
    document.getElementById('btn-export').addEventListener('click', exportJSON);
    document.getElementById('btn-import').addEventListener('click', importJSON);
    document.getElementById('btn-reset').addEventListener('click', resetToFile);
  }

  async function exportJSON() {
    let original;
    try {
      const res = await fetch('../content.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status);
      original = await res.json();
    } catch (err) {
      alert('Could not load content.json: ' + err.message);
      return;
    }

    const overrides = getOverrides();

    // Deep merge: overrides win over file values
    const merged = JSON.parse(JSON.stringify(original));
    Object.entries(overrides).forEach(([slideId, fields]) => {
      if (slideId === '_meta' || typeof fields !== 'object') return;
      if (merged[slideId]) Object.assign(merged[slideId], fields);
    });

    const blob = new Blob([JSON.stringify(merged, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'content.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importJSON() {
    const input    = document.createElement('input');
    input.type     = 'file';
    input.accept   = '.json,application/json';

    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      let imported;
      try {
        imported = JSON.parse(await file.text());
      } catch {
        alert('Could not parse file — make sure it is valid JSON.');
        return;
      }

      // Validate: warn on unknown slide IDs
      const validIds = new Set(DECK.slides.map(s => s.id));
      const unknowns = Object.keys(imported).filter(k => k !== '_meta' && !validIds.has(k));

      if (unknowns.length > 0) {
        const msg = `Unknown slide IDs in imported file (will be ignored):\n\n  • ${unknowns.join('\n  • ')}\n\nContinue?`;
        if (!confirm(msg)) return;
      }

      // Build override object from valid slide IDs only
      const overrides = {};
      Object.entries(imported).forEach(([key, val]) => {
        if (key !== '_meta' && validIds.has(key)) overrides[key] = val;
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));

      if (frame.contentWindow?.FBXContent) {
        frame.contentWindow.FBXContent.reapply();
      }
      updateSidebarIndicators();
      updateEditCount();
    });

    input.click();
  }

  function resetToFile() {
    if (!confirm('Reset all edits?\n\nThis will discard every draft change and restore content.json defaults. This cannot be undone.')) return;

    localStorage.removeItem(STORAGE_KEY);

    if (frame.contentWindow?.FBXContent) {
      frame.contentWindow.FBXContent.reapply();
    }
    updateSidebarIndicators();
    updateEditCount();
  }

  // =============================================================
  // START
  // =============================================================

  init();

})();
