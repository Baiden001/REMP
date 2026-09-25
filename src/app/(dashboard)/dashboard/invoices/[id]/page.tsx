import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import DocumentActions from "@/components/documents/document-actions";
import ShareButton from "@/components/documents/share-button";
import InvoiceDocument from "@/components/documents/invoice-document";
import InvoiceStatusBar from "./invoice-status-bar";

export default async function InvoicePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, bill_to_name, bill_to_phone, bill_to_email, bill_to_address, invoice_date, due_date, tax, notes, status, amount_paid, invoice_items(description, amount, quantity, unit_price, position), issuer:profiles!invoices_created_by_fkey(full_name)"
    )
    .eq("id", params.id)
    .single();

  if (!invoice) notFound();

  const items = ((invoice.invoice_items ?? []) as { description: string; amount: number; quantity: number | null; unit_price: number | null; position: number }[])
    .slice()
    .sort((a, b) => a.position - b.position);

  const { data: linked } = await supabase
    .from("payments")
    .select("id, amount, tax, paid_date, receipt_number, sale_id, rental_id")
    .eq("invoice_id", invoice.id)
    .eq("status", "paid")
    .order("paid_date", { ascending: true });

  const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0) + Number(invoice.tax || 0);
  const linkedPayments = (linked ?? []).map((p) => ({
    ...p,
    href: p.sale_id
      ? `/dashboard/sales/${p.sale_id}/receipt/${p.id}`
      : p.rental_id
        ? `/dashboard/rentals/${p.rental_id}/receipt/${p.id}`
        : null,
  }));

  return (
    <div className="payment-receipt-page">
      <DocumentActions printLabel="Print invoice">
        <ShareButton
          kind="invoice"
          invoiceId={invoice.id}
          docLabel={`invoice ${invoice.invoice_number}`}
          clientName={invoice.bill_to_name}
          phone={invoice.bill_to_phone}
          email={invoice.bill_to_email}
        />
      </DocumentActions>
      <InvoiceStatusBar
        invoiceId={invoice.id}
        status={invoice.status}
        total={total}
        amountPaid={Number(invoice.amount_paid || 0)}
        payments={linkedPayments}
      />
      <InvoiceDocument
        invoice={invoice}
        items={items}
        tax={Number(invoice.tax || 0)}
        status={invoice.status}
        issuedBy={(invoice.issuer as unknown as { full_name: string } | null)?.full_name ?? null}
      />
    </div>
  );
}
