# FBX HomeFab — Investor Deck

A multi-file HTML deck framework for the FBX HomeFab investor pitch. Designed to host your existing live tools (Expansion Map, Fishbone) alongside narrative and strategy slides, and to be extended in Claude Code as the pitch evolves.

**Current version: v0.2** — adds the Strategy section (slides 06–08: Momentum, The Four Moats, Precedent), red treatment on slide 04, fixed iPad/tablet scaling.

## Quick start

```bash
# From the project root, serve over HTTP (iframes need a real origin):
python3 -m http.server 8000
# then open http://localhost:8000/
```

Don't open `index.html` directly with `file://` — iframe `src` paths and the live-tool fallback probe both require `http://`.

## Controls

| Key | Action |
|---|---|
| `←` `→` `↑` `↓` `Space` | Previous / next slide |
| `Home` `End` | First / last slide |
| `i` or `Esc` | Toggle slide index |
| `f` | Fullscreen |
| `?` | Show keyboard help |

URL `#s=N` deep-links to slide N (zero-indexed).

## The 17-slide deck

| # | Section | Slide |
|---|---|---|
| 01 | Cover | Scaled Housing Factories |
| 02 | Thesis | Three networks, one operating system |
| 03 | Market | Trends indicate growth |
| 04 | Opportunity | The Last Mile Franchise *(red treatment)* |
| 05 | Strategy | Why this wins (3 pre-existing assets) |
| **06** | **Strategy** | **Momentum is the strategy** *(new in v0.2)* |
| **07** | **Strategy** | **The Four Moats — NFX framework** *(new in v0.2)* |
| **08** | **Strategy** | **Every great moat started as momentum** *(new in v0.2)* |
| 09 | Operating Model | First Mile |
| 10 | Product | Panels & Pod Kit of Parts |
| 11 | Operating Model | Distribution |
| 12 | Operating Model | Construction Workforce |
| 13 | Live Tool | Fishbone *(iframe → tools/fishbone.html)* |
| 14 | Live Tool | Expansion Map *(iframe → tools/expansion-map.html)* |
| 15 | Financials | Year-10 Economics |
| 16 | Diligence | Objections & Answers |
| 17 | Close | The Ask *(red treatment)* |

## Architecture

```
fbx-pitch/
├── index.html              ← Host shell (loads slides into iframe)
├── css/
│   ├── core.css            ← Design system shared by all slides
│   └── host.css            ← Host chrome (top bar, nav, index overlay)
├── js/
│   ├── manifest.js         ← Slide order — single source of truth
│   ├── host.js             ← Navigation, scaling, keyboard
│   └── slide.js            ← Per-slide animation trigger
├── slides/
│   ├── 01-cover.html
│   ├── 02-thesis.html
│   ├── … 17 slides total …
│   ├── 13-fishbone.html    ← embeds /tools/fishbone.html
│   └── 14-expansion-map.html ← embeds /tools/expansion-map.html
├── tools/
│   ├── expansion-map.html  ← REPLACE with your real map
│   └── fishbone.html       ← REPLACE with your real fishbone
└── assets/                 ← (empty — drop images/logos here)
```

### Why this structure

- **`index.html` is a shell, not a slide.** It loads each slide into an iframe so slides stay self-contained and you can iterate on one without touching the others.
- **Each slide is its own HTML file** at exactly 1600×900. The host scales the canvas to fit any viewport using transform from top-left + computed translate (this is the v0.2 fix — earlier versions bled on iPad). This means you design at fixed pixels and never fight responsive math.
- **`manifest.js` is the deck order.** To reorder, rename, or add slides, edit that one file.
- **`tools/` is for embedded live HTML.** The two live-tool slides probe their iframe sources on load — if a tool isn't wired up yet, they show a clear "not yet linked" panel pointing to the file path.

## Wiring up your existing tools

### Expansion Map

Two options:

**Option A — Drop in the files (works offline, full control)**
```
Replace /tools/expansion-map.html with your existing map's index.html.
Copy sites.json and any other assets it needs into /tools/.
Update relative paths inside that file if needed.
```

**Option B — Point at your hosted version**
```
Open slides/14-expansion-map.html
Find: src="../tools/expansion-map.html"
Change to: src="https://homefab-map.onrender.com/"
```

### Fishbone

