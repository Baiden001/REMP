// Works out whether a rent unit is free, occupied or booked, from its rentals.
export type Booking = {
  id: string;
  unit_id: string;
  start_date: string;
  end_date: string; // exclusive: the check-out / move-out date
  client_name?: string | null;
};

export type Occupancy = {
  status: "available" | "occupied" | "booked";
  current: Booking | null;
  next: Booking | null;
};

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function occupancyFor(unitId: string, bookings: Booking[], today = todayISO()): Occupancy {
  const mine = bookings.filter((b) => b.unit_id === unitId).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const current = mine.find((b) => b.start_date <= today && b.end_date > today) ?? null;
  const next = mine.find((b) => b.start_date > today) ?? null;
  return { status: current ? "occupied" : next ? "booked" : "available", current, next };
}

// First booking on this unit that overlaps the given dates, if any.
export function clashFor(unitId: string, bookings: Booking[], start: string, end: string) {
  return bookings.find((b) => b.unit_id === unitId && b.start_date < end && b.end_date > start) ?? null;
}

export function shortDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
