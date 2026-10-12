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
      "id, invoice_number, client_id, sale_id, rental_id, unit_id, agreed_price, units(unit_code, price, projects(name)), bill_to_name, bill_to_phone, bill_to_email, bill_to_address, invoice_date, due_date, tax, notes, status, amount_paid, invoice_items(description, amount, quantity, unit_price, position), issuer:profiles!invoices_created_by_fkey(full_name)"
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

  // What the invoice is for: its linked sale/rental, or the client's sales/rentals to pick from.
  type UnitRef = { unit_code: string; projects: { name: string } | null } | null;
  const unitLabel = (u: UnitRef) => [u?.projects?.name, u?.unit_code].filter(Boolean).join(" · ") || "Unit";
  const parentQuery = (column: "id" | "client_id", value: string) =>
    Promise.all([
      supabase.from("sales").select("id, sale_date, units(unit_code, projects(name))").eq(column, value),
      supabase.from("rentals").select("id, rental_type, start_date, units(unit_code, projects(name))").eq(column, value),
    ]);
  let parentOptions: { kind: "sale" | "rental"; id: string; label: string; rentalType?: string }[] = [];
  const [{ data: optSales }, { data: optRentals }] = invoice.sale_id
    ? await parentQuery("id", invoice.sale_id)
    : invoice.rental_id
      ? await parentQuery("id", invoice.rental_id)
      : invoice.client_id
        ? await parentQuery("client_id", invoice.client_id)
        : [{ data: [] }, { data: [] }];
  parentOptions = [
    ...(invoice.rental_id ? [] : (optSales ?? []).map((s) => ({
      kind: "sale" as const,
      id: s.id,
      label: `Sale · ${unitLabel(s.units as unknown as UnitRef)}`,
    }))),
    ...(invoice.sale_id ? [] : (optRentals ?? []).map((r) => ({
      kind: "rental" as const,
      id: r.id,
      rentalType: r.rental_type,
      label: `${r.rental_type === "monthly" ? "Tenancy" : "Short stay"} · ${unitLabel(r.units as unknown as UnitRef)} from ${new Date(r.start_date).toLocaleDateString("en-GB")}`,
    }))),
  ];

  // Invoice for buying a unit that has no sale yet: paying it creates the sale.
  const purchaseUnit = invoice.units as unknown as { unit_code: string; price: number | null; projects: { name: string } | null } | null;
  const purchase =
    !invoice.sale_id && !invoice.rental_id && invoice.unit_id && purchaseUnit
      ? {
          unitLabel: unitLabel(purchaseUnit),
          price: Number(invoice.agreed_price ?? purchaseUnit.price ?? 0),
          buyer: invoice.bill_to_name,
        }
      : null;
  if (purchase) parentOptions = [];

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
        linked={!!(invoice.sale_id || invoice.rental_id)}
        parentOptions={parentOptions}
        purchase={purchase}
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
