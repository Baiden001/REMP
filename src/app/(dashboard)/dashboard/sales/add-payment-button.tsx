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

    const data = new FormData(event.currentTarget);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("payments").insert({
      sale_id: saleId,
      amount: Number(data.get("amount")),
      due_date: data.get("due_date") || null,
      paid_date: data.get("paid_date") || null,
      status: data.get("paid_date") ? "paid" : "pending",
      recorded_by: user?.id,
    });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setOpen(false);
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <>
      <button className="button ghost" style={{ fontSize: 11 }} onClick={() => setOpen(true)}>
        ＋ Add payment
      </button>

      <div
        className="modal-backdrop"
        hidden={!open}
        onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      >
        <section className="modal" role="dialog" aria-modal="true">
          <button className="modal-close" aria-label="Close" onClick={() => setOpen(false)}>×</button>
          <p className="eyebrow">PAYMENTS</p>
          <h2>Log a payment</h2>
          <p>Record a payment instalment for this sale.</p>

          <form onSubmit={handleSubmit}>
            <label>
              Amount (GH₵)
              <input required type="number" name="amount" min={1} placeholder="e.g. 100000" />
            </label>
            <div className="form-pair">
              <label>
                Due date
                <input type="date" name="due_date" />
              </label>
              <label>
                Paid date (leave blank if unpaid)
                <input type="date" name="paid_date" />
              </label>
            </div>

            {error && <p style={{ color: "#c0392b", fontSize: 12 }}>{error}</p>}

            <div className="modal-actions">
              <button type="button" className="button ghost" onClick={() => setOpen(false)}>
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
