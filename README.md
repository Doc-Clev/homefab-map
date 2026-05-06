# FBX HomeFab Platform — v2.0

**Live:** https://Doc-Clev.github.io/homefab-map/

A single-page strategic planning platform for FBX HomeFab's 10-year US rollout. Master shell with six embedded tools, all sharing one canonical data file (`sites.json`) and one GitHub-Actions-backed save flow.

## What's new in v2

- **💰 Cost Calibrator** — sixth tab, the primary cost-modeling tool
- **City-level cost cascade** — every site has its own `cost.cci` (RSMeans construction-cost index); cost rolls up city → state default → national baseline
- **Entitlement model** — land + soft costs + permits broken out per-tier so the platform can show a "true total / door" comparable to NAHB national turnkey ($269K SFD avg)
- **Demand-weighted blending** — pipeline blended is weighted by `cost.demand_velocity` (homes/yr per fab), not site count
- **Cmd-K nav** — quick-switcher across the six tools, with `Cmd-1..6` direct jumps and `Cmd-E` view↔editor toggle within a tool group
- **Per-site map tooltip** — hover any city dot to see its full cost stack
- **Tier-segmented dashboard widget** — cost stack by Tier A/B/C/D, demand-weighted, year-filtered
- **Color-by-cost map overlay** — toggle dot coloring from phase to cost band (green = under target, amber = within 10%, red = 10%+ over)

---

## The platform

`index.html` is the master shell. It hosts six tools as `srcdoc` iframes:

| # | Tab | What it does | File |
|---|---|---|---|
| 1 | 🗺 Expansion Map | 137-site map, year slider, financial dashboard, tier-segmented cost widget | inlined in `index.html` |
| 2 | ✏ Map Editor | PAT-gated editor for sites + hubs + assumptions | inlined |
| 3 | 💰 Cost Calibrator | Cost cascade tool: per-state defaults + per-city CCI overrides + entitlement assumptions | inlined; standalone `cost-calibrator.html` |
| 4 | 🐟 Fishbone | Three-BU value-chain Ishikawa | inlined; standalone `fishbone.html` |
| 5 | ✏ Fishbone Editor | PAT-gated editor for the fishbone | inlined; standalone `fishbone-editor.html` |
| 6 | 📋 Sites Detail | Read-only narrative table of all 137 sites | inlined |

**Save Version** (top-right) commits the relevant JSON file (`sites.json` or `fishbone.json`) through the `save-version.yml` GitHub Actions workflow. Auto-reloads dependent tabs after the commit lands.

**Cmd-K** opens a quick switcher; `Cmd-1..6` jumps directly; `Cmd-E` toggles view↔editor when on Map or Fishbone.

---

## Data model — `sites.json` v2

```jsonc
{
  "version": 3,
  "sites": [
    {
      "yr": 1, "phase": 1, "name": "Fresno", "state": "CA",
      "lat": 36.74, "lon": -119.77, "hub": "Corona",
      "adu": "Base", "note": "Operational HQ. Central Valley hub…",
      "cost": {
        "cci": 1.08,                    // RSMeans CCI multiplier (1.00 = nat'l avg)
        "psf_override": null,           // direct $/sf override; null = use cci × baseline
        "strip_pct_override": null,     // null = inherit from state's tier
        "demand_velocity": 180,         // homes/yr per fab — Doc's planning constant
        "notes": "",
        "source": "RSMeans 2025 direct",
        "last_updated": "2026-05-06"
      }
    }
    // ... 136 more sites
  ],
  "cost_assumptions": {
    "version": 2,
    "national_baseline_psf": 162,        // NAHB SOC 2024 national avg ($/sf)
    "target_per_door": 165000,           // Factory $/door target
    "blended_per_door": 129623,          // Demand-weighted national blended (computed at save)
    "blended_site_work_per_door": ...,
    "blended_entitlement_per_door": ...,
    "blended_total_per_door": ...,       // True total = factory + site work + entitlement
    "products": {
      "townhome": { "name": "Townhome", "sf": 1450, "units": 214, "sf_mod": 0.90 },
      "adu":      { "name": "ADU",      "sf": 750,  "units": 211, "sf_mod": 1.15 },
      "duplex":   { "name": "Duplex",   "sf": 1850, "units": 160, "sf_mod": 0.88 },
      "sfr":      { "name": "SFR",      "sf": 1800, "units": 14,  "sf_mod": 1.00 }
    },
    "tier_strip_pct": { "A": 35, "B": 32, "C": 28, "D": 22 },  // GC site-work portion
    "state_defaults": {
      "CA": { "cost_psf": 225, "tier": "A" },
      // ... 49 more states
    },
    "entitlement": {
      "land_per_door_K_by_tier": { "A": 100, "B": 60, "C": 35, "D": 20 },
      "soft_costs_pct_of_construction": 12,   // A&E, marketing, sales
      "permits_per_door_K": 8                 // Impact fees + permits
    }
  }
}
```

### Cost cascade

Every per-site $/door reading walks this cascade, top to bottom:

```
city.cost.psf_override          ← user-set absolute $/sf (rare; from a real bid)
  ↓ falls back to
city.cost.cci × baseline_psf    ← typical case (RSMeans CCI × $162)
  ↓ falls back to
state_defaults[state].cost_psf  ← state typical (averages all metros)
  ↓ falls back to
national_baseline_psf           ← $162/sf, NAHB SOC 2024
```

Same cascade for `strip_pct` (city override → tier default).

### Cost stack

