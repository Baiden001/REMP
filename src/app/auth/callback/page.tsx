"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "../../auth-shell";
import { markActive } from "@/lib/session";

export default function AuthCallbackPage() {
  const router = useRouter();
  const supabase = createClient();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleInvite() {
      const hash = new URLSearchParams(window.location.hash.substring(1));
      const query = new URLSearchParams(window.location.search);

      // Supabase reports expired or already-used links in the URL.
      const linkError = hash.get("error_description") || query.get("error_description");
      if (linkError) {
        setError(
          /expired|invalid/i.test(linkError)
            ? "This invitation link has expired or was already used. Ask IT to send you a new invite."
            : linkError.replace(/\+/g, " ")
        );
        return;
      }

      let type = hash.get("type") || query.get("type");
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const code = query.get("code");
      const tokenHash = query.get("token_hash");

      let sessionError: { message: string } | null = null;

      if (accessToken && refreshToken) {
        ({ error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }));
      } else if (code) {
        ({ error: sessionError } = await supabase.auth.exchangeCodeForSession(code));
      } else if (tokenHash) {
        type = type || "invite";
        ({ error: sessionError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as "invite" | "recovery" | "signup" | "magiclink" | "email",
        }));
      } else {
        setError("This invitation link is missing its sign-in details. Ask IT to send you a new invite.");
        return;
      }

      if (sessionError) {
        setError(sessionError.message);
        return;
      }

      markActive();
      const next = query.get("next");
      if (type === "invite" || type === "recovery" || next === "/set-password") {
        router.replace("/set-password");
        return;
      }
      router.replace("/dashboard");
    }

    handleInvite();
  }, [router, supabase]);

  return (
    <AuthShell
      eyebrow="ACCOUNT SETUP"
      title={error ? "Link problem" : "Setting up your account"}
      subtitle={error ? "We couldn't sign you in with this link." : "Please wait while we prepare your account…"}
    >
      {error && (
        <div className="auth-form">
          <p className="auth-error">{error}</p>
          <button type="button" className="auth-submit" onClick={() => router.push("/login")}>
            Go to sign in
          </button>
        </div>
      )}
    </AuthShell>
  );
}
