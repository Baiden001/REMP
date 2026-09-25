"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IDLE_LIMIT_MS, SIGNED_OUT_STORAGE_KEY, clearActivity, lastActivity, markActive } from "@/lib/session";

const WARN_BEFORE_MS = 60 * 1000;
const WRITE_EVERY_MS = 20 * 1000;
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"] as const;

// Signs staff out after 30 minutes without activity, across every open tab.
export default function IdleGuard() {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastWrite = useRef(0);
  const leaving = useRef(false);

  const signOut = useCallback(async (reason: "idle" | "elsewhere") => {
    if (leaving.current) return;
    leaving.current = true;
    if (reason === "idle") clearActivity();
    try {
      await createClient().auth.signOut({ scope: "local" });
    } catch {}
    window.location.replace(reason === "idle" ? "/login?reason=idle" : "/login");
  }, []);

  const check = useCallback(() => {
    const idleFor = Date.now() - lastActivity();
    if (idleFor >= IDLE_LIMIT_MS) {
      signOut("idle");
      return;
    }
    const left = IDLE_LIMIT_MS - idleFor;
    setSecondsLeft(left <= WARN_BEFORE_MS ? Math.ceil(left / 1000) : null);
  }, [signOut]);

  const stayActive = useCallback(() => {
    markActive();
    lastWrite.current = Date.now();
    setSecondsLeft(null);
  }, []);

  useEffect(() => {
    // A page restored from the back/forward cache or reopened after a long time
    // must be re-checked before anything is shown.
    if (Date.now() - lastActivity() >= IDLE_LIMIT_MS) {
      signOut("idle");
      return;
    }
    stayActive();

    function onActivity() {
      if (leaving.current) return;
      // Any real activity (including during the warning) keeps the session; writes are throttled.
      const now = Date.now();
      if (now - lastActivity() >= IDLE_LIMIT_MS) return check();
      if (now - lastWrite.current > WRITE_EVERY_MS) {
        markActive(now);
        lastWrite.current = now;
        setSecondsLeft(null);
      }
    }

    function onVisible() {
      if (document.visibilityState === "visible") check();
    }

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) window.location.reload();
    }

    function onStorage(event: StorageEvent) {
      if (event.key === SIGNED_OUT_STORAGE_KEY) signOut("elsewhere");
    }

    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("storage", onStorage);
    const timer = window.setInterval(check, 5000);

    return () => {
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, onActivity));
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(timer);
    };
  }, [check, signOut, stayActive]);

  if (secondsLeft === null) return null;

  return (
    <div className="modal-backdrop idle-warning" role="alertdialog" aria-modal="true" aria-labelledby="idle-title">
      <section className="modal">
        <p className="eyebrow">SECURITY</p>
        <h2 id="idle-title">Still there?</h2>
        <p>
          You&apos;ve been inactive for a while. For security you&apos;ll be signed out in{" "}
          <b>{secondsLeft} second{secondsLeft === 1 ? "" : "s"}</b>.
        </p>
        <div className="modal-actions">
          <button type="button" className="button ghost" onClick={() => signOut("idle")}>
            Sign out now
          </button>
          <button type="button" className="button primary" onClick={stayActive} autoFocus>
            Stay signed in
          </button>
        </div>
      </section>
    </div>
  );
}
