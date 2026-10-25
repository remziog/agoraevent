// Site-wide constants and the web vs. native-app switch.
//
// The iOS/Android apps (Capacitor, see mobile/) run a static SPA build of this
// same codebase, made with `VITE_AGORA_NATIVE=1 vite build`. Everything native-
// specific is gated on IS_NATIVE_APP, which is a build-time constant: in the web
// build it is `false` and the native branches are dropped from the bundle.

/** Canonical public origin of the website. */
export const SITE_URL = "https://ago-ra.life";

/** True only in the Capacitor iOS/Android build. */
export const IS_NATIVE_APP = import.meta.env.VITE_AGORA_NATIVE === "1";

/**
 * Where the native app sends server-function calls. The app's own origin is
 * `capacitor://localhost` (iOS) / `https://localhost` (Android), which has no
 * server behind it. Override at build time with VITE_AGORA_API_ORIGIN, e.g. to
 * point a test build at the Lovable preview deployment.
 */
export const API_ORIGIN: string =
  (import.meta.env.VITE_AGORA_API_ORIGIN as string | undefined) || SITE_URL;

/**
 * Base URL for links that leave the app and come back through a browser
 * (email confirmation, password reset). On the web that's the current origin
 * (so Lovable previews keep working); in the native app it's the public site.
 */
export function publicSiteUrl(): string {
  if (IS_NATIVE_APP || typeof window === "undefined") return SITE_URL;
  return window.location.origin;
}

/**
 * `fetch` for TanStack server functions in the native app: their URLs are
 * relative (`/_serverFn/<id>`), so prefix them with the API origin. The server
 * answers these cross-origin calls with CORS headers (see src/server.ts); auth
 * travels in the Authorization header, so no cookies are involved.
 */
export const nativeServerFnFetch: typeof fetch = (input, init) => {
  if (typeof input === "string" && input.startsWith("/")) {
    return fetch(`${API_ORIGIN}${input}`, init);
  }
  return fetch(input, init);
};
