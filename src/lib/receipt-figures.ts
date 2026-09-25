import { isRentPayment } from "@/lib/listing";

type PaidPayment = { id: string; amount: number | null; tax: number | null; payment_for?: string | null };

// Totals printed on a receipt. Payments must be in the order they were paid.
// Sales: balance = price − everything received (incl. tax), as before.
// Rentals: balance = rent owed − rent paid (deposits, service charges and tax are extra).
export function receiptFigures({
  kind,
  payment,
  paidPayments,
  totalDue,
}: {
  kind: "sale" | "rental";
  payment: PaidPayment;
  paidPayments: PaidPayment[];
  totalDue: number;
}) {
  const index = paidPayments.findIndex((item) => item.id === payment.id);
  const previous = paidPayments.slice(0, Math.max(index, 0));
  const subtotal = Number(payment.amount ?? 0);
  const tax = Number(payment.tax ?? 0);
  const previousTotal = previous.reduce((sum, item) => sum + Number(item.amount ?? 0) + Number(item.tax ?? 0), 0);

  const balanceRemaining =
    kind === "sale"
      ? Math.max(totalDue - (previousTotal + subtotal + tax), 0)
      : Math.max(
          totalDue -
            (previous
              .filter((item) => isRentPayment({ payment_for: item.payment_for ?? null }))
              .reduce((sum, item) => sum + Number(item.amount ?? 0), 0) +
              (isRentPayment({ payment_for: payment.payment_for ?? null }) ? subtotal : 0)),
          0
        );

  return { subtotal, tax, previousTotal, balanceRemaining };
}
