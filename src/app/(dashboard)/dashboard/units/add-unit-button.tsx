"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AVAILABILITY_OPTIONS, pricingColumns, type ListingPricing } from "@/lib/listing";
import ListingPricingFields from "./listing-pricing-fields";

const UNIT_TYPES = [
  "Studio",
  "1 Bedroom",
  "2 Bedroom",
  "3 Bedroom",
  "4 Bedroom",
  "Penthouse",
  "Townhouse",
  "Villa",
];


const EMPTY_PRICING: ListingPricing = {
  listingType: "sale",
  price: "",
  nightlyRate: "",
  monthlyRate: "",
};

export default function AddUnitButton({
  projects,
}: {
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const formRef = useRef<HTMLFormElement>(null);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [amenityInput, setAmenityInput] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [pricing, setPricing] = useState<ListingPricing>(EMPTY_PRICING);

  function addAmenity() {
    const value = amenityInput.trim();

    if (!value) return;

    if (!amenities.includes(value)) {
      setAmenities((current) => [...current, value]);
    }

    setAmenityInput("");
  }

  function removeAmenity(index: number) {
    setAmenities((current) => current.filter((_, i) => i !== index));
  }

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);

    setPhotos(selected);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;

    setSaving(true);
    setError(null);

    const data = new FormData(form);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      setError("Your session has expired. Please log in again.");
      return;
    }

    const projectId = data.get("project_id") as string;

    if (!projectId) {
      setSaving(false);
      setError("Please select a project.");
      return;
    }

    const priced = pricingColumns(pricing);

    if ("error" in priced) {
      setSaving(false);
      setError(priced.error);
      return;
    }

    /*
     * 1. Create the unit first.
     */
    const { data: unit, error: unitError } = await supabase
      .from("units")
      .insert({
        project_id: projectId,
        unit_code: data.get("unit_code"),
        unit_type: data.get("unit_type"),
        bedrooms: data.get("bedrooms")
          ? Number(data.get("bedrooms"))
          : null,
        bathrooms: data.get("bathrooms")
          ? Number(data.get("bathrooms"))
          : null,
        floor_area_sqm: data.get("floor_area_sqm")
          ? Number(data.get("floor_area_sqm"))
          : null,
        ...priced.columns,
        availability: data.get("availability"),
        payment_plan:
          pricing.listingType === "sale" ? data.get("payment_plan") || null : null,
        features: amenities,
      })
      .select("id")
      .single();

    if (unitError || !unit) {
      setSaving(false);
      setError(unitError?.message ?? "Could not create unit.");
      return;
    }

    /*
     * 2. Upload selected photos.
     */
    const uploadedMedia: {
      unit_id: string;
      project_id: string;
      storage_path: string;
      media_type: string;
      uploaded_by: string;
    }[] = [];

    for (const photo of photos) {
      const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, "-");

      const path = `units/${unit.id}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("property-media")
        .upload(path, photo);

      if (uploadError) {
        setSaving(false);
        setError(
          `Unit was created, but photo upload failed: ${uploadError.message}`
        );
        return;
      }

      uploadedMedia.push({
        unit_id: unit.id,
        project_id: projectId,
        storage_path: path,
        media_type: "photo",
        uploaded_by: user.id,
      });
    }

    /*
     * 3. Save uploaded photos in property_media.
     */
    if (uploadedMedia.length > 0) {
      const { error: mediaError } = await supabase
        .from("property_media")
        .insert(uploadedMedia);

      if (mediaError) {
        setSaving(false);
        setError(
          `Unit was created, but the photos could not be linked: ${mediaError.message}`
        );
        return;
      }
    }

    setSaving(false);

    form.reset();
    setAmenities([]);
    setAmenityInput("");
    setPhotos([]);
    setPricing(EMPTY_PRICING);
    setOpen(false);

    router.refresh();
  }

  return (
    <>
      <button
        className="button primary"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        + Add unit
      </button>

      <div
        className="modal-backdrop"
        hidden={!open}
        onClick={(event) => {
          if (event.target === event.currentTarget && !saving) {
            setOpen(false);
          }
        }}
      >
        <section
          className="modal"
          role="dialog"
          aria-modal="true"
          style={{ maxWidth: 650 }}
        >
          <button
            className="modal-close"
            aria-label="Close"
            onClick={() => !saving && setOpen(false)}
          >
            ×
          </button>

          <p className="eyebrow">INVENTORY</p>

          <h2>Add a unit</h2>

          <p>
            Create a property unit with its specifications, amenities and
            photos.
          </p>

          <form ref={formRef} onSubmit={handleSubmit}>
            <div className="form-pair">
              <label>
                Unit code
                <input
                  required
                  name="unit_code"
                  placeholder="e.g. A-102"
                />
              </label>

              <label>
                Project
                <select required name="project_id" defaultValue="">
                  <option value="">Select project</option>

                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-pair">
              <label>
                Unit type
                <select name="unit_type" defaultValue="2 Bedroom">
                  {UNIT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Availability
                <select name="availability" defaultValue="available">
                  {AVAILABILITY_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-pair">
              <label>
                Bedrooms
                <input
                  type="number"
                  name="bedrooms"
                  min="0"
                  placeholder="e.g. 2"
                />
              </label>

              <label>
                Bathrooms
                <input
                  type="number"
                  name="bathrooms"
                  min="0"
                  placeholder="e.g. 2"
                />
              </label>
            </div>

            <label>
              Floor area (m²)
              <input
                type="number"
                name="floor_area_sqm"
                min="0"
                step="0.01"
                placeholder="e.g. 125"
              />
            </label>

            <ListingPricingFields value={pricing} onChange={setPricing} />

            {pricing.listingType === "sale" && (
              <label>
                Payment plan
                <textarea
                  name="payment_plan"
                  rows={3}
                  placeholder="e.g. 30% deposit, balance over 12 months"
                />
              </label>
            )}

            <div style={{ marginTop: 14 }}>
              <label>
                Amenities & features
              </label>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 6,
                }}
              >
                <input
                  value={amenityInput}
                  onChange={(event) =>
                    setAmenityInput(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addAmenity();
                    }
                  }}
                  placeholder="e.g. Private balcony"
                  style={{ flex: 1 }}
                />

                <button
                  type="button"
                  className="button ghost"
                  onClick={addAmenity}
                >
                  Add
                </button>
              </div>

              {amenities.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 7,
                    marginTop: 10,
                  }}
                >
                  {amenities.map((amenity, index) => (
                    <span
                      key={`${amenity}-${index}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 9px",
                        borderRadius: 6,
                        background: "#f3faf7",
                        border: "1px solid #e3f1eb",
                        color: "#315849",
                        fontSize: 11,
                      }}
                    >
                      {amenity}

                      <button
                        type="button"
                        onClick={() => removeAmenity(index)}
                        style={{
                          border: 0,
                          background: "transparent",
                          cursor: "pointer",
                          padding: 0,
                          color: "#8e9e98",
                        }}
                        aria-label={`Remove ${amenity}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <label style={{ marginTop: 16 }}>
              Unit photos
              <input
                type="file"
                name="photos"
                accept="image/*"
                multiple
                onChange={handlePhotoChange}
              />
            </label>

            {photos.length > 0 && (
              <p
                style={{
                  fontSize: 11,
                  color: "#8e9e98",
                  marginTop: 6,
                }}
              >
                {photos.length} photo
                {photos.length === 1 ? "" : "s"} selected
              </p>
            )}

            {error && (
              <p
                style={{
                  color: "#c0392b",
                  fontSize: 12,
                  marginTop: 12,
                }}
              >
                {error}
              </p>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="button ghost"
                disabled={saving}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>

              <button
                className="button primary"
                type="submit"
                disabled={saving}
              >
                {saving ? "Creating unit…" : "Create unit"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}