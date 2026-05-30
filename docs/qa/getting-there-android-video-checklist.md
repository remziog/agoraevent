# Android — "Getting There" Video QA Checklist

One-page shot list for recording a single ~90s screen capture on Android Chrome that proves both **granted** and **denied** geolocation flows for `GettingThere.tsx`. Use the phone's built-in screen recorder. Keep the device clock visible (status bar on) so timestamps are auditable.

**Device under test**: Android 13+ • Chrome (latest) • Google Maps installed • signed into the preview at `https://id-preview--0d3101bb-9764-405c-8d64-1cd8781cef23.lovable.app` • event detail page open (e.g. Hagia Sophia) at `/app/event/<id>`.

**Pre-roll reset**: Chrome → ⋮ → Settings → Site settings → Location → tap preview host → **Reset permissions**. Force-stop Chrome. Reopen the event detail page. Start the screen recorder.

---

## Android Emulator reset (use this for repeatable takes)

The Android Emulator (AVD) is the most reliable way to reproduce granted vs denied flows back-to-back because you can script a clean state in seconds. Run on a Mac/Linux/Windows host with Android Studio installed and `adb` + `emulator` on `PATH`. All commands assume a single booted emulator; substitute `-s <serial>` (from `adb devices`) if you run multiple.

### One-time setup

1. Open **Android Studio → Device Manager → Create Virtual Device**.
2. Pick **Pixel 7** with **Android 14 (API 34)** Google Play image (Play Store is required to install Google Maps).
3. Boot the AVD. Sign into a Google account if prompted. Install **Google Maps** from the Play Store (optional — fallback works against `maps.google.com` in Chrome).
4. Open Chrome, sign into the preview once, and add the event detail URL to the Home Screen for fast re-launch.
5. Confirm `adb` sees it: `adb devices` should list the emulator as `emulator-5554 device`.

### Full reset before recording (≈5s)

Run these in a terminal on the host. They reset Chrome's per-site location permission, clear Chrome cache + site data, and confirm system Location Services is on — without rebooting the emulator.

```bash
# 1. Clear Chrome's per-site permissions, cookies, cache, and history.
adb shell pm clear com.android.chrome
# Note: this signs you OUT of Chrome sync. If you need to stay signed in,
# use the GUI path instead (Chrome → ⋮ → Settings → Site settings → Location
# → tap preview host → Reset permissions).

# 2. Make sure system Location Services is ON.
adb shell settings put secure location_mode 3   # 3 = High accuracy

# 3. Force-stop Chrome so the next launch is clean.
adb shell am force-stop com.android.chrome
```

GUI equivalents if you want to keep Chrome signed in:

- **Reset per-site permission only**: Chrome → ⋮ → **Settings → Site settings → Location** → tap preview host → **Reset permissions**.
- **Clear site data only**: Chrome → ⋮ → **Settings → Privacy and security → Clear browsing data** → **Cached images and files** + **Cookies and site data** → time range **All time** → **Clear data**.
- **System Location Services**: Settings → Location → toggle **Off then On**.

### Seed a deterministic GPS fix (required for granted flow)

The emulator has no real GPS — without a seed, `getCurrentPosition` returns the AVD default (Googleplex) or times out. Pick one:

- **GUI**: Emulator toolbar → **⋯ Extended Controls → Location** → enter Istanbul coords (e.g. `41.0086, 28.9802` for Sultanahmet) → **Set Location**.
- **CLI** (preferred for scripts) via the emulator console (port `5554`):

  ```bash
  # Auth token lives in ~/.emulator_console_auth_token
  TOKEN=$(cat ~/.emulator_console_auth_token)
  {
    echo "auth $TOKEN"
    echo "geo fix 28.9802 41.0086"   # NOTE: longitude FIRST, then latitude
    echo "quit"
  } | nc -w 1 localhost 5554
  ```

- **Clear the seed** (to test the "location unavailable" code path):

  ```bash
  TOKEN=$(cat ~/.emulator_console_auth_token)
  { echo "auth $TOKEN"; echo "geo fix 0 0"; echo "quit"; } | nc -w 1 localhost 5554
  ```

### Full pre-record sequence (copy/paste)

