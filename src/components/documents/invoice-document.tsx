import { BANK_DETAILS, COMPANY, hasBankDetails } from "@/lib/brand";
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
  items: { description: string; amount: number }[];
  tax: number;
};

export default function InvoiceDocument({ invoice, items, tax }: InvoiceDocumentProps) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const total = subtotal + tax;

  const bankRows = [
    ["Bank", BANK_DETAILS.bankName],
    ["Account name", BANK_DETAILS.accountName],
    ["Account number", BANK_DETAILS.accountNumber],
    ["Branch", BANK_DETAILS.branch],
    ["SWIFT code", BANK_DETAILS.swiftCode],
  ].filter(([, value]) => value);

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

        <div className="payment-receipt-detail-block">
          <h2>FROM</h2>
          <dl>
            <div>
              <dt>COMPANY</dt>
              <dd>{COMPANY.name}</dd>
            </div>
            <div>
              <dt>ADDRESS</dt>
              <dd>{COMPANY.address}</dd>
            </div>
            <div>
              <dt>CONTACT</dt>
              <dd>
                {COMPANY.phone} · {COMPANY.email}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="invoice-table-wrap">
        <table className="invoice-table">
          <thead>
            <tr>
              <th style={{ width: "10mm" }}>#</th>
              <th>DESCRIPTION</th>
              <th className="amount">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{item.description}</td>
                <td className="amount">{money(Number(item.amount))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {tax > 0 && (
              <>
                <tr>
                  <td colSpan={2}>Subtotal</td>
                  <td className="amount">{money(subtotal)}</td>
                </tr>
                <tr>
                  <td colSpan={2}>Tax</td>
                  <td className="amount">{money(tax)}</td>
                </tr>
              </>
            )}
            <tr className="invoice-total-row">
              <td colSpan={2}>TOTAL DUE</td>
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
        {hasBankDetails() ? (
          <dl>
            {bankRows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="invoice-bank-pending">
            Bank details to be confirmed. Please contact {COMPANY.email} or {COMPANY.phone} for payment instructions.
          </p>
        )}
        <p className="invoice-bank-ref">
          Please quote <b>{invoice.invoice_number}</b> as your payment reference.
        </p>
        {invoice.notes && <p className="invoice-notes">{invoice.notes}</p>}
      </section>

      <DocumentFooter note={`Thank you for choosing ${COMPANY.shortName}.`} />
    </main>
  );
}
