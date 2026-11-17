import { COMPANY } from "@/lib/brand";
import { amountInWords, longDate, money } from "@/lib/money";
import type { Currency } from "@/lib/listing";
import { DocumentFooter, DocumentHeader } from "./document-parts";

export type PaymentReceiptProps = {
  receiptNumber: string;
  paidDate: string | null;
  currency: Currency;
  client: { full_name: string; phone: string | null; email: string | null } | null;
  property: { project: string | null; unit: string | null; unitType: string | null };
  paymentFor: string;
  periodLabel?: string | null;
  subtotal: number;
  tax: number;
  previousTotal: number;
  balanceRemaining: number;
  summaryTitle: string;
};

export default function PaymentReceipt({
  receiptNumber,
  paidDate,
  currency,
  client,
  property,
  paymentFor,
  periodLabel,
  subtotal,
  tax,
  previousTotal,
  balanceRemaining,
  summaryTitle,
}: PaymentReceiptProps) {
  const thisPayment = subtotal + tax;
  const format = (value: number) => money(value, currency);

  return (
    <main className="payment-receipt-a4" aria-label="Payment receipt">
      <DocumentHeader kicker="PAYMENT" title="RECEIPT" />

      <section className="payment-receipt-reference" aria-label="Receipt reference">
        <div>
          <span>RECEIPT NO.</span>
          <strong>{receiptNumber}</strong>
        </div>
        <div>
          <span>DATE</span>
          <strong>{longDate(paidDate ?? new Date())}</strong>
        </div>
      </section>

      <section className="payment-receipt-parties">
        <div className="payment-receipt-detail-block">
          <h2>RECEIVED FROM</h2>
          <dl>
            <div><dt>FULL NAME</dt><dd>{client?.full_name ?? "—"}</dd></div>
            <div><dt>PHONE</dt><dd>{client?.phone ?? "—"}</dd></div>
            <div><dt>EMAIL</dt><dd>{client?.email ?? "—"}</dd></div>
          </dl>
        </div>

        <div className="payment-receipt-detail-block">
          <h2>PROPERTY DETAILS</h2>
          <dl>
            <div><dt>PROJECT</dt><dd>{property.project ?? "—"}</dd></div>
            <div><dt>UNIT</dt><dd>{property.unit ?? "—"}</dd></div>
            <div><dt>UNIT TYPE</dt><dd>{property.unitType ?? "—"}</dd></div>
          </dl>
        </div>
      </section>

      <section className="payment-receipt-payment-details">
        <h2>PAYMENT DETAILS</h2>
        <div><span>PAYMENT FOR</span><strong>{paymentFor}</strong></div>
        <div>
          <span>{periodLabel ? "PERIOD COVERED" : "PAYMENT DATE"}</span>
          <strong>{periodLabel ?? longDate(paidDate)}</strong>
        </div>
        <div><span>CURRENCY</span><strong>{currency}</strong></div>
      </section>

      <section className="payment-receipt-summaries">
        <div className="payment-receipt-summary">
          <h2>BILLING SUMMARY</h2>
          <dl>
            <div><dt>Subtotal</dt><dd>{format(subtotal)}</dd></div>
            <div><dt>Tax</dt><dd>{format(tax)}</dd></div>
            <div className="payment-receipt-summary-total">
              <dt>Total</dt><dd>{format(thisPayment)}</dd>
            </div>
          </dl>
        </div>

        <div className="payment-receipt-summary">
          <h2>{summaryTitle}</h2>
          <dl>
            <div><dt>Previous Payments</dt><dd>{format(previousTotal)}</dd></div>
            <div><dt>This Payment</dt><dd>{format(thisPayment)}</dd></div>
            <div className="payment-receipt-summary-total">
              <dt>Balance Remaining</dt><dd>{format(balanceRemaining)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="payment-receipt-amount-box">
        <span>AMOUNT PAID (THIS RECEIPT)</span>
        <strong>{format(thisPayment)}</strong>
      </section>

      <section className="payment-receipt-bottom-details">
        <div><span>PAYMENT STATUS</span><strong className="payment-receipt-paid">PAID</strong></div>
        <div>
          <span>AMOUNT IN WORDS</span>
          <strong>{amountInWords(thisPayment, currency)}</strong>
        </div>
        <div><span>ISSUED BY</span><strong>Finance Department</strong></div>
      </section>

      <section className="payment-receipt-authorization">
        <div><span>Prepared by</span><strong>Finance Department</strong></div>
        <div className="payment-receipt-signature">
          <div aria-hidden="true" />
          <span>AUTHORIZED SIGNATURE</span>
        </div>
      </section>

      <DocumentFooter note={`This receipt acknowledges payment received by ${COMPANY.name}.`} />
    </main>
  );
}
