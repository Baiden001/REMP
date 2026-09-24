import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import AddPaymentButton from "@/components/payments/add-payment-button";
import { isRentPayment, RENTAL_TYPE_LABEL } from "@/lib/listing";
import { longDate, money } from "@/lib/money";
import NewInvoiceButton from "../../invoices/new-invoice-button";

function shortDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-GB") : "—";
}

export default async function RentalDetailsPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: rental }, { data: payments }] = await Promise.all([
    supabase
      .from("rentals")
      .select(
        "id, client_id, rental_type, start_date, end_date, rate, periods, total_amount, payment_status, notes, clients(full_name, phone, email), units(unit_code, unit_type, projects(name))"
      )
      .eq("id", params.id)
      .single(),
    supabase
      .from("payments")
      .select("id, amount, tax, paid_date, status, receipt_number, payment_for, period_start, period_end, created_at")
      .eq("rental_id", params.id)
      .order("created_at", { ascending: true }),
  ]);

  if (!rental) notFound();

  const client = rental.clients as unknown as { full_name: string; phone: string | null; email: string | null } | null;
  const unit = rental.units as unknown as {
    unit_code: string;
    unit_type: string | null;
    projects: { name: string } | null;
  } | null;

  const monthly = rental.rental_type === "monthly";
  const unitWord = monthly ? "month" : "night";
  const total = Number(rental.total_amount || 0);
  const rate = Number(rental.rate || 0);
  const allPayments = payments ?? [];
  const paid = allPayments.filter((p) => p.status === "paid");
  const rentPaid = paid.filter(isRentPayment);
  const totalPaid = rentPaid.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const otherPaid = paid.filter((p) => !isRentPayment(p)).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const outstanding = Math.max(total - totalPaid, 0);

  // Next unpaid period for the invoice shortcut: after the last rent period covered.
  const lastCovered = rentPaid
    .map((p) => p.period_end)
    .filter(Boolean)
    .sort()
    .at(-1);
  const propertyLabel = `${unit?.projects?.name ?? "Property"} · Unit ${unit?.unit_code ?? ""}`;
  const invoiceLine = monthly
    ? { description: `${propertyLabel} — monthly rent`, amount: String(rate) }
    : {
        description: `${propertyLabel} — short stay, ${rental.periods} night${Number(rental.periods) === 1 ? "" : "s"} (${shortDate(rental.start_date)} – ${shortDate(rental.end_date)})`,
        amount: String(outstanding || total),
      };

  return (
    <div className="view active-view">
      <div className="view-heading">
        <div>
          <p className="eyebrow">RENTALS</p>
          <h1>{RENTAL_TYPE_LABEL[rental.rental_type] ?? "Rental"} · {client?.full_name ?? "Client"}</h1>
          <p className="subtitle">
            {propertyLabel} · {longDate(rental.start_date)} to {longDate(rental.end_date)}
          </p>
        </div>

        <div className="hero-actions">
          <Link href="/dashboard/rentals" className="button ghost">
            ← Back to rentals
          </Link>
          <NewInvoiceButton
            label="Generate invoice"
            clients={[]}
            preset={{
              clientId: rental.client_id,
              billTo: { name: client?.full_name ?? "", phone: client?.phone ?? "", email: client?.email ?? "" },
              rentalId: rental.id,
              items: [invoiceLine],
            }}
          />
          <AddPaymentButton
            target={{
              kind: "rental",
              rentalId: rental.id,
              rentalType: monthly ? "monthly" : "short_stay",
              rate,
              totalDue: total,
              startDate: lastCovered
                ? new Date(new Date(`${lastCovered}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10)
                : rental.start_date,
            }}
          />
        </div>
      </div>

      <div className="sales-summary">
        <article>
          <div className="summary-icon navy">₵</div>
          <div>
            <p>{monthly ? "TENANCY VALUE" : "BOOKING VALUE"}</p>
            <b>{money(total)}</b>
            <small>
              {rental.periods} {unitWord}
              {Number(rental.periods) === 1 ? "" : "s"} × {money(rate)}
            </small>
          </div>
        </article>
        <article>
          <div className="summary-icon green">✓</div>
          <div>
            <p>RENT PAID</p>
            <b>{money(totalPaid)}</b>
            <small>
              {rentPaid.length} rent payment(s)
              {otherPaid > 0 ? ` · ${money(otherPaid)} deposits & charges` : ""}
            </small>
          </div>
        </article>
        <article>
          <div className="summary-icon amber">₵</div>
          <div>
            <p>OUTSTANDING</p>
            <b>{money(outstanding)}</b>
            <small>{lastCovered ? `Paid up to ${longDate(lastCovered)}` : "No rent periods paid yet"}</small>
          </div>
        </article>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h3>Tenant & Property</h3>
            <p>Details for this {monthly ? "tenancy" : "booking"}.</p>
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
            <span>UNIT</span>
            <strong>
              {propertyLabel} {unit?.unit_type ? `(${unit.unit_type})` : ""}
            </strong>
          </div>
          <div>
            <span>{monthly ? "START" : "CHECK-IN"}</span>
            <strong>{longDate(rental.start_date)}</strong>
          </div>
          <div>
            <span>{monthly ? "END" : "CHECK-OUT"}</span>
            <strong>{longDate(rental.end_date)}</strong>
          </div>
          {rental.notes && (
            <div>
              <span>NOTES</span>
              <strong>{rental.notes}</strong>
            </div>
          )}
        </div>
      </section>

      <section className="panel table-panel" style={{ marginTop: 18 }}>
        <div className="table-toolbar">
          <h3>Payment History</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>RECEIPT NO.</th>
                <th>PAYMENT FOR</th>
                <th>PERIOD COVERED</th>
                <th>PAID ON</th>
                <th>AMOUNT</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {allPayments.length === 0 ? (
                <tr>
                  <td colSpan={6}>No payments have been recorded for this rental.</td>
                </tr>
              ) : (
                allPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.receipt_number ?? "—"}</td>
                    <td>{payment.payment_for ?? "—"}</td>
                    <td>
                      {payment.period_start
                        ? `${shortDate(payment.period_start)} – ${shortDate(payment.period_end)}`
                        : "—"}
                    </td>
                    <td>{shortDate(payment.paid_date)}</td>
                    <td>{money(Number(payment.amount || 0) + Number(payment.tax || 0))}</td>
                    <td>
                      {payment.status === "paid" ? (
                        <Link href={`/dashboard/rentals/${rental.id}/receipt/${payment.id}`} className="text-button">
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
