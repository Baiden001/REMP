import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import AddPaymentButton from "../add-payment-button";

function gh(v: number) {
  if (v >= 1_000_000) return `GH₵ ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `GH₵ ${(v / 1_000).toFixed(0)}K`;
  return `GH₵ ${v.toLocaleString("en-GH")}`;
}

const STATUS_CLASS: Record<string, string> = {
  pending: "reserved",
  partial: "offplan",
  paid: "complete",
  overdue: "sold",
};

export default async function SaleDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: sale }, { data: payments }] = await Promise.all([
    supabase
      .from("sales")
      .select(
        "id, sale_price, sale_date, payment_status, clients(full_name, phone, email), units(unit_code, unit_type, price, projects(name)), profiles:agent_id(full_name)"
      )
      .eq("id", params.id)
      .single(),
    supabase
      .from("payments")
      .select("id, amount, due_date, paid_date, status")
      .eq("sale_id", params.id)
      .order("due_date", { ascending: true }),
  ]);

  if (!sale) notFound();

  const client = sale.clients as unknown as { full_name: string; phone: string | null; email: string | null } | null;
  const unit = sale.units as unknown as { unit_code: string; unit_type: string; price: number; projects: { name: string } | null } | null;
  const agent = sale.profiles as unknown as { full_name: string } | null;

  const totalPaid = (payments ?? [])
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = Number(sale.sale_price) - totalPaid;
  const pct = sale.sale_price > 0 ? Math.min(100, Math.round((totalPaid / Number(sale.sale_price)) * 100)) : 0;

  function Detail({ label, value }: { label: string; value: string | null }) {
    if (!value) return null;
    return (
      <div style={{ padding: "13px 0", borderBottom: "1px solid #edf1f4" }}>
        <small style={{ display: "block", fontSize: 10, color: "#8794a5", marginBottom: 4 }}>{label}</small>
        <b style={{ fontSize: 13 }}>{value}</b>
      </div>
    );
  }

  return (
    <div>
      <div className="view-heading">
        <div>
          <p className="eyebrow">
            <Link href="/dashboard/sales" style={{ color: "inherit", textDecoration: "none" }}>← Sales</Link>
          </p>
          <h1>{client?.full_name ?? "Sale detail"}</h1>
          <p className="subtitle">
            {unit?.projects?.name ?? ""} · {unit?.unit_code ?? ""} · {new Date(sale.sale_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <span className={`table-status ${STATUS_CLASS[sale.payment_status] ?? ""}`} style={{ fontSize: 11 }}>
          {sale.payment_status}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
        {/* Client */}
        <div className="panel">
          <div className="panel-head"><div><h3>Client</h3></div></div>
          <Detail label="FULL NAME" value={client?.full_name ?? null} />
          <Detail label="PHONE" value={client?.phone ?? null} />
          <Detail label="EMAIL" value={client?.email ?? null} />
        </div>

        {/* Transaction */}
        <div className="panel">
          <div className="panel-head"><div><h3>Transaction</h3></div></div>
          <Detail label="PROJECT" value={unit?.projects?.name ?? null} />
          <Detail label="UNIT" value={unit ? `${unit.unit_code} · ${unit.unit_type}` : null} />
          <Detail label="LISTED PRICE" value={unit ? gh(unit.price) : null} />
          <Detail label="SALE PRICE" value={gh(Number(sale.sale_price))} />
          <Detail label="SALE DATE" value={new Date(sale.sale_date).toLocaleDateString("en-GB")} />
          <Detail label="AGENT" value={agent?.full_name ?? null} />
        </div>
      </div>

      {/* Payment progress */}
      <div className="panel">
        <div className="panel-head">
          <div>
            <h3>Payment progress</h3>
            <p>{gh(totalPaid)} paid · {gh(outstanding)} outstanding</p>
          </div>
          <AddPaymentButton saleId={sale.id} />
        </div>

        <div className="progress-line" style={{ margin: "12px 0 18px" }}>
          <i style={{ width: `${pct}%`, background: pct === 100 ? "#15946b" : undefined }}></i>
        </div>

        {(payments ?? []).length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>AMOUNT</th>
                  <th>DUE DATE</th>
                  <th>PAID DATE</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {(payments ?? []).map((p) => (
                  <tr key={p.id}>
                    <td><b>{gh(Number(p.amount))}</b></td>
                    <td>{p.due_date ? new Date(p.due_date).toLocaleDateString("en-GB") : "—"}</td>
                    <td>{p.paid_date ? new Date(p.paid_date).toLocaleDateString("en-GB") : "—"}</td>
                    <td>
                      <span className={`table-status ${STATUS_CLASS[p.status] ?? ""}`}>{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="subtitle">No payments logged yet — add the first instalment above.</p>
        )}
      </div>
    </div>
  );
}
