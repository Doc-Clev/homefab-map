#!/usr/bin/env python3
"""Apply a deck-changes.json spec (from /admin/) to the deck.

Pipeline:
  1. Load spec + current manifest
  2. Snapshot current content.json -> content.json.backup
  3. Stage renamed slides into slides_new/, drop deletions, swap into slides/
  4. Renumber chrome inside each renamed slide (data-content prefix, eyebrow
     leading number, page-no inner text)
  5. Auto-fix cross-references (slide N / slides N-M) using old->new slot map
  6. Rewrite js/manifest.js
  7. Rebuild content.json from HTML, then restore user edits from the backup
     using the slide-id remap (preserves admin-UI / hand edits)
  8. Optionally git commit (--commit) and push (--push)

Usage:
    cd <project root>            # the dir containing index.html, slides/, js/
    python tools/apply-deck-changes.py path/to/deck-changes.json
    python tools/apply-deck-changes.py deck-changes.json --commit
    python tools/apply-deck-changes.py deck-changes.json --commit --push

Without --commit, the changes are written to the working tree and you can
review with `git status` before committing yourself.

The spec format (produced by /admin/ "Save Order" -> "Download spec"):
{
  "deck_version": "v0.9",
  "total_slides": 24,
  "order": [
    {"slot": 1, "id": "01-cover",  "from_slot": 1, "title": "...", "tag": "..."},
    {"slot": 2, "id": "03-trends", "from_slot": 3, "title": "...", "tag": "..."},
    ...
  ],
  "deletions": [
    {"id": "12-fishbone", "title": "...", "from_slot": 12}
  ]
}
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path


# ---- Path resolution ----------------------------------------------------------

def find_project_root(spec_path: Path) -> Path:
    """Find the deck root (a dir with slides/ + js/manifest.js).

    Search order:
      1. Walk up from CWD
      2. Walk up from the spec file's directory
      3. Common subdirs of CWD (e.g. cwd/fbx-pitch)
    """
    def _has_deck(p: Path) -> bool:
        return (p / "slides").is_dir() and (p / "js" / "manifest.js").is_file()

    candidates: list[Path] = []
    seen: set[Path] = set()

    # 1. Walk up from cwd
    cur = Path.cwd().resolve()
    for _ in range(6):
        candidates.append(cur)
        if cur.parent == cur:
            break
        cur = cur.parent

    # 2. Walk up from spec dir
    cur = spec_path.resolve().parent
    for _ in range(6):
        candidates.append(cur)
        if cur.parent == cur:
            break
        cur = cur.parent

    # 3. Common subdirs of cwd
    cwd = Path.cwd().resolve()
    for sub in ("fbx-pitch", "deck", "src"):
        candidates.append(cwd / sub)

    for c in candidates:
        c = c.resolve()
        if c in seen:
            continue
        seen.add(c)
        if _has_deck(c):
            return c

    print(
        f"ERROR: could not find deck root.\n"
        f"  cwd: {Path.cwd()}\n"
        f"  spec dir: {spec_path.resolve().parent}\n"
        f"  Pass --root <path-to-deck-dir> explicitly, or run from the deck root.",
        file=sys.stderr,
    )
    sys.exit(2)


# ---- Manifest (read + write) --------------------------------------------------

MANIFEST_HEADER = """\
/* ============================================================
   SLIDE MANIFEST
   The single source of truth for deck order and metadata.
   To add/reorder slides: edit this array, drop the file in /slides/.
   ============================================================ */
