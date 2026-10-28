// Post-login destinations. Only same-origin paths are accepted (no "//evil.com",
// no absolute URLs, no auth pages), so a `redirect`/`next` param can't be used
// for open redirects.
export function safeRedirect(target: string | undefined | null): string | null {
  if (!target) return null;
  if (!target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) return null;
  if (target.startsWith("/login") || target.startsWith("/signup")) return null;
  return target;
}

// Google sign-in leaves the page for Lovable's OAuth broker and comes back to
// the site root, so the destination is parked in sessionStorage for a few
// minutes and picked up on the landing page.
const KEY = "agora:afterLogin";
const MAX_AGE_MS = 10 * 60 * 1000;

export function rememberAfterLogin(target: string | null) {
  if (!target) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ target, at: Date.now() }));
  } catch {
    /* storage unavailable: the user lands on /app instead */
  }
}

export function takeAfterLogin(): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as { target?: string; at?: number };
    if (!parsed.at || Date.now() - parsed.at > MAX_AGE_MS) return null;
    return safeRedirect(parsed.target);
  } catch {
    return null;
  }
}
