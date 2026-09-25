// Staff are signed out after this long without activity, even if the browser
// kept them signed in (closed tab, installed app, cached page).
export const IDLE_LIMIT_MS = 30 * 60 * 1000;

// Timestamp of the last activity. Refreshed by the browser while someone is
// active and by the middleware on every page load; it also expires by itself
// after the idle limit, so a dormant browser has nothing to present.
export const ACTIVITY_COOKIE = "remp_last_active";
const ACTIVITY_STORAGE_KEY = "remp_last_active";
export const SIGNED_OUT_STORAGE_KEY = "remp_signed_out";

export function isActivityFresh(value: string | undefined | null, now = Date.now()) {
  const last = Number(value);
  return Number.isFinite(last) && last > 0 && now - last < IDLE_LIMIT_MS && last <= now + 60_000;
}

// Browser only.
export function markActive(now = Date.now()) {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${ACTIVITY_COOKIE}=${now}; path=/; max-age=${IDLE_LIMIT_MS / 1000}; samesite=lax${secure}`;
  try {
    window.localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now));
  } catch {}
}

// Browser only: most recent activity across all open tabs.
export function lastActivity() {
  let stored = 0;
  try {
    stored = Number(window.localStorage.getItem(ACTIVITY_STORAGE_KEY)) || 0;
  } catch {}
  const cookie = document.cookie.split("; ").find((c) => c.startsWith(`${ACTIVITY_COOKIE}=`));
  const fromCookie = Number(cookie?.split("=")[1]) || 0;
  return Math.max(stored, fromCookie);
}

// Browser only: forget activity and tell other tabs to leave too.
export function clearActivity() {
  document.cookie = `${ACTIVITY_COOKIE}=; path=/; max-age=0; samesite=lax`;
  try {
    window.localStorage.removeItem(ACTIVITY_STORAGE_KEY);
    window.localStorage.setItem(SIGNED_OUT_STORAGE_KEY, String(Date.now()));
  } catch {}
}
