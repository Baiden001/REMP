
export type ListingType = "sale" | "rent";
export type Currency = "GHS" | "USD";

export const CURRENCY_OPTIONS: { value: Currency; label: string; symbol: string }[] = [
  { value: "GHS", label: "Ghana Cedis (GH₵)", symbol: "GH₵" },
  { value: "USD", label: "US Dollars ($)", symbol: "$" },
];

export function currencySymbol(currency?: string | null) {
  return currency === "USD" ? "$" : "GH₵";
}

export function formatMoney(value: number, currency: string = "GHS") {
  const amount = Number(value || 0);
  const formatted = amount.toLocaleString(currency === "USD" ? "en-US" : "en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currencySymbol(currency)} ${formatted}`;
}

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

export const RENT_PAYMENT_FOR = ["Monthly rent", "Short-stay booking"];

export function isRentPayment(payment: { payment_for: string | null }) {
  return !payment.payment_for || RENT_PAYMENT_FOR.includes(payment.payment_for);
}

export type ListingPricing = {
  listingType: ListingType;
  currency: Currency;
  price: string;
  nightlyRate: string;
  monthlyRate: string;
};

export function pricingFromUnit(unit: {
  listing_type?: string | null;
  currency?: string | null;
  price: number | null;
  nightly_rate?: number | null;
  monthly_rate?: number | null;
}): ListingPricing {
  return {
    listingType: unit.listing_type === "rent" ? "rent" : "sale",
    currency: unit.currency === "USD" ? "USD" : "GHS",
    price: unit.price?.toString() ?? "",
    nightlyRate: unit.nightly_rate?.toString() ?? "",
    monthlyRate: unit.monthly_rate?.toString() ?? "",
  };
}

export function pricingColumns(
  pricing: ListingPricing
):
  | { error: string }
  | {
      columns: {
        listing_type: ListingType;
        currency: Currency;
        price: number | null;
        nightly_rate: number | null;
        monthly_rate: number | null;
      };
    } {
  if (pricing.listingType === "sale") {
    const price = Number(pricing.price);
    if (!price || price <= 0) return { error: "Please enter a valid sale price." };
    return {
      columns: {
        listing_type: "sale",
        currency: pricing.currency,
        price,
        nightly_rate: null,
        monthly_rate: null,
      },
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
    columns: {
      listing_type: "rent",
      currency: pricing.currency,
      price: null,
      nightly_rate: nightly,
      monthly_rate: monthly,
    },
  };
}

export function unitPriceLabel(unit: {
  listing_type?: string | null;
  currency?: string | null;
  price: number | null;
  nightly_rate?: number | null;
  monthly_rate?: number | null;
}) {
  const currency = unit.currency ?? "GHS";

  if (unit.listing_type === "rent") {
    const parts: string[] = [];
    if (unit.monthly_rate) parts.push(`${formatMoney(unit.monthly_rate, currency)} / month`);
    if (unit.nightly_rate) parts.push(`${formatMoney(unit.nightly_rate, currency)} / night`);
    return parts.join(" · ") || "—";
  }

  return unit.price !== null && unit.price !== undefined
    ? formatMoney(unit.price, currency)
    : "—";
}
