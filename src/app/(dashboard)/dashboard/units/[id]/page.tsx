import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import EditUnitButton from "./edit-unit-button";

const STATUS_CLASS: Record<string, string> = {
  available: "available",
  reserved: "reserved",
  sold: "sold",
  unavailable: "reserved",
};
function gh(value: number) {
  return `GH₵ ${Number(value).toLocaleString("en-GH")}`;
}
function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
export default async function UnitDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: unit, error } = await supabase
    .from("units")
    .select(`
      id,
      unit_code,
      unit_type,
      bedrooms,
      bathrooms,
      floor_area_sqm,
      price,
      availability,
      payment_plan,
      features,
      created_at,
      updated_at,
      projects (
        id,
        name,
        description,
        location,
        status,
        construction_progress,
        expected_completion
      )
    `)
    .eq("id", params.id)
    .single();
  if (error || !unit) {
    notFound();
  }
  const { data: projects } = await supabase
  .from("projects")
  .select("id, name")
  .order("name", { ascending: true });
  const { data: media } = await supabase
    .from("property_media")
    .select("id, storage_path, media_type, caption, created_at")
    .eq("unit_id", unit.id)
    .order("created_at", { ascending: false });
  const project = Array.isArray(unit.projects)
    ? unit.projects[0]
    : unit.projects;
  const photos =
    (media ?? []).map((item) => ({
      ...item,
      url: supabase.storage
        .from("property-media")
        .getPublicUrl(item.storage_path).data.publicUrl,
    }));
  const statusLabel =
    unit.availability.charAt(0).toUpperCase() +
    unit.availability.slice(1).replace("_", " ");
  return (
    <div>
      {/* Header */}
      <div className="view-heading">
        <div>
          <Link
            href="/dashboard/units"
            style={{
              display: "inline-block",
              marginBottom: 10,
              color: "#2775e6",
              textDecoration: "none",
              fontSize: 12,
            }}
          >
            ← Back to Properties & Units
          </Link>
          <p className="eyebrow">UNIT DETAILS</p>
          <h1>{unit.unit_code}</h1>
          <p className="subtitle">
            {project?.name ?? "No project assigned"}
            {project?.location ? ` · ${project.location}` : ""}
          </p>
        </div>
        <div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 10,
  }}
>
  <span
    className={`table-status ${
      STATUS_CLASS[unit.availability] ?? "reserved"
    }`}
    style={{
      textTransform: "capitalize",
    }}
  >
    {statusLabel}
  </span>

  <EditUnitButton
  unit={{
    id: unit.id,
    project_id: Array.isArray(unit.projects)
      ? unit.projects[0]?.id ?? ""
      : "",
    unit_code: unit.unit_code,
    unit_type: unit.unit_type,
    bedrooms: unit.bedrooms,
    bathrooms: unit.bathrooms,
    floor_area_sqm: unit.floor_area_sqm,
    price: Number(unit.price),
    availability: unit.availability,
    payment_plan: unit.payment_plan,
    features: unit.features,
  }}
  projects={projects ?? []}
