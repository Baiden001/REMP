"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/login");
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-xs text-[#a8c6ba] hover:text-white transition"
    >
      Sign out
    </button>
  );
}
