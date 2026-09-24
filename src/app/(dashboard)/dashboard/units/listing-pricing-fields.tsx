"use client";

import type { ListingPricing } from "@/lib/listing";

export default function ListingPricingFields({
  value,
  onChange,
}: {
  value: ListingPricing;
  onChange: (next: ListingPricing) => void;
}) {
  const set = (patch: Partial<ListingPricing>) => onChange({ ...value, ...patch });

  return (
    <>
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
          Sale price (GH₵)
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
              Short-stay rate / night (GH₵)
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
              Monthly rate (GH₵)
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
          </p>
        </>
      )}
    </>
  );
}
