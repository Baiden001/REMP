import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { money } from "@/lib/money";
import NewInvoiceButton from "./new-invoice-button";
import Icon from "@/components/icon";
import { INVOICE_STATUS, invoiceTotal, isOpenInvoice } from "@/lib/invoices";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "open", label: "Unpaid & part-paid" },
  { key: "overdue", label: "Past due" },
  { key: "paid", label: "Paid" },
  { key: "cancelled", label: "Cancelled" },
];

export default async function InvoicesPage({ searchParams }: { searchParams: { filter?: string } }) {
  const filter = FILTERS.some((f) => f.key === searchParams.filter) ? searchParams.filter! : "all";
  const supabase = createClient();

  const [{ data: invoices }, { data: clients }, { data: saleUnits }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, bill_to_name, invoice_date, due_date, tax, status, amount_paid, invoice_items(amount)")
      .order("created_at", { ascending: false }),
    supabase.from("clients").select("id, full_name, phone, email, location").order("full_name"),
    supabase
      .from("units")
      .select("id, unit_code, unit_type, price, availability, projects(name)")
      .eq("listing_type", "sale")
      .in("availability", ["available", "reserved"])
      .order("unit_code"),
  ]);

  const purchasableUnits = (saleUnits ?? []).map((u) => ({
    id: u.id,
    label: [(u.projects as unknown as { name: string } | null)?.name, u.unit_code].filter(Boolean).join(" · "),
    unitType: u.unit_type,
    price: Number(u.price || 0),
    availability: u.availability as string,
  }));

  const today = new Date().toISOString().slice(0, 10);
  const all = (invoices ?? []).map((invoice) => {
    const total = invoiceTotal(invoice as { tax: number; invoice_items: { amount: number }[] });
    const balance = Math.max(total - Number(invoice.amount_paid || 0), 0);
    const pastDue = isOpenInvoice(invoice.status) && !!invoice.due_date && invoice.due_date < today;
    return { ...invoice, total, balance, pastDue };
  });

  const open = all.filter((row) => isOpenInvoice(row.status));
  const outstanding = open.reduce((sum, row) => sum + row.balance, 0);
  const overdue = all.filter((row) => row.pastDue).length;

  const matches = (row: (typeof all)[number], key: string) =>
    key === "all" ||
    (key === "open" && isOpenInvoice(row.status)) ||
    (key === "overdue" && row.pastDue) ||
    row.status === key;
  const rows = all.filter((row) => matches(row, filter));

  return (
    <div>
      <div className="view-heading">
        <div>
          <p className="eyebrow">FINANCE</p>
          <h1>Invoices</h1>
          <p className="subtitle">Bills sent to clients, ready to print or share as PDF.</p>
        </div>
        <div className="hero-actions">
          <a className="button ghost" href="/api/export/invoices" download>
            <Icon name="download" size={15} /> Excel
          </a>
          <NewInvoiceButton clients={clients ?? []} units={purchasableUnits} />
        </div>
      </div>

      <div className="kpi-grid kpi-grid-3" style={{ marginBottom: 20 }}>
        <article className="kpi-card">
          <div className="kpi-icon navy"><Icon name="fileText" /></div>
          <div>
            <p>Invoices issued</p>
            <h2>{all.length}</h2>
          </div>
        </article>
        <article className="kpi-card">
          <div className="kpi-icon blue"><Icon name="banknote" /></div>
          <div>
            <p>Outstanding ({open.length} unpaid)</p>
            <h2>{money(outstanding)}</h2>
          </div>
        </article>
        <article className="kpi-card">
          <div className="kpi-icon warm"><Icon name="alert" /></div>
          <div>
            <p>Past due date</p>
            <h2>{overdue}</h2>
          </div>
        </article>
      </div>

      <div className="panel table-panel">
        <div className="table-toolbar">
          <div className="tabs unit-filters">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={f.key === "all" ? "/dashboard/invoices" : `/dashboard/invoices?filter=${f.key}`}
                className={filter === f.key ? "selected" : ""}
                scroll={false}
              >
                {f.label} <b>{all.filter((row) => matches(row, f.key)).length}</b>
              </Link>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>INVOICE NO.</th>
                <th>BILLED TO</th>
                <th>DATE</th>
                <th>DUE</th>
                <th>TOTAL</th>
                <th>BALANCE</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/dashboard/invoices/${row.id}`} className="text-button">
                      {row.invoice_number}
                    </Link>
                  </td>
                  <td>
                    <b>{row.bill_to_name}</b>
                  </td>
                  <td>{new Date(row.invoice_date).toLocaleDateString("en-GB")}</td>
                  <td className={row.pastDue ? "text-danger" : ""}>
                    {row.due_date ? new Date(row.due_date).toLocaleDateString("en-GB") : "—"}
                  </td>
                  <td>
                    <b>{money(row.total)}</b>
                  </td>
                  <td>{row.status === "cancelled" ? "—" : money(row.balance)}</td>
                  <td>
                    <span className={`table-status ${INVOICE_STATUS[row.status]?.cls ?? ""}`}>
                      {row.pastDue ? "Past due" : INVOICE_STATUS[row.status]?.label ?? row.status}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ color: "#8e9e98" }}>
                    {all.length > 0
                      ? "No invoices match this filter."
                      : "No invoices yet — create one above, or use “Generate invoice” on a sale or rental."}
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
