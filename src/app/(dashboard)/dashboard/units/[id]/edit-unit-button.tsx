"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

const AVAILABILITY_OPTIONS = [
{ value: "available", label: "Available" },
{ value: "reserved", label: "Reserved" },
{ value: "sold", label: "Sold" },
{ value: "unavailable", label: "Unavailable" },
];

type Unit = {
id: string;
project_id: string;
unit_code: string;
unit_type: string | null;
bedrooms: number | null;
bathrooms: number | null;
floor_area_sqm: number | null;
price: number;
availability: string;
payment_plan: string | null;
features: string[] | null;
};

type Project = {
id: string;
name: string;
};

export default function EditUnitButton({
unit,
projects,
}: {
unit: Unit;
projects: Project[];
}) {
const router = useRouter();
const supabase = createClient();

const [open, setOpen] = useState(false);
const [saving, setSaving] = useState(false);
const [error, setError] = useState<string | null>(null);

const [unitCode, setUnitCode] = useState(unit.unit_code);
const [projectId, setProjectId] = useState(unit.project_id);
const [unitType, setUnitType] = useState(
unit.unit_type ?? "2 Bedroom"
);
const [availability, setAvailability] = useState(
unit.availability
);
const [bedrooms, setBedrooms] = useState(
unit.bedrooms?.toString() ?? ""
);
const [bathrooms, setBathrooms] = useState(
unit.bathrooms?.toString() ?? ""
);
const [floorArea, setFloorArea] = useState(
unit.floor_area_sqm?.toString() ?? ""
);
const [price, setPrice] = useState(
unit.price.toString()
);
const [paymentPlan, setPaymentPlan] = useState(
unit.payment_plan ?? ""
);
const [amenities, setAmenities] = useState<string[]>(
unit.features ?? []
);
const [amenityInput, setAmenityInput] = useState("");
const [photos, setPhotos] = useState<File[]>([]);

function addAmenity() {
const value = amenityInput.trim();

if (!value) return;
if (!amenities.includes(value)) {
  setAmenities((current) => [...current, value]);
}
setAmenityInput("");

}

function removeAmenity(index: number) {
setAmenities((current) =>
current.filter((_, i) => i !== index)
);
}

function handlePhotoChange(
  event: React.ChangeEvent<HTMLInputElement>
) {
  setPhotos(Array.from(event.target.files ?? []));
}

function resetForm() {
setUnitCode(unit.unit_code);
setProjectId(unit.project_id);
setUnitType(
unit.unit_type ?? "2 Bedroom"
);
setAvailability(unit.availability);
setBedrooms(
unit.bedrooms?.toString() ?? ""
);
setBathrooms(
unit.bathrooms?.toString() ?? ""
);
setFloorArea(
unit.floor_area_sqm?.toString() ?? ""
);
setPrice(unit.price.toString());
setPaymentPlan(
unit.payment_plan ?? ""
);
setAmenities(unit.features ?? []);
setAmenityInput("");
setPhotos([]);
setError(null);
}

async function handleSubmit(
event: React.FormEvent
) {
event.preventDefault();

setSaving(true);
setError(null);
const {
  data: { user },
} = await supabase.auth.getUser();
if (!user) {
  setSaving(false);
  setError(
    "Your session has expired. Please log in again."
  );
  return;
}
if (!projectId) {
  setSaving(false);
  setError("Please select a project.");
  return;
}
const numericPrice = Number(price);
if (!numericPrice || numericPrice <= 0) {
  setSaving(false);
  setError("Please enter a valid price.");
  return;
}
const { error: updateError } = await supabase
  .from("units")
  .update({
    project_id: projectId,
    unit_code: unitCode.trim(),
    unit_type: unitType,
    bedrooms: bedrooms
      ? Number(bedrooms)
      : null,
    bathrooms: bathrooms
      ? Number(bathrooms)
      : null,
    floor_area_sqm: floorArea
      ? Number(floorArea)
      : null,
    price: numericPrice,
    availability,
    payment_plan:
      paymentPlan.trim() || null,
    features: amenities,
    updated_at:
      new Date().toISOString(),
  })
  .eq("id", unit.id);
if (updateError) {
  setSaving(false);
  setError(updateError.message);
  return;
}
const uploadedMedia: {
  unit_id: string;
  project_id: string;
  storage_path: string;
  media_type: string;
  uploaded_by: string;
}[] = [];
for (const photo of photos) {
  const safeName = photo.name.replace(
    /[^a-zA-Z0-9._-]/g,
    "-"
  );
  const path =
    "units/" +
    unit.id +
    "/" +
    Date.now() +
    "-" +
    safeName;
  const { error: uploadError } =
    await supabase.storage
      .from("property-media")
      .upload(path, photo);
  if (uploadError) {
    setSaving(false);
    setError(
      "Unit was updated, but photo upload failed: " +
        uploadError.message
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
if (uploadedMedia.length > 0) {
  const { error: mediaError } =
    await supabase
      .from("property_media")
      .insert(uploadedMedia);
  if (mediaError) {
    setSaving(false);
    setError(
      "Unit was updated, but the new photos could not be linked: " +
        mediaError.message
    );
    return;
  }
}
setSaving(false);
setOpen(false);
router.refresh();

}

return (
<>
<button
className="button primary"
type="button"
onClick={() => {
resetForm();
setOpen(true);
}}
>
Edit unit
      </button>
  <div
    className="modal-backdrop"
    hidden={!open}
    onClick={(event) => {
      if (
        event.target === event.currentTarget &&
        !saving
      ) {
        setOpen(false);
      }
    }}
  >
    <section
      className="modal"
      role="dialog"
      aria-modal="true"
      style={{
        maxWidth: 700,
        maxHeight: "90vh",
        overflowY: "auto",
      }}
    >
      <button
        className="modal-close"
        type="button"
        aria-label="Close"
        onClick={() => {
          if (!saving) {
            setOpen(false);
          }
        }}
      >
        X
      </button>
      <p className="eyebrow">
        INVENTORY
      </p>
      <h2>
        Edit {unit.unit_code}
      </h2>
      <p>
        Update the unit information,
        amenities or add new photos.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="form-pair">
          <label>
            Unit code
            <input
              required
              value={unitCode}
              onChange={(event) =>
                setUnitCode(
                  event.target.value
                )
              }
              placeholder="e.g. A-102"
            />
          </label>
          <label>
            Project
            <select
              required
              value={projectId}
              onChange={(event) =>
                setProjectId(
                  event.target.value
                )
              }
            >
              <option value="">
                Select project
              </option>
              {projects.map((project) => (
                <option
                  key={project.id}
                  value={project.id}
                >
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-pair">
          <label>
            Unit type
            <select
              value={unitType}
              onChange={(event) =>
                setUnitType(
                  event.target.value
                )
              }
            >
              {UNIT_TYPES.map((type) => (
                <option
                  key={type}
                  value={type}
                >
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            Availability
            <select
              value={availability}
              onChange={(event) =>
                setAvailability(
                  event.target.value
                )
              }
            >
              {AVAILABILITY_OPTIONS.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>
          </label>
        </div>
        <div className="form-pair">
          <label>
            Bedrooms
            <input
              type="number"
              min="0"
              value={bedrooms}
              onChange={(event) =>
                setBedrooms(
                  event.target.value
                )
              }
              placeholder="e.g. 2"
            />
          </label>
          <label>
            Bathrooms
            <input
              type="number"
              min="0"
              value={bathrooms}
              onChange={(event) =>
                setBathrooms(
                  event.target.value
                )
              }
              placeholder="e.g. 2"
            />
          </label>
        </div>
        <div className="form-pair">
          <label>
            Floor area (m2)
            <input
              type="number"
              min="0"
              step="0.01"
              value={floorArea}
              onChange={(event) =>
                setFloorArea(
                  event.target.value
                )
              }
              placeholder="e.g. 125"
            />
          </label>
          <label>
            Price (GHS)
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(event) =>
                setPrice(
                  event.target.value
                )
              }
              placeholder="e.g. 850000"
            />
          </label>
        </div>
        <label>
          Payment plan
          <textarea
            rows={3}
            value={paymentPlan}
            onChange={(event) =>
              setPaymentPlan(
                event.target.value
              )
            }
            placeholder="e.g. 30% deposit, balance over 12 months"
          />
        </label>
        <div
          style={{
            marginTop: 14,
          }}
        >
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
                setAmenityInput(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter"
                ) {
                  event.preventDefault();
                  addAmenity();
                }
              }}
              placeholder="e.g. Private balcony"
              style={{
                flex: 1,
              }}
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
              {amenities.map(
                (amenity, index) => (
                  <span
                    key={
                      amenity +
                      "-" +
                      index
                    }
                    style={{
                      display:
                        "inline-flex",
                      alignItems:
                        "center",
                      gap: 6,
                      padding:
                        "6px 9px",
                      borderRadius: 6,
                      background:
                        "#f1f6fc",
                      border:
                        "1px solid #dfeaf5",
                      color:
                        "#35658f",
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
    color: "#8794a5",
  }}
  aria-label={"Remove " + amenity}
>
  X
</button>
                  </span>
                )
              )}
            </div>
          )}
        </div>
        <label
          style={{
            marginTop: 16,
          }}
        >
          Add more photos
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={
              handlePhotoChange
            }
          />
        </label>
        {photos.length > 0 && (
          <p
            style={{
              fontSize: 11,
              color: "#8794a5",
              marginTop: 6,
            }}
          >
            {photos.length} new photo
            {photos.length === 1
              ? ""
              : "s"}{" "}
            selected
          </p>
        )}
        <p
          style={{
            fontSize: 11,
            color: "#8794a5",
            marginTop: 8,
          }}
        >
          Existing photos are kept.
          New photos will be added to
          the unit.
        </p>
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
            onClick={() =>
              setOpen(false)
            }
          >
            Cancel
          </button>
          <button
            className="button primary"
            type="submit"
            disabled={saving}
          >
            {saving
              ? "Saving changes..."
              : "Save changes"}
          </button>
        </div>
      </form>
    </section>
  </div>
</>

);
}