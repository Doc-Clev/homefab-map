/* ============================================================
   HOST CONTROLLER
   - Loads slides into iframe by index
   - Keyboard nav: ←/→ ↑/↓ space, Esc/i for index, ? for help
   - URL hash sync: #s=3 deep-links to slide 4 (zero-indexed)
   - Auto-scale 1600x900 canvas to viewport
   ============================================================ */

(function () {
  const $ = (sel) => document.querySelector(sel);
  const slides = window.DECK.slides;
  let current = 0;

  // --- DOM refs
  const frame      = $("#slide-frame");
  const counter    = $("#counter");
  const titleEl    = $("#deck-title-current");
  const progressEl = $("#progress-fill");
  const prevBtn    = $("#prev");
  const nextBtn    = $("#next");
  const scaler     = $("#scaler");
  const indexEl    = $("#index-overlay");
  const indexGrid  = $("#index-grid");
  const helpEl     = $("#help");

  // --- Scale-to-fit logic. Slide canvas is 1600x900.
  function rescale() {
    const padding = 80;          // breathing room around slide
    const topbarH = 48;
    const availW = window.innerWidth - padding;
    const availH = window.innerHeight - topbarH - padding;
    const scale = Math.min(availW / 1600, availH / 900);
    scaler.style.transform = `scale(${scale})`;
  }
  window.addEventListener("resize", rescale);

  // --- Render the slide grid index
  function buildIndex() {
    indexGrid.innerHTML = slides.map((s, i) => `
      <div class="index-card ${s.live ? 'live' : ''}" data-i="${i}">
        <div>
          <div class="num">${String(i + 1).padStart(2, '0')}</div>
        </div>
        <div>
          <div class="tag">${s.tag}</div>
          <div class="title">${s.title}</div>
        </div>
      </div>
    `).join("");
    indexGrid.querySelectorAll(".index-card").forEach(card => {
      card.addEventListener("click", () => {
        go(parseInt(card.dataset.i, 10));
        closeIndex();
      });
    });
  }

  // --- Slide loading
  function go(i) {
    if (i < 0 || i >= slides.length) return;
    current = i;
    const s = slides[i];

    // crossfade
    frame.style.opacity = "0";
    setTimeout(() => {
      frame.src = s.file;
      frame.onload = () => { frame.style.opacity = "1"; };
    }, 120);

    // chrome update
    counter.textContent = `${String(i + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    titleEl.textContent = s.title;
    progressEl.style.width = `${((i + 1) / slides.length) * 100}%`;
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === slides.length - 1;

    // hash sync
    history.replaceState(null, "", `#s=${i}`);
  }

  function next() { go(Math.min(current + 1, slides.length - 1)); }
  function prev() { go(Math.max(current - 1, 0)); }

  // --- Index overlay
  function openIndex()  { indexEl.classList.add("open"); }
  function closeIndex() { indexEl.classList.remove("open"); }
  function toggleIndex(){ indexEl.classList.toggle("open"); }

  // --- Help toast
  let helpTimer;
  function flashHelp() {
    helpEl.classList.add("show");
    clearTimeout(helpTimer);
    helpTimer = setTimeout(() => helpEl.classList.remove("show"), 2400);
  }

  // --- Keyboard
  document.addEventListener("keydown", (e) => {
    // Ignore if typing in an input (in case future slides have forms)
    if (["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName)) return;

    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
      case " ":
      case "PageDown":
        e.preventDefault(); next(); break;
      case "ArrowLeft":
      case "ArrowUp":
      case "PageUp":
        e.preventDefault(); prev(); break;
      case "Home":
        e.preventDefault(); go(0); break;
      case "End":
        e.preventDefault(); go(slides.length - 1); break;
      case "Escape":
      case "i":
      case "I":
        e.preventDefault(); toggleIndex(); break;
      case "?":
      case "h":
      case "H":
        e.preventDefault(); flashHelp(); break;
      case "f":
      case "F":
        e.preventDefault();
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
        break;
    }
  });

  // --- Click handlers
  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);
  $("#open-index").addEventListener("click", openIndex);
  $("#close-index").addEventListener("click", closeIndex);
  $("#fullscreen").addEventListener("click", () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  });

  // --- Init from hash
  function initFromHash() {
    const m = location.hash.match(/s=(\d+)/);
    return m ? Math.max(0, Math.min(parseInt(m[1], 10), slides.length - 1)) : 0;
  }

  // --- Boot
  buildIndex();
  rescale();
  go(initFromHash());
  setTimeout(flashHelp, 600);
})();
