import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { money } from "@/lib/money";
import NewInvoiceButton from "./new-invoice-button";
import Icon from "@/components/icon";

export default async function InvoicesPage() {
  const supabase = createClient();

  const [{ data: invoices }, { data: clients }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, bill_to_name, invoice_date, due_date, tax, invoice_items(amount)")
      .order("created_at", { ascending: false }),
    supabase.from("clients").select("id, full_name, phone, email, location").order("full_name"),
  ]);

  const rows = (invoices ?? []).map((invoice) => {
    const items = (invoice.invoice_items ?? []) as { amount: number }[];
    const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0) + Number(invoice.tax || 0);
    return { ...invoice, total };
  });

  const totalBilled = rows.reduce((sum, row) => sum + row.total, 0);
  const overdue = rows.filter((row) => row.due_date && new Date(row.due_date) < new Date()).length;

  return (
    <div>
      <div className="view-heading">
        <div>
          <p className="eyebrow">FINANCE</p>
          <h1>Invoices</h1>
          <p className="subtitle">Bills sent to clients, ready to print or share as PDF.</p>
        </div>
        <NewInvoiceButton clients={clients ?? []} />
      </div>

      <div className="kpi-grid kpi-grid-3" style={{ marginBottom: 20 }}>
        <article className="kpi-card">
          <div className="kpi-icon navy"><Icon name="fileText" /></div>
          <div>
            <p>Invoices issued</p>
            <h2>{rows.length}</h2>
          </div>
        </article>
        <article className="kpi-card">
          <div className="kpi-icon blue"><Icon name="banknote" /></div>
          <div>
            <p>Total billed</p>
            <h2>{money(totalBilled)}</h2>
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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>INVOICE NO.</th>
                <th>BILLED TO</th>
                <th>DATE</th>
                <th>DUE</th>
                <th>TOTAL</th>
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
                  <td>{row.due_date ? new Date(row.due_date).toLocaleDateString("en-GB") : "—"}</td>
                  <td>
                    <b>{money(row.total)}</b>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: "#8e9e98" }}>
                    No invoices yet — create one above, or use “Generate invoice” on a sale or rental.
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
