import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { invoiceTotal } from "@/lib/invoices";

export const dynamic = "force-dynamic";

type Named = { full_name: string } | null;
type UnitRef = { unit_code: string; projects: { name: string } | null } | null;

const n = (value: unknown) => (value === null || value === undefined ? "" : Number(value).toFixed(2));
const label = (value: string | null | undefined) => (value ? value.replace(/_/g, " ") : "");
const isDate = (value: string | null) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);

// Spreadsheet downloads. Queries run as the signed-in user, so row-level security
// limits each file to what that person can already see in the portal.
export async function GET(request: Request, { params }: { params: { kind: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const url = new URL(request.url);
  const from = isDate(url.searchParams.get("from")) ? url.searchParams.get("from") : null;
  const to = isDate(url.searchParams.get("to")) ? url.searchParams.get("to") : null;
  const range = <Q extends { gte: (c: string, v: string) => Q; lte: (c: string, v: string) => Q }>(query: Q, column: string) => {
    let q = query;
    if (from) q = q.gte(column, from);
    if (to) q = q.lte(column, to);
    return q;
  };

  let csv: string;
  let error: { message: string } | null = null;

  switch (params.kind) {
    case "sales": {
      const res = await range(
        supabase
          .from("sales")
          .select(
            "sale_date, sale_price, payment_status, clients(full_name), units(unit_code, projects(name)), agent:profiles!sales_agent_id_fkey(full_name), payments(amount, tax, status)"
          )
          .order("sale_date", { ascending: false }),
        "sale_date"
      );
      error = res.error;
      csv = toCsv(res.data ?? [], [
        { header: "Sale date", value: (r) => r.sale_date },
        { header: "Client", value: (r) => (r.clients as unknown as Named)?.full_name },
        { header: "Project", value: (r) => (r.units as unknown as UnitRef)?.projects?.name },
        { header: "Unit", value: (r) => (r.units as unknown as UnitRef)?.unit_code },
        { header: "Agent", value: (r) => (r.agent as unknown as Named)?.full_name },
        { header: "Sale price (GHS)", value: (r) => n(r.sale_price) },
        {
          header: "Paid (GHS)",
          value: (r) =>
            n(
              ((r.payments ?? []) as { amount: number; status: string }[])
                .filter((p) => p.status === "paid")
                .reduce((s, p) => s + Number(p.amount || 0), 0)
            ),
        },
        {
          header: "Balance (GHS)",
          value: (r) =>
            n(
              Math.max(
                Number(r.sale_price || 0) -
                  ((r.payments ?? []) as { amount: number; status: string }[])
                    .filter((p) => p.status === "paid")
                    .reduce((s, p) => s + Number(p.amount || 0), 0),
                0
              )
            ),
        },
        { header: "Payment status", value: (r) => label(r.payment_status) },
      ]);
      break;
    }

    case "payments": {
      const res = await range(
        supabase
          .from("payments")
          .select(
            "paid_date, due_date, status, receipt_number, payment_for, amount, tax, period_start, period_end, sales(clients(full_name), units(unit_code, projects(name))), rentals(clients(full_name), units(unit_code, projects(name)))"
          )
          .order("paid_date", { ascending: false, nullsFirst: false })
          .order("due_date", { ascending: false }),
        "paid_date"
      );
      error = res.error;
      type Parent = { clients: Named; units: UnitRef } | null;
      const parent = (r: { sales: unknown; rentals: unknown }) =>
        ((r.sales as Parent) ?? (r.rentals as Parent)) as Parent;
      csv = toCsv(res.data ?? [], [
        { header: "Paid date", value: (r) => r.paid_date },
        { header: "Due date", value: (r) => r.due_date },
        { header: "Status", value: (r) => (r.status === "pending" ? "scheduled" : label(r.status)) },
        { header: "Receipt no.", value: (r) => r.receipt_number },
        { header: "Type", value: (r) => (r.sales ? "Sale" : r.rentals ? "Rental" : "") },
        { header: "Client", value: (r) => parent(r)?.clients?.full_name },
        { header: "Project", value: (r) => parent(r)?.units?.projects?.name },
        { header: "Unit", value: (r) => parent(r)?.units?.unit_code },
        { header: "Payment for", value: (r) => r.payment_for },
        { header: "Period start", value: (r) => r.period_start },
        { header: "Period end", value: (r) => r.period_end },
        { header: "Amount (GHS)", value: (r) => n(r.amount) },
        { header: "Tax (GHS)", value: (r) => n(r.tax ?? 0) },
        { header: "Total (GHS)", value: (r) => n(Number(r.amount || 0) + Number(r.tax || 0)) },
      ]);
      break;
    }

    case "rentals": {
      const res = await range(
        supabase
          .from("rentals")
          .select(
            "rental_type, start_date, end_date, rate, periods, total_amount, payment_status, clients(full_name, phone), units(unit_code, projects(name)), payments(amount, status, payment_for)"
          )
          .order("start_date", { ascending: false }),
        "start_date"
      );
      error = res.error;
      csv = toCsv(res.data ?? [], [
        { header: "Type", value: (r) => (r.rental_type === "monthly" ? "Monthly" : "Short stay") },
        { header: "Tenant / guest", value: (r) => (r.clients as unknown as Named)?.full_name },
        { header: "Phone", value: (r) => (r.clients as unknown as { phone: string | null } | null)?.phone },
        { header: "Project", value: (r) => (r.units as unknown as UnitRef)?.projects?.name },
        { header: "Unit", value: (r) => (r.units as unknown as UnitRef)?.unit_code },
        { header: "Start", value: (r) => r.start_date },
        { header: "End", value: (r) => r.end_date },
        { header: "Rate (GHS)", value: (r) => n(r.rate) },
        { header: "Months / nights", value: (r) => r.periods },
        { header: "Total (GHS)", value: (r) => n(r.total_amount) },
        {
          header: "Paid (GHS)",
          value: (r) =>
            n(
              ((r.payments ?? []) as { amount: number; status: string }[])
                .filter((p) => p.status === "paid")
                .reduce((s, p) => s + Number(p.amount || 0), 0)
            ),
        },
        { header: "Payment status", value: (r) => label(r.payment_status) },
      ]);
      break;
    }

    case "invoices": {
      const res = await range(
        supabase
          .from("invoices")
          .select("invoice_number, bill_to_name, bill_to_phone, invoice_date, due_date, tax, status, amount_paid, paid_at, invoice_items(amount)")
          .order("invoice_date", { ascending: false }),
        "invoice_date"
      );
      error = res.error;
      csv = toCsv(res.data ?? [], [
        { header: "Invoice no.", value: (r) => r.invoice_number },
        { header: "Billed to", value: (r) => r.bill_to_name },
        { header: "Phone", value: (r) => r.bill_to_phone },
        { header: "Invoice date", value: (r) => r.invoice_date },
        { header: "Due date", value: (r) => r.due_date },
        { header: "Total (GHS)", value: (r) => n(invoiceTotal(r as { tax: number; invoice_items: { amount: number }[] })) },
        { header: "Paid (GHS)", value: (r) => n(r.amount_paid ?? 0) },
        {
          header: "Balance (GHS)",
          value: (r) =>
            r.status === "cancelled"
              ? ""
              : n(Math.max(invoiceTotal(r as { tax: number; invoice_items: { amount: number }[] }) - Number(r.amount_paid || 0), 0)),
        },
        { header: "Status", value: (r) => label(r.status) },
        { header: "Paid on", value: (r) => r.paid_at },
      ]);
      break;
    }

    case "clients": {
      const res = await supabase
        .from("clients")
        .select("full_name, phone, email, location, budget, notes, created_at, projects(name), leads(stage, source)")
        .order("full_name");
      error = res.error;
      type Lead = { stage: string; source: string };
      csv = toCsv(res.data ?? [], [
        { header: "Name", value: (r) => r.full_name },
        { header: "Phone", value: (r) => r.phone },
        { header: "Email", value: (r) => r.email },
        { header: "Location", value: (r) => r.location },
        { header: "Budget (GHS)", value: (r) => (r.budget ? n(r.budget) : "") },
        { header: "Preferred project", value: (r) => (r.projects as unknown as { name: string } | null)?.name },
        { header: "Stage", value: (r) => label(((r.leads ?? []) as Lead[])[0]?.stage) },
        { header: "Source", value: (r) => label(((r.leads ?? []) as Lead[])[0]?.source) },
        { header: "Added", value: (r) => r.created_at?.slice(0, 10) },
        { header: "Notes", value: (r) => r.notes },
      ]);
      break;
    }

    default:
      return NextResponse.json({ error: "Unknown export." }, { status: 404 });
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const stamp = new Date().toISOString().slice(0, 10);
  const suffix = from || to ? `-${from ?? "start"}-to-${to ?? stamp}` : `-${stamp}`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="remp-${params.kind}${suffix}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

