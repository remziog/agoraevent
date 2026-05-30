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
