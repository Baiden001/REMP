import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import DocumentActions from "@/components/documents/document-actions";
import PaymentReceipt from "@/components/documents/payment-receipt";

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
      .select("id, amount, tax, paid_date, status, receipt_number, payment_for")
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
  const receiptNumber = payment.receipt_number || "PENDING";

  return (
    <div className="payment-receipt-page">
      <DocumentActions printLabel="Print receipt" />

      <PaymentReceipt
        receiptNumber={receiptNumber}
        paidDate={payment.paid_date}
        client={client}
        property={{
          project: unit?.projects?.name ?? null,
          unit: unit?.unit_code ?? null,
          unitType: unit?.unit_type ?? null,
        }}
        paymentFor={payment.payment_for || "Property purchase installment"}
        subtotal={subtotal}
        tax={tax}
        previousTotal={previousPaymentTotal}
        balanceRemaining={balanceRemaining}
        summaryTitle="INSTALLMENT SUMMARY"
      />
    </div>
  );
}
