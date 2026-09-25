import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { isRentPayment, RENTAL_TYPE_LABEL } from "@/lib/listing";
import { money } from "@/lib/money";
import RecordRentalButton from "./record-rental-button";
import { occupancyFor, shortDate, todayISO, type Booking } from "@/lib/occupancy";
import { unitPriceLabel } from "@/lib/listing";
import Icon from "@/components/icon";

const STATUS_CLASS: Record<string, string> = {
  pending: "reserved",
  partial: "offplan",
  paid: "complete",
  overdue: "sold",
};


export default async function RentalsPage() {
  const supabase = createClient();

  const [{ data: rentals }, { data: clients }, { data: units }, { data: rentPayments }] = await Promise.all([
    supabase
      .from("rentals")
      .select(
        "id, unit_id, rental_type, start_date, end_date, rate, periods, total_amount, payment_status, clients(full_name), units(unit_code, projects(name))"
      )
      .order("start_date", { ascending: false }),
    supabase.from("clients").select("id, full_name").order("full_name"),
    supabase
      .from("units")
      .select("id, unit_code, unit_type, availability, listing_type, price, nightly_rate, monthly_rate, projects(name)")
      .eq("listing_type", "rent")
      .order("unit_code"),
    supabase.from("payments").select("amount, payment_for").not("rental_id", "is", null).eq("status", "paid"),
  ]);

  const all = rentals ?? [];
  const today = todayISO();
  const upcoming = all.filter((r) => r.start_date > today).length;

  const bookings: Booking[] = all.map((r) => ({
    id: r.id,
    unit_id: r.unit_id,
    start_date: r.start_date,
    end_date: r.end_date,
    client_name: (r.clients as unknown as { full_name: string } | null)?.full_name ?? null,
  }));

  const board = (units ?? []).map((u) => ({
    ...u,
    project_name: (u.projects as unknown as { name: string } | null)?.name ?? "—",
    occupancy: occupancyFor(u.id, bookings, today),
  }));
  const bookable = board.filter((u) => u.availability !== "unavailable");
  const occupiedNow = bookable.filter((u) => u.occupancy.status === "occupied").length;
  const freeNow = bookable.length - occupiedNow;
  const collected = (rentPayments ?? []).filter(isRentPayment).reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const rentUnits = bookable.map((u) => ({
    id: u.id,
    unit_code: u.unit_code,
    nightly_rate: u.nightly_rate === null ? null : Number(u.nightly_rate),
    monthly_rate: u.monthly_rate === null ? null : Number(u.monthly_rate),
    project_name: u.project_name,
  }));

  return (
    <div>
      <div className="view-heading">
        <div>
          <p className="eyebrow">RENTALS</p>
          <h1>Rentals</h1>
          <p className="subtitle">Short stays and monthly tenancies, with rent collected against each.</p>
        </div>
        <RecordRentalButton clients={clients ?? []} units={rentUnits} bookings={bookings} />
      </div>

      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <article className="kpi-card">
          <div className="kpi-icon navy"><Icon name="key" /></div>
          <div>
            <p>Occupied now</p>
            <h2>
              {occupiedNow} <small className="kpi-of">of {bookable.length}</small>
            </h2>
          </div>
        </article>
        <article className="kpi-card">
          <div className="kpi-icon green"><Icon name="doorOpen" /></div>
          <div>
            <p>Available now</p>
            <h2>
              {freeNow} <small className="kpi-of">of {bookable.length}</small>
            </h2>
          </div>
        </article>
        <article className="kpi-card">
          <div className="kpi-icon warm"><Icon name="calendar" /></div>
          <div>
            <p>Upcoming bookings</p>
            <h2>{upcoming}</h2>
          </div>
        </article>
        <article className="kpi-card">
          <div className="kpi-icon blue"><Icon name="wallet" /></div>
          <div>
            <p>Rent collected</p>
            <h2>{money(collected)}</h2>
          </div>
        </article>
      </div>

      <section className="panel table-panel" style={{ marginBottom: 18 }}>
        <div className="table-toolbar">
          <div>
            <h3>Rental units</h3>
            <p className="table-toolbar-sub">Which units are free, occupied or booked.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>UNIT</th>
                <th>RATES</th>
                <th>STATUS</th>
                <th>CURRENT TENANT</th>
                <th>NEXT BOOKING</th>
              </tr>
            </thead>
            <tbody>
              {board.map((u) => {
                const occ = u.occupancy;
                const status =
                  u.availability === "unavailable"
                    ? { cls: "reserved", text: "Unavailable" }
                    : occ.status === "occupied"
                      ? { cls: "sold", text: `Occupied until ${shortDate(occ.current!.end_date)}` }
                      : { cls: "available", text: "Available" };
                return (
                  <tr key={u.id}>
                    <td>
                      <Link href={`/dashboard/units/${u.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                        <b>{u.unit_code}</b>
                      </Link>
                      <small className="cell-sub">{u.project_name}</small>
                    </td>
                    <td>{unitPriceLabel(u)}</td>
                    <td>
                      <span className={`table-status ${status.cls}`}>{status.text}</span>
                    </td>
                    <td>
                      {occ.current ? (
                        <Link href={`/dashboard/rentals/${occ.current.id}`} className="text-button">
                          {occ.current.client_name ?? "View rental"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {occ.next ? (
                        <Link href={`/dashboard/rentals/${occ.next.id}`} className="text-button">
                          {shortDate(occ.next.start_date)}
                          {occ.next.client_name ? ` · ${occ.next.client_name}` : ""}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
              {board.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: "#8e9e98" }}>
                    No units are listed for rent. Edit a unit under Properties &amp; units and choose “For rent”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>CLIENT</th>
                <th>UNIT</th>
                <th>TYPE</th>
                <th>PERIOD</th>
                <th>RATE</th>
                <th>TOTAL</th>
                <th>PAYMENT</th>
              </tr>
            </thead>
            <tbody>
              {all.map((r) => {
                const client = r.clients as unknown as { full_name: string } | null;
                const unit = r.units as unknown as { unit_code: string; projects: { name: string } | null } | null;
                return (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/dashboard/rentals/${r.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                        <b>{client?.full_name ?? "—"}</b>
                      </Link>
                    </td>
                    <td>
                      {unit?.projects?.name ?? "—"} · {unit?.unit_code ?? "—"}
                    </td>
                    <td>
                      <span className="listing-chip rent">{RENTAL_TYPE_LABEL[r.rental_type] ?? r.rental_type}</span>
                    </td>
                    <td>
                      {shortDate(r.start_date)} → {shortDate(r.end_date)}
                      {(() => {
                        const days = Math.round(
                          (new Date(`${r.end_date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000
                        );
                        return r.start_date <= today && days >= 0 && days <= 30 ? (
                          <small className="cell-sub text-danger">Ends in {days} day{days === 1 ? "" : "s"}</small>
                        ) : null;
                      })()}
                    </td>
                    <td>
                      {money(Number(r.rate))} / {r.rental_type === "monthly" ? "month" : "night"}
                    </td>
                    <td>
                      <b>{money(Number(r.total_amount))}</b>
                    </td>
                    <td>
                      <span className={`table-status ${STATUS_CLASS[r.payment_status] ?? ""}`}>{r.payment_status}</span>
                    </td>
                  </tr>
                );
              })}
              {all.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ color: "#8e9e98" }}>
                    No rentals yet. Mark a unit “For rent” under Properties &amp; units, then record the first booking here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
