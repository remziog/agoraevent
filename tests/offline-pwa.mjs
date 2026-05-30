/**
 * Offline PWA verification — Playwright script.
 *
 * Verifies that on a published Agora domain:
 *   1. The service worker installs and activates.
 *   2. After warming the cache online, the concert event page still renders
 *      with network disabled.
 *   3. The Google Static Map image is served from the SW cache while offline.
 *
 * The SW only registers on production hostnames (see src/lib/register-sw.ts),
 * so this script must point at a published URL — not the editor preview.
 *
 * --- Setup ---
 *   npm i -D @playwright/test
 *   npx playwright install chromium
 *
 * --- Run ---
 *   BASE_URL=https://agoraevent.lovable.app \
 *   EVENT_PATH=/app/event/<concert-event-id> \
 *   node tests/offline-pwa.mjs
 *
 * Exits 0 on success, non-zero on any failed assertion.
 */
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "https://agoraevent.lovable.app";
const EVENT_PATH = process.env.EVENT_PATH; // e.g. /app/event/<uuid>
const TIMEOUT = Number(process.env.TIMEOUT_MS ?? 30_000);

if (!EVENT_PATH) {
  console.error("✗ Set EVENT_PATH to the concert event route, e.g. /app/event/<uuid>");
  process.exit(2);
}

const checks = [];
function assert(name, cond, detail = "") {
  checks.push({ name, ok: !!cond, detail });
  console.log(`${cond ? "✓" : "✗"} ${name}${detail ? `  — ${detail}` : ""}`);
}

const STATIC_MAP_HOST = "maps.googleapis.com";
const STATIC_MAP_PATH = "/maps/api/staticmap";

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    serviceWorkers: "allow",
    viewport: { width: 390, height: 844 }, // mobile-first
  });
  const page = await context.newPage();

  // Track network responses so we can confirm the static map was actually fetched.
  let staticMapOnlineResponse = null;
  const staticMapOfflineRequests = [];
  context.on("response", (res) => {
    const url = new URL(res.url());
    if (url.hostname === STATIC_MAP_HOST && url.pathname.startsWith(STATIC_MAP_PATH)) {
      staticMapOnlineResponse = { url: res.url(), status: res.status(), fromSW: !!res.fromServiceWorker() };
    }
  });

  try {
    // --- 1. Cold visit: install the SW ---
    console.log(`\n[1/4] Visiting ${BASE_URL} to install the service worker…`);
    await page.goto(BASE_URL, { waitUntil: "load", timeout: TIMEOUT });

    // Wait for SW registration + activation.
    const swState = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return { supported: false };
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      return {
        supported: true,
        scope: reg?.scope ?? null,
        state: reg?.active?.state ?? null,
        controller: !!navigator.serviceWorker.controller,
      };
    });
    assert("Service worker is supported", swState.supported);
    assert("Service worker activated", swState.state === "activated", `state=${swState.state}`);
    assert("Scope is root", swState.scope?.endsWith("/"), `scope=${swState.scope}`);

    if (swState.state !== "activated") {
      throw new Error("SW did not activate — is this a published domain in the registration allowlist?");
    }

    // --- 2. Warm the cache by visiting the concert page ---
    console.log(`\n[2/4] Warming cache: ${BASE_URL}${EVENT_PATH}`);
    await page.goto(BASE_URL + EVENT_PATH, { waitUntil: "networkidle", timeout: TIMEOUT });

    // Scroll to force lazy-loaded static map image into view.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
    });
    await page.waitForTimeout(1500);

    assert(
      "Static map fetched while online",
      !!staticMapOnlineResponse && staticMapOnlineResponse.status === 200,
      staticMapOnlineResponse ? `status=${staticMapOnlineResponse.status}` : "no request seen — page may not include a static map",
    );

    // Confirm caches exist and the map URL is stored.
    const cacheState = await page.evaluate(async (mapHost) => {
      const names = await caches.keys();
      const out = { names, mapCached: false, shellCached: false };
      for (const n of names) {
        const cache = await caches.open(n);
        const reqs = await cache.keys();
        for (const r of reqs) {
          const u = new URL(r.url);
          if (u.hostname === mapHost) out.mapCached = true;
          if (u.pathname === "/") out.shellCached = true;
        }
      }
      return out;
    }, STATIC_MAP_HOST);
    assert("Cache 'shell' contains '/'", cacheState.shellCached, `caches=${cacheState.names.join(",")}`);
    assert("Static map cached", cacheState.mapCached);

    // --- 3. Go offline and reload ---
    console.log("\n[3/4] Going offline and reloading the concert page…");
    await context.setOffline(true);

    // Reset trackers; intercept to verify failures are network-level, not SW-bypassed.
    let sawOfflineNetwork = false;
    context.on("request", (req) => {
      const url = new URL(req.url());
      if (url.hostname === STATIC_MAP_HOST && url.pathname.startsWith(STATIC_MAP_PATH)) {
        staticMapOfflineRequests.push(req.url());
      }
    });
    context.on("requestfailed", () => { sawOfflineNetwork = true; });

    const offlineResp = await page.reload({ waitUntil: "load", timeout: TIMEOUT }).catch((e) => {
      console.warn("reload threw:", e.message);
      return null;
    });

    assert("Page reloaded while offline", !!offlineResp, offlineResp ? `status=${offlineResp.status()}` : "navigation failed");

    // --- 4. Verify cached content rendered ---
    console.log("\n[4/4] Verifying cached content rendered…");
    const bodyText = await page.textContent("body").catch(() => "");
    assert("Body has rendered text", bodyText && bodyText.trim().length > 50, `chars=${bodyText?.length ?? 0}`);
    assert("Not a Chrome offline error page", !/no internet|err_internet_disconnected/i.test(bodyText));

    // Static map <img> should be in the DOM and complete (loaded from SW cache).
    const mapImg = await page.evaluate((host) => {
      const imgs = Array.from(document.querySelectorAll("img"));
      const m = imgs.find((i) => i.src.includes(host));
      return m ? { src: m.src, complete: m.complete, naturalWidth: m.naturalWidth } : null;
    }, STATIC_MAP_HOST);
    assert("Static map <img> in DOM", !!mapImg, mapImg ? mapImg.src : "no img matched");
    assert(
      "Static map image loaded from cache",
      mapImg && mapImg.complete && mapImg.naturalWidth > 0,
      mapImg ? `naturalWidth=${mapImg.naturalWidth}` : "",
    );

    await context.setOffline(false);

    // --- Summary ---
    const failed = checks.filter((c) => !c.ok);
    console.log(`\n— Summary: ${checks.length - failed.length}/${checks.length} passed —`);
    if (failed.length) {
      console.error("Failed checks:");
      failed.forEach((f) => console.error(`  ✗ ${f.name} ${f.detail}`));
      process.exitCode = 1;
    }
  } catch (err) {
    console.error("\nFatal:", err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
