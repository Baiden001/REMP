import { createClient } from "@supabase/supabase-js";
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async () => {
  try {
    const now = new Date();

    // Start/end of today in UTC.
    // We'll refine timezone handling for Ghana before production scheduling.
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );

    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const threeDays = new Date(today);
    threeDays.setUTCDate(threeDays.getUTCDate() + 3);

    let created = 0;

    // ============================================================
    // PAYMENT NOTIFICATIONS
    // ============================================================

    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select(`
        id,
        amount,
        due_date,
        status,
        sales (
          id,
          clients (
            full_name
          )
        )
      `)
      .not("due_date", "is", null)
      .neq("status", "paid");

    if (paymentsError) throw paymentsError;

    // Finance, management and CEO receive payment alerts.
    const { data: financeUsers, error: financeUsersError } = await supabase
      .from("profiles")
      .select("id, role")
      .in("role", ["ceo", "management", "finance"])
      .eq("is_active", true);

    if (financeUsersError) throw financeUsersError;

    for (const payment of payments ?? []) {
      if (!payment.due_date) continue;

      const due = new Date(`${payment.due_date}T00:00:00Z`);

      let type: string | null = null;
      let title: string | null = null;

      const clientData = payment.sales?.clients;
      const clientName =
        Array.isArray(clientData)
          ? clientData[0]?.full_name
          : clientData?.full_name;

      const name = clientName ?? "Client";

      if (due < today) {
        type = "payment_overdue";
        title = "Payment overdue";
      } else if (due.getTime() === today.getTime()) {
        type = "payment_due_today";
        title = "Payment due today";
      } else if (due.getTime() === tomorrow.getTime()) {
        type = "payment_due_tomorrow";
        title = "Payment due tomorrow";
      } else if (due.getTime() === threeDays.getTime()) {
        type = "payment_due_soon";
        title = "Payment due soon";
      }

      if (!type || !title) continue;

      const body =
        `${name} has a payment of GH₵${Number(payment.amount).toLocaleString()} ` +
        `due on ${payment.due_date}.`;

      for (const user of financeUsers ?? []) {
        // Prevent duplicate notifications for the same payment/day/type.
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("recipient_id", user.id)
          .eq("entity_id", payment.id)
          .eq("type", type)
          .gte("created_at", today.toISOString())
          .limit(1);

        if (existing && existing.length > 0) continue;

        const { error } = await supabase.from("notifications").insert({
          recipient_id: user.id,
          title,
          body,
          type,
          entity_type: "payment",
          entity_id: payment.id,
        });

        if (!error) created++;
      }
    }

    // ============================================================
    // VIEWING NOTIFICATIONS
    // ============================================================

    const { data: viewings, error: viewingsError } = await supabase
      .from("viewings")
      .select(`
        id,
        scheduled_at,
        status,
        clients (
          full_name
        ),
        projects (
          name
        )
      `)
      .in("status", ["requested", "confirmed"]);

    if (viewingsError) throw viewingsError;

    // CEO, management and sales receive viewing alerts.
    const { data: salesUsers, error: salesUsersError } = await supabase
      .from("profiles")
      .select("id, role")
      .in("role", ["ceo", "management", "sales"])
      .eq("is_active", true);

    if (salesUsersError) throw salesUsersError;

    for (const viewing of viewings ?? []) {
      const scheduled = new Date(viewing.scheduled_at);

      const clientData = viewing.clients;
      const projectData = viewing.projects;

      const clientName =
        Array.isArray(clientData)
          ? clientData[0]?.full_name
          : clientData?.full_name;

      const projectName =
        Array.isArray(projectData)
          ? projectData[0]?.name
          : projectData?.name;

      const name = clientName ?? "Client";
      const project = projectName ?? "Property";

      const viewingDate = new Date(
        Date.UTC(
          scheduled.getUTCFullYear(),
          scheduled.getUTCMonth(),
          scheduled.getUTCDate()
        )
      );

      let type: string | null = null;
      let title: string | null = null;

      if (viewingDate.getTime() === today.getTime()) {
        type = "viewing_today";
        title = "Viewing today";
      } else if (viewingDate.getTime() === tomorrow.getTime()) {
        type = "viewing_tomorrow";
        title = "Viewing tomorrow";
      }

      if (!type || !title) continue;

      const body =
        `${name} has a viewing for ${project} at ` +
        `${scheduled.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "UTC",
        })}.`;

      for (const user of salesUsers ?? []) {
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("recipient_id", user.id)
          .eq("entity_id", viewing.id)
          .eq("type", type)
          .gte("created_at", today.toISOString())
          .limit(1);

        if (existing && existing.length > 0) continue;

        const { error } = await supabase.from("notifications").insert({
          recipient_id: user.id,
          title,
          body,
          type,
          entity_type: "viewing",
          entity_id: viewing.id,
        });

        if (!error) created++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notifications_created: created,
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
});