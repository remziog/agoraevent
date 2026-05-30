# "Getting There" — Mobile Permission Test Flow

End-to-end manual QA for the **Use my location** flow in `src/components/GettingThere.tsx`, covering both **granted** and **denied** geolocation permissions on a real phone. Run on iOS Safari and Android Chrome.

## Prerequisites

- Open the preview URL on your phone: `https://id-preview--0d3101bb-9764-405c-8d64-1cd8781cef23.lovable.app`
- Sign in (the event detail route is auth-gated).
- Pick any landmark event from `/app/memories` or the home feed, e.g. **Hagia Sophia**.
- Make sure Google Maps is installed (recommended) — links will still resolve in the browser if not.

Reset permissions before each run so the prompt actually appears:
- **iOS Safari**: Settings → Safari → Location → **Ask**. Also: Settings → Privacy & Security → Location Services → Safari Websites → **Ask Next Time**.
- **Android Chrome**: Chrome → ⋮ → Settings → Site settings → Location → tap the preview host → **Reset permissions**.

---

## iOS Safari — Tap-by-tap Permission Tests

Mirrors the Android Chrome flow, but accounts for iOS's two-layer permission model (system Location Services + per-site Safari prompt) and Safari's per-tab caching of "Don't Allow".

### iOS reset (do this between every run)

