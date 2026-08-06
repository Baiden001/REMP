"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
    router.push("/dashboard");
    router.refresh();
  }
  return (
    <main
      className="relative min-h-screen flex items-center justify-center px-6 bg-cover bg-center"
      style={{
        backgroundImage: "url('/images/skyline.jpg')",
      }}
    >
      <div className="absolute inset-0 bg-[#081521]/70"></div>
      <div className="relative z-10 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl bg-white/90 backdrop-blur-sm">
        <div className="p-10">
          <div className="flex justify-center mb-1">
            <img
              src="/images/resilience-logo.png"
              alt="Resilience Estate"
              className="h-40 w-auto mx-auto"
            />
          </div>
          <h1 className="text-3xl font-bold text-center text-slate-800">
            Create Your Password
          </h1>
          <p className="text-center text-slate-500 mt-2 mb-8">
            Welcome to the Resilience Estate Management Portal.
          </p>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-sm font-medium text-slate-700">
                New Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Create a password"
                className="mt-2 w-full h-12 rounded-lg border border-slate-300 px-4 focus:border-blue-600 focus:ring-2 focus:ring-blue-200 outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">
                Confirm Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                placeholder="Confirm your password"
                className="mt-2 w-full h-12 rounded-lg border border-slate-300 px-4 focus:border-blue-600 focus:ring-2 focus:ring-blue-200 outline-none"
              />
            </div>
            {error && (
              <p className="text-red-600 text-sm">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="w-full h-12 rounded-lg bg-[#0052CC] hover:bg-[#0044AA] active:scale-[0.99] transition-all font-semibold text-white shadow-lg shadow-blue-500/40"
            >
              {saving ? "Creating Password..." : "Create Password"}
            </button>
          </form>
          <p className="text-center text-xs text-slate-500 mt-8">
            Your password is private and should not be shared with anyone.
          </p>
        </div>
      </div>
      <footer className="absolute bottom-6 text-center text-white/80 text-sm">
        <p className="font-medium">
          © {new Date().getFullYear()} Resilience Estate Ltd.
        </p>
        <p className="text-white/60">
          Resilience Estate Management Portal (REMP) • Version 1.0
        </p>
      </footer>
    </main>
  );
}