import React from "react";

function money(value: number) {
  return `GH₵ ${value.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export type ReceiptDocumentProps = {
  receiptNumber: string;
  receiptDate: string;
  client: {
    full_name: string;
    phone: string | null;
    email: string | null;
  } | null;
  unit: {
    unit_code: string;
    unit_type: string | null;
    project_name: string | null;
  } | null;
  amount: number;
  paymentDate: string | null;
  paymentFor?: string;
  preparedBy: string;
  department?: string;
};

export default function ReceiptDocument({
  receiptNumber,
  receiptDate,
  client,
  unit,
  amount,
  paymentDate,
  paymentFor = "Installment",
  preparedBy,
  department = "Finance Department",
}: ReceiptDocumentProps) {
  return (
    <main className="receipt-document" aria-label="Payment receipt">
      <header className="receipt-document-header">
        <div className="receipt-document-brand">
          <img
            src="/images/resilience-logo-bg.PNG"
            alt="Resilience Estate Ltd"
            className="receipt-document-logo"
          />

          <div>
            <h1>RESILIENCE ESTATE LTD</h1>
            <p>RESILIENCE ESTATE MANAGEMENT PORTAL</p>
          </div>
        </div>

        <div className="receipt-document-title">
          <span>PAYMENT</span>
          <strong>RECEIPT</strong>
        </div>
      </header>

      <div className="receipt-document-rule" />

      <section className="receipt-document-reference">
        <div>
          <span>RECEIPT NO.</span>
          <strong>{receiptNumber}</strong>
        </div>

        <div>
          <span>DATE</span>
          <strong>{receiptDate}</strong>
        </div>
      </section>

      <section className="receipt-document-section">
        <h2>RECEIVED FROM</h2>

        <div className="receipt-document-grid">
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

      <section className="receipt-document-section">
        <h2>PROPERTY DETAILS</h2>

        <div className="receipt-document-grid">
          <div>
            <span>PROJECT</span>
            <strong>{unit?.project_name ?? "—"}</strong>
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

      <section className="receipt-document-section receipt-document-payment">
        <h2>PAYMENT DETAILS</h2>

        <table>
          <thead>
            <tr>
              <th>PAYMENT FOR</th>
              <th>PAYMENT DATE</th>
              <th>AMOUNT PAID</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>{paymentFor}</td>
              <td>{paymentDate ?? "—"}</td>
              <td>{money(amount)}</td>
            </tr>
          </tbody>

          <tfoot>
            <tr>
              <td colSpan={2}>TOTAL PAID</td>
              <td>{money(amount)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="receipt-document-amount">
        <span>AMOUNT RECEIVED</span>
        <strong>{money(amount)}</strong>
      </section>

      <section className="receipt-document-authorization">
        <div className="receipt-document-prepared">
          <div>
            <span>PREPARED BY</span>
            <strong>{preparedBy}</strong>
          </div>

          <div>
            <span>DEPARTMENT</span>
            <strong>{department}</strong>
          </div>
        </div>

        <div className="receipt-document-signature">
          <div className="receipt-document-signature-line" />
          <span>AUTHORIZED SIGNATURE</span>
        </div>
      </section>

      <footer className="receipt-document-footer">
        <strong>Thank you for your payment.</strong>

        <p>
          This receipt confirms payment received by Resilience Estate Ltd.
        </p>
      </footer>

      <div className="receipt-document-reference-bottom">
        Receipt No: {receiptNumber}
      </div>
    </main>
  );
}