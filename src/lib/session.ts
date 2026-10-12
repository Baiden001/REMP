// Staff are signed out after this long without activity, even if the browser
// kept them signed in (closed tab, installed app, cached page).
export const IDLE_LIMIT_MS = 30 * 60 * 1000;

// Timestamp of the last activity. Refreshed by the browser while someone is
// active and by the middleware on every page load; it also expires by itself
// after the idle limit, so a dormant browser has nothing to present.
export const ACTIVITY_COOKIE = "remp_last_active";
const ACTIVITY_STORAGE_KEY = "remp_last_active";
export const SIGNED_OUT_STORAGE_KEY = "remp_signed_out";

// The cookie carries a Max-Age, so the browser deletes it by itself after 30
// minutes without a refresh. Its presence is what counts; the value is never
// compared with the server's clock, so a device whose clock is off (common on
// desktops) isn't signed out the moment it signs in.
export function hasActivityCookie(value: string | undefined | null) {
  return !!value && Number(value) > 0;
}

// Someone who signed in moments ago is active, even if the browser hasn't
// stored the activity cookie yet (e.g. a login page loaded before an update).
export const FRESH_SIGN_IN_MS = 5 * 60 * 1000;

// Browser only.
export function markActive(now = Date.now()) {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${ACTIVITY_COOKIE}=${now}; path=/; max-age=${IDLE_LIMIT_MS / 1000}; samesite=lax${secure}`;
  try {
    window.localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now));
  } catch {}
}

// Browser only: most recent activity across all open tabs, by this device's own
// clock (the cookie may carry the server's time, so its value isn't used here).
export function lastActivity() {
  try {
    const stored = Number(window.localStorage.getItem(ACTIVITY_STORAGE_KEY)) || 0;
    if (stored) return stored;
  } catch {}
  // No local record (private mode, storage blocked): fall back to the cookie being alive.
  return activityCookiePresent() ? Date.now() : 0;
}

// Browser only: the activity cookie expires by itself after 30 idle minutes.
export function activityCookiePresent() {
  return document.cookie.split("; ").some((c) => c.startsWith(`${ACTIVITY_COOKIE}=`) && c.length > ACTIVITY_COOKIE.length + 1);
}

// Browser only: forget activity and tell other tabs to leave too.
export function clearActivity() {
  document.cookie = `${ACTIVITY_COOKIE}=; path=/; max-age=0; samesite=lax`;
  try {
    window.localStorage.removeItem(ACTIVITY_STORAGE_KEY);
    window.localStorage.setItem(SIGNED_OUT_STORAGE_KEY, String(Date.now()));
  } catch {}
}
