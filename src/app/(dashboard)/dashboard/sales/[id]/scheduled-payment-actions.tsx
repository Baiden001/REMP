"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/icon";
import { nextReceiptNumber } from "@/lib/receipts";

// "Record" turns a scheduled (pending) installment into a paid payment with a receipt.
export default function ScheduledPaymentActions({
  paymentId,
  saleId,
  salePrice,
  amount,
  label,
}: {
  paymentId: string;
  saleId: string;
  salePrice: number;
  amount: number;
  label: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function record(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    const paidDate = data.get("paid_date") as string;
    const paidAmount = Number(data.get("amount"));
    const tax = Number(data.get("tax")) || 0;

    if (!paidDate || !(paidAmount > 0)) {
      setError("Enter the payment date and amount.");
      setSaving(false);
      return;
    }

    const numbered = await nextReceiptNumber(supabase, paidDate);
    if ("error" in numbered) {
      setError(numbered.error ?? "Could not create a receipt number.");
      setSaving(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: updated, error: updateError } = await supabase
      .from("payments")
      .update({
        status: "paid",
        paid_date: paidDate,
        amount: paidAmount,
        tax,
        receipt_number: numbered.receiptNumber,
        recorded_by: user?.id,
      })
      .eq("id", paymentId)
      .select("id");

    if (updateError || !updated?.length) {
      setError(updateError?.message ?? "You don't have permission to record payments.");
      setSaving(false);
      return;
    }

    const { data: paid } = await supabase.from("payments").select("amount").eq("sale_id", saleId).eq("status", "paid");
    const collected = (paid ?? []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
    await supabase
      .from("sales")
      .update({ payment_status: collected >= salePrice ? "paid" : collected > 0 ? "partial" : "pending" })
      .eq("id", saleId);

    setSaving(false);
    setOpen(false);
    router.push(`/dashboard/sales/${saleId}/receipt/${paymentId}`);
  }

  async function remove() {
    if (!window.confirm(`Remove "${label}" from the payment plan?`)) return;
    const { data, error: deleteError } = await supabase.from("payments").delete().eq("id", paymentId).select("id");
    if (deleteError || !data?.length) {
      window.alert(deleteError?.message ?? "You don't have permission to change payment plans.");
      return;
    }
    router.refresh();
  }

  return (
    <span className="row-actions">
      <button type="button" className="text-button" onClick={() => setOpen(true)}>
        Record
      </button>
      <button type="button" className="text-button muted" onClick={remove} aria-label={`Remove ${label}`}>
        Remove
      </button>

      <div
        className="modal-backdrop"
        hidden={!open}
        onClick={(event) => event.target === event.currentTarget && !saving && setOpen(false)}
      >
        <section className="modal" role="dialog" aria-modal="true">
          <button className="modal-close" aria-label="Close" onClick={() => !saving && setOpen(false)}>
            <Icon name="x" size={20} />
          </button>
          <p className="eyebrow">PAYMENTS</p>
          <h2>Record {label.toLowerCase()}</h2>
          <p>Marks this scheduled payment as received and creates its receipt.</p>
          <form onSubmit={record} key={open ? "open" : "closed"}>
            <div className="form-pair">
              <label>
                Amount received (GH₵)
                <input required type="number" name="amount" min="0.01" step="0.01" defaultValue={amount} />
              </label>
              <label>
                Tax (GH₵)
                <input type="number" name="tax" min="0" step="0.01" defaultValue={0} />
              </label>
            </div>
            <label>
              Payment date
              <input required type="date" name="paid_date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </label>
            {error && <p style={{ color: "#c0392b", fontSize: 12 }}>{error}</p>}
            <div className="modal-actions">
              <button type="button" className="button ghost" disabled={saving} onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="button primary" disabled={saving}>
                {saving ? "Saving…" : "Record payment"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </span>
  );
}
