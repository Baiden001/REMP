"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { INVOICE_STATUS } from "@/lib/invoices";
import { RENT_PAYMENT_FOR } from "@/lib/listing";
import { money } from "@/lib/money";
import Icon from "@/components/icon";

type LinkedPayment = {
  id: string;
  amount: number;
  tax: number | null;
  paid_date: string | null;
  receipt_number: string | null;
  href: string | null;
};

type ParentOption = { kind: "sale" | "rental"; id: string; label: string; rentalType?: string };

const SALE_PAYMENT_FOR = ["Property purchase installment", "Deposit", "Final payment", "Other"];

function paymentForOptions(option: ParentOption | undefined) {
  if (!option) return [];
  if (option.kind === "sale") return SALE_PAYMENT_FOR;
  return [
    option.rentalType === "monthly" ? RENT_PAYMENT_FOR[0] : RENT_PAYMENT_FOR[1],
    "Security deposit",
    "Service charge",
    "Other",
  ];
}

export default function InvoiceStatusBar({
  invoiceId,
  status,
  total,
  amountPaid,
  payments,
  linked,
  parentOptions,
  purchase,
}: {
  invoiceId: string;
  status: string;
  total: number;
  amountPaid: number;
  payments: LinkedPayment[];
  linked: boolean;
  parentOptions: ParentOption[];
  purchase: { unitLabel: string; price: number; buyer: string } | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [parentKey, setParentKey] = useState("");
  const [paymentFor, setPaymentFor] = useState("");

  const recorded = payments.reduce((sum, p) => sum + Number(p.amount || 0) + Number(p.tax || 0), 0);
  const balance = Math.max(total - amountPaid, 0);
  const unrecorded = Math.max(total - recorded, 0);
  const info = INVOICE_STATUS[status] ?? { label: status, cls: "" };

  // An invoice marked paid before payments were tied to sales/rentals.
  const paidWithoutPayment = status === "paid" && unrecorded > 0 && (parentOptions.length > 0 || !!purchase);

  // A purchase invoice behaves like a sale that will be created on payment.
  const purchaseOption: ParentOption | undefined = purchase ? { kind: "sale", id: "", label: purchase.unitLabel } : undefined;
  const chosen =
    purchaseOption ?? (linked ? parentOptions[0] : parentOptions.find((o) => `${o.kind}:${o.id}` === parentKey));
  const forOptions = paymentForOptions(chosen);

  function openDialog() {
    setError(null);
    const first = purchaseOption ?? (linked ? parentOptions[0] : parentOptions.length === 1 ? parentOptions[0] : undefined);
    setParentKey(first ? `${first.kind}:${first.id}` : "");
    setPaymentFor(paymentForOptions(first)[0] ?? "");
    setOpen(true);
  }

  async function markPaid() {
    setSaving(true);
    setError(null);
    if (!paidDate) {
      setError("Enter the date the money was received.");
      setSaving(false);
      return;
    }
    if (!purchase && !linked && parentOptions.length > 0 && !chosen && parentKey !== "none") {
      setError("Choose the sale or rental this invoice is for.");
      setSaving(false);
      return;
    }

    const { data: paymentId, error: rpcError } = await supabase.rpc("mark_invoice_paid", {
      p_invoice: invoiceId,
      p_paid_date: paidDate,
      p_sale: !linked && !purchase && chosen?.kind === "sale" ? chosen.id : null,
      p_rental: !linked && !purchase && chosen?.kind === "rental" ? chosen.id : null,
      p_payment_for: chosen ? paymentFor : null,
    });

    setSaving(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setOpen(false);
    if (paymentId) {
      // Open the receipt (for a purchase, on the sale that was just created).
      const { data: payment } = await supabase.from("payments").select("sale_id, rental_id").eq("id", paymentId).single();
      if (payment?.sale_id || payment?.rental_id) {
        router.push(
          payment.sale_id
            ? `/dashboard/sales/${payment.sale_id}/receipt/${paymentId}`
            : `/dashboard/rentals/${payment.rental_id}/receipt/${paymentId}`
        );
        return;
      }
    }
    router.refresh();
  }

  async function markUnpaid() {
    const receipts = payments.map((p) => p.receipt_number ?? "receipt").join(", ");
    const message = payments.length
      ? `Mark as unpaid? This deletes the payment${payments.length === 1 ? "" : "s"} recorded against this invoice (${receipts}) from the sale/rental.`
      : "Mark this invoice as unpaid?";
    if (!window.confirm(message)) return;

    setSaving(true);
    setError(null);
    if (payments.length) {
      const { data, error: deleteError } = await supabase
        .from("payments")
        .delete()
        .eq("invoice_id", invoiceId)
        .eq("status", "paid")
        .select("id");
      if (deleteError || (data?.length ?? 0) < payments.length) {
        setSaving(false);
        setError(deleteError?.message ?? "You don't have permission to remove payments.");
        router.refresh();
        return;
      }
    }
    const { error: updateError } = await supabase.from("invoices").update({ status: "unpaid" }).eq("id", invoiceId);
    if (!updateError) await supabase.rpc("refresh_invoice_payment_status", { target: invoiceId });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  async function setCancelled(cancel: boolean) {
    if (cancel && payments.length) {
      setError("Payments are recorded against this invoice. Mark it as unpaid first.");
      return;
    }
    if (cancel && !window.confirm("Cancel this invoice? It will no longer count as owed.")) return;
    setSaving(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from("invoices")
      .update({ status: cancel ? "cancelled" : "unpaid" })
      .eq("id", invoiceId)
      .select("id");
    if (!cancel && !updateError) await supabase.rpc("refresh_invoice_payment_status", { target: invoiceId });
    setSaving(false);
    if (updateError || !data?.length) {
      setError(updateError?.message ?? "You don't have permission to change invoices.");
      return;
    }
    router.refresh();
  }

  const recordAmount = paidWithoutPayment ? unrecorded : balance;

  return (
    <section className="invoice-status-bar">
      <div className="invoice-status-main">
        <span className={`table-status ${info.cls}`}>{info.label}</span>
        <span>
          Paid <b>{money(amountPaid)}</b> of {money(total)}
          {status !== "cancelled" && balance > 0 ? (
            <>
              {" "}
              · Balance <b>{money(balance)}</b>
            </>
          ) : null}
        </span>
      </div>

      {payments.length > 0 && (
        <ul className="invoice-status-payments">
          {payments.map((p) => (
            <li key={p.id}>
              {p.paid_date ? new Date(p.paid_date).toLocaleDateString("en-GB") : "—"} ·{" "}
              {money(Number(p.amount || 0) + Number(p.tax || 0))}
              {p.href ? (
                <>
                  {" "}
                  ·{" "}
                  <Link href={p.href} className="text-button" style={{ padding: 0 }}>
                    {p.receipt_number ?? "Receipt"}
                  </Link>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {paidWithoutPayment && (
        <p className="invoice-status-warning">
          Marked paid, but {money(unrecorded)} isn&apos;t recorded as a payment on the sale or rental yet, so it
          doesn&apos;t show there.
        </p>
      )}

      <div className="invoice-status-actions">
        {error && <span className="save-error">{error}</span>}
        {(status === "unpaid" || status === "part_paid") && (
          <button type="button" className="button primary" disabled={saving} onClick={openDialog}>
            Mark as paid
          </button>
        )}
        {paidWithoutPayment && (
          <button type="button" className="button primary" disabled={saving} onClick={openDialog}>
            Record payment
          </button>
        )}
        {(status === "paid" || status === "part_paid") && (
          <button type="button" className="button ghost" disabled={saving} onClick={markUnpaid}>
            Mark as unpaid
          </button>
        )}
        {status === "cancelled" && (
          <button type="button" className="button ghost" disabled={saving} onClick={() => setCancelled(false)}>
            Restore invoice
          </button>
        )}
        {(status === "unpaid" || status === "part_paid") && (
          <button type="button" className="button ghost danger" disabled={saving} onClick={() => setCancelled(true)}>
            Cancel invoice
          </button>
        )}
      </div>

      <div className="modal-backdrop" hidden={!open} onClick={(e) => e.target === e.currentTarget && !saving && setOpen(false)}>
        <section className="modal" role="dialog" aria-modal="true">
          <button className="modal-close" aria-label="Close" onClick={() => !saving && setOpen(false)}>
            <Icon name="x" size={20} />
          </button>
          <p className="eyebrow">INVOICE PAYMENT</p>
          <h2>{paidWithoutPayment ? "Record the payment" : "Mark as paid"}</h2>
          <p>
            {purchase
              ? `Creates the sale of ${purchase.unitLabel} to ${purchase.buyer} at ${money(purchase.price)} (adding them as a client if needed), then records ${money(recordAmount)} with a receipt.`
              : chosen || linked
              ? `Records ${money(recordAmount)} as received on the ${chosen?.kind === "rental" ? "rental" : "sale"}, with a receipt. The sale/rental and payments update to match.`
              : parentOptions.length > 0
                ? `Choose what this invoice is for, so ${money(recordAmount)} is recorded there with a receipt.`
                : "This client has no sale or rental in REMP, so only the invoice will be marked paid."}
          </p>

          <div className="modal-form">
            {!purchase && !linked && parentOptions.length > 0 && (
              <label>
                Invoice is for
                <select
                  value={parentKey}
                  onChange={(e) => {
                    setParentKey(e.target.value);
                    const next = parentOptions.find((o) => `${o.kind}:${o.id}` === e.target.value);
                    setPaymentFor(paymentForOptions(next)[0] ?? "");
                  }}
                >
                  <option value="">Choose a sale or rental…</option>
                  {parentOptions.map((o) => (
                    <option key={`${o.kind}:${o.id}`} value={`${o.kind}:${o.id}`}>
                      {o.label}
                    </option>
                  ))}
                  <option value="none">Neither — only mark the invoice paid</option>
                </select>
              </label>
            )}

            {chosen && (
              <label>
                Payment for
                <select value={paymentFor} onChange={(e) => setPaymentFor(e.target.value)}>
                  {forOptions.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label>
              Date received
              <input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
            </label>

            {error && <p style={{ color: "#c0392b", fontSize: 12, margin: 0 }}>{error}</p>}

            <div className="modal-actions">
              <button type="button" className="button ghost" disabled={saving} onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" className="button primary" disabled={saving} onClick={markPaid}>
                {saving ? "Saving…" : chosen ? `Record ${money(recordAmount)}` : "Mark as paid"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
