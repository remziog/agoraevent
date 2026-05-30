/**
 * Offline PWA verification — cross-browser Playwright script.
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
 *   npm i -D playwright
 *   npx playwright install chromium firefox webkit
 *
 * --- Run ---
 *   BASE_URL=https://agoraevent.lovable.app \
 *   EVENT_PATH=/app/event/<concert-event-id> \
 *   BROWSERS=chromium,firefox,webkit \
 *   node tests/offline-pwa.mjs
 *
 * Exits 0 only if every selected browser passes every check.
 *
 * Note: WebKit and Firefox have narrower service-worker semantics than
 * Chromium (stricter cross-origin cache behavior, different fromServiceWorker
 * reporting). The script reports per-browser results so you can see which
 * engines pass cleanly.
 */
import { chromium, firefox, webkit } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "https://agoraevent.lovable.app";
const EVENT_PATH = process.env.EVENT_PATH;
const TIMEOUT = Number(process.env.TIMEOUT_MS ?? 30_000);
const ENGINES = (process.env.BROWSERS ?? "chromium,firefox,webkit")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ENGINE_MAP = { chromium, firefox, webkit };
const STATIC_MAP_HOST = "maps.googleapis.com";
const STATIC_MAP_PATH = "/maps/api/staticmap";

if (!EVENT_PATH) {
  console.error("✗ Set EVENT_PATH to the concert event route, e.g. /app/event/<uuid>");
  process.exit(2);
}

async function runForEngine(engineName) {
  const launcher = ENGINE_MAP[engineName];
  const checks = [];
  const assert = (name, cond, detail = "") => {
    checks.push({ name, ok: !!cond, detail });
    console.log(`  ${cond ? "✓" : "✗"} ${name}${detail ? `  — ${detail}` : ""}`);
  };

  if (!launcher) {
    assert(`browser '${engineName}' available`, false);
    return { engine: engineName, checks };
  }

  console.log(`\n=========== ${engineName.toUpperCase()} ===========`);

  let browser;
  try {
    browser = await launcher.launch();
  } catch (e) {
    assert(`launch ${engineName}`, false, e.message);
    return { engine: engineName, checks };
  }

  const context = await browser.newContext({
    serviceWorkers: "allow",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  let staticMapOnlineResponse = null;
  context.on("response", (res) => {
    const url = new URL(res.url());
    if (url.hostname === STATIC_MAP_HOST && url.pathname.startsWith(STATIC_MAP_PATH)) {
      staticMapOnlineResponse = { status: res.status() };
    }
  });

  try {
    // 1. Install SW
    console.log(`[1/4] Visiting ${BASE_URL} to install the service worker…`);
    await page.goto(BASE_URL, { waitUntil: "load", timeout: TIMEOUT });

    const swState = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return { supported: false };
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((r) => setTimeout(() => r(null), 10_000)),
      ]).catch(() => null);
      return {
        supported: true,
        scope: reg?.scope ?? null,
        state: reg?.active?.state ?? null,
      };
    });
    assert("Service worker supported", swState.supported);
    assert("Service worker activated", swState.state === "activated", `state=${swState.state}`);

    if (swState.state !== "activated") {
      throw new Error("SW did not activate — published domain + allowlist required.");
    }

    // 2. Warm cache
    console.log(`[2/4] Warming cache: ${BASE_URL}${EVENT_PATH}`);
    await page.goto(BASE_URL + EVENT_PATH, { waitUntil: "networkidle", timeout: TIMEOUT });
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
      staticMapOnlineResponse ? `status=${staticMapOnlineResponse.status}` : "no request seen",
    );

    const cacheState = await page.evaluate(async (mapHost) => {
      if (!("caches" in window)) return { available: false };
      const names = await caches.keys();
      const out = { available: true, names, mapCached: false, shellCached: false };
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
    assert("CacheStorage API available", cacheState.available);
    assert("Cache contains '/'", cacheState.shellCached, `caches=${(cacheState.names ?? []).join(",")}`);
    assert("Static map cached", cacheState.mapCached);

    // 3. Offline reload
    console.log("[3/4] Going offline and reloading the concert page…");
    await context.setOffline(true);
    const offlineResp = await page
      .reload({ waitUntil: "load", timeout: TIMEOUT })
      .catch((e) => {
        console.warn("  reload threw:", e.message);
        return null;
      });
    assert("Page reloaded while offline", !!offlineResp, offlineResp ? `status=${offlineResp.status()}` : "navigation failed");

    // 4. Verify cached content
    console.log("[4/4] Verifying cached content rendered…");
    const bodyText = (await page.textContent("body").catch(() => "")) ?? "";
    assert("Body has rendered text", bodyText.trim().length > 50, `chars=${bodyText.length}`);
    assert("Not a browser offline error page", !/no internet|err_internet_disconnected|offline/i.test(bodyText.slice(0, 200)));

    const mapImg = await page.evaluate((host) => {
      const imgs = Array.from(document.querySelectorAll("img"));
      const m = imgs.find((i) => i.src.includes(host));
      return m ? { src: m.src, complete: m.complete, naturalWidth: m.naturalWidth } : null;
    }, STATIC_MAP_HOST);
    assert("Static map <img> in DOM", !!mapImg, mapImg ? mapImg.src.slice(0, 80) + "…" : "no img matched");
    assert(
      "Static map image loaded from cache",
      mapImg && mapImg.complete && mapImg.naturalWidth > 0,
      mapImg ? `naturalWidth=${mapImg.naturalWidth}` : "",
    );

    await context.setOffline(false);
  } catch (err) {
    assert("run completed without fatal error", false, err.message);
  } finally {
    await browser.close();
  }

  return { engine: engineName, checks };
}

(async () => {
  const results = [];
  for (const eng of ENGINES) {
    results.push(await runForEngine(eng));
  }

  console.log("\n=============== SUMMARY ===============");
  let anyFailed = false;
  for (const r of results) {
    const passed = r.checks.filter((c) => c.ok).length;
    const total = r.checks.length;
    const status = passed === total ? "PASS" : "FAIL";
    if (status === "FAIL") anyFailed = true;
    console.log(`  ${status}  ${r.engine.padEnd(10)}  ${passed}/${total}`);
    if (status === "FAIL") {
      r.checks.filter((c) => !c.ok).forEach((c) => {
        console.log(`         ✗ ${c.name}${c.detail ? `  — ${c.detail}` : ""}`);
      });
    }
  }
  process.exitCode = anyFailed ? 1 : 0;
})();