"""

def write_manifest(path: Path, version: str, slides: list[dict]) -> None:
    """slides: [{id, file, title, tag, live}, ...]"""
    # Compute the column widths for a tidy aligned output (matches existing style)
    id_w   = max(len(s["id"]) for s in slides) + 2
    file_w = max(len(s["file"]) for s in slides) + 2
    ttl_w  = max(len(s["title"]) for s in slides) + 2
    tag_w  = max(len(s["tag"])   for s in slides) + 2

    lines = [MANIFEST_HEADER, "", "window.DECK = {"]
    lines.append('  title: "FBX HomeFab — Investor Deck",')
    lines.append(f'  version: "{version}",')
    lines.append("  slides: [")
    for s in slides:
        live_str = "true " if s["live"] else "false"
        lines.append(
            f'    {{ id: "{s["id"]}",{" " * (id_w - len(s["id"]))}'
            f'file: "{s["file"]}",{" " * (file_w - len(s["file"]))}'
            f'title: "{s["title"]}",{" " * (ttl_w - len(s["title"]))}'
            f'tag: "{s["tag"]}",{" " * (tag_w - len(s["tag"]))}'
            f'live: {live_str} }},'
        )
    # remove trailing comma on last slide entry
    lines[-1] = lines[-1].rstrip(",")
    lines.append("  ]")
    lines.append("};")
    lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def read_manifest_metadata(path: Path) -> dict[str, dict]:
    """Read manifest.js and return a dict keyed by slide id with title/tag/file/live."""
    src = path.read_text(encoding="utf-8")
    rx = re.compile(
        r'\{\s*id:\s*"(?P<id>[^"]+)",\s*'
        r'file:\s*"(?P<file>[^"]+)",\s*'
        r'title:\s*"(?P<title>[^"]+)",\s*'
        r'tag:\s*"(?P<tag>[^"]+)",\s*'
        r'live:\s*(?P<live>true|false)'
    )
    out = {}
    for m in rx.finditer(src):
        out[m["id"]] = {
            "id":    m["id"],
            "file":  m["file"],
            "title": m["title"],
            "tag":   m["tag"],
            "live":  m["live"] == "true",
        }
    return out


# ---- Renumber a single slide --------------------------------------------------

def renumber_slide_html(path: Path, old_id: str, new_id: str) -> tuple[int, int, int]:
    """Apply the three renumbering substitutions in-place. Returns counts."""
    src = path.read_text(encoding="utf-8")
    old_num = old_id.split("-", 1)[0]
    new_num = new_id.split("-", 1)[0]

    # 1. data-content prefix
    n_dc = src.count(f'data-content="{old_id}.')
    src = src.replace(f'data-content="{old_id}.', f'data-content="{new_id}.')

    # 2. eyebrow.right leading number
    eb_pattern = rf'(data-content="{re.escape(new_id)}\.eyebrow\.right"[^>]*>){old_num} · '
    src, n_eb = re.subn(eb_pattern, rf'\g<1>{new_num} · ', src)

    # 3. page-no span value
    pn_pattern = rf'(<span class="page-no"[^>]*>){old_num}(</span>)'
    src, n_pn = re.subn(pn_pattern, rf'\g<1>{new_num}\g<2>', src)

    path.write_text(src, encoding="utf-8")
    return n_dc, n_eb, n_pn


# ---- Cross-reference fixes ----------------------------------------------------

def fix_xrefs_in_text(text: str, slot_map: dict[int, int | None]) -> tuple[str, list[str]]:
    """Auto-rewrite "slide N" / "slides N–M" / "slides N, M" references using
    old->new slot map. Returns (new_text, warnings)."""
    warnings: list[str] = []

    def map_n(n: int) -> int | None:
        return slot_map.get(n)

    def fmt(n: int) -> str:
        return f"{n:02d}" if n < 10 else str(n)

    def repl_single(m):
        prefix = m.group(1)  # "slide " or "Slide "
        n_str  = m.group(2)
        n = int(n_str)
        new = map_n(n)
        if new is None:
            warnings.append(f'unmapped reference: "{m.group(0)}" (old slot {n} was deleted or unknown)')
            return m.group(0)
        # Preserve zero-padding if the original was zero-padded
        formatted = f"{new:02d}" if (len(n_str) == 2 and n_str.startswith("0")) else str(new)
        return f"{prefix}{formatted}"

    def repl_range(m):
        prefix = m.group(1)
        a, b = int(m.group(2)), int(m.group(4))
        sep = m.group(3)  # the dash variant used (- or –)
        na, nb = map_n(a), map_n(b)
        if na is None or nb is None:
            warnings.append(f'unmapped range: "{m.group(0)}"')
            return m.group(0)
        # Re-zero-pad if both originals were 2-digit
        fa = f"{na:02d}" if len(m.group(2)) == 2 and m.group(2).startswith("0") else str(na)
        fb = f"{nb:02d}" if len(m.group(4)) == 2 and m.group(4).startswith("0") else str(nb)
        return f"{prefix}{fa}{sep}{fb}"

    def repl_pair(m):
        prefix = m.group(1)
        a, b = int(m.group(2)), int(m.group(3))
        na, nb = map_n(a), map_n(b)
        if na is None or nb is None:
            warnings.append(f'unmapped pair: "{m.group(0)}"')
            return m.group(0)
        fa = f"{na:02d}" if len(m.group(2)) == 2 and m.group(2).startswith("0") else str(na)
        fb = f"{nb:02d}" if len(m.group(3)) == 2 and m.group(3).startswith("0") else str(nb)
        return f"{prefix}{fa}, {fb}"

    # Order matters: do range/pair before singletons (greedy match priority)
    text = re.sub(r"(\bslides\s+)(\d{1,2})(\s*[-–]\s*)(\d{1,2})\b", repl_range, text)
    text = re.sub(r"(\bslides\s+)(\d{1,2}),\s*(\d{1,2})\b", repl_pair, text)
    text = re.sub(r"(\bslide\s+)(\d{1,2})\b", repl_single, text, flags=re.IGNORECASE)

    return text, warnings


# ---- content.json rebuild + restore -------------------------------------------

DC_RX = re.compile(r'<(\w+)[^>]*data-content="([^"]+)"[^>]*>(.*?)</\1>', re.DOTALL)

def extract_html_defaults(slides_dir: Path) -> dict[str, dict[str, str]]:
    out: dict[str, dict[str, str]] = {}
    for fname in sorted(os.listdir(slides_dir)):
        if not fname.endswith(".html"):
            continue
        src = (slides_dir / fname).read_text(encoding="utf-8")
        for m in DC_RX.finditer(src):
            key, inner = m.group(2), m.group(3)
            sid, _, field = key.partition(".")
            normalized = re.sub(r"\s+", " ", inner).strip()
            out.setdefault(sid, {})[field] = normalized
    return out


def build_content_json(
    fresh: dict[str, dict[str, str]],
    baseline: dict,
    prefix_map: dict[str, str],
    version: str,
) -> tuple[dict, list[tuple[str, str, str]]]:
    """Compose final content.json: HTML defaults overlaid with user edits from
    baseline (remapped via prefix_map). Skips eyebrow.right (chrome managed by
    the renumber step). Returns (content, restored_log)."""
    restored: list[tuple[str, str, str]] = []  # (old_id, new_id, field)

    out: dict = {
        "_meta": {
            "version": version,
            "description": (
                "Editable content for FBX deck. Edit via /admin/ or directly. "
                "Slide HTML reads keys via data-content attributes; localStorage "
                "overrides this file at runtime."
            ),
        }
    }
    # Pre-fill from HTML defaults
    for sid, fields in fresh.items():
        out[sid] = dict(fields)

    # Overlay baseline values
    for old_id, fields in baseline.items():
        if old_id == "_meta":
            continue
        new_id = prefix_map.get(old_id)
        if new_id is None or new_id not in out:
            continue
        for field, baseline_val in fields.items():
            if field == "eyebrow.right":
                continue  # chrome managed by HTML; never restore stale slot prefixes
            cur = out[new_id].get(field)
            if cur is None:
                out[new_id][field] = baseline_val
                continue
            if str(baseline_val).strip() != str(cur).strip():
                out[new_id][field] = baseline_val
                restored.append((old_id, new_id, field))

    # Sort: _meta first, then slide ids
    ordered: dict = {"_meta": out["_meta"]}
    for k in sorted(k for k in out if k != "_meta"):
        ordered[k] = out[k]
    return ordered, restored


# ---- Main pipeline ------------------------------------------------------------

def apply_spec(root: Path, spec: dict, *, dry_run: bool = False) -> None:
    slides_dir   = root / "slides"
    manifest_path = root / "js" / "manifest.js"
    content_path = root / "content.json"
    backup_path  = root / "content.json.backup"

    # ---- Validate spec --------------------------------------------------------
    if "order" not in spec or not isinstance(spec["order"], list):
        raise SystemExit("Bad spec: missing 'order' array")
    new_order = spec["order"]
    deletions = spec.get("deletions", [])
    deleted_ids = {d["id"] for d in deletions}
    new_version = spec.get("deck_version_target") or _bump_version(spec.get("deck_version", "v0.0"))

    # Read current manifest as the source of truth for current slide ids/files
    manifest = read_manifest_metadata(manifest_path)
    current_ids = set(manifest.keys())

    # Sanity: every spec id must exist in manifest
    for entry in new_order:
        if entry["id"] not in current_ids:
            raise SystemExit(f"Spec references unknown slide id: {entry['id']}")
    for d in deletions:
        if d["id"] not in current_ids:
            raise SystemExit(f"Spec wants to delete unknown slide id: {d['id']}")

    # ---- Build prefix_map (old_id -> new_id) ----------------------------------
    prefix_map: dict[str, str] = {}
    for entry in new_order:
        old_id = entry["id"]
        # Rebuild new_id by replacing the slot prefix
        slot   = int(entry["slot"])
        suffix = old_id.split("-", 1)[1]
        new_id = f"{slot:02d}-{suffix}"
        prefix_map[old_id] = new_id

    # Slot map for cross-ref fixing: old_slot -> new_slot or None (deleted)
    slot_map: dict[int, int | None] = {}
    for entry in new_order:
        slot_map[int(entry["from_slot"])] = int(entry["slot"])
    for d in deletions:
        slot_map[int(d["from_slot"])] = None

    print(f"=== Applying spec ({len(new_order)} slides, {len(deletions)} deletions) ===")
    print(f"Project root: {root}")
    print(f"New version:  {new_version}")
    if dry_run:
        print("(dry run — no files will be modified)")
    print()

    # ---- Snapshot content.json -------------------------------------------------
    if not dry_run:
        shutil.copy2(content_path, backup_path)
    print(f"[1/7] backed up content.json -> {backup_path.name}")

    # ---- Stage renames in slides_new/ ------------------------------------------
    staging = slides_dir.parent / "slides_new"
    if not dry_run:
        if staging.exists():
            shutil.rmtree(staging)
        staging.mkdir()
        for entry in new_order:
            old_id = entry["id"]
            new_id = prefix_map[old_id]
            old_file = manifest[old_id]["file"].split("/")[-1]  # "01-cover.html"
            src_path = slides_dir / old_file
            dst_path = staging / f"{new_id}.html"
            shutil.copy2(src_path, dst_path)
    print(f"[2/7] staged {len(new_order)} files in slides_new/")
    if deletions:
        print(f"      excluded: {', '.join(d['id'] for d in deletions)}")

    # ---- Swap into slides/ -----------------------------------------------------
    if not dry_run:
        for f in slides_dir.iterdir():
            if f.suffix == ".html":
                f.unlink()
        for f in staging.iterdir():
            f.rename(slides_dir / f.name)
        staging.rmdir()
    print(f"[3/7] swapped slides_new/ into slides/ (now {sum(1 for _ in slides_dir.glob('*.html')) if not dry_run else len(new_order)} files)")

    # ---- Renumber chrome inside each renamed slide -----------------------------
    rename_count = 0
    for entry in new_order:
        old_id = entry["id"]
        new_id = prefix_map[old_id]
        if old_id == new_id:
            continue
        if not dry_run:
            renumber_slide_html(slides_dir / f"{new_id}.html", old_id, new_id)
        rename_count += 1
    print(f"[4/7] renumbered chrome in {rename_count} slides")

    # ---- Cross-reference fixes -------------------------------------------------
    xref_warnings: list[tuple[str, str]] = []  # (filename, warning)
    if not dry_run:
        for entry in new_order:
            new_id = prefix_map[entry["id"]]
            path = slides_dir / f"{new_id}.html"
            text = path.read_text(encoding="utf-8")
            new_text, warns = fix_xrefs_in_text(text, slot_map)
            if new_text != text:
                path.write_text(new_text, encoding="utf-8")
            for w in warns:
                xref_warnings.append((f"{new_id}.html", w))
    print(f"[5/7] auto-fixed cross-references")
    if xref_warnings:
        print(f"      ⚠  {len(xref_warnings)} unmapped reference(s) — review manually:")
        for f, w in xref_warnings[:10]:
            print(f"        {f}: {w}")
        if len(xref_warnings) > 10:
            print(f"        ... and {len(xref_warnings) - 10} more")

    # ---- Rewrite manifest.js ---------------------------------------------------
    new_slides_meta: list[dict] = []
    for entry in new_order:
        old_id = entry["id"]
        new_id = prefix_map[old_id]
        meta = manifest[old_id]
        new_slides_meta.append({
            "id":    new_id,
            "file":  f"slides/{new_id}.html",
            "title": entry.get("title", meta["title"]),
            "tag":   entry.get("tag", meta["tag"]),
            "live":  meta["live"],
        })
    if not dry_run:
        write_manifest(manifest_path, new_version, new_slides_meta)
    print(f"[6/7] rewrote manifest.js (version {new_version})")

    # ---- Rebuild content.json with edit preservation ---------------------------
    if not dry_run:
        baseline = json.loads(backup_path.read_text(encoding="utf-8"))
        fresh = extract_html_defaults(slides_dir)
        content, restored = build_content_json(fresh, baseline, prefix_map, new_version)
        content_path.write_text(
            json.dumps(content, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        backup_path.unlink()
        total_fields = sum(len(v) for k, v in content.items() if k != "_meta")
        print(f"[7/7] rebuilt content.json ({len(content) - 1} slides, {total_fields} fields)")
        print(f"      restored {len(restored)} user edits from backup")
    else:
        print("[7/7] (dry run) would rebuild content.json")

    print()
    print("Done. Review with `git status` / `git diff --stat`.")


def _bump_version(v: str) -> str:
    m = re.match(r"v(\d+)\.(\d+)$", v)
    if not m:
        return "v0.10"
    major, minor = int(m.group(1)), int(m.group(2))
    return f"v{major}.{minor + 1}"


# ---- Git ops ------------------------------------------------------------------

def git_run(root: Path, *args: str, capture: bool = False) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "-C", str(root), *args], capture_output=capture, text=True)

def git_commit(root: Path, spec: dict) -> None:
    n = len(spec["order"])
    d = len(spec.get("deletions", []))
    moves = sum(1 for e in spec["order"] if int(e["slot"]) != int(e["from_slot"]))
    msg = (
        f"feat: apply admin reorder/delete spec ({n} slides, {moves} moved, {d} deleted)\n\n"
        f"Generated by /admin/ on {spec.get('generated_at', 'unknown')}.\n"
        f"Source manifest version: {spec.get('deck_version', 'unknown')}.\n\n"
        "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>\n"
    )
    git_run(root, "add", "fbx-pitch/" if (root / "fbx-pitch").is_dir() else ".")
    git_run(root, "commit", "-m", msg)

def git_push(root: Path) -> None:
    git_run(root, "push", "origin", "HEAD")


# ---- CLI ----------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Apply a deck-changes.json spec to the deck.")
    parser.add_argument("spec", type=Path, help="Path to deck-changes.json")
    parser.add_argument("--dry-run", action="store_true", help="Show what would change, don't modify files")
    parser.add_argument("--commit", action="store_true", help="git add/commit after applying")
    parser.add_argument("--push", action="store_true", help="git push after committing (implies --commit)")
    parser.add_argument("--root", type=Path, default=None, help="Project root (deck dir). Auto-detected if omitted.")
    args = parser.parse_args()

    if not args.spec.is_file():
        print(f"ERROR: spec file not found: {args.spec}", file=sys.stderr)
        sys.exit(2)

    spec = json.loads(args.spec.read_text(encoding="utf-8"))

    root = args.root.resolve() if args.root else find_project_root(args.spec)
    apply_spec(root, spec, dry_run=args.dry_run)

    if args.dry_run:
        return
    if args.commit or args.push:
        git_commit(root, spec)
        print("git commit done")
    if args.push:
        git_push(root)
        print("git push done")


if __name__ == "__main__":
    main()
