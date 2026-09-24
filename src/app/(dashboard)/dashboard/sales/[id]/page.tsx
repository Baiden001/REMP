import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import AddPaymentButton from "@/components/payments/add-payment-button";
import NewInvoiceButton from "../../invoices/new-invoice-button";

function money(value: number) {
  return `GH₵ ${value.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function SaleDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const [{ data: sale }, { data: payments }] = await Promise.all([
    supabase
      .from("sales")
      .select(
        "id, sale_price, sale_date, payment_status, client_id, clients(full_name, phone, email), units(unit_code, unit_type, projects(name))"
      )
      .eq("id", params.id)
      .single(),

    supabase
      .from("payments")
      .select(
        "id, amount, tax, due_date, paid_date, status, receipt_number, payment_for, created_at"
      )
      .eq("sale_id", params.id)
      .order("created_at", { ascending: true }),
  ]);

  if (!sale) {
    notFound();
  }

  const client = sale.clients as unknown as {
    full_name: string;
    phone: string | null;
    email: string | null;
  } | null;

  const unit = sale.units as unknown as {
    unit_code: string;
    unit_type: string;
    projects: { name: string } | null;
  } | null;

  const salePrice = Number(sale.sale_price || 0);
  const allPayments = payments ?? [];

  const paidPayments = allPayments.filter(
    (payment) => payment.status === "paid"
  );

  const totalPaid = paidPayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );

  const totalTax = paidPayments.reduce(
    (sum, payment) => sum + Number(payment.tax || 0),
    0
  );

  const outstanding = Math.max(salePrice - totalPaid, 0);

  const paymentStatus =
    outstanding <= 0
      ? "PAID"
      : totalPaid > 0
        ? "PARTIALLY PAID"
        : "PENDING";

  return (
    <div className="view active-view">
      <div className="view-heading">
        <div>
          <p className="eyebrow">SALES</p>

          <h1>Sale Details</h1>

          <p className="subtitle">
            Review the property transaction, payment history and receipt
            records.
          </p>
        </div>

        <div className="hero-actions">
          <Link
            href="/dashboard/sales"
            className="button ghost"
          >
            ← Back to sales
          </Link>

          <NewInvoiceButton
            label="Generate invoice"
            clients={[]}
            preset={{
              clientId: sale.client_id,
              billTo: {
                name: client?.full_name ?? "",
                phone: client?.phone ?? "",
                email: client?.email ?? "",
              },
              saleId: sale.id,
              items: [
                {
                  description: `${unit?.projects?.name ?? "Property"} · Unit ${unit?.unit_code ?? ""} — property purchase installment`,
                  amount: outstanding > 0 ? String(outstanding) : "",
                },
              ],
            }}
          />

          <AddPaymentButton target={{ kind: "sale", saleId: sale.id, totalDue: salePrice }} />
        </div>
      </div>

      <div className="sales-summary">
        <article>
          <div className="summary-icon navy">₵</div>

          <div>
            <p>SALE PRICE</p>
            <b>{money(salePrice)}</b>
            <small>Agreed property price</small>
          </div>
        </article>

        <article>
          <div className="summary-icon green">✓</div>

          <div>
            <p>TOTAL PAID</p>
            <b>{money(totalPaid)}</b>
            <small>{paidPayments.length} paid payment(s)</small>
          </div>
        </article>

        <article>
          <div className="summary-icon amber">₵</div>

          <div>
            <p>OUTSTANDING</p>
            <b>{money(outstanding)}</b>
            <small>{paymentStatus}</small>
          </div>
        </article>
      </div>

      <div className="dashboard-grid sales-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Client & Property</h3>
              <p>Information linked to this sale.</p>
            </div>
          </div>

          <div className="receipt-info-grid" style={{ marginTop: 18 }}>
            <div>
              <span>CLIENT</span>
              <strong>{client?.full_name ?? "—"}</strong>
            </div>

            <div>
              <span>PHONE</span>
              <strong>{client?.phone ?? "—"}</strong>
            </div>

            <div>
              <span>EMAIL</span>
              <strong>{client?.email ?? "—"}</strong>
            </div>

            <div>
              <span>PROJECT</span>
              <strong>{unit?.projects?.name ?? "—"}</strong>
            </div>

            <div>
              <span>UNIT</span>
              <strong>{unit?.unit_code ?? "—"}</strong>
            </div>

            <div>
              <span>UNIT TYPE</span>
              <strong>{unit?.unit_type ?? "—"}</strong>
            </div>

            <div>
              <span>SALE DATE</span>
              <strong>
                {sale.sale_date
                  ? new Date(sale.sale_date).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })
                  : "—"}
              </strong>
            </div>

            <div>
              <span>PAYMENT STATUS</span>
              <strong>{paymentStatus}</strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Payment Summary</h3>
              <p>Collection progress for this sale.</p>
            </div>
          </div>

          <div className="collection-amount">
            {money(totalPaid)}
            <small>Collected from this sale</small>
          </div>

          <div className="collection-meter">
            <i
              style={{
                width: `${
                  salePrice > 0
                    ? Math.min((totalPaid / salePrice) * 100, 100)
                    : 0
                }%`,
              }}
            />
          </div>

          <ul className="collection-list">
            <li>
              <span>
                <b>Sale price</b>
                <small>Total agreed price</small>
              </span>

              <strong>{money(salePrice)}</strong>
            </li>

            <li>
              <span>
                <b>Tax recorded</b>
                <small>Total tax on paid payments</small>
              </span>

              <strong>{money(totalTax)}</strong>
            </li>

            <li>
              <span>
                <b>Outstanding</b>
                <small>Remaining property balance</small>
              </span>

              <strong>{money(outstanding)}</strong>
            </li>
          </ul>
        </section>
      </div>

      <section className="panel table-panel" style={{ marginTop: 18 }}>
        <div className="table-toolbar">
          <div>
            <h3>Payment History</h3>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>RECEIPT NO.</th>
                <th>PAYMENT FOR</th>
                <th>PAYMENT DATE</th>
                <th>DUE DATE</th>
                <th>AMOUNT</th>
                <th>TAX</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>

            <tbody>
              {allPayments.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    No payments have been recorded for this sale.
                  </td>
                </tr>
              ) : (
                allPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      {payment.receipt_number ?? "—"}
                    </td>

                    <td>{payment.payment_for ?? "Installment"}</td>

                    <td>
                      {payment.paid_date
                        ? new Date(
                            payment.paid_date
                          ).toLocaleDateString("en-GB")
                        : "—"}
                    </td>

                    <td>
                      {payment.due_date
                        ? new Date(
                            payment.due_date
                          ).toLocaleDateString("en-GB")
                        : "—"}
                    </td>

                    <td>
                      {money(Number(payment.amount || 0))}
                    </td>

                    <td>
                      {money(Number(payment.tax || 0))}
                    </td>

                    <td>
                      <span
                        className={`table-status ${
                          payment.status === "paid"
                            ? "available"
                            : "reserved"
                        }`}
                      >
                        {String(payment.status).toUpperCase()}
                      </span>
                    </td>

                    <td>
                      {payment.status === "paid" ? (
                        <Link
                          href={`/dashboard/sales/${sale.id}/receipt/${payment.id}`}
                          className="text-button"
                        >
                          View receipt
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}