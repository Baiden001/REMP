"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { INVOICE_STATUS } from "@/lib/invoices";
import { money } from "@/lib/money";

type LinkedPayment = {
  id: string;
  amount: number;
  tax: number | null;
  paid_date: string | null;
  receipt_number: string | null;
  href: string | null;
};

export default function InvoiceStatusBar({
  invoiceId,
  status,
  total,
  amountPaid,
  payments,
}: {
  invoiceId: string;
  status: string;
  total: number;
  amountPaid: number;
  payments: LinkedPayment[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const balance = Math.max(total - amountPaid, 0);
  const info = INVOICE_STATUS[status] ?? { label: status, cls: "" };

  async function setStatus(next: string) {
    if (next === "cancelled" && !window.confirm("Cancel this invoice? It will no longer count as owed.")) return;
    setSaving(true);
    setError(null);

    const paidFromPayments = payments.reduce((sum, p) => sum + Number(p.amount || 0) + Number(p.tax || 0), 0);
    const update =
      next === "paid"
        ? { status: "paid", amount_paid: Math.max(total, paidFromPayments), paid_at: new Date().toISOString().slice(0, 10) }
        : next === "cancelled"
          ? { status: "cancelled" }
          : {
              // Back to what the recorded payments say.
              status: paidFromPayments >= total && total > 0 ? "paid" : paidFromPayments > 0 ? "part_paid" : "unpaid",
              amount_paid: paidFromPayments,
              paid_at: null,
            };

    const { data, error: updateError } = await supabase.from("invoices").update(update).eq("id", invoiceId).select("id");
    setSaving(false);
    if (updateError || !data?.length) {
      setError(updateError?.message ?? "You don't have permission to change invoices.");
      return;
    }
    router.refresh();
  }

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

      <div className="invoice-status-actions">
        {error && <span className="save-error">{error}</span>}
        {status !== "paid" && status !== "cancelled" && (
          <button type="button" className="button primary" disabled={saving} onClick={() => setStatus("paid")}>
            Mark as paid
          </button>
        )}
        {(status === "paid" || status === "cancelled") && (
          <button type="button" className="button ghost" disabled={saving} onClick={() => setStatus("unpaid")}>
            {status === "cancelled" ? "Restore invoice" : "Mark as unpaid"}
          </button>
        )}
        {status !== "cancelled" && status !== "paid" && (
          <button type="button" className="button ghost danger" disabled={saving} onClick={() => setStatus("cancelled")}>
            Cancel invoice
          </button>
        )}
      </div>
    </section>
  );
}
