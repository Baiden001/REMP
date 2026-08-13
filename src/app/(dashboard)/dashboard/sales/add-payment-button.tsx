"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AddPaymentButton({
  saleId,
}: {
  saleId: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setError(null);

    const form = event.currentTarget;
    const data = new FormData(form);

    const amount = Number(data.get("amount"));
    const tax = Number(data.get("tax")) || 0;
    const dueDate = data.get("due_date") as string;
    const paidDate = data.get("paid_date") as string;

    if (!amount || amount <= 0) {
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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Your session has expired. Please log in again.");
      setSaving(false);
      return;
    }

    const { count, error: countError } = await supabase
  .from("payments")
  .select("id", {
    count: "exact",
    head: true,
  })
  .eq("status", "paid");

if (countError) {
  setError(countError.message);
  setSaving(false);
  return;
}

const sequence = (count ?? 0) + 1;

const paymentDate = new Date(`${paidDate}T12:00:00`);

const yy = String(paymentDate.getFullYear()).slice(-2);
const dd = String(paymentDate.getDate()).padStart(2, "0");
const mm = String(paymentDate.getMonth() + 1).padStart(2, "0");

const receiptNumber = `REMP${yy}/${String(sequence).padStart(3, "0")}/${dd}${mm}`;

const { error: insertError } = await supabase
  .from("payments")
  .insert({
    sale_id: saleId,
    amount,
    tax,
    due_date: dueDate || null,
    paid_date: paidDate,
    status: "paid",
    recorded_by: user.id,
    receipt_number: receiptNumber,
  });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
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
        onClick={(event) => {
          if (
            event.target === event.currentTarget &&
            !saving
          ) {
            setOpen(false);
          }
        }}
      >
        <section
          className="modal"
          role="dialog"
          aria-modal="true"
        >
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
            Record the payment and tax information for this transaction.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-pair">
              <label>
                Amount (GH₵)
                <input
                  required
                  type="number"
                  name="amount"
                  min="0.01"
                  step="0.01"
                  placeholder="e.g. 100000"
                />
              </label>

              <label>
  Tax (GH₵)
  <input
    type="number"
    name="tax"
    min="0"
    step="0.01"
    defaultValue="0"
    placeholder="e.g. 15000"
  />
</label>
            </div>

            <div className="form-pair">
              <label>
                Due date
                <input
                  type="date"
                  name="due_date"
                />
              </label>

              <label>
                Payment date
                <input
                  required
                  type="date"
                  name="paid_date"
                />
              </label>
            </div>

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
