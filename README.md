# HomeFab Expansion Map

An interactive, editable map of HomeFab's 10-year US expansion. The map and the city data are decoupled — update `sites.json` to change the map, without touching any code.

## Files in this repo

- `index.html` — the editor UI (map + editable table, all-in-one)
- `sites.json` — the canonical list of 141 cities (year, phase, name, state, lat, lon)
- `README.md` — this file

## Publishing to GitHub Pages

1. Create a new public repo on GitHub (e.g. `homefab-map`)
2. Upload both `index.html` and `sites.json` to the root of the repo
3. Go to **Settings → Pages**
4. Under **Source**, select **Deploy from a branch**, choose branch `main` and folder `/ (root)`
5. Click **Save**. Wait 1–2 minutes.
6. Your published URL will be:
   `https://YOUR-USERNAME.github.io/homefab-map/`

## Embedding in Canva

1. In Canva: **Elements → Embed**
2. Paste your GitHub Pages URL
3. Click **Embed**

The live map renders inside your Canva deck. Interactive during presentations.

## Editing the city list

There are two ways to edit cities, depending on whether you want the changes to be permanent (visible to everyone) or local (just on your browser).

### For permanent changes — edit `sites.json` on GitHub

This is the canonical list. Whatever's in this file is what everyone sees.

1. In your GitHub repo, click `sites.json`
2. Click the pencil icon (Edit this file) in the top-right
3. Each city is a JSON object like:
   ```json
   {
     "yr": 3,
     "phase": 2,
     "name": "Dallas-Ft Worth",
     "state": "TX",
     "lat": 32.78,
     "lon": -96.80
   }
   ```
4. Edit, add, or remove cities. Keep the JSON valid (commas between entries, square brackets around the whole list).
5. Scroll down and click **Commit changes**
6. Within 1–2 minutes, your published Pages site will show the updates

**Tip:** if you're editing a lot at once, easier to use the editor UI (below) to make changes visually, then **Export JSON** and replace `sites.json` in the repo.

### For experimentation — use the editor UI

Visit your published URL (or open `index.html` locally).

- Edit any field in the city table — the map updates live
- Add cities with the form at the bottom (lat/lon auto-fills for major US cities)
- Drag the `⋮⋮` handles to reorder
- Your edits save to your browser's localStorage automatically — they survive reloads
- When you're ready to publish: click **Export JSON** and replace `sites.json` in the repo

The indicator badge next to the title tells you where your current view comes from:

- **Synced with sites.json** — what you see matches the published file
- **Local edits (not saved to source)** — you've made changes that aren't in sites.json yet
- **Using built-in defaults** — couldn't find sites.json (falling back to the 141 cities baked into the HTML)

## Data format reference

`sites.json` is a JSON array. Each entry has:

| Field | Type | Notes |
|-------|------|-------|
| `yr` | integer 1–10 | Year the HomeFab opens (relative to Year 1 = 2026) |
| `phase` | integer 1–3 | 1 = California pilot, 2 = key markets, 3 = national scale |
| `name` | string | City or metro name |
| `state` | string | 2-letter US state abbreviation |
| `lat` | number | Latitude (decimal degrees) |
| `lon` | number | Longitude (decimal degrees, negative for western hemisphere) |

## How the loading priority works

When the editor loads:

1. It fetches `sites.json` (with a cache-buster so you always get the latest)
2. If you have local edits in your browser that differ from `sites.json`, you're prompted: keep local edits, or load the fresh list from source
3. If the fetch fails (e.g. opened as `file://` rather than via a web server), it falls back to your local edits, then to the 141 built-in defaults

Click **↻ Reload from source** anytime to discard local edits and pull the latest `sites.json`.
