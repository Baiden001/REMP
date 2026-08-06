import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const { email, full_name, role } = await request.json();

  if (!email || !full_name || !role) {
    return NextResponse.json(
      { error: "Missing email, full_name, or role." },
      { status: 400 }
    );
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  if (!normalizedEmail.endsWith("@resilienceghana.com")) {
    return NextResponse.json(
      {
        error:
          "Only Resilience Estate company email addresses (@resilienceghana.com) can be invited.",
      },
      { status: 400 }
    );
  }

  // Confirm the caller is signed in and is IT or CEO before doing anything privileged.
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Not signed in." },
      { status: 401 }
    );
  }
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!callerProfile || !["it", "ceo"].includes(callerProfile.role)) {
    return NextResponse.json(
      { error: "Only IT or CEO can add team members." },
      { status: 403 }
    );
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        error:
          "Server is missing SUPABASE_SERVICE_ROLE_KEY — see .env.example.",
      },
      { status: 500 }
    );
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return NextResponse.json(
      { error: "Server is missing NEXT_PUBLIC_SUPABASE_URL." },
      { status: 500 }
    );
  }
  // Use the current site URL so this works locally and in production.
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    request.headers.get("origin") ||
    "http://localhost:3000";
  const admin = createAdminClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data: created, error: createError } =
  await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
    data: { full_name },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/set-password`,
  });
  if (createError) {
    return NextResponse.json(
      { error: createError.message },
      { status: 400 }
    );
  }
  // The handle_new_user trigger already creates the profile.
  // Update it to the role selected by IT/CEO.
  const { error: roleError } = await admin
    .from("profiles")
    .update({
      role,
      full_name,
    })
    .eq("id", created.user.id);
  if (roleError) {
    return NextResponse.json(
      { error: roleError.message },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}