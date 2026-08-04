import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const { email, full_name, role } = await request.json();

  if (!email || !full_name || !role) {
    return NextResponse.json({ error: "Missing email, full_name, or role." }, { status: 400 });
  }

  // Confirm the caller is signed in and is IT or CEO before doing anything privileged.
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
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
  console.log("SERVICE ROLE KEY EXISTS:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY — see .env.example." },
      { status: 500 }
    );
  }

  // Service-role client: only ever used here, server-side, never sent to the browser.
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: created, error: createError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name },
  });

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  // The handle_new_user trigger already created a profile row with role 'sales' —
  // update it to the role actually chosen for this invite.
  const { error: roleError } = await admin
    .from("profiles")
    .update({ role, full_name })
    .eq("id", created.user.id);

  if (roleError) {
    return NextResponse.json({ error: roleError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
