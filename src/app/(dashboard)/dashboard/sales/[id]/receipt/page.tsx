import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ReceiptActions from "./receipt-actions";

function money(value: number) {
  return `GH₵ ${value.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function generateReceiptNumber(date: Date, sequence: number) {
  const yy = String(date.getFullYear()).slice(-2);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");

  return `REMP${yy}/${String(sequence).padStart(3, "0")}/${dd}${mm}`;
}

export default async function ReceiptPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const [{ data: sale }, { data: payments }] = await Promise.all([
    supabase
      .from("sales")
      .select(
        "id, sale_price, sale_date, payment_status, clients(full_name, phone, email), units(unit_code, unit_type, projects(name))"
      )
      .eq("id", params.id)
      .single(),

    supabase
      .from("payments")
      .select("id, amount, paid_date, status")
      .eq("sale_id", params.id)
      .eq("status", "paid")
      .order("paid_date", { ascending: true }),
  ]);

  if (!sale) notFound();

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

  const paidPayments = payments ?? [];

  const totalPaid = paidPayments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0
  );

  const latestPayment = paidPayments[paidPayments.length - 1];

  const receiptDate = latestPayment?.paid_date
    ? new Date(latestPayment.paid_date)
    : new Date();

  const receiptNumber = generateReceiptNumber(
    receiptDate,
    paidPayments.length || 1
  );

  return (
    <div className="receipt-page">
      <ReceiptActions />

      <div className="receipt">
        <div className="receipt-header">
          <div>
            <img
              src="/images/resilience-logo-bg.PNG"
              alt="Resilience Estate Ltd"
              className="receipt-logo"
            />

            <h1>RESILIENCE ESTATE LTD</h1>
            <p>RESILIENCE ESTATE MANAGEMENT PORTAL</p>
          </div>

          <div className="receipt-title">
            <span>PAYMENT RECEIPT</span>
            <strong>{receiptNumber}</strong>
          </div>
        </div>

        <div className="receipt-divider" />

        <div className="receipt-meta">
          <div>
            <span>DATE</span>
            <strong>
              {receiptDate.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </strong>
          </div>

          <div>
            <span>PAYMENT STATUS</span>
            <strong>PAID</strong>
          </div>
        </div>

        <section className="receipt-section">
          <h3>RECEIVED FROM</h3>

          <div className="receipt-info-grid">
            <div>
              <span>FULL NAME</span>
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
          </div>
        </section>

        <section className="receipt-section">
          <h3>PROPERTY DETAILS</h3>

          <div className="receipt-info-grid">
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
          </div>
        </section>

        <section className="receipt-section">
          <h3>PAYMENT DETAILS</h3>

          <table className="receipt-table">
            <thead>
              <tr>
                <th>DESCRIPTION</th>
                <th>PAYMENT DATE</th>
                <th>AMOUNT</th>
              </tr>
            </thead>

            <tbody>
              {paidPayments.map((payment) => (
                <tr key={payment.id}>
                  <td>Property installment</td>
                  <td>
                    {payment.paid_date
                      ? new Date(payment.paid_date).toLocaleDateString(
                          "en-GB"
                        )
                      : "—"}
                  </td>
                  <td>{money(Number(payment.amount))}</td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr>
                <td colSpan={2}>TOTAL PAID</td>
                <td>{money(totalPaid)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        <div className="receipt-total">
          <span>AMOUNT RECEIVED</span>
          <strong>{money(totalPaid)}</strong>
        </div>

        <div className="receipt-footer">
          <div>
            <strong>Thank you for your payment.</strong>
            <p>
              This receipt confirms payment received by Resilience Estate Ltd.
            </p>
          </div>

          <div className="receipt-signature">
            <span>AUTHORIZED BY</span>
            <strong>Resilience Estate Ltd</strong>
          </div>
        </div>

        <div className="receipt-reference">
          Receipt No: {receiptNumber}
        </div>
      </div>
    </div>
  );
}