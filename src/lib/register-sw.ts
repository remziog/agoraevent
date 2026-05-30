/**
 * Register the Agora service worker — only on the published production domain.
 * Lovable's preview iframe and dev hosts are explicitly excluded because a SW
 * there would serve stale builds and break navigation.
 */
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const hostname = window.location.hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const isLovablePreview =
    hostname.includes("id-preview--") ||
    hostname.endsWith("lovableproject.com") ||
    hostname.endsWith("lovable.app"); // also covers *.lovable.app preview slugs

  let inIframe = false;
  try {
    inIframe = window.self !== window.top;
  } catch {
    inIframe = true;
  }

  // Allowlist the real production domains only.
  const allowed =
    hostname === "ago-ra.life" ||
    hostname === "www.ago-ra.life" ||
    hostname === "agoraevent.lovable.app";

  if (inIframe || isLocalhost || isLovablePreview || !allowed) {
    // Clean up any previously-registered SW so stale caches can't linger.
    navigator.serviceWorker.getRegistrations?.().then((regs) => {
      regs.forEach((r) => r.unregister().catch(() => {}));
    });
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => console.warn("[sw] registration failed", err));
  });
}
