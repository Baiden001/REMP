"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "../auth-shell";
import { markActive } from "@/lib/session";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Invite links can arrive here if Supabase falls back to the site URL.
  useEffect(() => {
    const { hash, search } = window.location;
    if (/access_token=|error_description=/.test(hash) || /[?&](code|token_hash)=/.test(search)) {
      window.location.replace(`/auth/callback${search}${hash}`);
      return;
    }
    const params = new URLSearchParams(search);
    if (params.get("reason") === "idle") {
      setNotice("You were signed out after 30 minutes of inactivity. Sign in again to continue.");
    } else if (params.get("reset") === "1") {
      setNotice("Your password has been changed. Sign in with your new password.");
    }
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    markActive();
    router.refresh();
    router.push("/dashboard");
  }

  return (
    <AuthShell
      eyebrow="STAFF PORTAL"
      title="Sign in to REMP"
      subtitle="Use your Resilience work account to continue."
    >
      <form onSubmit={handleSubmit} className="auth-form">
        {notice && <p className="auth-notice">{notice}</p>}

        <label className="auth-field">
          <span>Work email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@resilienceghana.com"
          />
        </label>

        <label className="auth-field">
          <span className="auth-label-row">
            Password
            <a href="/forgot-password" className="auth-link">
              Forgot password?
            </a>
          </span>
          <div className="auth-password">
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
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

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" disabled={loading} className="auth-submit">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
