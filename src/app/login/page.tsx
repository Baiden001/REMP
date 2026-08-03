"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

    router.refresh();
    router.push("/dashboard");
  }

  return (
  <main
  className="relative min-h-screen flex items-center justify-center px-6 bg-cover bg-center"
  style={{
    backgroundImage: "url('/images/skyline.jpg')",
  }}
>
  {/* Dark overlay */}
  <div className="absolute inset-0 bg-[#081521]/70"></div>

  {/* Login Card */}
  <div className="relative z-5 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl bg-white/90 backdrop-blur-sm">


    <div className="p-10">

      <div className="flex justify-center mb-1">
        <img
          src="/images/resilience-logo.png"
          alt="Resilience Estate"
          className="h-48 w-auto mx-auto"
        />
      </div>

      <h1 className="text-3xl font-bold text-center text-slate-800">
        Welcome Back
      </h1>

      <p className="text-center text-slate-500 mt-2 mb-8">
        Sign in to the REMP
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">

        <div>
          <label className="text-sm font-medium text-slate-700">
            Work Email
          </label>

          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@resilienceghana.com"
            className="mt-2 w-full h-12 rounded-lg border border-slate-300 px-4 focus:border-blue-600 focus:ring-2 focus:ring-blue-200 outline-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">
            Password
          </label>

          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
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
          disabled={loading}
          className="w-full h-12 rounded-lg bg-[#0052CC] hover:bg-[#0044AA] active:scale-[0.99] transition-all font-semibold text-white shadow-lg shadow-blue-500/40"
        >
          {loading ? "Signing In..." : "Sign In"}
        </button>

      </form>

      <p className="text-center text-xs text-slate-500 mt-8">
        Contact IT support for assistance with login issues.
      </p>

       <p className="text-center text-xs text-slate-500 mt-1">
        it@resilienceghana.com
      </p>

    </div>
  </div>

  {/* Footer */}
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
