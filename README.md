# HomeFab Expansion Map — Integrated Financial Model

An interactive, editable map of HomeFab's 10-year US expansion, with a live financial dashboard that aggregates per-site economics across both business units: **FBX Core** (warehousing & distribution) and **FBX Fab-Home** (franchise factories).

## Files

- `index.html` — the all-in-one editor: map, financial dashboard, cities table, hubs table, assumption controls
- `sites.json` — canonical data file containing sites + hubs + financial assumptions
- `README.md` — this file

## Publishing to GitHub Pages

1. Create a public GitHub repo (e.g. `homefab-map`)
2. Upload all three files to the root
3. Settings → Pages → Deploy from branch `main`, folder `/ (root)` → Save
4. Your URL: `https://Doc-Clev.github.io/homefab-map/index.html`

## Embedding in Canva

Elements → Embed → paste your GitHub Pages URL. The interactive map + dashboard render live.

## What's on the page

### Financial dashboard (top)
Two bold side-by-side panels that update as you drag the year slider:

**FBX Core** (teal) — warehousing & distribution
Cumulative revenue, operating profit, kit sales, royalty income, CAPEX committed, hubs operating, homes shipped, ROI

**FBX Fab-Home** (amber) — franchise factory network
Cumulative revenue, net income, annual run-rate, Fab count, CAPEX committed, states covered, homes delivered, ROI

### Global assumptions panel
Click the ⚙ button to expose flex controls:
- **Fab-Home defaults**: Fab CAPEX ($M), home revenue ($K), Fab margin (%)
- **Core defaults**: hub CAPEX, kit price to Fabs, Core margin on kits, royalty %, Core opex %

Change any number and the whole dashboard + tables recalculate instantly.

### Map
- Fab dots colored by phase (green / amber / red)
- 4 FBX Core hub diamonds in teal
- Toggle "Show hub→Fab routes" for nearest-hub visualization
- Hover any marker for details

### Fab sites table
Every row is inline-editable. Columns: Year, Phase, City, State, Lat, Lon, **CAPEX** (override $M), **Rev** (override $K), **Mgn** (override %), **Hub** (auto-assigned). Blank overrides use global defaults; filled overrides show in bold amber.

### Hubs table
Edit each of the 4 strategic hubs: name, city, state, lat/lon, CAPEX override, opening year. "Fabs" column shows how many sites route to each hub.

## Editing workflows

### Quick edits — modify `sites.json` on GitHub directly

The file is human-readable JSON:
```json
{
  "version": 2,
  "sites": [
    { "yr":1, "phase":1, "name":"Los Angeles", "state":"CA",
      "lat":34.05, "lon":-118.24,
      "capex": 3.5,         // optional override ($M)
      "rev_per_home": 200,  // optional override ($K)
      "margin_pct": 20      // optional override (%)
    }
  ],
  "hubs": [
    { "name":"West Coast Core", "city":"Stockton", "state":"CA",
      "lat":37.96, "lon":-121.29, "capex":15, "opens_yr":1 }
  ],
  "assumptions": {
    "fab_capex_M":3, "rev_per_home_K":180, "fab_margin_pct":22,
    "hub_capex_M":15, "kit_price_K":72, "core_margin_pct":28,
    "royalty_pct":8, "core_opex_pct":15
  }
}
```

Commit to GitHub, wait 1–2 minutes for Pages to update.

### Visual editing — use the UI
1. Open the published URL
2. Edit anything — rows, assumptions, hubs
3. All changes save to browser localStorage automatically
4. Click **Export JSON** to download the combined file
5. Replace `sites.json` in the repo with the export

## Economics model

### Per-Fab output ramp
- Phase 1: 180 homes/yr mature
- Phase 2: 240 homes/yr mature
- Phase 3: 320 → 400 homes/yr (scales by opening year)
- Opening year contributes half mature output (mid-year average)

### Per-home revenue split (defaults)
- $180K home sale → Fab revenue
- $72K kit COGS → paid to Core
- $14.4K royalty (8%) → paid to Core
- Remainder → Fab labor, overhead, margin (22%)

### Core economics
Revenue = kit sales + royalty · Gross profit on kits = kit sales × 28% · Opex = revenue × 15% · Operating profit = kit GP + royalty − opex

### Fab-Home economics
Revenue = homes × $180K · Net income = revenue × 22% · CAPEX = $3M per Fab

### Hub assignment
Each Fab is assigned to its nearest **active** Core hub by haversine distance. A hub is active when `opens_yr ≤ current year`.

## Data source indicator

Badge next to the title:
- **Synced with sites.json** — view matches published file
- **Local edits (not saved to source)** — unsaved changes in this browser
- **Using built-in defaults** — sites.json not found (e.g. opened as `file://`)

**↻ Reload from source** button discards local edits and re-fetches `sites.json`.
