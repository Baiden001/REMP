"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "../auth-shell";
import { markActive } from "@/lib/session";
export default function SetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }
    markActive();
    router.push("/dashboard");
    router.refresh();
  }
  return (
    <AuthShell
      eyebrow="ACCOUNT SETUP"
      title="Create your password"
      subtitle="Choose a password for your REMP account. It must be at least 8 characters."
    >
      <form onSubmit={handleSubmit} className="auth-form">
        <label className="auth-field">
          <span>New password</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Create a password"
          />
        </label>

        <label className="auth-field">
          <span>Confirm password</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm your password"
          />
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" disabled={saving} className="auth-submit">
          {saving ? "Creating password…" : "Create password"}
        </button>
      </form>
    </AuthShell>
  );
}
