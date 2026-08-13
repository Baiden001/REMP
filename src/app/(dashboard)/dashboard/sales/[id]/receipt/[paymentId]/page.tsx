import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ReceiptActions from "../receipt-actions";

function money(value: number) {
  return `GH₵ ${value.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function amountInWords(value: number) {
  const small = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function wordsUnderThousand(number: number): string {
    const parts: string[] = [];

    if (number >= 100) {
      parts.push(`${small[Math.floor(number / 100)]} Hundred`);
      number %= 100;
    }

    if (number >= 20) {
      parts.push(`${tens[Math.floor(number / 10)]}${number % 10 ? `-${small[number % 10]}` : ""}`);
    } else if (number > 0) {
      parts.push(small[number]);
    }

    return parts.join(" ");
  }

  const whole = Math.floor(Math.max(value, 0));
  const pesewas = Math.round((value - whole) * 100);
  const scales = ["", "Thousand", "Million", "Billion"];
  const parts: string[] = [];
  let remainder = whole;
  let scaleIndex = 0;

  do {
    const group = remainder % 1000;

    if (group > 0) {
      parts.unshift(`${wordsUnderThousand(group)}${scales[scaleIndex] ? ` ${scales[scaleIndex]}` : ""}`);
    }

    remainder = Math.floor(remainder / 1000);
    scaleIndex += 1;
  } while (remainder > 0);

  const cedis = parts.length > 0 ? parts.join(" ") : "Zero";
  const pesewaText = pesewas > 0 ? ` and ${wordsUnderThousand(pesewas)} Pesewas` : "";

  return `${cedis} Ghana Cedis${pesewaText} Only`;
}

export default async function PaymentReceiptPage({
  params,
}: {
  params: {
    id: string;
    paymentId: string;
  };
}) {
  const supabase = createClient();

  const [{ data: sale }, { data: payment }, { data: paidPayments }] = await Promise.all([
    supabase
      .from("sales")
      .select(
        "id, sale_price, clients(full_name, phone, email), units(unit_code, unit_type, projects(name))"
      )
      .eq("id", params.id)
      .single(),
    supabase
      .from("payments")
      .select("id, amount, tax, paid_date, status, receipt_number")
      .eq("id", params.paymentId)
      .eq("sale_id", params.id)
      .eq("status", "paid")
      .single(),
    supabase
      .from("payments")
      .select("id, amount, tax, paid_date, created_at")
      .eq("sale_id", params.id)
      .eq("status", "paid")
      .order("paid_date", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (!sale || !payment) notFound();

  const client = sale.clients as unknown as {
    full_name: string;
    phone: string | null;
    email: string | null;
  } | null;

  const unit = sale.units as unknown as {
    unit_code: string;
    unit_type: string | null;
    projects: { name: string } | null;
  } | null;

  const allPaidPayments = paidPayments ?? [];
  const currentPaymentIndex = allPaidPayments.findIndex((item) => item.id === payment.id);
  const previousPayments = allPaidPayments.slice(0, Math.max(currentPaymentIndex, 0));
  const subtotal = Number(payment.amount ?? 0);
  const tax = Number(payment.tax ?? 0);
  const thisPayment = subtotal + tax;
  const previousPaymentTotal = previousPayments.reduce(
    (sum, item) => sum + Number(item.amount ?? 0) + Number(item.tax ?? 0),
    0
  );
  const amountReceivedToDate = previousPaymentTotal + thisPayment;
  const balanceRemaining = Math.max(Number(sale.sale_price ?? 0) - amountReceivedToDate, 0);
  const receiptDate = payment.paid_date ? new Date(payment.paid_date) : new Date();
  const receiptNumber = payment.receipt_number || "PENDING";

  return (
    <div className="payment-receipt-page">
      <ReceiptActions />

      <main className="payment-receipt-a4" aria-label="Payment receipt">
        <header className="payment-receipt-header">
          <div className="payment-receipt-brand">
            <img
              src="/images/resilience-logo.png"
              alt="Resilience Estate"
              className="payment-receipt-logo"
            />
            <div>
              <p className="payment-receipt-company">RESILIENCE ESTATE</p>
              <p className="payment-receipt-tagline">
                LUXURY PROPERTY <span>•</span> DEVELOPMENT <span>•</span> INVESTMENT
              </p>
            </div>
          </div>

          <div className="payment-receipt-title">
            <p>PAYMENT</p>
            <h1>RECEIPT</h1>
          </div>
        </header>

        <section className="payment-receipt-reference" aria-label="Receipt reference">
          <div>
            <span>RECEIPT NO.</span>
            <strong>{receiptNumber}</strong>
          </div>
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
        </section>

        <section className="payment-receipt-parties">
          <div className="payment-receipt-detail-block">
            <h2>RECEIVED FROM</h2>
            <dl>
              <div>
                <dt>FULL NAME</dt>
                <dd>{client?.full_name ?? "—"}</dd>
              </div>
              <div>
                <dt>PHONE</dt>
                <dd>{client?.phone ?? "—"}</dd>
              </div>
              <div>
                <dt>EMAIL</dt>
                <dd>{client?.email ?? "—"}</dd>
              </div>
            </dl>
          </div>

          <div className="payment-receipt-detail-block">
            <h2>PROPERTY DETAILS</h2>
            <dl>
              <div>
                <dt>PROJECT</dt>
                <dd>{unit?.projects?.name ?? "—"}</dd>
              </div>
              <div>
                <dt>UNIT</dt>
                <dd>{unit?.unit_code ?? "—"}</dd>
              </div>
              <div>
                <dt>UNIT TYPE</dt>
                <dd>{unit?.unit_type ?? "—"}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="payment-receipt-payment-details">
          <h2>PAYMENT DETAILS</h2>
          <div>
            <span>PAYMENT FOR</span>
            <strong>Property purchase installment</strong>
          </div>
          <div>
            <span>PAYMENT DATE</span>
            <strong>
              {payment.paid_date
                ? new Date(payment.paid_date).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })
                : "—"}
            </strong>
          </div>
        </section>

        <section className="payment-receipt-summaries">
          <div className="payment-receipt-summary">
            <h2>BILLING SUMMARY</h2>
            <dl>
              <div>
                <dt>Subtotal</dt>
                <dd>{money(subtotal)}</dd>
              </div>
              <div>
                <dt>Tax</dt>
                <dd>{money(tax)}</dd>
              </div>
              <div className="payment-receipt-summary-total">
                <dt>Total</dt>
                <dd>{money(thisPayment)}</dd>
              </div>
            </dl>
          </div>

          <div className="payment-receipt-summary">
            <h2>INSTALLMENT SUMMARY</h2>
            <dl>
              <div>
                <dt>Previous Payments</dt>
                <dd>{money(previousPaymentTotal)}</dd>
              </div>
              <div>
                <dt>This Payment</dt>
                <dd>{money(thisPayment)}</dd>
              </div>
              <div className="payment-receipt-summary-total">
                <dt>Balance Remaining</dt>
                <dd>{money(balanceRemaining)}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="payment-receipt-amount-box">
          <span>AMOUNT PAID (THIS RECEIPT)</span>
          <strong>{money(thisPayment)}</strong>
        </section>

        <section className="payment-receipt-bottom-details">
          <div>
            <span>PAYMENT STATUS</span>
            <strong className="payment-receipt-paid">PAID</strong>
          </div>
          <div>
            <span>AMOUNT IN WORDS</span>
            <strong>{amountInWords(thisPayment)}</strong>
          </div>
          <div>
            <span>ISSUED BY</span>
            <strong>Finance Department</strong>
          </div>
        </section>

        <section className="payment-receipt-authorization">
          <div>
            <span>Prepared by</span>
            <strong>Finance Department</strong>
          </div>
          <div className="payment-receipt-signature">
            <div aria-hidden="true" />
            <span>AUTHORIZED SIGNATURE</span>
          </div>
        </section>

        <footer className="payment-receipt-footer">
          <strong>RESILIENCE ESTATE LTD</strong>
          <span>LUXURY PROPERTY <i>•</i> DEVELOPMENT <i>•</i> INVESTMENT</span>
          <p>This receipt acknowledges payment received by Resilience Estate Ltd.</p>
        </footer>
      </main>
    </div>
  );
}
