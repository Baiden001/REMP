import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import DocumentActions from "@/components/documents/document-actions";
import InvoiceDocument from "@/components/documents/invoice-document";
import PaymentReceipt from "@/components/documents/payment-receipt";
import { COMPANY } from "@/lib/brand";
import { longDate } from "@/lib/money";
import { receiptFigures } from "@/lib/receipt-figures";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Document · ${COMPANY.name}`,
  robots: { index: false, follow: false },
};

type Paid = { id: string; amount: number; tax: number | null; payment_for: string | null };

type Shared =
  | {
      kind: "invoice";
      invoice: {
        invoice_number: string;
        bill_to_name: string;
        bill_to_phone: string | null;
        bill_to_email: string | null;
        bill_to_address: string | null;
        invoice_date: string;
        due_date: string | null;
        notes: string | null;
        tax: number | null;
        status: string;
      };
      items: { description: string; amount: number; quantity: number | null; unit_price: number | null }[];
      issued_by: string | null;
    }
  | {
      kind: "receipt";
      parent: "sale" | "rental";
      payment: Paid & {
        paid_date: string | null;
        receipt_number: string | null;
        period_start: string | null;
        period_end: string | null;
      };
      total_due: number | null;
      rental_type: "monthly" | "short_stay" | null;
      client: { full_name: string; phone: string | null; email: string | null } | null;
      unit: { unit_code: string | null; unit_type: string | null; project: string | null } | null;
      paid_payments: Paid[];
    };

// Public page: a client opens one invoice or receipt with the link staff sent them.
export default async function SharedDocumentPage({ params }: { params: { token: string } }) {
  const supabase = createClient();
  const { data } = await supabase.rpc("get_shared_document", { p_token: params.token });
  const doc = data as Shared | null;

  if (!doc) {
    return (
      <div className="share-missing">
        <section>
          <h1>This link isn&apos;t available</h1>
          <p>
            It may have expired or been turned off. Please contact {COMPANY.name} for a new copy
            {COMPANY.phone ? ` on ${COMPANY.phone}` : ""}
            {COMPANY.email ? ` or at ${COMPANY.email}` : ""}.
          </p>
        </section>
      </div>
    );
  }

  if (doc.kind === "invoice") {
    return (
      <div className="payment-receipt-page">
        <DocumentActions printLabel="Print / save as PDF" showBack={false} />
        <InvoiceDocument
          invoice={doc.invoice}
          items={doc.items}
          tax={Number(doc.invoice.tax || 0)}
          status={doc.invoice.status}
          issuedBy={doc.issued_by}
        />
      </div>
    );
  }

  const { payment } = doc;
  const figures = receiptFigures({
    kind: doc.parent,
    payment,
    paidPayments: doc.paid_payments,
    totalDue: Number(doc.total_due ?? 0),
  });
  const rental = doc.parent === "rental";

  return (
    <div className="payment-receipt-page">
      <DocumentActions printLabel="Print / save as PDF" showBack={false} />
      <PaymentReceipt
        receiptNumber={payment.receipt_number || "PENDING"}
        paidDate={payment.paid_date}
        client={doc.client}
        property={{
          project: doc.unit?.project ?? null,
          unit: doc.unit?.unit_code ?? null,
          unitType: doc.unit?.unit_type ?? null,
        }}
        paymentFor={
          payment.payment_for ||
          (rental ? (doc.rental_type === "monthly" ? "Monthly rent" : "Short-stay booking") : "Property purchase installment")
        }
        periodLabel={payment.period_start ? `${longDate(payment.period_start)} – ${longDate(payment.period_end)}` : null}
        {...figures}
        summaryTitle={rental ? (doc.rental_type === "monthly" ? "TENANCY SUMMARY" : "BOOKING SUMMARY") : "INSTALLMENT SUMMARY"}
      />
    </div>
  );
}
