export type ListingType = "sale" | "rent";

export const AVAILABILITY_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "sold", label: "Sold" },
  { value: "rented", label: "Rented / occupied" },
  { value: "unavailable", label: "Unavailable" },
];

export const RENTAL_TYPE_LABEL: Record<string, string> = {
  short_stay: "Short stay",
  monthly: "Monthly",
};

// Payments that count towards the rent owed; deposits and service charges are extra.
export const RENT_PAYMENT_FOR = ["Monthly rent", "Short-stay booking"];

export function isRentPayment(payment: { payment_for: string | null }) {
  return !payment.payment_for || RENT_PAYMENT_FOR.includes(payment.payment_for);
}

export type ListingPricing = {
  listingType: ListingType;
  price: string;
  nightlyRate: string;
  monthlyRate: string;
};

export function pricingFromUnit(unit: {
  listing_type?: string | null;
  price: number | null;
  nightly_rate?: number | null;
  monthly_rate?: number | null;
}): ListingPricing {
  return {
    listingType: unit.listing_type === "rent" ? "rent" : "sale",
    price: unit.price?.toString() ?? "",
    nightlyRate: unit.nightly_rate?.toString() ?? "",
    monthlyRate: unit.monthly_rate?.toString() ?? "",
  };
}

// Validates the pricing fields and returns the columns to write to `units`.
export function pricingColumns(
  pricing: ListingPricing
):
  | { error: string }
  | {
      columns: {
        listing_type: ListingType;
        price: number | null;
        nightly_rate: number | null;
        monthly_rate: number | null;
      };
    } {
  if (pricing.listingType === "sale") {
    const price = Number(pricing.price);
    if (!price || price <= 0) return { error: "Please enter a valid sale price." };
    return {
      columns: { listing_type: "sale", price, nightly_rate: null, monthly_rate: null },
    };
  }

  const nightly = pricing.nightlyRate ? Number(pricing.nightlyRate) : null;
  const monthly = pricing.monthlyRate ? Number(pricing.monthlyRate) : null;

  if (nightly === null && monthly === null) {
    return { error: "Enter a short-stay nightly rate, a monthly rate, or both." };
  }
  if ((nightly !== null && !(nightly > 0)) || (monthly !== null && !(monthly > 0))) {
    return { error: "Rental rates must be greater than zero." };
  }

  return {
    columns: { listing_type: "rent", price: null, nightly_rate: nightly, monthly_rate: monthly },
  };
}

function gh(value: number) {
  return `GH₵ ${Number(value).toLocaleString("en-GH")}`;
}

// Short human label for a unit's price, e.g. "GH₵ 850,000" or "GH₵ 1,200 / night".
export function unitPriceLabel(unit: {
  listing_type?: string | null;
  price: number | null;
  nightly_rate?: number | null;
  monthly_rate?: number | null;
}) {
  if (unit.listing_type === "rent") {
    const parts: string[] = [];
    if (unit.monthly_rate) parts.push(`${gh(unit.monthly_rate)} / month`);
    if (unit.nightly_rate) parts.push(`${gh(unit.nightly_rate)} / night`);
    return parts.join(" · ") || "—";
  }
  return unit.price !== null && unit.price !== undefined ? gh(unit.price) : "—";
}
