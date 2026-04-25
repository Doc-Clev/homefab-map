# FBX Deck — Admin Content Editor

A browser-based WYSIWYG editor for every text field in the pitch deck.
No build step. No framework. Runs from the same static server as the deck.

---

## Launch

```bash
# from the project root
python3 -m http.server 8000
```

Then open **http://localhost:8000/admin/**

The deck itself is at **http://localhost:8000/**

---

## How to edit

1. Click a slide in the left sidebar — it loads in the scaled preview.
2. Hover over any text — a red dashed outline appears on editable fields.
3. Click the outlined field — it becomes a live editor pre-filled with the current text.
4. Type your changes.
   - **Enter** inserts a line break (`<br>`).
   - **Esc** cancels and restores the original value.
   - Click away (or Tab away) to save.
5. The slide updates immediately. A red dot appears on the sidebar item to show unsaved drafts.

### Inline formatting

The JSON values support a small set of inline HTML tags.
Type them directly in the editor — they are preserved on save:

| Tag | Effect |
|-----|--------|
| `<strong>text</strong>` | Bold |
| `<em>text</em>` | Italic |
| `<br>` | Line break (use Enter key) |
| `<small>text</small>` | Smaller text |

---

## Toolbar actions

| Button | What it does |
|--------|-------------|
| **Export JSON** | Downloads a `content.json` that merges the original file with all your draft edits. This is the file you commit. |
| **Import JSON** | Opens a file picker. Reads a `content.json` (e.g. from a colleague) and writes it as the new draft layer. Unknown slide IDs are warned and ignored. |
| **Reset to File** | Clears all drafts from `localStorage`. Prompts for confirmation first. |
| **Open Deck ↗** | Opens `/index.html` in a new tab — your localStorage edits appear there too, since both pages share the same storage key (`fbx-content-overrides`). |

The **"N edits in draft"** counter in the toolbar shows how many individual fields differ from `content.json`.

---

## Committing changes

1. Click **Export JSON** — save the downloaded file as `content.json` in the project root (replacing the existing file).
2. Verify the merge looks right: `git diff content.json`
3. Commit:

```bash
git add content.json
git commit -m "content: update slide copy"
```

After committing you can optionally clear your local drafts with **Reset to File** (the committed file and your localStorage will now be identical, so it makes no visible difference either way).

---

## Storage key

Drafts are stored at `localStorage["fbx-content-overrides"]` as a partial content object — only the fields you've changed. The deck's `content-loader.js` reads the same key, so edits appear live in both the admin preview and the deck itself.

---

## Live-tool slides (13 & 14)

Slides 13 (Fishbone) and 14 (Expansion Map) embed interactive tools in nested iframes. The admin overlay only reaches the slide-level fields (title, status lines) — it cannot edit content inside the nested tool iframes. That content lives in `tools/fishbone.html` and `tools/expansion-map.html` and is edited directly in those files.

---

## Architecture notes

- **No `js/admin-bridge.js` needed** — admin and slides are same-origin, so the admin reads `iframe.contentDocument` directly.
- **`reapply()` is async** — it re-fetches `content.json` (cached by the browser) and re-injects all values. Element DOM nodes survive a reapply, so click listeners persist.
- **`fbx:content-applied` event** — fired by `content-loader.js` after each apply cycle. The admin hooks into this to bind the edit overlay when a slide first loads.
