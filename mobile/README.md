# Agora — iOS & Android app

The apps are a [Capacitor 8](https://capacitorjs.com) shell around a static build of the same web code in `../src`. You keep developing the product in Lovable; this folder only holds the native projects.

```
../src  ──VITE_AGORA_NATIVE=1 vite build──▶  ../dist/client (SPA)  ──cap sync──▶  ios/ · android/
                                                     │
                     server functions (/_serverFn/…) └──▶ https://ago-ra.life  (CORS in ../src/server.ts)
                     auth, data                      └──▶ Supabase (directly, as on the web)
```

- Everything native-specific in the web code is gated on `IS_NATIVE_APP` (`../src/lib/site.ts`), a build-time constant, so the website is unchanged.
- This folder has its own `package.json`; nothing here touches the root dependencies that Lovable manages.

## Requirements

- Node 22+ and [bun](https://bun.sh) (`brew install oven-sh/bun/bun`)
- iOS: macOS with **Xcode 26+**
- Android: **Android Studio 2025.2.1+** (bundles the JDK)

## Run it

```bash
# once, from the repo root: the exact dependency versions Lovable uses
bash scripts/install-outside-lovable.sh

cd mobile
npm install

npm run ios       # builds the web bundle, copies it into the project, opens Xcode
npm run android   # same for Android Studio
```

In Xcode pick a simulator and press ▶. To run on your own iPhone, open **Signing & Capabilities** and choose your Apple ID as the team (a free personal team is enough for your own device; the paid Developer Program is only needed for TestFlight/App Store).

After changing web code: `npm run sync` (or `npm run ios` / `npm run android`) again.

> **The backend must be published first.** The app calls the server functions on https://ago-ra.life, which only answer the app after the CORS change in `src/server.ts` is live — merge the PR and press **Publish** in Lovable. To test against another deployment: `VITE_AGORA_API_ORIGIN=https://<host> npm run sync`.

## What's in v1 (and what isn't yet)

| Works | Not yet |
|---|---|
| Email sign-up / sign-in, password reset (finished on the website) | Google / Apple sign-in in the app (needs native sign-in; Google blocks OAuth in web views) |
| Everything in `/app` and `/biz` | Push notifications |
| Directions open the Google Maps / Yandex apps | Deep links (ago-ra.life links opening the app) |
| Location ("use my location") and photo memories, with permission prompts | Native session storage — the session lives in the web view's localStorage; if iOS ever clears it, the user signs in again |
| Map page falls back to a keyless Google embed when the Maps JS key rejects the app | |

## Icons and splash

Sources are rendered from the logo (`../public/favicon.svg`):

```bash
node scripts/make-asset-sources.mjs   # → assets/*.png
npm run assets                        # → every iOS/Android size
```

## Before submitting to the stores

- **Accounts:** Apple Developer Program ($99/year) and Google Play Console ($25 once). New personal Play accounts must run a closed test with at least 12 testers for 14 days before production.
- **Account deletion inside the app** — required by both stores for apps with sign-up. *Not implemented yet.*
- **User-generated content** (memory photos, captions, events): Apple requires a way to report content and block users. *Not implemented yet.*
- **Sign in with Apple** becomes required on iOS as soon as Google sign-in is added to the app.
- Privacy policy URL (`https://ago-ra.life/privacy`), App Store privacy labels and the Play Data safety form.
- App Store names must be unique — "Agora" is likely taken; the home-screen name can stay "Agora" while the store listing uses e.g. "Agora: Meet IRL".
- `appId` (`life.agora.app` in `capacitor.config.ts`) can't change after the first upload.
- The iOS app is iPhone-only and both apps are portrait-only for now.

## Device check for the 28 Oct 2026 web changes

The web layer changed on 28 Oct (talking compass, results page with a sticky "Tell Agora…" input, confirmed RSVP, community pages, Turkish). Nothing in `mobile/` changed, but the apps ship that web code, so the same flows need one pass on real devices before any build is shared:

- **Build to test:** the debug APK built by CI for PR #10 (workflow run 40746528661, artifact `agora-android-debug-apk`), or `npm run android` / `npm run ios` locally against the published backend (the app calls server functions by ID; a build older than 28 Oct will not work with the current backend because `searchEvents` was replaced by `discoverEvents`).
- **Checklist (iOS Safari-style WebView and Android WebView):** compass direction → results page opens with the conversation; the bottom input stays above the keyboard and the home indicator; typing a follow-up keeps the chips; Android back from an event returns to the results with the conversation intact; "I'm going" → confirmation → calendar shows it; cancel → calendar clears; language switch from the drawer; reduced-motion setting stops the needle/bezel animation.
- **Still not native:** no microphone or camera plugin is wired (none is shown in the UI); Google/Apple sign-in, push and deep links remain as listed above.