Same pattern — replace `/tools/fishbone.html` with your fishbone HTML, or update the `src` in `slides/13-fishbone.html` to your hosted URL.

## Adding a new slide

1. Create `slides/18-my-new-slide.html` (copy any existing slide as a starting template).
2. Add an entry to `js/manifest.js`:

```js
{
  id: "18-my-new-slide",
  file: "slides/18-my-new-slide.html",
  title: "My New Slide",
  tag: "Custom",
  live: false
}
```

3. Update the eyebrow `<span>` text and the `<span class="page-no">` in your new file to show "18".

That's it. The slide appears in the deck and the index overlay automatically.

## Inserting a slide between existing ones

If you need to insert a slide at, say, position 10:

1. Rename existing slides 10–17 → 11–18 (use the bash pattern: rename in reverse to avoid collisions).
2. Inside each renamed file, update the eyebrow span (e.g. `<span>10 ·` → `<span>11 ·`) and page-no span.
3. Update any cross-references inside slide bodies (e.g. "see slide 14" pointers).
4. Add the new slide to `manifest.js` in the right position and renumber subsequent entries.

There's a working example of this in v0.2 — slides 06-08 were inserted, and slides 06-14 became 09-17. The git history shows the pattern.

## Design system

All design tokens live in `css/core.css` as CSS custom properties:

- **Colors**: `--ink`, `--paper`, `--signal` (red), `--moss`, `--clay`, `--gold`
- **Type**: `--display` (Fraunces), `--body` (Inter Tight), `--mono` (JetBrains Mono)
- **Slide canvas**: `--slide-w: 1600px`, `--slide-h: 900px`, `--gutter: 72px`

Slide variants:
- `<section class="slide">` — paper background, ink text (default)
- `<section class="slide dark">` — ink background, paper text
- `<section class="slide signal">` — red background, paper text (used for slide 17 Ask)
- `<section class="slide opp">` — red+ink hybrid (used for slide 04 Opportunity in v0.2)

The Opportunity and Ask slides use *different* red treatments deliberately — the Opportunity is a section opener with ink text and dark bottom band, the Ask is a closing finale with paper text on full-bleed red.

## Strategy section (slides 06-08) — content notes

These slides are the strategic backbone of the pitch. Their argument is:

- **06 (Momentum):** Moats don't exist on Day 0. They emerge from accumulated scale. Therefore: momentum is the *strategy*, the moat is the *consequence*.
- **07 (Four Moats):** NFX framework — network effects, scale economies, brand, embedding — each mapped specifically to FBX's franchise/kit/distribution model.
- **08 (Precedent):** Amazon, Airbnb, Booking.com all earned their moats *through* momentum. FBX is following the same playbook in a category nobody has structured this way.

The objection slide (16) deliberately points back to slides 06-08 for the moat answer rather than restating it. If you want to expand or reorder this section, the content lives inline in each HTML file.

## Claude Code workflow tips

- Each slide is small enough (~150-200 lines) to fit in a single Claude Code edit.
- The `manifest.js` array tells you exactly which file maps to which slide number.
- When you're iterating on copy or numbers, work at the slide-file level — don't touch the host.
- When you're rewiring tools, only edit the `src` in `slides/13-fishbone.html` and `slides/14-expansion-map.html`, not the tool files themselves.
- `assets/` is empty by design — drop logos, founder photos, product renders here and reference them from any slide as `../assets/your-file.png`.

## Build / deploy

There's no build step. Drop the whole folder on any static host (Render, Netlify, Vercel, GitHub Pages, S3+CloudFront).

For Render, the same instance can serve both this deck and your existing `homefab-map.onrender.com` if you put them at different paths and update the iframe `src` accordingly.

## Changelog

**v0.2** (this version)
- Added Strategy section: slides 06 (Momentum), 07 (Four Moats / NFX), 08 (Precedent)
- Renumbered slides 06-14 (v0.1) → 09-17 (v0.2)
- Slide 04 (Opportunity) converted from dark navy to red treatment with ink headline + dark anchor band
- Fixed iPad/tablet right-edge bleed (transform-origin + computed translate centering)
- Stage now sits below topbar, nav arrows reposition with stage
- Slide 16 (Objections) moat answer now references strategy section
- Total slides: 14 → 17

**v0.1** — initial 14-slide framework
