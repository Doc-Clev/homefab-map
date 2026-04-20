# HomeFab Expansion Map & Fishbone — Integrated Strategic Model

Two interactive, editable strategic artifacts for HomeFab's 10-year US expansion and operating model, sharing a single repo and deployment target.

**Expansion Map** — a geographic + financial dashboard of US Fab rollout across both business units: FBX Core (warehousing & distribution) and FBX Fab-Home (franchise factories).

**Fishbone** — a value-chain Ishikawa diagram of the three business units (First Mile, FBX Core, Last Mile) showing their constituent functions, inter-BU flows, and consolidated economics.

---

## Files

### Expansion Map
- `index.html` — editor: map, financial dashboard, cities table, hubs table, assumption controls
- `sites.json` — canonical data file: sites + hubs + financial assumptions

### Fishbone
- `fishbone.html` — public read-only viewer (unauthenticated GitHub reads, version dropdown, hover explainers with optional financial breakdown)
- `fishbone-editor.html` — private editor (PAT-gated, full editing of BUs, functions, financials, and prose descriptions)
- `fishbone.json` — canonical fishbone data: BUs, functions, financial inputs, volume assumptions, inter-BU elimination rules, products list

### Shared
- `README.md` — this file

---

## Publishing to GitHub Pages

1. Create a public GitHub repo (e.g. `homefab-map`)
2. Upload all files to the root
3. Settings → Pages → Deploy from branch `main`, folder `/` (root) → Save
4. Your URLs:
   - Expansion map: `https://Doc-Clev.github.io/homefab-map/index.html`
   - Fishbone (public): `https://Doc-Clev.github.io/homefab-map/fishbone.html`
   - Fishbone (editor): `https://Doc-Clev.github.io/homefab-map/fishbone-editor.html`

## Embedding in Canva

Elements → Embed → paste any of the GitHub Pages URLs above. The interactive artifact renders live.

---

## What's on the Expansion Map page

### Financial dashboard (top)
Two bold side-by-side panels that update as you drag the year slider:

- **FBX Core (teal)** — warehousing & distribution. Cumulative revenue, operating profit, kit sales, royalty income, CAPEX committed, hubs operating, homes shipped, ROI
- **FBX Fab-Home (amber)** — franchise factory network. Cumulative revenue, net income, annual run-rate, Fab count, CAPEX committed, states covered, homes delivered, ROI

### Global assumptions panel
Click the ⚙ button to expose flex controls:

- Fab-Home defaults: Fab CAPEX ($M), home revenue ($K), Fab margin (%)
- Core defaults: hub CAPEX, kit price to Fabs, Core margin on kits, royalty %, Core opex %

Change any number and the whole dashboard + tables recalculate instantly.

### Map
- Fab dots colored by phase (green / amber / red)
- 4 FBX Core hub diamonds in teal
- Toggle "Show hub→Fab routes" for nearest-hub visualization
- Hover any marker for details

### Fab sites table
Every row is inline-editable. Columns: Year, Phase, City, State, Lat, Lon, CAPEX override ($M), Rev override ($K), Mgn override (%), Hub (auto-assigned). Blank overrides use global defaults; filled overrides show in bold amber.

### Hubs table
Edit each of the 4 strategic hubs: name, city, state, lat/lon, CAPEX override, opening year. "Fabs" column shows how many sites route to each hub.

---

## What's on the Fishbone page

### Diagram
Classic Ishikawa (fishbone) layout, left-to-right:

- **Products box** (left end of spine) — ADUs, High Density Multi-Family, Bathroom Pods, SIPs
- **Horizontal spine** running through the middle
- **Three BU zones** separated by dashed vertical dividers, each with a colored pill label at top:
  - First Mile (green) — entitlement, finance, design, home sales, franchise sales, licensing fees, building contracts
  - FBX Core (amber) — import, warehousing, KoP creation, component sales, training, R&D, distribution
  - Last Mile (red) — assembly, delivery logistics, installation, inspections
- **Oblique function bones** fanning off the spine (top and bottom), tilted 22° away from the effect in classic Ishikawa orientation
- **Customer ownership band** along the top showing who owns the buyer at each stage: Sales through First Mile + Core, GC at Last Mile
- **Effect arrow + box** (right end) — "Delivered Home on Bare Land"
- **Handoff labels** below the dividers marking the two commercial transitions: "contract signed → kit ordered" and "kit shipped → site work begins"

### Hover explainer
Hover any BU label or function stub for a detail panel with markdown description. Click to pin. Toggle the "Show financials" button to reveal per-unit numbers, annualized revenue/cost, margin, headcount, and time-in-phase.

### Roll-up sidebar (right)
Three BU P&Ls + a consolidated view showing:
- Gross revenue (sum of all three BUs standalone)
- Eliminations (inter-BU flows: KoP revenue, licensing royalties)
- Consolidated revenue (real external money flowing into FBX)
- Consolidated cost and margin

