# iOS Safari — "Getting There" Video QA Checklist

One-page shot list for recording a single ~95s screen capture on iOS Safari that proves both **granted** and **denied** geolocation flows for `GettingThere.tsx`. Use the built-in iOS Screen Recorder (Control Center → Record). Keep the status bar visible so the device clock is auditable.

**Device under test**: iPhone on iOS 17+ • Safari • Google Maps installed • signed into the preview at `https://id-preview--0d3101bb-9764-405c-8d64-1cd8781cef23.lovable.app` • event detail page open (e.g. Hagia Sophia) at `/app/event/<id>`.

**Pre-roll reset** (do this before hitting Record):
1. Settings → Privacy & Security → Location Services → **On**.
2. Same screen → Safari Websites → **Ask Next Time Or When I Share**.
3. Safari → tabs icon → swipe up to **close the preview tab** (Safari caches "Don't Allow" per tab).
4. Open a fresh tab → paste the preview URL → tap **Go** → sign in if needed → navigate to the event detail page.
5. Start Screen Recording from Control Center (3-second countdown).

---

## Part 1 — GRANTED flow (0:00 – 0:45)

| Time | Tap / Action | Expected UI state |
|------|--------------|-------------------|
| 0:00 | Recording starts on event detail page, scrolled to top. | Header visible, "Getting there" card below the fold. |
| 0:03 | Scroll down to **Getting there** section. | Section title, primary button **Use my location**, static **Open directions in Google Maps**, 3 mode cards (Metro/Tram, Taxi, Walking). No denied note. |
| 0:08 | Tap **Use my location**. | Button shows spinner. iOS native sheet appears: **"…would like to use your current location"** with **Allow Once** / **Allow While Using App** / **Don't Allow**. |
| 0:11 | Tap **Allow Once**. | Sheet dismisses. Spinner stops within ~1s. iOS app-switch banner appears at top: **"Open in Google Maps?"** (or Safari opens `maps.google.com` in a new tab if the app is missing). |
| 0:14 | Tap **Open**. | Google Maps app opens to **Directions** view. Starting point = **Your location** (blue dot). Destination = landmark. Default mode: **Transit**. |
| 0:22 | Swipe up from home indicator → return to Safari. | "Getting there" still visible. Denied note still hidden. Spinner not stuck. |
| 0:25 | Tap **Metro/Tram** card. Accept "Open in Google Maps?" banner. | Maps opens, **Transit** mode, origin = Your location. |
| 0:31 | Return to Safari. Tap **Taxi** card. Accept banner. | Maps opens, **Driving** mode, origin = Your location. |
| 0:37 | Return to Safari. Tap **Walking** card. Accept banner. | Maps opens, **Walking** mode, origin = Your location. |
| 0:43 | Return to Safari. | All 4 buttons confirmed. Denied note never appeared. |

URL spot-check (pause recording, long-press the primary button → **Copy Link**, paste into Notes): must contain `maps/dir/?api=1`, `destination=`, `origin=<lat>,<lng>`, `travelmode=transit`.

---

## Part 2 — Reset between flows (0:45 – 0:58)

iOS caches the per-tab decision aggressively — closing the tab is mandatory.

| Time | Tap / Action | Expected UI state |
|------|--------------|-------------------|
| 0:45 | Return to Safari. Tap **tabs icon** (bottom-right). | Tab switcher visible. |
| 0:48 | Swipe up on the preview tab to **close it**. | Tab removed. |
| 0:51 | Tap **+** to open a new tab → paste preview URL → **Go**. | App reloads. |
| 0:55 | Navigate back to the same event detail page → scroll to **Getting there**. | Initial state restored. Denied note hidden. |

(Optional faster path: use a **Private** tab — permissions reset per-tab automatically.)

---

## Part 3 — DENIED flow (0:58 – 1:35)

| Time | Tap / Action | Expected UI state |
|------|--------------|-------------------|
| 0:58 | At **Getting there** section. | Same initial state as 0:03. |
| 1:01 | Tap **Use my location**. | Spinner appears. iOS permission sheet shows **Allow Once** / **Allow While Using App** / **Don't Allow**. |
| 1:04 | Tap **Don't Allow**. | Sheet dismisses. **Within ~1s**: spinner stops, **no new tab opens, no app-switch banner**, fallback note `gettingThere.deniedNote` becomes visible directly under the primary button. Static **Open directions in Google Maps** button and 3 mode cards still enabled. |
| 1:09 | Tap **Open directions in Google Maps**. Accept "Open in Google Maps?" banner. | Maps opens. Directions view. Starting point empty / **"Choose starting point"**. Destination = landmark. Mode = Transit. |
| 1:15 | Return to Safari. Tap **Metro/Tram**. Accept banner. | Maps opens, **Transit** mode, **no origin**. |
| 1:20 | Return to Safari. Tap **Taxi**. Accept banner. | Maps opens, **Driving** mode, **no origin**. |
| 1:25 | Return to Safari. Tap **Walking**. Accept banner. | Maps opens, **Walking** mode, **no origin**. |
| 1:30 | Return to Safari. Tap **Use my location** again. | iOS does **not** re-prompt (decision cached for the tab). Denied note stays visible. No new tab. No spinner stuck. |
| 1:35 | Stop screen recording (Control Center → Stop). | Done. |

URL spot-check (denied path): must contain `maps/dir/?api=1`, `destination=`, `travelmode=<mode>`, **no `origin=` parameter**.

---

## Pass criteria (tick on review)

- [ ] 0:08 — iOS native permission sheet appeared on first tap
- [ ] 0:14 — Maps opened with live `origin=<lat>,<lng>` and `travelmode=transit`
- [ ] 0:25 / 0:31 / 0:37 — mode cards opened Maps with correct `travelmode` and origin
- [ ] 0:43 — denied note never shown during granted flow
- [ ] 1:04 — denied note appeared **immediately** after Don't Allow, no new tab, no app-switch banner
- [ ] 1:09 / 1:15 / 1:20 / 1:25 — all 4 fallback buttons opened Maps without `origin`
- [ ] 1:30 — re-tap after deny does not re-prompt, does not crash, keeps note visible
- [ ] No console errors (test with Safari Web Inspector on Mac), no layout shift, buttons remained thumb-reachable throughout

## Fail triggers (re-record)

- Permission sheet never appears → Location Services disabled at system level, or tab wasn't closed during reset.
- Spinner never stops after Allow Once / Don't Allow → loading state leak in `GettingThere.tsx`.
- New tab opens or app-switch banner appears during the denied flow → fallback path is firing geolocation unexpectedly.
- Denied note missing or delayed >2s → state update bug.
- Any mode card opens Maps with the wrong `travelmode` or wrong/missing origin for its state.
- Re-tap after deny re-triggers the iOS permission sheet → permission handling regression.

## iOS-specific gotchas

- "Allow While Using App" persists across reloads — only **Allow Once** mirrors a true first-time grant for repeat testing.
- If Safari opens `maps.google.com` in a new tab instead of triggering the "Open in Google Maps?" banner, Google Maps isn't installed; URL assertions still apply.
- Private Browsing tabs auto-clear permission state — fastest reset between takes.
- iOS Low Power Mode can throttle geolocation; disable it for the recording.
