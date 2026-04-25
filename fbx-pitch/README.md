# FBX HomeFab — Investor Deck

A multi-file HTML deck framework for the FBX HomeFab investor pitch. Designed to host your existing live tools (Expansion Map, Fishbone) alongside narrative slides, and to be extended in Claude Code as the pitch evolves.

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
│   ├── … 14 slides total …
│   ├── 10-fishbone.html    ← embeds /tools/fishbone.html
│   └── 11-expansion-map.html ← embeds /tools/expansion-map.html
├── tools/
│   ├── expansion-map.html  ← REPLACE with your real map
│   └── fishbone.html       ← REPLACE with your real fishbone
└── assets/                 ← (empty — drop images/logos here)
```

### Why this structure

- **`index.html` is a shell, not a slide.** It loads each slide into an iframe so slides stay self-contained and you can iterate on one without touching the others.
- **Each slide is its own HTML file** at exactly 1600×900. The host scales the canvas to fit any viewport. This means you design at fixed pixels and never fight responsive math.
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
Open slides/11-expansion-map.html
Find: src="../tools/expansion-map.html"
Change to: src="https://homefab-map.onrender.com/"
```

### Fishbone

Same pattern — replace `/tools/fishbone.html` with your fishbone HTML, or update the `src` in `slides/10-fishbone.html` to your hosted URL.

## Adding a new slide

1. Create `slides/15-my-new-slide.html` (copy any existing slide as a starting template).
2. Add an entry to `js/manifest.js`:

```js
{
  id: "15-my-new-slide",
  file: "slides/15-my-new-slide.html",
  title: "My New Slide",
  tag: "Custom",
  live: false
}
```

That's it. The slide appears in the deck and the index overlay automatically.

## Design system

All design tokens live in `css/core.css` as CSS custom properties:

- **Colors**: `--ink`, `--paper`, `--signal` (red), `--moss`, `--clay`, `--gold`
- **Type**: `--display` (Fraunces), `--body` (Inter Tight), `--mono` (JetBrains Mono)
- **Slide canvas**: `--slide-w: 1600px`, `--slide-h: 900px`, `--gutter: 72px`

Slide variants:
- `<section class="slide">` — paper background, ink text (default)
- `<section class="slide dark">` — ink background, paper text
- `<section class="slide signal">` — red background, paper text

## Claude Code workflow tips

- Each slide is small enough (~150 lines) to fit in a single Claude Code edit.
- The `manifest.js` array tells you exactly which file maps to which slide number.
- When you're iterating on copy or numbers, work at the slide-file level — don't touch the host.
- When you're rewiring tools, only edit the `src` in the `slides/10-` and `slides/11-` files, not the tool files themselves.
- `assets/` is empty by design — drop logos, founder photos, product renders here and reference them from any slide as `../assets/your-file.png`.

## Build / deploy

There's no build step. Drop the whole folder on any static host (Render, Netlify, Vercel, GitHub Pages, S3+CloudFront).

For Render, the same instance can serve both this deck and your existing `homefab-map.onrender.com` if you put them at different paths and update the iframe `src` accordingly.
