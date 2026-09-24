import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import RecordSaleButton from "./record-sale-button";

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

export default async function SalesPage() {
  const supabase = createClient();

  const [{ data: sales }, { data: clients }, { data: units }] = await Promise.all([
    supabase
      .from("sales")
      .select(
        "id, sale_price, sale_date, payment_status, clients(full_name), units(unit_code, projects(name)), profiles:agent_id(full_name)"
      )
      .order("sale_date", { ascending: false }),
    supabase.from("clients").select("id, full_name").order("full_name"),
    supabase
      .from("units")
      .select("id, unit_code, availability, price, projects(name)")
      .eq("availability", "available")
      .eq("listing_type", "sale"),
  ]);

  const totalRevenue = (sales ?? []).reduce((s, r) => s + Number(r.sale_price), 0);
  const totalSales = sales?.length ?? 0;
  const paidSales = (sales ?? []).filter((s) => s.payment_status === "paid").length;

  const flatUnits = (units ?? []).map((u) => ({
    id: u.id,
    unit_code: u.unit_code,
    price: Number(u.price),
    project_name: (u.projects as unknown as { name: string } | null)?.name ?? "—",
  }));

  return (
    <div>
      <div className="view-heading">
        <div>
          <p className="eyebrow">SALES &amp; PAYMENTS</p>
          <h1>Sales</h1>
          <p className="subtitle">Every closed transaction and its payment progress.</p>
        </div>
        <RecordSaleButton clients={clients ?? []} units={flatUnits} />
      </div>

      {/* KPI strip */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <article className="kpi-card">
          <div className="kpi-icon navy">◇</div>
          <div>
            <p>Total sales value</p>
            <h2>{gh(totalRevenue)}</h2>
          </div>
        </article>
        <article className="kpi-card">
          <div className="kpi-icon blue">▦</div>
          <div>
            <p>Total sales</p>
            <h2>{totalSales}</h2>
          </div>
        </article>
        <article className="kpi-card">
          <div className="kpi-icon green">◎</div>
          <div>
            <p>Fully paid</p>
            <h2>{paidSales}</h2>
          </div>
        </article>
      </div>

      {/* Sales table */}
      <div className="panel table-panel">
        <div className="table-toolbar">
          <div className="tabs">
            <button className="selected">All sales</button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>CLIENT</th>
                <th>UNIT</th>
                <th>AGENT</th>
                <th>SALE PRICE</th>
                <th>DATE</th>
                <th>PAYMENT</th>
              </tr>
            </thead>
            <tbody>
              {(sales ?? []).map((s) => {
                const client = s.clients as unknown as { full_name: string } | null;
                const unit = s.units as unknown as {
                  unit_code: string;
                  projects: { name: string } | null;
                } | null;
                const agent = s.profiles as unknown as { full_name: string } | null;

                return (
                  <tr key={s.id} style={{ cursor: "pointer" }}>
                    <td>
                      <Link
                        href={`/dashboard/sales/${s.id}`}
                        style={{ textDecoration: "none", color: "inherit", display: "block" }}
                      >
                        <b>{client?.full_name ?? "—"}</b>
                      </Link>
                    </td>
                    <td>
                      {unit?.projects?.name ?? "—"} · {unit?.unit_code ?? "—"}
                    </td>
                    <td>{agent?.full_name ?? "—"}</td>
                    <td>
                      <b>{gh(Number(s.sale_price))}</b>
                    </td>
                    <td>{new Date(s.sale_date).toLocaleDateString("en-GB")}</td>
                    <td>
                      <span className={`table-status ${STATUS_CLASS[s.payment_status] ?? ""}`}>
                        {s.payment_status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {(!sales || sales.length === 0) && (
                <tr>
                  <td colSpan={6} style={{ color: "#8e9e98" }}>
                    No sales yet — record the first one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
