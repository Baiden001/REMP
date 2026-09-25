"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isRentPayment, RENT_PAYMENT_FOR } from "@/lib/listing";
import { nextReceiptNumber } from "@/lib/receipts";
import Icon from "@/components/icon";

export type PaymentTarget =
  | { kind: "sale"; saleId: string; totalDue: number }
  | {
      kind: "rental";
      rentalId: string;
      rentalType: "short_stay" | "monthly";
      rate: number;
      totalDue: number;
      startDate: string;
    };

const SALE_PAYMENT_FOR = ["Deposit", "Property purchase installment", "Final payment", "Other"];

function rentalPaymentFor(rentalType: "short_stay" | "monthly") {
  return [
    rentalType === "monthly" ? RENT_PAYMENT_FOR[0] : RENT_PAYMENT_FOR[1],
    "Security deposit",
    "Service charge",
    "Other",
  ];
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addMonths(start: string, months: number) {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return isoDate(date);
}

function addDays(start: string, days: number) {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

function nightsBetween(from: string, to: string) {
  const ms = new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

export type OpenInvoice = { id: string; invoice_number: string; balance: number };

export default function AddPaymentButton({
  target,
  invoices = [],
}: {
  target: PaymentTarget;
  invoices?: OpenInvoice[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const isRental = target.kind === "rental";
  const paymentForOptions = isRental ? rentalPaymentFor(target.rentalType) : SALE_PAYMENT_FOR;
  const rentLabel = paymentForOptions[0];

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [paymentFor, setPaymentFor] = useState(isRental ? rentLabel : SALE_PAYMENT_FOR[1]);
  const [amount, setAmount] = useState("");
  const [periodStart, setPeriodStart] = useState(isRental ? target.startDate : "");
  const [months, setMonths] = useState("1");
  const [periodEnd, setPeriodEnd] = useState("");
  const [invoiceId, setInvoiceId] = useState("");

  const coversRent = isRental && paymentFor === rentLabel;

  // Suggest an amount from the rental rate whenever the period changes.
  function suggestAmount(start: string, monthsValue: string, end: string) {
    if (target.kind !== "rental") return;
    if (target.rentalType === "monthly") {
      const count = Number(monthsValue);
      if (count > 0) setAmount(String(count * target.rate));
    } else if (start && end) {
      const nights = nightsBetween(start, end);
      if (nights > 0) setAmount(String(nights * target.rate));
    }
  }

  function resetForm() {
    setError(null);
    setPaymentFor(isRental ? rentLabel : SALE_PAYMENT_FOR[1]);
    setPeriodStart(isRental ? target.startDate : "");
    setMonths("1");
    setPeriodEnd("");
    setInvoiceId("");
    if (target.kind === "rental" && target.rentalType === "monthly") {
      setAmount(String(target.rate));
    } else {
      setAmount("");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError(null);

    const form = event.currentTarget;
    const data = new FormData(form);

    const numericAmount = Number(amount);
    const tax = Number(data.get("tax")) || 0;
    const dueDate = data.get("due_date") as string;
    const paidDate = data.get("paid_date") as string;

    if (!numericAmount || numericAmount <= 0) {
      setError("Please enter a valid payment amount.");
      setSaving(false);
      return;
    }

    if (tax < 0) {
      setError("Tax cannot be negative.");
      setSaving(false);
      return;
    }

    if (!paidDate) {
      setError("Please enter the payment date.");
      setSaving(false);
      return;
    }

    let period: { start: string | null; end: string | null } = { start: null, end: null };

    if (coversRent && target.kind === "rental") {
      if (!periodStart) {
        setError("Please enter the start of the period this payment covers.");
        setSaving(false);
        return;
      }

      if (target.rentalType === "monthly") {
        const count = Number(months);
        if (!count || count <= 0) {
          setError("Please enter how many months this payment covers.");
          setSaving(false);
          return;
        }
        // Last day covered, e.g. 1 Oct + 1 month → 31 Oct.
        period = { start: periodStart, end: addDays(addMonths(periodStart, count), -1) };
      } else {
        if (!periodEnd || nightsBetween(periodStart, periodEnd) <= 0) {
          setError("Check-out must be after check-in.");
          setSaving(false);
          return;
        }
        period = { start: periodStart, end: periodEnd };
      }
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Your session has expired. Please log in again.");
      setSaving(false);
      return;
    }

    const numbered = await nextReceiptNumber(supabase, paidDate);
    if ("error" in numbered) {
      setError(numbered.error ?? "Could not create a receipt number.");
      setSaving(false);
      return;
    }
    const receiptNumber = numbered.receiptNumber;

    const parent =
      target.kind === "sale"
        ? { column: "sale_id", id: target.saleId, table: "sales" }
        : { column: "rental_id", id: target.rentalId, table: "rentals" };

    const { error: insertError } = await supabase.from("payments").insert({
      [parent.column]: parent.id,
      amount: numericAmount,
      tax,
      due_date: dueDate || null,
      paid_date: paidDate,
      status: "paid",
      recorded_by: user.id,
      receipt_number: receiptNumber,
      payment_for: paymentFor,
      period_start: period.start,
      period_end: period.end,
      invoice_id: invoiceId || null,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    // Keep the sale / rental payment status in step with what has been collected.
    const { data: paid } = await supabase
      .from("payments")
      .select("amount, payment_for")
      .eq(parent.column, parent.id)
      .eq("status", "paid");

    const collected = (paid ?? [])
      .filter((p) => target.kind === "sale" || isRentPayment(p))
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const status = collected >= target.totalDue ? "paid" : collected > 0 ? "partial" : "pending";

    await supabase.from(parent.table).update({ payment_status: status }).eq("id", parent.id);

    setSaving(false);
    setOpen(false);
    form.reset();

    router.refresh();
  }

  return (
    <>
      <button
        className="button ghost"
        style={{ fontSize: 11 }}
        onClick={() => {
          resetForm();
          setOpen(true);
        }}
      >
        <Icon name="plus" size={14} /> Add payment
      </button>

      <div
        className="modal-backdrop"
        hidden={!open}
        onClick={(event) => {
          if (event.target === event.currentTarget && !saving) {
            setOpen(false);
          }
        }}
      >
        <section className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 520 }}>
          <button className="modal-close" aria-label="Close" onClick={() => !saving && setOpen(false)}>
            <Icon name="x" size={20} />
          </button>

          <p className="eyebrow">PAYMENTS</p>

          <h2>Log a payment</h2>

          <p>
            {isRental
              ? "Record a rent payment and the period it covers. The amount is worked out from the rate — adjust it if needed."
              : "Record the payment and tax information for this transaction."}
          </p>

          <form onSubmit={handleSubmit}>
            {invoices.length > 0 && (
              <label>
                Paying an invoice? (optional)
                <select
                  value={invoiceId}
                  onChange={(event) => {
                    setInvoiceId(event.target.value);
                    const chosen = invoices.find((inv) => inv.id === event.target.value);
                    if (chosen && !amount) setAmount(String(chosen.balance));
                  }}
                >
                  <option value="">No — not against an invoice</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} — balance GH₵ {inv.balance.toLocaleString("en-GH", { minimumFractionDigits: 2 })}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label>
              Payment for
              <select value={paymentFor} onChange={(event) => setPaymentFor(event.target.value)}>
                {paymentForOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            {coversRent && target.kind === "rental" && (
              <div className="form-pair">
                <label>
                  {target.rentalType === "monthly" ? "Period starts" : "Check-in"}
                  <input
                    required
                    type="date"
                    value={periodStart}
                    onChange={(event) => {
                      setPeriodStart(event.target.value);
                      suggestAmount(event.target.value, months, periodEnd);
                    }}
                  />
                </label>

                {target.rentalType === "monthly" ? (
                  <label>
                    Months covered
                    <input
                      required
                      type="number"
                      min="1"
                      step="1"
                      value={months}
                      onChange={(event) => {
                        setMonths(event.target.value);
                        suggestAmount(periodStart, event.target.value, periodEnd);
                      }}
                    />
                  </label>
                ) : (
                  <label>
                    Check-out
                    <input
                      required
                      type="date"
                      value={periodEnd}
                      onChange={(event) => {
                        setPeriodEnd(event.target.value);
                        suggestAmount(periodStart, months, event.target.value);
                      }}
                    />
                  </label>
                )}
              </div>
            )}

            <div className="form-pair">
              <label>
                Amount (GH₵)
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="e.g. 100000"
                />
              </label>

              <label>
                Tax (GH₵)
                <input type="number" name="tax" min="0" step="0.01" defaultValue="0" placeholder="e.g. 15000" />
              </label>
            </div>

            <div className="form-pair">
              <label>
                Due date
                <input type="date" name="due_date" />
              </label>

              <label>
                Payment date
                <input required type="date" name="paid_date" defaultValue={isoDate(new Date())} />
              </label>
            </div>

            {error && <p style={{ color: "#c0392b", fontSize: 12, marginTop: 12 }}>{error}</p>}

            <div className="modal-actions">
              <button type="button" className="button ghost" disabled={saving} onClick={() => setOpen(false)}>
                Cancel
              </button>

              <button className="button primary" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save payment"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
