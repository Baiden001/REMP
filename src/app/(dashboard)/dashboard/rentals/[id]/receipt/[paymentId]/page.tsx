import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import DocumentActions from "@/components/documents/document-actions";
import PaymentReceipt from "@/components/documents/payment-receipt";
import { isRentPayment } from "@/lib/listing";
import { longDate } from "@/lib/money";

export default async function RentalReceiptPage({ params }: { params: { id: string; paymentId: string } }) {
  const supabase = createClient();

  const [{ data: rental }, { data: payment }, { data: paidPayments }] = await Promise.all([
    supabase
      .from("rentals")
      .select("id, rental_type, total_amount, clients(full_name, phone, email), units(unit_code, unit_type, projects(name))")
      .eq("id", params.id)
      .single(),
    supabase
      .from("payments")
      .select("id, amount, tax, paid_date, receipt_number, payment_for, period_start, period_end")
      .eq("id", params.paymentId)
      .eq("rental_id", params.id)
      .eq("status", "paid")
      .single(),
    supabase
      .from("payments")
      .select("id, amount, tax, payment_for")
      .eq("rental_id", params.id)
      .eq("status", "paid")
      .order("paid_date", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (!rental || !payment) notFound();

  const client = rental.clients as unknown as { full_name: string; phone: string | null; email: string | null } | null;
  const unit = rental.units as unknown as {
    unit_code: string;
    unit_type: string | null;
    projects: { name: string } | null;
  } | null;

  const all = paidPayments ?? [];
  const index = all.findIndex((item) => item.id === payment.id);
  const previous = all.slice(0, Math.max(index, 0));
  const subtotal = Number(payment.amount ?? 0);
  const tax = Number(payment.tax ?? 0);
  const previousTotal = previous.reduce((sum, item) => sum + Number(item.amount ?? 0) + Number(item.tax ?? 0), 0);
  // Balance is measured against rent owed (tax is collected on top, as for sales).
  const paidRent =
    previous.filter(isRentPayment).reduce((sum, item) => sum + Number(item.amount ?? 0), 0) +
    (isRentPayment(payment) ? subtotal : 0);
  const balanceRemaining = Math.max(Number(rental.total_amount ?? 0) - paidRent, 0);

  const periodLabel = payment.period_start
    ? `${longDate(payment.period_start)} – ${longDate(payment.period_end)}`
    : null;

  return (
    <div className="payment-receipt-page">
      <DocumentActions printLabel="Print receipt" />

      <PaymentReceipt
        receiptNumber={payment.receipt_number || "PENDING"}
        paidDate={payment.paid_date}
        client={client}
        property={{
          project: unit?.projects?.name ?? null,
          unit: unit?.unit_code ?? null,
          unitType: unit?.unit_type ?? null,
        }}
        paymentFor={payment.payment_for || (rental.rental_type === "monthly" ? "Monthly rent" : "Short-stay booking")}
        periodLabel={periodLabel}
        subtotal={subtotal}
        tax={tax}
        previousTotal={previousTotal}
        balanceRemaining={balanceRemaining}
        summaryTitle={rental.rental_type === "monthly" ? "TENANCY SUMMARY" : "BOOKING SUMMARY"}
      />
    </div>
  );
}
