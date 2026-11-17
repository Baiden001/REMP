
"use client";

import {
  CURRENCY_OPTIONS,
  type ListingPricing,
} from "@/lib/listing";

export default function ListingPricingFields({
  value,
  onChange,
}: {
  value: ListingPricing;
  onChange: (next: ListingPricing) => void;
}) {
  const set = (patch: Partial<ListingPricing>) => onChange({ ...value, ...patch });
  const currencyLabel = value.currency === "USD" ? "$" : "GH₵";

  return (
    <>
      <label>
        Currency
        <select
          value={value.currency}
          onChange={(event) => set({ currency: event.target.value as ListingPricing["currency"] })}
        >
          {CURRENCY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <small className="field-hint">
          This currency applies to this unit's listed price and rental rates.
        </small>
      </label>

      <div className="listing-toggle" role="radiogroup" aria-label="Listing type">
        <span>Listing type</span>
        <div>
          <button
            type="button"
            role="radio"
            aria-checked={value.listingType === "sale"}
            className={value.listingType === "sale" ? "selected" : ""}
            onClick={() => set({ listingType: "sale" })}
          >
            For sale
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={value.listingType === "rent"}
            className={value.listingType === "rent" ? "selected" : ""}
            onClick={() => set({ listingType: "rent" })}
          >
            For rent
          </button>
        </div>
      </div>

      {value.listingType === "sale" ? (
        <label>
          Sale price ({currencyLabel})
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={value.price}
            onChange={(event) => set({ price: event.target.value })}
            placeholder="e.g. 850000"
          />
        </label>
      ) : (
        <>
          <div className="form-pair">
            <label>
              Short-stay rate / night ({currencyLabel})
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={value.nightlyRate}
                onChange={(event) => set({ nightlyRate: event.target.value })}
                placeholder="e.g. 1200"
              />
            </label>
            <label>
              Monthly rate ({currencyLabel})
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={value.monthlyRate}
                onChange={(event) => set({ monthlyRate: event.target.value })}
                placeholder="e.g. 15000"
              />
            </label>
          </div>
          <p className="field-hint">
            Fill in the rate for each way this unit is let — short stays, monthly, or both.
            Availability updates automatically from bookings; set it to “Unavailable” to take
            the unit off the market.
          </p>
        </>
      )}
    </>
  );
}
