"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/icon";

export default function RecordSaleButton({
  clients,
  units,
}: {
  clients: { id: string; full_name: string }[];
  units: { id: string; unit_code: string; project_name: string; price: number }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState("");

  function handleUnitChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const unit = units.find((u) => u.id === e.target.value);
    setPrice(unit ? String(unit.price) : "");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const data = new FormData(event.currentTarget);
    const unitId = data.get("unit_id") as string;
    const salePrice = Number(data.get("sale_price"));

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: saleError } = await supabase.from("sales").insert({
      client_id: data.get("client_id"),
      unit_id: unitId,
      agent_id: user?.id,
      sale_price: salePrice,
      sale_date: data.get("sale_date"),
      payment_status: "pending",
    });

    if (saleError) {
      setSaving(false);
      setError(saleError.message);
      return;
    }

    // Mark the unit as sold
    await supabase.from("units").update({ availability: "sold" }).eq("id", unitId);

    setSaving(false);
    setOpen(false);
    setPrice("");
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <>
      <button className="button primary" onClick={() => setOpen(true)}>
        <Icon name="plus" size={15} /> Record sale
      </button>

      <div
        className="modal-backdrop"
        hidden={!open}
        onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      >
        <section className="modal" role="dialog" aria-modal="true">
          <button className="modal-close" aria-label="Close" onClick={() => setOpen(false)}>
            <Icon name="x" size={20} />
          </button>
          <p className="eyebrow">SALES</p>
          <h2>Record a sale</h2>
          <p>Log a completed property transaction.</p>

          <form onSubmit={handleSubmit}>
            <label>
              Client
              <select required name="client_id" defaultValue="">
                <option value="" disabled>Select a client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            </label>
            <label>
              Unit
              <select required name="unit_id" defaultValue="" onChange={handleUnitChange}>
                <option value="" disabled>Select a unit</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.project_name} · {u.unit_code}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-pair">
              <label>
                Sale price (GH₵)
                <input
                  required
                  type="number"
                  name="sale_price"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 850000"
                />
              </label>
              <label>
                Sale date
                <input
                  required
                  type="date"
                  name="sale_date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </label>
            </div>

            {error && <p style={{ color: "#c0392b", fontSize: 12 }}>{error}</p>}

            <div className="modal-actions">
              <button type="button" className="button ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="button primary" type="submit" disabled={saving}>
                {saving ? "Recording…" : "Record sale"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
