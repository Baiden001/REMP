"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/icon";
import { money } from "@/lib/money";

function addMonths(start: string, months: number) {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function addDays(start: string, days: number) {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function pretty(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// Creates the next tenancy (or extra nights) for the same tenant, starting when this one ends.
export default function RenewRentalButton({
  rental,
  unitRate,
}: {
  rental: {
    id: string;
    client_id: string;
    unit_id: string;
    rental_type: "monthly" | "short_stay";
    end_date: string;
    rate: number;
    periods: number;
  };
  unitRate: number | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const monthly = rental.rental_type === "monthly";
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periods, setPeriods] = useState(String(monthly ? rental.periods : 1));
  const [rate, setRate] = useState(String(unitRate ?? rental.rate));

  const count = Math.max(Math.floor(Number(periods) || 0), 0);
  const newEnd = monthly ? addMonths(rental.end_date, count) : addDays(rental.end_date, count);
  const total = count * (Number(rate) || 0);

  async function renew() {
    setSaving(true);
    setError(null);
    if (count <= 0 || !(Number(rate) > 0)) {
      setError(`Enter the number of ${monthly ? "months" : "nights"} and the rate.`);
      setSaving(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error: insertError } = await supabase
      .from("rentals")
      .insert({
        client_id: rental.client_id,
        unit_id: rental.unit_id,
        agent_id: user?.id,
        rental_type: rental.rental_type,
        start_date: rental.end_date,
        end_date: newEnd,
        rate: Number(rate),
        periods: count,
        total_amount: total,
        notes: monthly ? "Renewal of previous tenancy" : "Extension of previous stay",
      })
      .select("id")
      .single();

    setSaving(false);
    if (insertError || !data) {
      setError(
        insertError?.code === "23P01"
          ? "The unit is already booked for part of that period. Shorten the renewal or check the unit's bookings."
          : insertError?.message ?? "Could not renew."
      );
      return;
    }
    setOpen(false);
    router.push(`/dashboard/rentals/${data.id}`);
  }

  return (
    <>
      <button
        type="button"
        className="button primary"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Icon name="refresh" size={15} /> {monthly ? "Renew tenancy" : "Extend stay"}
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
          <p className="eyebrow">RENTALS</p>
          <h2>{monthly ? "Renew tenancy" : "Extend stay"}</h2>
          <p>
            Starts {pretty(rental.end_date)}, when the current {monthly ? "tenancy" : "stay"} ends. Same tenant and unit.
          </p>

          <div className="modal-form">
            <div className="form-pair">
              <label>
                {monthly ? "Months" : "Extra nights"}
                <input type="number" min="1" step="1" value={periods} onChange={(event) => setPeriods(event.target.value)} />
              </label>
              <label>
                Rate per {monthly ? "month" : "night"} (GH₵)
                <input type="number" min="0.01" step="0.01" value={rate} onChange={(event) => setRate(event.target.value)} />
              </label>
            </div>
            <p className="field-hint" style={{ margin: 0 }}>
              {count > 0 ? `${pretty(rental.end_date)} → ${pretty(newEnd)} · ${money(total)}` : ""}
              {unitRate && unitRate !== rental.rate ? ` · current listed rate is ${money(unitRate)}` : ""}
            </p>

            {error && <p style={{ color: "#c0392b", fontSize: 12, margin: 0 }}>{error}</p>}

            <div className="modal-actions">
              <button type="button" className="button ghost" disabled={saving} onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" className="button primary" disabled={saving} onClick={renew}>
                {saving ? "Saving…" : monthly ? "Renew" : "Extend"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
