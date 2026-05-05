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
  const ORDER_KEY   = 'fbx-deck-order';      // [slideId, slideId, ...]
  const DELETE_KEY  = 'fbx-deck-deleted';    // [slideId, ...]

  // --- DOM refs ------------------------------------------------
  const slideList  = document.getElementById('slide-list');
  const frame      = document.getElementById('slide-frame');
  const stage      = document.getElementById('stage');
  const scaler     = document.getElementById('scaler');
  const editCountEl = document.getElementById('edit-count');
  const pendingEl   = document.getElementById('pending-indicator');

  let currentIndex = 0;
  let activeEditor = null;   // the iframe element currently in edit mode
  let draggedId    = null;   // id of slide being dragged

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
  // DECK ORDER + DELETIONS (local pending state)
  // =============================================================

  function getStoredOrder() {
    try { return JSON.parse(localStorage.getItem(ORDER_KEY) || 'null'); }
    catch { return null; }
  }
  function getStoredDeletions() {
    try { return new Set(JSON.parse(localStorage.getItem(DELETE_KEY) || '[]')); }
    catch { return new Set(); }
  }
  function setStoredOrder(arr)   { localStorage.setItem(ORDER_KEY, JSON.stringify(arr)); }
  function setStoredDeletions(s) { localStorage.setItem(DELETE_KEY, JSON.stringify([...s])); }

  /** Effective order: stored override (if any), filtered to valid IDs, with new
      manifest entries appended at the end. Falls back to manifest order.
      Auto-clears stale stored orders that don't match the current manifest. */
  function getEffectiveOrder() {
    const validIds = new Set(DECK.slides.map(s => s.id));
    const stored = getStoredOrder();
    if (!stored) return DECK.slides.map(s => s.id);

    // Stale-detection: if any stored ID is no longer in the manifest, the
    // stored order is from before a rename/reorder and we should reset it.
    // Same goes for any deletions stale.
    const hasStaleId = stored.some(id => !validIds.has(id));
    const missingIds = DECK.slides.filter(s => !stored.includes(s.id));
    if (hasStaleId || missingIds.length > 0) {
      console.warn('[admin] stored deck order is stale (missing or unknown IDs); auto-resetting to manifest order');
      localStorage.removeItem(ORDER_KEY);
      // Also clear deletions if they reference unknown IDs
      const dels = getStoredDeletions();
      const staleDels = [...dels].filter(id => !validIds.has(id));
      if (staleDels.length > 0) {
        const fresh = new Set([...dels].filter(id => validIds.has(id)));
        setStoredDeletions(fresh);
      }
      return DECK.slides.map(s => s.id);
    }

    return [...stored];
  }

  // =============================================================
  // SIDEBAR
  // =============================================================

  function buildSidebar() {
    slideList.innerHTML = '';
    const order = getEffectiveOrder();
    const deletions = getStoredDeletions();
    const slideById = Object.fromEntries(DECK.slides.map(s => [s.id, s]));

    order.forEach((id, i) => {
      const slide = slideById[id];
      if (!slide) return;
      const row = document.createElement('div');
      row.className = 'slide-item';
      if (deletions.has(id)) row.classList.add('deleted');
      row.dataset.index   = i;
      row.dataset.slideId = id;
      row.draggable = true;
      row.innerHTML =
        `<span class="drag-handle" aria-hidden="true">⠿</span>` +
        `<span class="slide-num">${String(i + 1).padStart(2, '0')}</span>` +
        `<span class="slide-title">${slide.title}</span>` +
        `<span class="edit-dot" hidden aria-label="has edits"></span>` +
        `<button class="row-btn delete-btn" type="button" title="Mark for deletion (toggle)" aria-label="Mark for deletion">✕</button>`;

      // Click to load slide — but ignore clicks on inner controls
      // (i is effective-order position; loadSlide takes the DECK.slides index)
      row.addEventListener('click', e => {
        if (e.target.closest('.delete-btn, .drag-handle')) return;
        const deckIndex = DECK.slides.findIndex(s => s.id === id);
        if (deckIndex >= 0) loadSlide(deckIndex);
      });

      // Delete toggle
      row.querySelector('.delete-btn').addEventListener('click', e => {
        e.stopPropagation();
        toggleDelete(id);
      });

      // Drag-drop
      row.addEventListener('dragstart', onDragStart);
      row.addEventListener('dragover',  onDragOver);
      row.addEventListener('dragleave', onDragLeave);
      row.addEventListener('drop',      onDrop);
      row.addEventListener('dragend',   onDragEnd);

      slideList.appendChild(row);
    });

    // Restore active highlight if the current slide still exists.
    // currentIndex stays as the DECK.slides index — only the visual position changes.
    const activeId = DECK.slides[currentIndex]?.id;
    if (activeId) {
      const activeRow = slideList.querySelector(`[data-slide-id="${activeId}"]`);
      if (activeRow) activeRow.classList.add('active');
    }

    updateSidebarIndicators();
    updateEditCount();
    updatePendingIndicator();
  }

  // =============================================================
  // DRAG & DROP REORDER
  // =============================================================

  function onDragStart(e) {
    draggedId = this.dataset.slideId;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', draggedId); } catch {}
  }

  function onDragOver(e) {
    if (!draggedId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = this.getBoundingClientRect();
    const above = e.clientY < rect.top + rect.height / 2;
    slideList.querySelectorAll('.drop-above, .drop-below').forEach(el => {
      el.classList.remove('drop-above', 'drop-below');
    });
    this.classList.add(above ? 'drop-above' : 'drop-below');
  }

  function onDragLeave() { /* indicator managed by dragover on the new target */ }

  function onDrop(e) {
    e.preventDefault();
    if (!draggedId) return;

    const rect = this.getBoundingClientRect();
    const above = e.clientY < rect.top + rect.height / 2;
    const targetId = this.dataset.slideId;
    if (draggedId === targetId) { onDragEnd(); return; }

    const order = getEffectiveOrder();
    const fromIdx = order.indexOf(draggedId);
    if (fromIdx === -1) { onDragEnd(); return; }

    order.splice(fromIdx, 1);
    const toIdx = order.indexOf(targetId);
    const insertAt = above ? toIdx : toIdx + 1;
    order.splice(insertAt, 0, draggedId);

    setStoredOrder(order);
    onDragEnd();
    buildSidebar();
  }

  function onDragEnd() {
    slideList.querySelectorAll('.dragging, .drop-above, .drop-below').forEach(el => {
      el.classList.remove('dragging', 'drop-above', 'drop-below');
    });
    draggedId = null;
  }

  // =============================================================
  // DELETE TOGGLE
  // =============================================================

  function toggleDelete(slideId) {
    const dels = getStoredDeletions();
    if (dels.has(slideId)) dels.delete(slideId);
    else dels.add(slideId);
    setStoredDeletions(dels);
    buildSidebar();
  }

  function resetOrder() {
    if (!confirm('Reset slide order and clear deletion marks?\n\nContent edits are kept.'))
      return;
    localStorage.removeItem(ORDER_KEY);
    localStorage.removeItem(DELETE_KEY);
    buildSidebar();
  }

  function updatePendingIndicator() {
    const stored = getStoredOrder();
    const dels   = getStoredDeletions();
    let moves = 0;
    if (stored) {
      const original = DECK.slides.map(s => s.id);
      const eff = getEffectiveOrder();
      moves = eff.reduce((n, id, i) => n + (original[i] !== id ? 1 : 0), 0);
    }
    const total = moves + dels.size;
    const saveBtn = document.getElementById('btn-save-order');
    if (total === 0) {
      pendingEl.hidden = true;
      pendingEl.textContent = '';
      saveBtn.classList.remove('primary');
    } else {
      const parts = [];
      if (moves > 0)   parts.push(`${moves} moved`);
      if (dels.size)   parts.push(`${dels.size} to delete`);
      pendingEl.hidden = false;
      pendingEl.textContent = parts.join(' · ');
      saveBtn.classList.add('primary');
    }
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

    // Highlight active row by slide id (NodeList order != DECK order after reorder)
    document.querySelectorAll('.slide-item').forEach(item => {
      item.classList.toggle('active', item.dataset.slideId === slide.id);
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
    document.getElementById('btn-save-order').addEventListener('click', openSaveModal);
    document.getElementById('btn-reset-order').addEventListener('click', resetOrder);

    // Save Order modal wiring
    document.getElementById('btn-modal-cancel').addEventListener('click', closeSaveModal);
    document.getElementById('btn-modal-download').addEventListener('click', downloadSpec);
    document.getElementById('btn-modal-copy').addEventListener('click', copyClaudePrompt);
    document.getElementById('save-modal').addEventListener('click', e => {
      if (e.target.id === 'save-modal') closeSaveModal();
    });
  }

  // =============================================================
  // SAVE ORDER MODAL — generate spec + Claude prompt
  // =============================================================

  /** Build the change spec object. */
  function buildSpec() {
    const original = DECK.slides.map(s => s.id);
    const effective = getEffectiveOrder();
    const dels = getStoredDeletions();
    const slideById = Object.fromEntries(DECK.slides.map(s => [s.id, s]));

    const kept = effective.filter(id => !dels.has(id));
    const newOrder = kept.map((id, i) => ({
      slot:  i + 1,
      id:    id,
      title: slideById[id]?.title || '',
      tag:   slideById[id]?.tag   || '',
      from_slot: original.indexOf(id) + 1,
    }));

    const deletedList = [...dels].map(id => ({
      id:    id,
      title: slideById[id]?.title || '',
      from_slot: original.indexOf(id) + 1,
    }));

    return {
      generated_at: new Date().toISOString(),
      deck_version: DECK.version || 'unknown',
      total_slides: kept.length,
      order: newOrder,
      deletions: deletedList,
    };
  }

  function hasPendingChanges() {
    const stored = getStoredOrder();
    const dels = getStoredDeletions();
    if (dels.size > 0) return true;
    if (!stored) return false;
    const original = DECK.slides.map(s => s.id);
    const eff = getEffectiveOrder();
    return eff.some((id, i) => original[i] !== id);
  }

  function openSaveModal() {
    if (!hasPendingChanges()) {
      alert('No reorder or deletion changes to apply.\n\nDrag slides in the sidebar or click ✕ to mark for deletion.');
      return;
    }
    const spec = buildSpec();

    // Summary
    const summary = document.getElementById('changes-summary');
    const moves = spec.order.filter(o => o.from_slot !== o.slot).length;
    summary.innerHTML =
      `<span class="lab">Final size</span><span class="val">${spec.total_slides} slides</span>` +
      `<span class="lab">Moved</span><span class="val">${moves}</span>` +
      `<span class="lab">Deleted</span><span class="val">${spec.deletions.length}</span>` +
      `<span class="lab">Source ver</span><span class="val">${spec.deck_version}</span>`;

    // Spec preview
    document.getElementById('save-modal-spec').textContent = JSON.stringify(spec, null, 2);

    document.getElementById('save-modal').classList.add('open');
  }

  function closeSaveModal() {
    document.getElementById('save-modal').classList.remove('open');
  }

  function downloadSpec() {
    const spec = buildSpec();
    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deck-changes.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    closeSaveModal();
  }

  function buildClaudePrompt(spec) {
    const lines = [];
    lines.push('Apply this slide reorder/delete spec to the deck. Use the standard reorder pipeline (stage to slides_new/, renumber chrome, fix cross-refs, rewrite manifest, rebuild content.json with edit preservation, commit & push).');
    lines.push('');
    lines.push('## Final order');
    lines.push('');
    lines.push('| Slot | Slide ID | Title | From slot |');
    lines.push('|---|---|---|---|');
    spec.order.forEach(o => {
      const from = o.from_slot ? String(o.from_slot).padStart(2, '0') : '—';
      lines.push(`| ${String(o.slot).padStart(2, '0')} | ${o.id} | ${o.title} | ${from} |`);
    });

    if (spec.deletions.length > 0) {
      lines.push('');
      lines.push('## Slides to delete');
      lines.push('');
      lines.push('| Slide ID | Title | Was at slot |');
      lines.push('|---|---|---|');
      spec.deletions.forEach(d => {
        lines.push(`| ${d.id} | ${d.title} | ${String(d.from_slot).padStart(2, '0')} |`);
      });
      lines.push('');
      lines.push('Confirm before removing files — these may be backup-worthy.');
    }
    lines.push('');
    lines.push(`Total ${spec.total_slides} slides post-reorder. Source manifest version: ${spec.deck_version}.`);
    return lines.join('\n');
  }

  async function copyClaudePrompt() {
    const spec = buildSpec();
    const text = buildClaudePrompt(spec);
    try {
      await navigator.clipboard.writeText(text);
      const btn = document.getElementById('btn-modal-copy');
      const orig = btn.textContent;
      btn.textContent = 'Copied ✓';
      setTimeout(() => { btn.textContent = orig; }, 1400);
    } catch (err) {
      alert('Could not copy to clipboard: ' + err.message + '\n\nThe prompt is in the spec preview below — copy it manually.');
    }
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
