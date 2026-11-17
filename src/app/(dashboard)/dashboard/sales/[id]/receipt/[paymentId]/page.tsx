import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import DocumentActions from "@/components/documents/document-actions";
import ShareButton from "@/components/documents/share-button";
import PaymentReceipt from "@/components/documents/payment-receipt";
import { receiptFigures } from "@/lib/receipt-figures";

export default async function PaymentReceiptPage({
  params,
}: {
  params: { id: string; paymentId: string };
}) {
  const supabase = createClient();

  const [{ data: sale }, { data: payment }, { data: paidPayments }] =
    await Promise.all([
      supabase
        .from("sales")
        .select(
          "id, sale_price, currency, clients(full_name, phone, email), units(unit_code, unit_type, projects(name))"
        )
        .eq("id", params.id)
        .single(),

      supabase
        .from("payments")
        .select("id, amount, tax, currency, paid_date, status, receipt_number, payment_for")
        .eq("id", params.paymentId)
        .eq("sale_id", params.id)
        .eq("status", "paid")
        .single(),

      supabase
        .from("payments")
        .select("id, amount, tax, currency, paid_date, created_at, payment_for")
        .eq("sale_id", params.id)
        .eq("status", "paid")
        .order("paid_date", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

  if (!sale || !payment) notFound();

  const currency =
    payment.currency === "USD" || sale.currency === "USD" ? "USD" : "GHS";

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

  const {
    subtotal,
    tax,
    previousTotal,
    balanceRemaining,
  } = receiptFigures({
    kind: "sale",
    payment,
    paidPayments: paidPayments ?? [],
    totalDue: Number(sale.sale_price ?? 0), currency,
  });

  return (
    <div className="payment-receipt-page">
      <DocumentActions printLabel="Print receipt">
        {payment.receipt_number && (
          <ShareButton
            kind="receipt"
            paymentId={payment.id}
            docLabel={`receipt ${payment.receipt_number}`}
            clientName={client?.full_name}
            phone={client?.phone}
            email={client?.email}
          />
        )}
      </DocumentActions>

      <PaymentReceipt
        receiptNumber={payment.receipt_number || "PENDING"}
        paidDate={payment.paid_date}
        currency={currency}
        client={client}
        property={{
          project: unit?.projects?.name ?? null,
          unit: unit?.unit_code ?? null,
          unitType: unit?.unit_type ?? null,
        }}
        paymentFor={payment.payment_for || "Property purchase installment"}
        subtotal={subtotal}
        tax={tax}
        previousTotal={previousTotal}
        balanceRemaining={balanceRemaining}
        summaryTitle="INSTALLMENT SUMMARY"
      />
    </div>
  );
}