```
factory       = effective_psf × (1 − strip%) × Σ(p.sf_mod × p.sf × p.units) / Σ(p.units)
site_work     = effective_psf × strip% × Σ(p.sf_mod × p.sf × p.units) / Σ(p.units)
construction  = factory + site_work
entitlement   = land[tier] + (construction × soft_pct/100) + permits
true_total    = construction + entitlement
```

### Demand-weighted blending

```
blended_total = Σ(site.true_total × site.cost.demand_velocity) / Σ(site.cost.demand_velocity)
```

Default `demand_velocity = 180 homes/yr`. Sites with higher fab capacity pull the blended toward their numbers.

---

## Cost Calibrator workflow

1. **Open the calibrator tab.** Hero shows the current cost stack: Factory + Site Work + Entitlement = True Total, with deltas vs the $165K factory target and the $269K NAHB SFD benchmark.

2. **Tune assumptions** in the left panels:
   - Pipeline mix presets (Actual / ADU-Heavy / Density Push / Custom)
   - Per-product size + units + sf_mod
   - Tier-strip% sliders (A/B/C/D)
   - **Entitlement** — per-tier land sliders, soft costs %, permits $K
   - Target $/door

3. **City Explorer** (right panel) — searchable, sortable table of all 137 sites. Click any row to expand an inline editor:
   - CCI slider (0.75–1.50)
   - $/sf override (overrides CCI × baseline if set)
   - Strip% override (overrides tier default if set)
   - Demand/yr
   - Source dropdown (RSMeans direct / Local builder bid / Mfr quote / Estimated / Manual / Inherited)
   - Notes
   - **Reset to inherited** clears all overrides on that city

4. **Save & sync to Expansion Map** — commits the updated `sites.json` through GitHub Actions. The map and editor tabs auto-reload after the commit lands; their per-site REV numbers and tier-breakdown widget reflect the new values.

### CCI seeding

Of the 137 sites, **17 have RSMeans 2025 direct CCIs** from the v2 spec (Fresno, San Diego, Phoenix, Denver, Hartford, Indianapolis, Honolulu, Anchorage, Boston, Seattle, Chicago, Portland, Dallas, Houston, Atlanta, Miami, Minneapolis). The remaining 120 are seeded by tier-typical CCI (`A: 1.05, B: 0.98, C: 0.92, D: 0.86`) with a phase-based downward nudge for later-rollout markets. Source is tagged `"estimated (Tier X typical)"` so Doc can audit and override per-city as real bids come in.

---

## Publishing & embedding

GitHub Pages serves from `main` branch, root folder. URLs:

- **Platform:** `https://Doc-Clev.github.io/homefab-map/` (master shell, all 6 tabs)
- **Standalone tools** (for Canva embeds):
  - Cost Calibrator: `https://Doc-Clev.github.io/homefab-map/cost-calibrator.html`
  - Fishbone: `https://Doc-Clev.github.io/homefab-map/fishbone.html`
  - Fishbone Editor: `https://Doc-Clev.github.io/homefab-map/fishbone-editor.html`

For Canva: Elements → Embed → paste a URL. The interactive artifact renders live.

---

## Save flow architecture

The master shell talks to each iframe via `postMessage`:

1. User clicks **Save Version** → modal asks for a name
2. Shell sends `fbx-get-state` to the active iframe
3. Iframe responds with `fbx-state` containing the full updated JSON for that file
4. Shell base64-encodes and POSTs to the GitHub Actions `workflow_dispatch` endpoint
5. The workflow (`.github/workflows/save-version.yml`) decodes, validates JSON, and commits with a message like `[Q2 draft] saved from cost-calibrator`
6. Shell polls until the workflow completes (~15-30s), then auto-reloads dependent iframes (`map`, `editor`, `sitelist`, `cost-calibrator` for sites.json saves)

The PAT is hardcoded in the master shell (with `contents:write` scope on this repo only). The workflow only writes `sites.json` or `fishbone.json` — HTML changes are uploaded separately.

---

## Repository files

| File | Role |
|---|---|
| `index.html` | Master shell (1MB; 6 srcdoc iframes + nav + Cmd-K + save flow) |
| `sites.json` | Canonical data: 137 sites + cost_assumptions block (v2 schema) |
| `fishbone.json` | Canonical fishbone data |
| `cost-calibrator.html` | Standalone calibrator (also inlined in index.html) |
| `fishbone.html` | Standalone fishbone viewer |
| `fishbone-editor.html` | Standalone fishbone editor |
| `editor.html` | Standalone map editor (legacy; primary editor is now the inlined Map Editor tab) |
| `_scripts/` | Build helpers: `migrate_v2.py` (sites.json schema migration), `add_cost_assumptions.py` (v1 seeder, deprecated), `rebuild_shell.py` (re-inlines `cost-calibrator.html` into `index.html`) — gitignored |
| `.github/workflows/save-version.yml` | Save-Version GitHub Actions workflow |

---

## Version history

- **v2.0** (2026-05-06) — Cost Calibrator added as 6th tab. City-level cost cascade (CCI > state default > national baseline). Entitlement model (land + soft + permits). Per-site map tooltip with cost stack. Tier-segmented dashboard widget. Color-by-cost map overlay. Cmd-K quick switcher. Demand-weighted blending.
- **v1.5** — Master shell consolidated 5 standalone tools into srcdoc iframes; Save Version flow via GitHub Actions.
- **v1.0** — Initial Expansion Map + Fishbone, separate files.
