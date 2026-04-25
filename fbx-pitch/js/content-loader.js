/* ============================================================
   CONTENT LOADER
   - Fetches content.json (the source of truth on disk)
   - Layers localStorage overrides on top (drafts beat the file)
   - Replaces innerHTML of every element with [data-content="key"]
   - Fires "fbx:content-applied" when done so admin UIs can hook in
   - If content.json fails to load, leaves the HTML defaults in place
   ============================================================ */

(function () {
  const STORAGE_KEY = "fbx-content-overrides";

  function getOverrides() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn("[fbx] could not read content overrides:", e);
      return {};
    }
  }

  function lookupKey(content, slideId, fieldKey) {
    if (!content || !content[slideId]) return undefined;
    return content[slideId][fieldKey];
  }

  function applyContent(content, overrides) {
    const els = document.querySelectorAll("[data-content]");
    els.forEach(el => {
      const path = el.getAttribute("data-content");        // "slide-id.field.name"
      const dot = path.indexOf(".");
      if (dot < 0) return;
      const slideId  = path.slice(0, dot);
      const fieldKey = path.slice(dot + 1);

      // Override beats file
      const overrideVal = lookupKey(overrides, slideId, fieldKey);
      const fileVal     = lookupKey(content, slideId, fieldKey);
      const value = (overrideVal !== undefined) ? overrideVal : fileVal;

      if (value !== undefined && value !== null) {
        // We use innerHTML (not textContent) so authors can use simple inline
        // tags like <em>, <strong>, <br> in their copy. Caller controls the
        // file; this is an authoring tool, not user input.
        el.innerHTML = value;
      }
    });
    document.dispatchEvent(new CustomEvent("fbx:content-applied", {
      detail: { slideCount: els.length }
    }));
  }

  // Slides are loaded inside an iframe whose path is something like
  // /slides/04-opportunity.html — so the content.json sits two levels up
  // from a slide, but one level up from /admin/. We try a couple of paths.
  async function loadContent() {
    const candidates = [
      "../content.json",
      "./content.json",
      "/content.json"
    ];
    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: "no-cache" });
        if (res.ok) return await res.json();
      } catch (e) { /* try next */ }
    }
    console.warn("[fbx] content.json not found; using HTML defaults");
    return null;
  }

  // ---- Boot
  async function init() {
    const content = await loadContent();
    const overrides = getOverrides();
    if (content || Object.keys(overrides).length) {
      applyContent(content || {}, overrides);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose a small API so the admin can re-apply after edits without
  // a full reload of the slide iframe.
  window.FBXContent = {
    reapply: async function (overridesOverride) {
      const content = await loadContent();
      const overrides = overridesOverride || getOverrides();
      applyContent(content || {}, overrides);
    },
    getOverrides,
    setOverrides(obj) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
      } catch (e) { console.error("[fbx] could not save overrides:", e); }
    },
    clearOverrides() {
      localStorage.removeItem(STORAGE_KEY);
    }
  };
})();
