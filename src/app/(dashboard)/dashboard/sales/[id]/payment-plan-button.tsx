"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/icon";
import { money } from "@/lib/money";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addMonths(start: string, months: number) {
  const date = new Date(`${start}T00:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  // Keep the same day of month where possible (31 Jan + 1 month → 28/29 Feb).
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return isoDate(date);
}

type Row = { label: string; due: string; amount: number };

export default function PaymentPlanButton({
  saleId,
  salePrice,
  alreadyPaid,
  pendingCount,
}: {
  saleId: string;
  salePrice: number;
  alreadyPaid: number;
  pendingCount: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const today = isoDate(new Date());
  const remaining = Math.max(salePrice - alreadyPaid, 0);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [depositMode, setDepositMode] = useState<"percent" | "amount">("percent");
  const [depositValue, setDepositValue] = useState(alreadyPaid > 0 ? "0" : "30");
  const [depositDue, setDepositDue] = useState(today);
  const [count, setCount] = useState("12");
  const [frequency, setFrequency] = useState<"1" | "3">("1");
  const [firstDue, setFirstDue] = useState(addMonths(today, 1));
  const [replace, setReplace] = useState(true);

  const schedule = useMemo<Row[]>(() => {
    const deposit =
      depositMode === "percent"
        ? Math.round(salePrice * (Number(depositValue) || 0)) / 100
        : Number(depositValue) || 0;
    const depositAmount = Math.min(Math.max(deposit, 0), remaining);
    const n = Math.max(Math.floor(Number(count) || 0), 0);
    const rest = Math.max(remaining - depositAmount, 0);
    const rows: Row[] = [];
    if (depositAmount > 0) rows.push({ label: "Deposit", due: depositDue, amount: depositAmount });
    if (n > 0 && rest > 0) {
      const each = Math.floor((rest / n) * 100) / 100;
      for (let i = 0; i < n; i++) {
        const amount = i === n - 1 ? Math.round((rest - each * (n - 1)) * 100) / 100 : each;
        rows.push({
          label: `Installment ${i + 1} of ${n}`,
          due: addMonths(firstDue, i * Number(frequency)),
          amount,
        });
      }
    }
    return rows;
  }, [depositMode, depositValue, depositDue, count, frequency, firstDue, salePrice, remaining]);

  const scheduledTotal = schedule.reduce((sum, r) => sum + r.amount, 0);

  async function save() {
    setSaving(true);
    setError(null);

    if (schedule.length === 0) {
      setError("Nothing to schedule — the balance is already covered.");
      setSaving(false);
      return;
    }

    if (replace && pendingCount > 0) {
      const { error: deleteError } = await supabase
        .from("payments")
        .delete()
        .eq("sale_id", saleId)
        .eq("status", "pending");
      if (deleteError) {
        setError(deleteError.message);
        setSaving(false);
        return;
      }
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error: insertError } = await supabase
      .from("payments")
      .insert(
        schedule.map((row) => ({
          sale_id: saleId,
          amount: row.amount,
          tax: 0,
          due_date: row.due,
          status: "pending",
          payment_for: row.label,
          recorded_by: user?.id,
        }))
      )
      .select("id");

    setSaving(false);
    if (insertError || !data?.length) {
      setError(insertError?.message ?? "You don't have permission to set up payment plans.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        className="button ghost"
        style={{ fontSize: 11 }}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Icon name="calendar" size={14} /> {pendingCount > 0 ? "Change payment plan" : "Set up payment plan"}
      </button>

      <div
        className="modal-backdrop"
        hidden={!open}
        onClick={(event) => event.target === event.currentTarget && !saving && setOpen(false)}
      >
        <section className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 620, maxHeight: "92vh", overflowY: "auto" }}>
          <button className="modal-close" aria-label="Close" onClick={() => !saving && setOpen(false)}>
            <Icon name="x" size={20} />
          </button>
          <p className="eyebrow">PAYMENT PLAN</p>
          <h2>{pendingCount > 0 ? "Change payment plan" : "Set up payment plan"}</h2>
          <p>
            Balance to schedule: <b>{money(remaining)}</b>
            {alreadyPaid > 0 ? ` (sale price ${money(salePrice)}, already paid ${money(alreadyPaid)})` : ""}. Finance gets
            reminders before each due date and when one is missed.
          </p>

          <div className="modal-form">
            <div className="form-pair">
              <label>
                Deposit
                <div className="input-with-toggle">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={depositValue}
                    onChange={(event) => setDepositValue(event.target.value)}
                  />
                  <select value={depositMode} onChange={(event) => setDepositMode(event.target.value as "percent" | "amount")}>
                    <option value="percent">% of price</option>
                    <option value="amount">GH₵</option>
                  </select>
                </div>
              </label>
              <label>
                Deposit due
                <input type="date" value={depositDue} onChange={(event) => setDepositDue(event.target.value)} />
              </label>
            </div>

            <div className="form-pair">
              <label>
                Number of installments
                <input type="number" min="0" max="120" step="1" value={count} onChange={(event) => setCount(event.target.value)} />
              </label>
              <label>
                Every
                <select value={frequency} onChange={(event) => setFrequency(event.target.value as "1" | "3")}>
                  <option value="1">Month</option>
                  <option value="3">3 months (quarterly)</option>
                </select>
              </label>
            </div>

            <label>
              First installment due
              <input type="date" value={firstDue} onChange={(event) => setFirstDue(event.target.value)} />
            </label>

            {pendingCount > 0 && (
              <label className="checkbox-row">
                <input type="checkbox" checked={replace} onChange={(event) => setReplace(event.target.checked)} />
                Replace the {pendingCount} payment{pendingCount === 1 ? "" : "s"} already scheduled
              </label>
            )}

            <div className="plan-preview">
              <div className="plan-preview-head">
                <b>Schedule</b>
                <span>
                  {schedule.length} payment{schedule.length === 1 ? "" : "s"} · {money(scheduledTotal)}
                </span>
              </div>
              <ol>
                {schedule.slice(0, 60).map((row) => (
                  <li key={row.label + row.due}>
                    <span>{row.label}</span>
                    <span>{new Date(`${row.due}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                    <b>{money(row.amount)}</b>
                  </li>
                ))}
              </ol>
            </div>

            {error && <p style={{ color: "#c0392b", fontSize: 12, margin: 0 }}>{error}</p>}

            <div className="modal-actions">
              <button type="button" className="button ghost" disabled={saving} onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" className="button primary" disabled={saving || schedule.length === 0} onClick={save}>
                {saving ? "Saving…" : "Save payment plan"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
