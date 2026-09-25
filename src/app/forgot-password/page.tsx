"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "../auth-shell";

// Staff who forgot their password ask IT; IT approves and sends a reset link.
export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("request_password_reset", { p_email: email, p_note: note || null });
    setSending(false);
    if (rpcError) {
      setError("We couldn't send your request. Check your connection and try again.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <AuthShell
        eyebrow="PASSWORD HELP"
        title="Request sent to IT"
        subtitle="If this email belongs to a REMP account, IT has been notified."
      >
        <div className="auth-form">
          <p className="auth-notice">
            Once IT approves your request, they will send you a secure link by WhatsApp or email. Open it to choose a new
            password. The link works once and expires after about an hour.
          </p>
          <a href="/login" className="auth-submit auth-submit-link">
            Back to sign in
          </a>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="PASSWORD HELP"
      title="Forgot your password?"
      subtitle="Send a request to the IT department. They'll check it's you and send a link to set a new password."
    >
      <form onSubmit={handleSubmit} className="auth-form">
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
          <span>
            Message for IT <small className="auth-optional">(optional)</small>
          </span>
          <input
            type="text"
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. My WhatsApp number"
          />
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" disabled={sending} className="auth-submit">
          {sending ? "Sending…" : "Send request to IT"}
        </button>

        <a href="/login" className="auth-link auth-link-center">
          Back to sign in
        </a>
      </form>
    </AuthShell>
  );
}
