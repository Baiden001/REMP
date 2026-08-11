"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AddPaymentButton({ saleId }: { saleId: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError(null);

    const form = event.currentTarget;
    const data = new FormData(form);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      setError("Your session has expired. Please log in again.");
      return;
    }

    const amount = Number(data.get("amount"));
    const dueDate = data.get("due_date") || null;
    const paidDate = data.get("paid_date") || null;
    const isPaid = Boolean(paidDate);

    if (!amount || amount <= 0) {
      setSaving(false);
      setError("Please enter a valid payment amount.");
      return;
    }

    /*
     * 1. Create the payment
     */
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        sale_id: saleId,
        amount,
        due_date: dueDate,
        paid_date: paidDate,
        status: isPaid ? "paid" : "pending",
        recorded_by: user.id,
      })
      .select("id")
      .single();

    if (paymentError || !payment) {
      setSaving(false);
      setError(paymentError?.message ?? "Could not save payment.");
      return;
    }

    /*
     * 2. Create receipt only for a paid payment
     */
    if (isPaid) {
      const { data: receiptNumber, error: numberError } = await supabase.rpc(
        "generate_receipt_number"
      );

      if (numberError || !receiptNumber) {
        setSaving(false);
        setError(
          numberError?.message ?? "Payment saved, but receipt number failed."
        );
        return;
      }

      const { error: receiptError } = await supabase
        .from("receipts")
        .insert({
          receipt_number: receiptNumber,
          sale_id: saleId,
          payment_id: payment.id,
          amount,
          created_by: user.id,
        });

      if (receiptError) {
        setSaving(false);
        setError(
          `Payment saved, but receipt creation failed: ${receiptError.message}`
        );
        return;
      }
    }

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
          setError(null);
          setOpen(true);
        }}
      >
        ＋ Add payment
      </button>

      <div
        className="modal-backdrop"
        hidden={!open}
        onClick={(e) => {
          if (e.target === e.currentTarget && !saving) {
            setOpen(false);
          }
        }}
      >
        <section className="modal" role="dialog" aria-modal="true">
          <button
            className="modal-close"
            aria-label="Close"
            onClick={() => !saving && setOpen(false)}
          >
            ×
          </button>

          <p className="eyebrow">PAYMENTS</p>

          <h2>Log a payment</h2>

          <p>
            Record a payment instalment for this sale. A receipt is generated
            automatically for paid payments.
          </p>

          <form onSubmit={handleSubmit}>
            <label>
              Amount (GH₵)
              <input
                required
                type="number"
                name="amount"
                min={1}
                step="0.01"
                placeholder="e.g. 100000"
              />
            </label>

            <div className="form-pair">
              <label>
                Due date
                <input type="date" name="due_date" />
              </label>

              <label>
                Paid date
                <input type="date" name="paid_date" />
              </label>
            </div>

            <p
              style={{
                fontSize: 11,
                color: "#8794a5",
                marginTop: 8,
              }}
            >
              Leave Paid date blank if this instalment has not been paid.
            </p>

            {error && (
              <p
                style={{
                  color: "#c0392b",
                  fontSize: 12,
                  marginTop: 12,
                }}
              >
                {error}
              </p>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="button ghost"
                disabled={saving}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>

              <button
                className="button primary"
                type="submit"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save payment"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}