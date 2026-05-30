# Android — "Getting There" Video QA Checklist

One-page shot list for recording a single ~90s screen capture on Android Chrome that proves both **granted** and **denied** geolocation flows for `GettingThere.tsx`. Use the phone's built-in screen recorder. Keep the device clock visible (status bar on) so timestamps are auditable.

**Device under test**: Android 13+ • Chrome (latest) • Google Maps installed • signed into the preview at `https://id-preview--0d3101bb-9764-405c-8d64-1cd8781cef23.lovable.app` • event detail page open (e.g. Hagia Sophia) at `/app/event/<id>`.

**Pre-roll reset**: Chrome → ⋮ → Settings → Site settings → Location → tap preview host → **Reset permissions**. Force-stop Chrome. Reopen the event detail page. Start the screen recorder.

---

## Part 1 — GRANTED flow (0:00 – 0:45)

| Time | Tap / Action | Expected UI state |
|------|--------------|-------------------|
| 0:00 | Recording starts on event detail page, scrolled to top. | Header visible, "Getting there" card below the fold. |
| 0:03 | Scroll down to **Getting there** section. | Section title, primary button **Use my location**, static **Open directions in Google Maps** button, 3 mode cards (Metro/Tram, Taxi, Walking). No denied note. |
| 0:08 | Tap **Use my location**. | Button shows spinner. Chrome shows system prompt: **"<host> wants to know your location"** with **Allow** / **Block**. |
| 0:11 | Tap **Allow**. | Prompt dismisses. Spinner stops within ~1s. New Chrome tab opens — or Android shows the **"Open with"** sheet with Google Maps. |
| 0:14 | Tap **Google Maps** → **Always** (or **Just once**). | Maps opens to **Directions** view. Origin shows **Your location** with live coordinates. Destination is the landmark. Default mode: **Transit**. |
| 0:22 | Switch back to Chrome (recent apps). | "Getting there" still visible. Denied note still hidden. |
| 0:25 | Tap **Metro/Tram** card. | Maps reopens, directions with **Transit** mode, origin = Your location. |
| 0:30 | Back to Chrome. Tap **Taxi** card. | Maps reopens, **Driving** mode, origin = Your location. |
| 0:36 | Back to Chrome. Tap **Walking** card. | Maps reopens, **Walking** mode, origin = Your location. |
| 0:42 | Back to Chrome. | All 4 buttons confirmed. No fallback note ever appeared. |

URL spot-check (pause recording, long-press the primary button, **Copy link address**): must contain `maps/dir/?api=1`, `destination=`, `origin=<lat>,<lng>`, `travelmode=transit`.

---

## Part 2 — Reset (0:45 – 0:55)

| Time | Tap / Action | Expected UI state |
|------|--------------|-------------------|
| 0:45 | Chrome → ⋮ → Settings → Site settings → Location. | Site list visible. |
| 0:48 | Tap preview host → **Reset permissions** → confirm. | Permission cleared. |
| 0:52 | Back to event detail page → pull-to-refresh. | "Getting there" section re-renders, denied note hidden. |

---

## Part 3 — DENIED flow (0:55 – 1:30)

| Time | Tap / Action | Expected UI state |
|------|--------------|-------------------|
| 0:55 | Scroll to **Getting there**. | Same initial state as 0:03. |
| 0:58 | Tap **Use my location**. | Spinner appears. System prompt: **Allow** / **Block**. |
| 1:01 | Tap **Block**. | Prompt dismisses. **Within ~1s**: spinner stops, **no new tab opens**, fallback note `gettingThere.deniedNote` becomes visible directly under the primary button. Static **Open directions in Google Maps** button and 3 mode cards still enabled. |
| 1:06 | Tap **Open directions in Google Maps**. | Maps opens. Directions view. Origin field is **empty / "Choose starting point"**. Destination = landmark. Mode = Transit. |
| 1:12 | Back to Chrome. Tap **Metro/Tram**. | Maps opens, **Transit** mode, **no origin**. |
| 1:17 | Back to Chrome. Tap **Taxi**. | Maps opens, **Driving** mode, **no origin**. |
| 1:22 | Back to Chrome. Tap **Walking**. | Maps opens, **Walking** mode, **no origin**. |
| 1:27 | Back to Chrome. Tap **Use my location** again. | Chrome does **not** re-prompt (decision cached). Denied note stays visible. No new tab. |
| 1:30 | Stop recording. | Done. |

URL spot-check (denied path): must contain `maps/dir/?api=1`, `destination=`, `travelmode=<mode>`, **no `origin=` parameter**.

---

## Pass criteria (tick on review)

- [ ] 0:11 — system prompt appeared after tapping **Use my location**
- [ ] 0:14 — Maps opened with live `origin=<lat>,<lng>` and `travelmode=transit`
- [ ] 0:25 / 0:30 / 0:36 — mode cards opened Maps with correct `travelmode` and origin
- [ ] 0:42 — denied note never shown during granted flow
- [ ] 1:01 — denied note appeared **immediately** after Block, no new tab
- [ ] 1:06 / 1:12 / 1:17 / 1:22 — all 4 fallback buttons opened Maps without `origin`
- [ ] 1:27 — re-tapping after deny does not crash, does not reprompt, keeps note visible
- [ ] No console errors, no layout shift, buttons remained thumb-reachable throughout

## Fail triggers (re-record)

- Spinner never stops after Allow/Block → loading state leak.
- New tab opens during the denied flow → fallback path is firing geolocation unexpectedly.
- Denied note missing or delayed >2s → state update bug in `GettingThere.tsx`.
- Any mode card opens Maps with the wrong `travelmode` or wrong/missing origin for its state.
- Re-tap after deny re-triggers the system prompt → permission handling regression.
