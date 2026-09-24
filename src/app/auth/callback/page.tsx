"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export default function AuthCallbackPage() {
  const router = useRouter();
  const supabase = createClient();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    async function handleInvite() {
      const hash = window.location.hash;
      if (!hash) {
        setError("This invitation link is missing its authentication information.");
        return;
      }
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type = params.get("type");
      if (!accessToken || !refreshToken) {
        setError("This invitation link is invalid or has expired.");
        return;
      }
      const { error: sessionError } =
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      if (sessionError) {
        setError(sessionError.message);
        return;
      }
      if (type === "invite") {
        router.replace("/set-password");
        return;
      }
      router.replace("/dashboard");
    }
    handleInvite();
  }, [router, supabase]);
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 px-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        <h1 className="text-2xl font-bold text-slate-800">
          Setting up your account
        </h1>
        {!error ? (
          <p className="mt-3 text-sm text-slate-500">
            Please wait while we prepare your account...
          </p>
        ) : (
          <>
            <p className="mt-4 text-sm text-red-600">
              {error}
            </p>
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="mt-6 rounded-lg bg-[#246b4f] px-6 py-3 font-semibold text-white"
            >
              Go to Login
            </button>
          </>
        )}
      </div>
    </main>
  );
}