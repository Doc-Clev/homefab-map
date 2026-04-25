/* ============================================================
   SLIDE-LEVEL UTILITIES
   Small helper for slides that load inside the iframe.
   Triggers .is-active on the slide root after a tick so the
   .reveal animations play on every load.
   ============================================================ */

(function () {
  function activate() {
    document.querySelectorAll(".slide").forEach(s => s.classList.add("is-active"));
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => requestAnimationFrame(activate));
  } else {
    requestAnimationFrame(activate);
  }
})();