### Editor-only features
- Left sidebar: editable diagram head, product list, volume assumptions (homes/yr, contracts/yr, franchises/yr with optional map-sync), per-BU function list with reordering
- Right pane: detail editor for the selected BU or function (name, basis, revenue, cost, external %, headcount, time, markdown description)
- Inline **"+ add input"** prompt at the end of each BU's function column — click to add a new function with smart defaults
- Import / Export JSON, GitHub save with named versions, version dropdown, `?v=<sha>` deep-link, PAT settings

---

## Editing workflows

### Quick edits — modify JSON directly on GitHub

Both `sites.json` and `fishbone.json` are human-readable:

**sites.json:**
```json
{
  "version": 2,
  "sites": [
    { "yr":1, "phase":1, "name":"Los Angeles", "state":"CA",
      "lat":34.05, "lon":-118.24,
      "capex": 3.5,
      "rev_per_home": 200,
      "margin_pct": 20
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

**fishbone.json:**
```json
{
  "head": "Delivered Home on Bare Land",
  "products": ["ADUs", "High Density Multi-Family", "Bathroom Pods", "SIPs"],
  "volume": {
    "homes_per_year": 100,
    "contracts_per_year": 100,
    "franchises_per_year": 4,
    "franchises_from_map": true
  },
  "bus": [
    {
      "id": "first_mile", "name": "First Mile", "color_var": "--p1",
      "description": "markdown...",
      "functions": [
        { "id":"licensing_fees", "name":"Licensing / Royalties",
          "basis":"per_year", "revenue_K":1500, "cost_K":0,
          "headcount":2, "time_days":0,
          "external_rev_pct":0,
          "description":"markdown..." }
      ]
    }
  ],
  "handoffs": [...],
  "customer_ownership": { "sales_owns_through": "fbx_core" }
}
```

Commit to GitHub, wait 1–2 minutes for Pages to update.

### Visual editing

**Expansion Map** (`index.html`): open the URL, edit any row/assumption/hub, changes save to browser localStorage, click Export JSON to download, replace `sites.json` in the repo.

**Fishbone** (`fishbone-editor.html`): open the editor URL, set your GitHub PAT once (stored in localStorage under a key separate from the map), edit anything, click Save Version with a named commit. The PAT needs Contents: Read & Write scoped to this repo. Commit messages use `[version-name] description` format so the version dropdown can parse names back out.

---

## Economics model

### Expansion Map

**Per-Fab output ramp:**
- Phase 1: 180 homes/yr mature
- Phase 2: 240 homes/yr mature
- Phase 3: 320 → 400 homes/yr (scales by opening year)
- Opening year contributes half mature output (mid-year average)

**Per-home revenue split (defaults):**
- $180K home sale → Fab revenue
- $72K kit COGS → paid to Core
- $14.4K royalty (8%) → paid to Core
- Remainder → Fab labor, overhead, margin (22%)

**Core economics:** Revenue = kit sales + royalty. Gross profit on kits = kit sales × 28%. Opex = revenue × 15%. Operating profit = kit GP + royalty − opex.

**Fab-Home economics:** Revenue = homes × $180K. Net income = revenue × 22%. CAPEX = $3M per Fab.

**Hub assignment:** each Fab is assigned to its nearest active Core hub by haversine distance. A hub is active when `opens_yr ≤ current year`.

### Fishbone

**Basis normalization:** each function has a billing basis (per_home, per_contract, per_franchise, per_month, per_year). The roll-up multiplies per-basis values against the relevant volume assumption to produce annual $K.

**External vs inter-BU revenue:** each function has an `external_rev_pct` (0–100). 100 = real external revenue (home buyers, new franchisees, third-party component sales). 0 = inter-BU flow (Core sells KoP to Last Mile, First Mile collects licensing royalty from Last Mile). The consolidated view eliminates all internal flows so consolidated revenue reflects only real money entering FBX.

**Inter-BU flows as modeled:**
- Core → Last Mile: Kit of Parts at transfer price (Core `kop` revenue = Last Mile COGS line)
- First Mile → Last Mile: ongoing 4–8% licensing royalty on franchisee sales volume (First Mile `licensing_fees` revenue = Last Mile COGS line)
- External: franchise sales ($650–$950K per franchise to new franchisees), home sales (end buyers), component sales (SIP panels, pods to non-franchisee builders), Last Mile install revenue (end buyers)

**Map sync:** when the "sync from map" checkbox is on, the fishbone's `franchises_per_year` volume auto-pulls from `sites.json` Fab count on every refresh. Other map values (rev/home, homes/fab/year) appear as read-only reference in the editor sidebar but do not auto-apply — they're there for scenario modeling against the map's assumptions.

---

## Data source indicators

**Expansion Map** — badge next to the title:
- *Synced with sites.json* — view matches published file
- *Local edits (not saved to source)* — unsaved changes in this browser
- *Using built-in defaults* — `sites.json` not found (e.g. opened as `file://`)

Click ↻ Reload from source to discard local edits and re-fetch `sites.json`.

**Fishbone** — header shows the active version's short SHA, or "latest" for the default load. The version dropdown lists the last 30 commits to `fishbone.json`. Selecting any version loads it and updates the URL to `?v=<sha>` for deep-linking.
