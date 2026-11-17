
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import RecordSaleButton from "./record-sale-button";
import Icon from "@/components/icon";
import { formatMoney } from "@/lib/listing";

const STATUS_CLASS: Record<string, string> = {
  pending: "reserved",
  partial: "offplan",
  paid: "complete",
  overdue: "sold",
};

export default async function SalesPage() {
  const supabase = createClient();

  const [{ data: sales }, { data: clients }, { data: units }] =
    await Promise.all([
      supabase
        .from("sales")
        .select(
          "id, sale_price, sale_date, payment_status, currency, clients(full_name), units(unit_code, projects(name)), profiles:agent_id(full_name)"
        )
        .order("sale_date", { ascending: false }),

      supabase
        .from("clients")
        .select("id, full_name")
        .order("full_name"),

      supabase
        .from("units")
        .select("id, unit_code, availability, price, projects(name)")
        .eq("availability", "available")
        .eq("listing_type", "sale"),
    ]);

  const allSales = sales ?? [];

  const totalSales = allSales.length;

  const paidSales = allSales.filter(
    (s) => s.payment_status === "paid"
  ).length;

  const totalRevenueGHS = allSales
    .filter((s) => s.currency !== "USD")
    .reduce((sum, s) => sum + Number(s.sale_price || 0), 0);

  const totalRevenueUSD = allSales
    .filter((s) => s.currency === "USD")
    .reduce((sum, s) => sum + Number(s.sale_price || 0), 0);

  const flatUnits = (units ?? []).map((u) => ({
    id: u.id,
    unit_code: u.unit_code,
    price: Number(u.price),
    project_name:
      (u.projects as unknown as { name: string } | null)?.name ?? "—",
  }));

  return (
    <div>
      <div className="view-heading">
        <div>
          <p className="eyebrow">SALES &amp; PAYMENTS</p>
          <h1>Sales</h1>
          <p className="subtitle">
            Every closed transaction and its payment progress.
          </p>
        </div>

        <div className="hero-actions">
          <a className="button ghost" href="/api/export/sales" download>
            <Icon name="download" size={15} /> Excel
          </a>
          <RecordSaleButton clients={clients ?? []} units={flatUnits} />
        </div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <article className="kpi-card">
          <div className="kpi-icon navy">
            <Icon name="trendingUp" />
          </div>
          <div>
            <p>Total sales value · GHS</p>
            <h2>{formatMoney(totalRevenueGHS, "GHS")}</h2>
            <p style={{ marginTop: 10 }}>Total sales value · USD</p>
            <h2 style={{ fontSize: 17 }}>
              {formatMoney(totalRevenueUSD, "USD")}
            </h2>
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-icon blue">
            <Icon name="receipt" />
          </div>
          <div>
            <p>Total sales</p>
            <h2>{totalSales}</h2>
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-icon green">
            <Icon name="checkCircle" />
          </div>
          <div>
            <p>Fully paid</p>
            <h2>{paidSales}</h2>
          </div>
        </article>
      </div>

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
              {allSales.map((s) => {
                const client = s.clients as unknown as {
                  full_name: string;
                } | null;

                const unit = s.units as unknown as {
                  unit_code: string;
                  projects: { name: string } | null;
                } | null;

                const agent = s.profiles as unknown as {
                  full_name: string;
                } | null;

                const currency = s.currency === "USD" ? "USD" : "GHS";

                return (
                  <tr key={s.id} style={{ cursor: "pointer" }}>
                    <td>
                      <Link
                        href={`/dashboard/sales/${s.id}`}
                        style={{
                          textDecoration: "none",
                          color: "inherit",
                          display: "block",
                        }}
                      >
                        <b>{client?.full_name ?? "—"}</b>
                      </Link>
                    </td>

                    <td>
                      {unit?.projects?.name ?? "—"} · {unit?.unit_code ?? "—"}
                    </td>

                    <td>{agent?.full_name ?? "—"}</td>

                    <td>
                      <b>
                        {formatMoney(Number(s.sale_price), currency)}
                      </b>
                    </td>

                    <td>
                      {new Date(s.sale_date).toLocaleDateString("en-GB")}
                    </td>

                    <td>
                      <span
                        className={`table-status ${
                          STATUS_CLASS[s.payment_status] ?? ""
                        }`}
                      >
                        {s.payment_status}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {allSales.length === 0 && (
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
