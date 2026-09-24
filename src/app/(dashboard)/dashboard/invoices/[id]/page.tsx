import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import DocumentActions from "@/components/documents/document-actions";
import InvoiceDocument from "@/components/documents/invoice-document";

export default async function InvoicePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, bill_to_name, bill_to_phone, bill_to_email, bill_to_address, invoice_date, due_date, tax, notes, invoice_items(description, amount, position), issuer:profiles!invoices_created_by_fkey(full_name)"
    )
    .eq("id", params.id)
    .single();

  if (!invoice) notFound();

  const items = ((invoice.invoice_items ?? []) as { description: string; amount: number; position: number }[])
    .slice()
    .sort((a, b) => a.position - b.position);

  return (
    <div className="payment-receipt-page">
      <DocumentActions printLabel="Print invoice" />
      <InvoiceDocument
        invoice={invoice}
        items={items}
        tax={Number(invoice.tax || 0)}
        issuedBy={(invoice.issuer as unknown as { full_name: string } | null)?.full_name ?? null}
      />
    </div>
  );
}