```bash
# Reset Chrome state + ensure Location Services on
adb shell pm clear com.android.chrome
adb shell settings put secure location_mode 3
adb shell am force-stop com.android.chrome

# Seed Istanbul GPS (lon, lat)
TOKEN=$(cat ~/.emulator_console_auth_token)
{ echo "auth $TOKEN"; echo "geo fix 28.9802 41.0086"; echo "quit"; } | nc -w 1 localhost 5554

# Open Chrome straight to the event detail page (replace <id>)
adb shell am start -a android.intent.action.VIEW \
  -d "https://id-preview--0d3101bb-9764-405c-8d64-1cd8781cef23.lovable.app/app/event/<id>" \
  com.android.chrome
```

Then in the emulator: sign back into the preview if `pm clear` logged you out, close any old Chrome tabs, and start screen recording from the emulator toolbar (**⋯ Extended Controls → Record screen**) or with:

```bash
adb shell screenrecord /sdcard/getting-there.mp4
# Press Ctrl+C in the terminal to stop; then:
adb pull /sdcard/getting-there.mp4
```

### Between takes (granted → denied or denied → granted)

Run only this — no need to reboot, no need to wipe all Chrome data:

```bash
# Lightweight: reset just the per-site permission via GUI is fastest.
# Or fully reset Chrome again:
adb shell pm clear com.android.chrome
adb shell am force-stop com.android.chrome
```

Then reopen the event detail page so Chrome re-prompts on the next tap.

### Sanity checks before pressing Record

