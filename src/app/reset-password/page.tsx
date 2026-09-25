"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "../auth-shell";
import { clearActivity } from "@/lib/session";

// Opened from the one-time link IT sends. The link is only used when the form is
// submitted, so WhatsApp/email link previews can't use it up.
export default function ResetPasswordPage() {
  const supabase = createClient();
  const [tokenHash, setTokenHash] = useState<string | null | undefined>(undefined);
  const [verified, setVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkDead, setLinkDead] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTokenHash(new URLSearchParams(window.location.search).get("token_hash"));
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Your password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setSaving(true);

    if (!verified) {
      const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: "recovery" });
      if (verifyError) {
        setSaving(false);
        setLinkDead(true);
        return;
      }
      setVerified(true);
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setSaving(false);
      setError(
        /different from the old/i.test(updateError.message)
          ? "Choose a password you haven't used before."
          : updateError.message
      );
      return;
    }

    // Sign out everywhere so the new password is needed on every device.
    clearActivity();
    await supabase.auth.signOut({ scope: "global" });
    window.location.replace("/login?reset=1");
  }

  if (tokenHash === undefined) {
    return <AuthShell eyebrow="PASSWORD RESET" title="Set a new password" subtitle="Loading…">{null}</AuthShell>;
  }

  if (!tokenHash || linkDead) {
    return (
      <AuthShell
        eyebrow="PASSWORD RESET"
        title="This link can't be used"
        subtitle="It may have expired, already been used, or been replaced by a newer link."
      >
        <div className="auth-form">
          <p className="auth-notice">Ask IT for a new reset link, or send a fresh request below.</p>
          <a href="/forgot-password" className="auth-submit auth-submit-link">
            Request a new link
          </a>
          <a href="/login" className="auth-link auth-link-center">
            Back to sign in
          </a>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="PASSWORD RESET"
      title="Set a new password"
      subtitle="Choose a new password for your REMP account. You'll sign in with it straight after."
    >
      <form onSubmit={handleSubmit} className="auth-form">
        <label className="auth-field">
          <span>New password</span>
          <div className="auth-password">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        <label className="auth-field">
          <span>Confirm new password</span>
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Type it again"
          />
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" disabled={saving} className="auth-submit">
          {saving ? "Saving…" : "Save new password"}
        </button>
      </form>
    </AuthShell>
  );
}
