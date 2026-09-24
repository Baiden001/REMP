import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const ROLES = ["ceo", "management", "administration", "sales", "marketing", "finance", "legal", "it"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

// Turn Supabase's email errors into something an admin can act on.
function friendlyInviteError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("sending") || lower.includes("smtp") || lower.includes("not authorized")) {
    return (
      "The invite email could not be sent. Supabase's built-in email service only delivers to " +
      "members of your Supabase team — set up custom SMTP in Supabase (Authentication → Emails → SMTP " +
      "settings) so invites reach any address."
    );
  }
  if (lower.includes("rate limit")) {
    return "Too many emails sent recently. Wait a little and try again, or set up custom SMTP in Supabase for higher limits.";
  }
  return message;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const fullName = String(body?.full_name ?? "").trim();
  const role = String(body?.role ?? "");

  if (!email || !fullName || !role) {
    return fail("Missing email, full name, or role.");
  }
  if (!EMAIL_PATTERN.test(email)) {
    return fail("Please enter a valid email address.");
  }
  if (!ROLES.includes(role)) {
    return fail("Unknown role.");
  }

  // Confirm the caller is signed in and is IT or CEO before doing anything privileged.
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return fail("Not signed in.", 401);
  }
  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!callerProfile || !["it", "ceo"].includes(callerProfile.role)) {
    return fail("Only IT or CEO can add team members.", 403);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fail("Server is missing SUPABASE_SERVICE_ROLE_KEY — add it in Vercel project settings.", 500);
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return fail("Server is missing NEXT_PUBLIC_SUPABASE_URL.", 500);
  }

  // Send people back to whichever deployment they were invited from.
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    request.headers.get("origin") ||
    "https://portal-resilience-estate.vercel.app"
  ).replace(/\/$/, "");
  const redirectTo = `${siteUrl}/auth/callback`;

  const admin = createAdminClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let { data: created, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo,
  });

  let resent = false;

  // Already registered: if they never finished setting up, send a fresh invite.
  if (inviteError && (inviteError.status === 422 || /already been registered|already exists/i.test(inviteError.message))) {
    const { data: page } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existing = page?.users.find((u) => u.email?.toLowerCase() === email);

    if (existing && !existing.last_sign_in_at) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(existing.id);
      if (deleteError) {
        return fail(`Could not reset the earlier invite: ${deleteError.message}`);
      }
      ({ data: created, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
        redirectTo,
      }));
      resent = true;
    } else {
      return fail("This email already has an active REMP account. Change their role from the team list instead.");
    }
  }

  if (inviteError || !created?.user) {
    return fail(friendlyInviteError(inviteError?.message ?? "Could not send the invite."));
  }

  // The handle_new_user trigger already creates the profile.
  // Update it to the role selected by IT/CEO.
  const { error: roleError } = await admin
    .from("profiles")
    .update({ role, full_name: fullName })
    .eq("id", created.user.id);
  if (roleError) {
    return fail(roleError.message);
  }

  return NextResponse.json({
    ok: true,
    message: resent ? `A fresh invite was sent to ${email}.` : `Invite sent to ${email}.`,
  });
}