- [ ] `adb devices` lists the emulator as `device` (not `unauthorized` or `offline`).
- [ ] `adb shell settings get secure location_mode` returns `3`.
- [ ] `geo fix` command succeeded (no error in `nc` output).
- [ ] Chrome opens to the event detail page, signed in, no stale permission banner.
- [ ] Status bar / system clock is visible for video timestamps.
- [ ] Google Maps app installed (or you've decided to verify against `maps.google.com`).

### Known Emulator gotchas

- `adb shell pm clear com.android.chrome` is the nuclear option — it signs you out of Chrome sync and wipes ALL site data, not just the preview host. Prefer the GUI per-site reset when you want to stay signed in.
- `geo fix` takes **longitude first, then latitude** — the opposite of most other APIs. Swapping them silently puts you in the wrong hemisphere.
- A `geo fix` is **sticky** until you set a new one or reboot the emulator. Always re-seed before a fresh granted-flow test.
- Without Google Play services (non-`google_apis_playstore` AVD image), the Google Maps app won't install and the "Open with" intent picker won't appear — Chrome will open `maps.google.com` in a new tab instead. URL assertions still apply.
- If `getCurrentPosition` hangs forever, system Location Services is off (`location_mode = 0`) or no `geo fix` has been issued since boot.

---

## Physical Android device reset (use this when recording on real hardware)

Mirrors the Emulator reset, but accounts for real-device constraints: USB debugging must be enabled, `pm clear` doesn't work on system-protected app slots without uninstall, and there is no `geo fix` — real GPS or a mock-location app is the only way to seed coordinates.

### One-time setup

1. On the phone: Settings → About phone → tap **Build number** 7 times to enable Developer options.
2. Settings → System → Developer options → enable **USB debugging**.
3. Plug the device into the host with a data-capable USB cable. On the device, tap **Allow USB debugging** for this host's RSA key (check "Always allow").
4. On the host: `adb devices` must list the phone as `device` (not `unauthorized`). If unauthorized, revoke and re-pair: Developer options → **Revoke USB debugging authorizations** → unplug/replug.
5. Install **Google Chrome** and **Google Maps** from the Play Store (skip Maps only if you'll verify against `maps.google.com`).
6. Sign into the preview once in Chrome and add the event detail URL to the Home Screen.

### Full reset before recording (≈15s)

```bash
# 1. Confirm the right device (use -s <serial> if multiple are attached).
adb devices

# 2. Reset Chrome's per-site permission + clear site data + cache (nuclear).
adb shell pm clear com.android.chrome
# This signs you OUT of Chrome sync on this device. See GUI alternative below
# if you need to stay signed in.

# 3. Confirm system Location Services is ON (High accuracy).
adb shell settings put secure location_mode 3

# 4. Force-stop Chrome so the next launch is clean.
adb shell am force-stop com.android.chrome

# 5. (Optional) Force-stop Google Maps so the "Open with" sheet appears fresh.
adb shell am force-stop com.google.android.apps.maps
```

GUI-only alternative (keeps Chrome signed in):

- Chrome → ⋮ → **Settings → Site settings → Location** → tap preview host → **Reset permissions**.
- Chrome → ⋮ → **Settings → Privacy and security → Clear browsing data** → time range **All time** → check **Cookies and site data** + **Cached images and files** → **Clear data**.
- Settings → Location → toggle **Off → On**, mode = **High accuracy**.

### Full uninstall / reinstall (when state is corrupted)

Use this only if `pm clear` doesn't fix a stuck permission banner or persistent crash:

```bash
# Uninstall Chrome updates (system app on most OEMs — can't fully remove).
adb shell pm uninstall --user 0 com.android.chrome
# Reinstall from Play Store (open Play Store → search Chrome → Update/Install).
# OR sideload a known-good APK:
adb install /path/to/chrome.apk

# Google Maps (user-installed on most phones):
adb uninstall com.google.android.apps.maps
# Reinstall from Play Store.
```

After reinstall, re-grant USB debugging if prompted, re-sign into the preview, and re-add the Home Screen shortcut.

### Seed location on a physical device

There is no `geo fix` over `adb`. Options:

- **Real GPS** (recommended for accuracy): take the phone outside or near a window, open Google Maps once to acquire a fix, then return to Chrome. The browser will use the cached fix for ~30s.
- **Mock location app** (for repeatable Istanbul fix from your desk):
  1. Install **"Lockito"** or **"Mock GPS Location"** from the Play Store.
  2. Settings → System → Developer options → **Select mock location app** → pick the installed app.
  3. In the app, set coordinates to `41.0086, 28.9802` (Sultanahmet) and **Start**.
  4. Verify in Google Maps that the blue dot is in Istanbul before continuing.
- **Clear mock**: in the mock app, **Stop**. Disable "Select mock location app" if testing the no-GPS-available path.

### Full pre-record sequence (copy/paste)

```bash
# Verify connection
adb devices

# Reset Chrome + Location Services + Maps
adb shell pm clear com.android.chrome
adb shell settings put secure location_mode 3
adb shell am force-stop com.android.chrome
adb shell am force-stop com.google.android.apps.maps

# Open Chrome to the event detail page (replace <id>)
adb shell am start -a android.intent.action.VIEW \
  -d "https://id-preview--0d3101bb-9764-405c-8d64-1cd8781cef23.lovable.app/app/event/<id>" \
  com.android.chrome
```

Then on the device: sign back into the preview (Chrome was cleared), confirm the mock-location app is running (if using one), and start the built-in screen recorder (Quick Settings → **Screen Record** → enable **Show touches** under Developer options first so taps are visible on the video).

Optional `adb`-driven recording (max 3 min per clip, no audio):

```bash
adb shell screenrecord --show-touches --bit-rate 6000000 /sdcard/getting-there.mp4
# Ctrl+C to stop, then:
adb pull /sdcard/getting-there.mp4
adb shell rm /sdcard/getting-there.mp4
```

### Between takes (granted → denied or denied → granted)

```bash
adb shell pm clear com.android.chrome
adb shell am force-stop com.android.chrome
```

Reopen the event detail page so Chrome re-prompts on the next tap. Re-confirm the mock-location app is still running if you're testing the granted flow.

### Sanity checks before pressing Record

- [ ] `adb devices` shows the phone as `device` (authorized).
- [ ] `adb shell settings get secure location_mode` returns `3`.
- [ ] Google Maps blue dot is at the expected location (real or mocked).
- [ ] Chrome opens to the event detail page, signed back in, no stale permission banner under the URL bar.
- [ ] Developer options → **Show taps** is ON so the video shows tap targets.
- [ ] Status bar / system clock visible for video timestamps.
- [ ] Battery > 30% (screen recording is power-hungry) or plugged in.

### Known physical-device gotchas

- `pm clear com.android.chrome` signs you out of Chrome sync on this device. Use the GUI per-site reset to stay signed in.
- Many OEM skins (Samsung One UI, Xiaomi MIUI) ship a **forked Chrome** as the default browser. Confirm the package is `com.android.chrome`; on Samsung the system browser is `com.sec.android.app.sbrowser` — use stock Chrome from Play Store for parity with the test plan.
- Battery Saver and **Adaptive Battery** can throttle background geolocation between takes. Disable both during the session.
- Some carriers preinstall a location-permission overlay (e.g., Samsung's "Apps that use location"). Approve once, then the OS-level prompt behaves normally.
- Mock locations require Developer options to remain enabled; toggling Developer options off clears the **Select mock location app** setting.
- If the OS permission prompt never appears, the site already has a stored decision — Chrome's "Reset permissions" wasn't applied to the right host. Confirm you reset the **exact** preview host (id-preview vs published URL are different origins).

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