1. Settings → Privacy & Security → Location Services → **On**.
2. Same screen → scroll to **Safari Websites** → **Ask Next Time Or When I Share**.
3. Open Safari → tap the **tabs** icon (bottom-right) → swipe up to **close the preview tab**. (Safari caches a denied decision for the tab's lifetime.)
4. Open a fresh tab → paste the preview URL → tap **Go**.

### iOS Test A — GRANTED

1. Sign in. Navigate to an event detail page (e.g. Hagia Sophia).
2. Scroll to **Getting there**.
3. Tap **Use my location**.
4. iOS shows the native sheet: **"…would like to use your current location"** with **Allow Once / Allow While Using / Don't Allow**. Tap **Allow Once**.
5. Within ~1s the system app-switch banner appears: **"Open in Google Maps?"** (or Safari opens a new tab to `maps.google.com` if the app isn't installed). Tap **Open**.
6. UI checks back in Safari (swipe up from the home indicator → return to Safari):
   - Spinner on the button has stopped.
   - The **deniedNote** is **not** visible.
   - The three mode cards (Metro/Tram, Taxi, Walking) are tappable.
7. In Google Maps, confirm the **directions** view loaded (not a place card) with **Your location** as the starting point.
8. Back in Safari, long-press the **Use my location** button → **Copy Link**. Paste into Notes and verify the URL contains:
   - `google.com/maps/dir/?api=1`
   - `destination=…`
   - `origin=<lat>,<lng>` ← required
   - `travelmode=transit`
9. Tap each mode card in turn. After each, swipe back to Safari and confirm the previous tap opened directions with the correct `travelmode` (`transit` / `driving` / `walking`) and the same `origin`.

Pass: directions opened with live origin on all four buttons; no fallback note shown.

### iOS Test B — DENIED

1. Perform the **iOS reset** above (closing the tab is mandatory).
2. Reopen the event detail page → scroll to **Getting there**.
3. Tap **Use my location**.
4. On the iOS permission sheet, tap **Don't Allow**.
5. UI checks (must all happen within ~1s, no new tab):
   - Button spinner stops.
   - The fallback note `gettingThere.deniedNote` becomes visible directly under the button.
   - No app-switch banner, no new Safari tab.
   - The static **Open directions in Google Maps** button is visible and enabled.
   - The three mode cards remain visible and enabled.
6. Tap **Open directions in Google Maps**. Accept the **"Open in Google Maps?"** banner.
7. Verify the URL (long-press the button → Copy Link):
   - `google.com/maps/dir/?api=1`
   - `destination=…`
   - `travelmode=transit`
   - **No `origin=` parameter** — Google Maps prompts "Choose starting point" / uses "Your location" placeholder.
8. Back in Safari, tap **Metro/Tram**, then **Taxi**, then **Walking**. For each, confirm Maps opens directions with the matching `travelmode` and no `origin`.
9. Re-tap **Use my location**. iOS should **not** re-prompt (decision is cached for the tab). Confirm the deniedNote stays visible and nothing else changes.

Pass: no crash, fallback note shown immediately, all four buttons open valid directions without an origin.

### iOS-specific gotchas

- If the permission sheet never appears, Location Services is off at the system level — re-check Settings → Privacy & Security → Location Services.
- If Safari opens `maps.google.com` in a new tab instead of the Google Maps app, that's expected when the app isn't installed; the URL assertions still apply.
- "Allow While Using" treats the decision as persistent across reloads — only **Allow Once** matches a real first-time grant for repeat testing.
- Private Browsing tabs clear permission state automatically and are the fastest way to re-test repeatedly.

---

## Test A — Permission GRANTED

Goal: confirm the primary CTA opens Google Maps **directions** with the user's coordinates as the origin and `travelmode=transit`.

1. Open the event detail page (e.g. `/app/event/<hagia-sophia-id>`).
2. Scroll to the **Getting there** section.
3. Tap **Use my location**.
4. When the OS prompt appears, tap **Allow** (iOS: "Allow Once" is fine).
5. Expect: a new tab/Google Maps app opens to a directions screen.
6. Verify the URL (long-press the address bar → Copy) contains:
   - `google.com/maps/dir/?api=1`
   - `destination=<encoded landmark name or coords>`
   - `origin=<your lat>,<your lng>` ← must be present
   - `travelmode=transit`
7. Go back to the app. Tap each mode card and confirm the same shape with the correct `travelmode`:
   - **Metro/Tram** → `travelmode=transit`
   - **Taxi** → `travelmode=driving`
   - **Walking** → `travelmode=walking`
8. Confirm the **denied note** (`gettingThere.deniedNote`) is **not** visible.

Pass criteria: directions open with your live origin; no error toast; denied note hidden.

---

## Test B — Permission DENIED

Goal: confirm graceful fallback — the friendly note appears and the static **Open directions in Google Maps** button still works without an origin (Maps asks the user for one).

1. Reset location permission (see Prerequisites) so the prompt fires fresh.
2. Reload the event detail page.
3. Scroll to **Getting there**.
4. Tap **Use my location**.
5. When the OS prompt appears, tap **Don't Allow** / **Block**.
6. Expect, within ~1s:
   - No new tab opens.
   - The loading spinner stops.
   - The fallback note `gettingThere.deniedNote` is visible under the button.
7. Tap **Open directions in Google Maps** (the static fallback button).
8. Expect: Google Maps opens to a directions screen. Verify URL:
   - `google.com/maps/dir/?api=1`
   - `destination=<encoded landmark>`
   - `travelmode=transit`
   - **No `origin=` parameter** — Maps should prompt for "Your location" or "Choose starting point".
9. Tap each mode card (Metro/Tram, Taxi, Walking). Each should open Maps directions with the matching `travelmode` and no `origin`.

Pass criteria: no crash, no blank tab, fallback note shown, all four buttons (primary + 3 modes) still open valid Maps directions.

---

## Test C — No Geolocation API (degraded browser)

Optional sanity check for older WebViews.

1. In Chrome DevTools device emulation, set Sensors → Location → **Location unavailable**, or test on a browser without `navigator.geolocation`.
2. Tap **Use my location**.
3. Expect: same outcome as Test B (denied note + working fallback).

---

## Regression checklist

After any change to `GettingThere.tsx` or related i18n keys:

- [ ] Test A passes on iOS Safari
- [ ] Test A passes on Android Chrome
- [ ] Test B passes on iOS Safari
- [ ] Test B passes on Android Chrome
- [ ] Mode cards (transit/driving/walking) carry the correct `travelmode` in both states
- [ ] `gettingThere.deniedNote` renders in EN, RU, TR, DE
- [ ] Buttons remain thumb-reachable (`size="lg"`, `flex-1`, `grid-cols-3` cards)

## Known limitations

- Headless Chromium in the Lovable browser tool cannot trigger real OS geolocation prompts, so these tests must run on a physical device.
- iOS Safari may cache "Don't Allow" for the session — fully close the tab between Test A and Test B if the prompt does not re-appear.
