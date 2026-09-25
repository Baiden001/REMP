import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

// IT/CEO approve (get a one-time reset link to send) or decline a forgotten-password request.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (action !== "approve" && action !== "decline") return fail("Unknown action.");

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.", 401);

  const { data: caller } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!caller || !["it", "ceo"].includes(caller.role)) {
    return fail("Only IT or CEO can handle password requests.", 403);
  }

  // Read through the caller's own access rules.
  const { data: req } = await supabase
    .from("password_reset_requests")
    .select("id, user_id, email, status")
    .eq("id", params.id)
    .single();
  if (!req) return fail("Request not found.", 404);
  if (req.status === "declined") return fail("This request was declined. Ask them to send a new one.");

  if (action === "decline") {
    if (req.status !== "pending") return fail("This request was already approved.");
    const { error } = await supabase
      .from("password_reset_requests")
      .update({ status: "declined", handled_by: user.id, handled_at: new Date().toISOString() })
      .eq("id", req.id);
    if (error) return fail(error.message);
    return NextResponse.json({ ok: true });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return fail("Server is missing SUPABASE_SERVICE_ROLE_KEY — add it in Vercel project settings.", 500);
  }
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Use the account's current email, in case it changed since the request.
  const { data: account, error: accountError } = await admin.auth.admin.getUserById(req.user_id);
  if (accountError || !account?.user?.email) return fail("That account no longer exists.");

  // Generating a new link replaces any earlier one, so only the newest link works.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: account.user.email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) return fail(linkError?.message ?? "Could not create a reset link.");

  const { error: updateError } = await supabase
    .from("password_reset_requests")
    .update({ status: "approved", handled_by: user.id, handled_at: new Date().toISOString() })
    .eq("id", req.id);
  if (updateError) return fail(updateError.message);

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    request.headers.get("origin") ||
    "https://portal-resilience-estate.vercel.app"
  ).replace(/\/$/, "");

  return NextResponse.json({
    ok: true,
    link: `${siteUrl}/reset-password?token_hash=${encodeURIComponent(tokenHash)}`,
  });
}
