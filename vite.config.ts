// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// `VITE_AGORA_NATIVE=1 vite build` makes the static SPA that the iOS/Android
// apps ship (mobile/, Capacitor): no Cloudflare worker, and the app shell is
// prerendered to dist/client/index.html. The default build (the website) is
// unchanged. The same variable is read at runtime as IS_NATIVE_APP (src/lib/site.ts).
const isNativeAppBuild = process.env.VITE_AGORA_NATIVE === "1";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  ...(isNativeAppBuild
    ? {
        cloudflare: false as const,
        // The shell is prerendered through a local preview server; bind it to
        // IPv4 loopback (the Lovable default "::" fails on hosts without IPv6).
        vite: { preview: { host: "127.0.0.1" } },
      }
    : {}),
  tanstackStart: {
    server: { entry: "server" },
    ...(isNativeAppBuild ? { spa: { enabled: true, prerender: { outputPath: "/index" } } } : {}),
  },
});
