import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import DocumentActions from "@/components/documents/document-actions";
import ShareButton from "@/components/documents/share-button";
import PaymentReceipt from "@/components/documents/payment-receipt";
import { receiptFigures } from "@/lib/receipt-figures";
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
      .select("id, amount, tax, paid_date, status, receipt_number, payment_for, period_start, period_end")
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

  const { subtotal, tax, previousTotal, balanceRemaining } = receiptFigures({
    kind: "rental",
    payment,
    paidPayments: paidPayments ?? [],
    totalDue: Number(rental.total_amount ?? 0),
  });

  const periodLabel = payment.period_start
    ? `${longDate(payment.period_start)} – ${longDate(payment.period_end)}`
    : null;

  return (
    <div className="payment-receipt-page">
      <DocumentActions printLabel="Print receipt">
        {payment.status === "paid" && payment.receipt_number && (
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
