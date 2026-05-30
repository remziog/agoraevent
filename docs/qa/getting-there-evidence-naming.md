# "Getting There" — Evidence Artifact Naming Standard

Single source of truth for where evidence files live and how they are named, so a granted run on iOS Safari can be diffed 1:1 against the same run on Android Emulator or a physical Android device. Any tooling (review scripts, CI checks, manual diffs) should rely on this exact layout.

## Top-level folder

```
docs/qa/evidence/<DATE>-<SHORT_SHA>/
```

- `<DATE>` — ISO date of the test session, format `YYYY-MM-DD` (e.g. `2026-05-30`).
- `<SHORT_SHA>` — 7-char git commit SHA the build under test was produced from (e.g. `a1b2c3d`).

Example: `docs/qa/evidence/2026-05-30-a1b2c3d/`

One folder per test session. Never reuse or overwrite a previous session's folder — create a new one even for re-runs on the same SHA (append `-r2`, `-r3`).

## Per-session structure

```
docs/qa/evidence/<DATE>-<SHORT_SHA>/
├── README.md                       # Session metadata + matrix sign-off
├── ios-safari/
│   ├── granted/
│   │   ├── 01-prompt.png
│   │   ├── 02-maps-url.png
│   │   ├── 03-console.txt
│   │   ├── 04-network.har          # optional
│   │   └── notes.md                # optional, free-form observations
│   └── denied/
│       ├── 01-prompt.png
│       ├── 02-fallback-note.png
│       ├── 03-maps-url.png
│       ├── 04-console.txt
│       ├── 05-network.har          # optional
│       └── notes.md                # optional
├── android-emulator/
│   ├── granted/   (same 4 required files as above)
│   └── denied/    (same 5 required files as above)
└── android-physical/
    ├── granted/   (same)
    └── denied/    (same)
```

### Platform folder names (fixed)

| Platform | Folder name |
|---|---|
| iOS Safari (Simulator or real device) | `ios-safari` |
| Android Emulator (AVD) | `android-emulator` |
| Physical Android device | `android-physical` |

Do not invent variants (`ios`, `android`, `pixel-7`, etc.) — diff tooling matches these three strings exactly.

### Flow folder names (fixed)

`granted/` and `denied/` — lowercase, no other variants.

## File naming convention

All artifact filenames follow:

```
<NN>-<slug>.<ext>
```

- `<NN>` — 2-digit ordinal matching the capture order in the checklist (`01`, `02`, …). Pads with leading zero. Required so directory listings sort chronologically.
- `<slug>` — kebab-case, lowercase, ASCII only, fixed per flow (see tables below). Never localize or pluralize.
- `<ext>` — file extension matching the artifact type (see below).

### Required files per flow

**`granted/`** — 4 required files, identical names on every platform:

| Ordinal | Slug | Ext | Captures |
|---|---|---|---|
| 01 | `prompt` | `png` | OS / browser geolocation permission sheet, full screen. |
| 02 | `maps-url` | `png` | Google Maps directions URL, with visible `origin=<lat>,<lng>` and `travelmode=transit`. |
| 03 | `console` | `txt` | Browser console dump for the granted run window. Zero error-level entries. |
| 04 | `network` | `har` | **Optional.** DevTools / Web Inspector HAR export covering the run window. Include when debugging a regression. |

**`denied/`** — 5 required files, identical names on every platform:

| Ordinal | Slug | Ext | Captures |
|---|---|---|---|
| 01 | `prompt` | `png` | OS / browser geolocation permission sheet. |
| 02 | `fallback-note` | `png` | App screenshot with `gettingThere.deniedNote` clearly visible under the primary button. |
| 03 | `maps-url` | `png` | Fallback Maps directions URL, with `destination=…&travelmode=…` and **no** `origin=` parameter. |
| 04 | `console` | `txt` | Browser console dump for the denied run window. Zero error-level entries. |
| 05 | `network` | `har` | **Optional.** HAR export. |

### Optional files

- `notes.md` — free-form Markdown for tester observations (lag, flicker, unexpected toasts). Always lowercase, always `.md`.
- Additional screenshots beyond the required set use ordinals `90+` and a descriptive slug, e.g. `90-extra-orientation-landscape.png`. This keeps required files at the top of any sorted listing.

### Extensions (fixed)

| Type | Extension | Notes |
|---|---|---|
| Screenshot | `.png` | PNG only. No JPEG, no HEIC (convert iPhone HEIC to PNG before saving). |
| Console dump | `.txt` | Plain UTF-8, no ANSI color codes. |
| Network log | `.har` | Standard HAR 1.2 JSON. |
| Free-form notes | `.md` | CommonMark. |
| Video (out of scope here — lives next to this folder) | `.mp4` | Stored under `docs/qa/evidence/<session>/videos/` if any. |

## Session `README.md` template

Every session folder MUST contain a `README.md` at its root:

```markdown
# Evidence session 2026-05-30-a1b2c3d

- Tester: <name>
- Commit SHA: a1b2c3d
- Build URL: https://id-preview--0d3101bb-9764-405c-8d64-1cd8781cef23.lovable.app
- Event under test: Hagia Sophia (id: <uuid>)
- GPS seed: 41.0086, 28.9802 (Sultanahmet)

## Platforms

- iOS Safari: iPhone 15 Simulator, iOS 17.5
- Android Emulator: Pixel 7 AVD, Android 14 (API 34), google_apis_playstore
- Android physical: <make/model>, Android <ver>, Chrome <ver>

## Cross-platform matrix

All 14 rows passed: [yes / no — link to discrepancy notes]

## Known deviations from the standard

[None / list any optional files added or skipped]
```

## Pre-flight checklist

Before declaring a session complete:

- [ ] Session folder name matches `<YYYY-MM-DD>-<SHORT_SHA>` exactly.
- [ ] Three platform folders exist with the exact fixed names.
- [ ] Each platform folder contains `granted/` and `denied/`.
- [ ] Every required file from both tables is present, with the exact ordinal + slug + extension.
- [ ] All `.png` files are actually PNG (not renamed JPEG/HEIC).
- [ ] All `02-maps-url.png` files visibly contain the URL text (not just the Maps directions view).
- [ ] All `03-console.txt` / `04-console.txt` files contain zero `error`-level entries during the flow window.
- [ ] `README.md` exists at the session root and is filled in.

## Diff workflow

To compare a flow across platforms (e.g. confirm the denied fallback URL has no `origin=` everywhere):

```bash
SESSION=docs/qa/evidence/2026-05-30-a1b2c3d
for p in ios-safari android-emulator android-physical; do
  echo "--- $p ---"
  ls "$SESSION/$p/denied/" | sort
done
```

The sorted listings must be identical across the three platforms. Any difference is a missing or misnamed artifact and blocks recording the video.
