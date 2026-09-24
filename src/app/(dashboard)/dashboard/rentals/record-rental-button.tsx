"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/money";
import Icon from "@/components/icon";
import { clashFor, occupancyFor, shortDate, type Booking } from "@/lib/occupancy";

export type RentUnit = {
  id: string;
  unit_code: string;
  project_name: string;
  nightly_rate: number | null;
  monthly_rate: number | null;
};

type RentalType = "short_stay" | "monthly";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addMonths(start: string, months: number) {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return isoDate(date);
}

function nightsBetween(from: string, to: string) {
  const ms = new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

function unitStatusLabel(unitId: string, bookings: Booking[]) {
  const occ = occupancyFor(unitId, bookings);
  if (occ.current) return `occupied until ${shortDate(occ.current.end_date)}`;
  if (occ.next) return `free · next booking ${shortDate(occ.next.start_date)}`;
  return "available";
}

export default function RecordRentalButton({
  clients,
  units,
  bookings,
}: {
  clients: { id: string; full_name: string }[];
  units: RentUnit[];
  bookings: Booking[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [unitId, setUnitId] = useState("");
  const [rentalType, setRentalType] = useState<RentalType>("monthly");
  const [rate, setRate] = useState("");
  const [startDate, setStartDate] = useState(isoDate(new Date()));
  const [endDate, setEndDate] = useState("");
  const [months, setMonths] = useState("12");

  const unit = units.find((u) => u.id === unitId);

  const periods =
    rentalType === "monthly"
      ? Number(months) || 0
      : startDate && endDate
        ? Math.max(nightsBetween(startDate, endDate), 0)
        : 0;
  const total = periods * (Number(rate) || 0);
  const computedEnd = rentalType === "monthly" && startDate && periods > 0 ? addMonths(startDate, periods) : endDate;

  function applyRate(nextUnit: RentUnit | undefined, type: RentalType) {
    const value = type === "monthly" ? nextUnit?.monthly_rate : nextUnit?.nightly_rate;
    setRate(value ? String(value) : "");
  }

  function chooseUnit(id: string) {
    setUnitId(id);
    const next = units.find((u) => u.id === id);
    // Default to whichever way this unit is let.
    const type: RentalType = next && !next.monthly_rate && next.nightly_rate ? "short_stay" : rentalType;
    setRentalType(type);
    applyRate(next, type);
  }

  function chooseType(type: RentalType) {
    setRentalType(type);
    applyRate(unit, type);
  }

  function reset() {
    setError(null);
    setUnitId("");
    setRentalType("monthly");
    setRate("");
    setStartDate(isoDate(new Date()));
    setEndDate("");
    setMonths("12");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const data = new FormData(event.currentTarget);

    if (!unitId) {
      setError("Please choose a unit.");
      setSaving(false);
      return;
    }

    if (!(Number(rate) > 0)) {
      setError("Please enter the rate.");
      setSaving(false);
      return;
    }

    if (periods <= 0) {
      setError(rentalType === "monthly" ? "Enter how many months the tenancy runs." : "Check-out must be after check-in.");
      setSaving(false);
      return;
    }

    const clash = clashFor(unitId, bookings, startDate, computedEnd);
    if (clash) {
      setError(
        `This unit is already booked from ${shortDate(clash.start_date)} to ${shortDate(clash.end_date)}` +
          (clash.client_name ? ` (${clash.client_name})` : "") +
          ". Choose different dates or another unit."
      );
      setSaving(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: rental, error: rentalError } = await supabase
      .from("rentals")
      .insert({
        client_id: data.get("client_id"),
        unit_id: unitId,
        agent_id: user?.id,
        rental_type: rentalType,
        start_date: startDate,
        end_date: computedEnd,
        rate: Number(rate),
        periods,
        total_amount: total,
        notes: ((data.get("notes") as string) ?? "").trim() || null,
      })
      .select("id")
      .single();

    if (rentalError || !rental) {
      setSaving(false);
      setError(
        rentalError?.code === "23P01"
          ? "This unit is already booked for some of those dates. Choose different dates or another unit."
          : rentalError?.message ?? "Could not record the rental."
      );
      return;
    }

    setSaving(false);
    setOpen(false);
    router.push(`/dashboard/rentals/${rental.id}`);
  }

  const canShortStay = !unit || Boolean(unit.nightly_rate);
  const canMonthly = !unit || Boolean(unit.monthly_rate);

  return (
    <>
      <button
        className="button primary"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <Icon name="plus" size={15} /> Record rental
      </button>

      <div
        className="modal-backdrop"
        hidden={!open}
        onClick={(event) => event.target === event.currentTarget && !saving && setOpen(false)}
      >
        <section className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 560 }}>
          <button className="modal-close" aria-label="Close" onClick={() => !saving && setOpen(false)}>
            <Icon name="x" size={20} />
          </button>
          <p className="eyebrow">RENTALS</p>
          <h2>Record a rental</h2>
          <p>Book a short stay or start a monthly tenancy on a rental unit.</p>

          <form onSubmit={handleSubmit}>
            <div className="form-pair">
              <label>
                Client
                <select required name="client_id" defaultValue="">
                  <option value="">Select client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Unit
                <select required value={unitId} onChange={(event) => chooseUnit(event.target.value)}>
                  <option value="">{units.length ? "Select rental unit" : "No units are listed for rent yet"}</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.project_name} · {u.unit_code} — {unitStatusLabel(u.id, bookings)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {unit && (() => {
              const upcoming = bookings
                .filter((b) => b.unit_id === unit.id && b.end_date > new Date().toISOString().slice(0, 10))
                .sort((a, b) => a.start_date.localeCompare(b.start_date));
              return (
                <p className="field-hint">
                  {upcoming.length === 0
                    ? "No bookings on this unit — any dates are free."
                    : "Already booked: " +
                      upcoming
                        .map((b) => `${shortDate(b.start_date)} – ${shortDate(b.end_date)}${b.client_name ? ` (${b.client_name})` : ""}`)
                        .join("; ")}
                </p>
              );
            })()}

            <div className="listing-toggle" role="radiogroup" aria-label="Rental type">
              <span>Rental type</span>
              <div>
                <button
                  type="button"
                  role="radio"
                  aria-checked={rentalType === "short_stay"}
                  className={rentalType === "short_stay" ? "selected" : ""}
                  disabled={!canShortStay}
                  onClick={() => chooseType("short_stay")}
                >
                  Short stay
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={rentalType === "monthly"}
                  className={rentalType === "monthly" ? "selected" : ""}
                  disabled={!canMonthly}
                  onClick={() => chooseType("monthly")}
                >
                  Monthly
                </button>
              </div>
            </div>

            <div className="form-pair">
              <label>
                {rentalType === "monthly" ? "Start date" : "Check-in"}
                <input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </label>
              {rentalType === "monthly" ? (
                <label>
                  Number of months
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={months}
                    onChange={(event) => setMonths(event.target.value)}
                  />
                </label>
              ) : (
                <label>
                  Check-out
                  <input required type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                </label>
              )}
            </div>

            <div className="form-pair">
              <label>
                Rate per {rentalType === "monthly" ? "month" : "night"} (GH₵)
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={rate}
                  onChange={(event) => setRate(event.target.value)}
                />
              </label>
              <div className="invoice-total-preview">
                <span>
                  {periods > 0 ? `${periods} ${rentalType === "monthly" ? "month" : "night"}${periods === 1 ? "" : "s"}` : "Total"}
                </span>
                <b>{money(total)}</b>
              </div>
            </div>

            <label>
              Notes (optional)
              <textarea name="notes" rows={2} placeholder="e.g. Includes cleaning twice a week" />
            </label>

            {error && <p style={{ color: "#c0392b", fontSize: 12 }}>{error}</p>}

            <div className="modal-actions">
              <button type="button" className="button ghost" disabled={saving} onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="button primary" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Record rental"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
