import { BANK_DETAILS, COMPANY, INVOICE_TERMS } from "@/lib/brand";
import { amountInWords, longDate, money } from "@/lib/money";
import { DocumentFooter, DocumentHeader } from "./document-parts";

export type InvoiceDocumentProps = {
  invoice: {
    invoice_number: string;
    bill_to_name: string;
    bill_to_phone: string | null;
    bill_to_email: string | null;
    bill_to_address: string | null;
    invoice_date: string;
    due_date: string | null;
    notes: string | null;
  };
  items: { description: string; amount: number; quantity?: number | null; unit_price?: number | null }[];
  tax: number;
  issuedBy?: string | null;
};

function formatQty(value: number | null | undefined) {
  const n = Number(value ?? 1);
  return Number.isInteger(n) ? String(n) : n.toLocaleString("en-GH", { maximumFractionDigits: 2 });
}

export default function InvoiceDocument({ invoice, items, tax, issuedBy }: InvoiceDocumentProps) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const total = subtotal + tax;

  const bankRows = [
    ["Bank name", BANK_DETAILS.bankName],
    ["Account number", BANK_DETAILS.accountNumber],
    ["Account name", BANK_DETAILS.accountName],
  ];

  return (
    <main className="payment-receipt-a4 invoice-a4" aria-label="Invoice">
      <DocumentHeader kicker="CLIENT" title="INVOICE" />

      <section className="payment-receipt-reference invoice-reference" aria-label="Invoice reference">
        <div>
          <span>INVOICE NO.</span>
          <strong>{invoice.invoice_number}</strong>
        </div>
        <div>
          <span>INVOICE DATE</span>
          <strong>{longDate(invoice.invoice_date)}</strong>
        </div>
        <div>
          <span>DUE DATE</span>
          <strong>{invoice.due_date ? longDate(invoice.due_date) : "On receipt"}</strong>
        </div>
      </section>

      <section className="payment-receipt-parties">
        <div className="payment-receipt-detail-block">
          <h2>BILL TO</h2>
          <dl>
            <div>
              <dt>NAME</dt>
              <dd>{invoice.bill_to_name}</dd>
            </div>
            {invoice.bill_to_phone && (
              <div>
                <dt>PHONE</dt>
                <dd>{invoice.bill_to_phone}</dd>
              </div>
            )}
            {invoice.bill_to_email && (
              <div>
                <dt>EMAIL</dt>
                <dd>{invoice.bill_to_email}</dd>
              </div>
            )}
            {invoice.bill_to_address && (
              <div>
                <dt>ADDRESS</dt>
                <dd>{invoice.bill_to_address}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="invoice-due-box">
          <span>AMOUNT DUE</span>
          <strong>{money(total)}</strong>
          <small>{invoice.due_date ? `Due by ${longDate(invoice.due_date)}` : "Due on receipt"}</small>
        </div>
      </section>

      <section className="invoice-table-wrap">
        <table className="invoice-table">
          <thead>
            <tr>
              <th style={{ width: "10mm" }}>#</th>
              <th>DESCRIPTION</th>
              <th className="qty">QTY</th>
              <th className="amount">UNIT PRICE</th>
              <th className="amount">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{item.description}</td>
                <td className="qty">{formatQty(item.quantity)}</td>
                <td className="amount">{money(Number(item.unit_price ?? item.amount))}</td>
                <td className="amount">{money(Number(item.amount))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {tax > 0 && (
              <>
                <tr>
                  <td colSpan={4}>Subtotal</td>
                  <td className="amount">{money(subtotal)}</td>
                </tr>
                <tr>
                  <td colSpan={4}>Tax</td>
                  <td className="amount">{money(tax)}</td>
                </tr>
              </>
            )}
            <tr className="invoice-total-row">
              <td colSpan={4}>TOTAL DUE</td>
              <td className="amount">{money(total)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="invoice-words">
          <span>AMOUNT IN WORDS</span>
          {amountInWords(total)}
        </p>
      </section>

      <section className="invoice-bank">
        <h2>PAYMENT DETAILS</h2>
        <dl className="invoice-bank-rows">
          {bankRows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}:</dt>
              <dd>{value || <span className="invoice-blank" aria-label="to be filled in" />}</dd>
            </div>
          ))}
        </dl>
        {invoice.notes && <p className="invoice-notes">{invoice.notes}</p>}
      </section>

      <section className="invoice-terms">
        <h2>TERMS &amp; CONDITIONS</h2>
        <ol>
          {INVOICE_TERMS.map((term) => (
            <li key={term}>{term}</li>
          ))}
        </ol>
      </section>

      <section className="payment-receipt-authorization invoice-authorization">
        <div>
          <span>ISSUED BY</span>
          <strong>{issuedBy || "Finance Department"}</strong>
        </div>
        <div className="payment-receipt-signature">
          <div aria-hidden="true" />
          <span>AUTHORIZED SIGNATURE</span>
        </div>
      </section>

      <DocumentFooter note={`Thank you for choosing ${COMPANY.shortName}.`} />
    </main>
  );
}
