"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function GenerateReceiptButton({
  paymentId,
}: {
  paymentId: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setCreating(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Your session has expired. Please log in again.");
      setCreating(false);
      return;
    }

    const { data: existingReceipt } = await supabase
      .from("receipts")
      .select("id")
      .eq("payment_id", paymentId)
      .maybeSingle();

    if (existingReceipt) {
      router.push(`/dashboard/receipts/${existingReceipt.id}`);
      return;
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select(`
        id,
        amount,
        paid_date,
        status,
        sales(
          sale_price,
          clients(full_name, phone, email),
          units(
            unit_code,
            projects(name)
          )
        )
      `)
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      setError(paymentError?.message ?? "Could not find payment.");
      setCreating(false);
      return;
    }

    if (payment.status !== "paid") {
      setError("A receipt can only be generated for a paid payment.");
      setCreating(false);
      return;
    }

    const sale = payment.sales as unknown as {
      sale_price: number;
      clients: {
        full_name: string;
        phone: string | null;
        email: string | null;
      } | null;
      units: {
        unit_code: string;
        projects: {
          name: string;
        } | null;
      } | null;
    } | null;

    const client = sale?.clients;
    const unit = sale?.units;

    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .insert({
        payment_id: payment.id,
        received_from: client?.full_name ?? "Client",
        project_name: unit?.projects?.name ?? null,
        unit_code: unit?.unit_code ?? null,
        amount: Number(payment.amount),
        payment_for: "Installment",
        receipt_date: payment.paid_date ?? new Date().toISOString().slice(0, 10),
        issued_by: user.id,
      })
      .select("id")
      .single();

    if (receiptError || !receipt) {
      setError(receiptError?.message ?? "Could not create receipt.");
      setCreating(false);
      return;
    }

    router.push(`/dashboard/receipts/${receipt.id}`);
  }

  return (
    <div>
      <button
        type="button"
        className="button ghost"
        onClick={handleGenerate}
        disabled={creating}
      >
        {creating ? "Generating..." : "Generate Receipt"}
      </button>

      {error && (
        <p
          style={{
            color: "#c0392b",
            fontSize: 11,
            marginTop: 6,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}