/>
</div>
      </div>
      {/* Main information */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.5fr) minmax(280px, 0.8fr)",
          gap: 18,
          marginBottom: 18,
        }}
      >
        {/* Gallery */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Unit photos</h3>
              <p>
                {photos.length > 0
                  ? `${photos.length} photo${photos.length === 1 ? "" : "s"}`
                  : "No unit photos uploaded"}
              </p>
            </div>
          </div>
          {photos.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  photos.length === 1
                    ? "1fr"
                    : "repeat(2, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              {photos.map((photo) => (
                <a
                  key={photo.id}
                  href={photo.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "block",
                    overflow: "hidden",
                    borderRadius: 10,
                    background: "#f2f5f8",
                    minHeight: 180,
                  }}
                >
                  <img
                    src={photo.url}
                    alt={photo.caption ?? `${unit.unit_code} photo`}
                    style={{
                      width: "100%",
                      height: "100%",
                      minHeight: 180,
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </a>
              ))}
            </div>
          ) : (
            <div
              style={{
                minHeight: 260,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 10,
                background: "#f5f7fa",
                color: "#8794a5",
                fontSize: 12,
              }}
            >
              No photos available for this unit.
            </div>
          )}
        </div>
        {/* Price / summary */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">LISTED PRICE</p>
              <h2 style={{ margin: 0 }}>{gh(unit.price)}</h2>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginTop: 16,
            }}
          >
            <div className="kpi-card" style={{ display: "block" }}>
              <small>TYPE</small>
              <b style={{ display: "block", marginTop: 5 }}>
                {unit.unit_type ?? "—"}
              </b>
            </div>
            <div className="kpi-card" style={{ display: "block" }}>
              <small>AREA</small>
              <b style={{ display: "block", marginTop: 5 }}>
                {unit.floor_area_sqm
                  ? `${unit.floor_area_sqm} m²`
                  : "—"}
              </b>
            </div>
            <div className="kpi-card" style={{ display: "block" }}>
              <small>BEDROOMS</small>
              <b style={{ display: "block", marginTop: 5 }}>
                {unit.bedrooms ?? "—"}
              </b>
            </div>
            <div className="kpi-card" style={{ display: "block" }}>
              <small>BATHROOMS</small>
              <b style={{ display: "block", marginTop: 5 }}>
                {unit.bathrooms ?? "—"}
              </b>
            </div>
          </div>
          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: "1px solid #edf0f4",
            }}
          >
            <small
              style={{
                color: "#8794a5",
                fontSize: 10,
                display: "block",
                marginBottom: 5,
              }}
            >
              PAYMENT PLAN
            </small>
            <p style={{ margin: 0, fontSize: 12 }}>
              {unit.payment_plan ?? "No payment plan specified"}
            </p>
          </div>
        </div>
      </div>
      {/* Features */}
      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head">
          <div>
            <h3>Features & Amenities</h3>
            <p>Features recorded for this unit</p>
          </div>
        </div>
        {unit.features && unit.features.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 8,
            }}
          >
            {unit.features.map((feature: string, index: number) => (
              <span
                key={`${feature}-${index}`}
                style={{
                  padding: "7px 11px",
                  borderRadius: 7,
                  background: "#f1f6fc",
                  border: "1px solid #dfeaf5",
                  color: "#35658f",
                  fontSize: 11,
                }}
              >
                ✓ {feature}
              </span>
            ))}
          </div>
        ) : (
          <p className="subtitle">No features have been listed for this unit.</p>
        )}
      </div>
      {/* Project */}
      <div className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">PROJECT</p>
            <h3>{project?.name ?? "No project assigned"}</h3>
          </div>
        </div>
        {project ? (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div>
                <small style={{ color: "#8794a5", fontSize: 10 }}>
                  LOCATION
                </small>
                <b
                  style={{
                    display: "block",
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  {project.location ?? "—"}
                </b>
              </div>
              <div>
                <small style={{ color: "#8794a5", fontSize: 10 }}>
                  STATUS
                </small>
                <b
                  style={{
                    display: "block",
                    fontSize: 12,
                    marginTop: 4,
                    textTransform: "capitalize",
                  }}
                >
                  {project.status?.replace("_", " ") ?? "—"}
                </b>
              </div>
              <div>
                <small style={{ color: "#8794a5", fontSize: 10 }}>
                  COMPLETION
                </small>
                <b
                  style={{
                    display: "block",
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  {formatDate(project.expected_completion)}
                </b>
              </div>
              <div>
                <small style={{ color: "#8794a5", fontSize: 10 }}>
                  CONSTRUCTION
                </small>
                <b
                  style={{
                    display: "block",
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  {project.construction_progress}%
                </b>
              </div>
            </div>
            {project.description && (
              <div
                style={{
                  paddingTop: 14,
                  borderTop: "1px solid #edf0f4",
                }}
              >
                <small
                  style={{
                    color: "#8794a5",
                    fontSize: 10,
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  ABOUT THE PROJECT
                </small>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    lineHeight: 1.7,
                    color: "#526174",
                  }}
                >
                  {project.description}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="subtitle">
            This unit has not been assigned to a project.
          </p>
        )}
      </div>
    </div>
  );
}