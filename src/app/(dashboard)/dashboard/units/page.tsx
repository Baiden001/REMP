import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import AddUnitButton from "./add-unit-button";
const STATUS_CLASS: Record<string, string> = {
  available: "available",
  reserved: "reserved",
  sold: "sold",
  unavailable: "reserved",
};
function gh(value: number) {
  return `GH₵ ${Number(value).toLocaleString("en-GH")}`;
}
export default async function UnitsPage() {
  const supabase = createClient();
  const [{ data: units }, { data: projects }] = await Promise.all([
    supabase
      .from("units")
      .select(
        "id, unit_code, unit_type, price, availability, updated_at, projects(name)"
      )
      .order("updated_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id, name")
      .order("name"),
  ]);
  const unitIds = (units ?? []).map((u) => u.id);
  const { data: media } =
    unitIds.length > 0
      ? await supabase
          .from("property_media")
          .select("id, unit_id, storage_path, media_type, created_at")
          .in("unit_id", unitIds)
          .order("created_at", { ascending: true })
      : { data: [] };
  // Get the first image belonging to each unit.
  const thumbnails = new Map<string, string>();
  for (const item of media ?? []) {
    if (!item.unit_id || thumbnails.has(item.unit_id)) continue;
    // Only use image/photo media as thumbnails.
    const mediaType = (item.media_type ?? "").toLowerCase();
    if (
      mediaType === "photo" ||
      mediaType === "image" ||
      mediaType.startsWith("image/")
    ) {
      const url = supabase.storage
        .from("property-media")
        .getPublicUrl(item.storage_path).data.publicUrl;
      if (url) {
        thumbnails.set(item.unit_id, url);
      }
    }
  }
  const total = units?.length ?? 0;
  const available = (units ?? []).filter(
    (u) => u.availability === "available"
  ).length;
  const reserved = (units ?? []).filter(
    (u) => u.availability === "reserved"
  ).length;
  const sold = (units ?? []).filter(
    (u) => u.availability === "sold"
  ).length;
  return (
    <div>
      <div className="view-heading">
        <div>
          <p className="eyebrow">INVENTORY</p>
          <h1>Properties &amp; Units</h1>
          <p className="subtitle">
            A single source of truth for every available residence.
          </p>
        </div>
        <AddUnitButton projects={projects ?? []} />
      </div>
      <div className="inventory-summary">
        <div>
          <span>Available inventory</span>
          <b>{available} units</b>
        </div>
        <div>
          <span>Reserved</span>
          <b>{reserved} units</b>
        </div>
        <div>
          <span>Sold</span>
          <b>{sold} units</b>
        </div>
        <div className="inventory-visual">
          <span
            className="available-bar"
            style={{
              width: total ? `${(available / total) * 100}%` : "0%",
            }}
          ></span>
          <span
            className="reserved-bar"
            style={{
              width: total ? `${(reserved / total) * 100}%` : "0%",
            }}
          ></span>
          <span
            className="sold-bar"
            style={{
              width: total ? `${(sold / total) * 100}%` : "0%",
            }}
          ></span>
          <small>
            {total ? Math.round((available / total) * 100) : 0}% available
          </small>
        </div>
      </div>
      <div className="panel table-panel">
        <div className="table-toolbar">
          <div className="tabs">
            <button className="selected">All units</button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>UNIT</th>
                <th>PROJECT</th>
                <th>TYPE</th>
                <th>PRICE</th>
                <th>STATUS</th>
                <th>LAST UPDATED</th>
              </tr>
            </thead>
            <tbody>
              {(units ?? []).map((u) => {
                const thumbnail = thumbnails.get(u.id);
                const projectName = Array.isArray(u.projects)
                  ? u.projects[0]?.name ?? "—"
                  : (u.projects as { name: string } | null)?.name ?? "—";
                return (
                  <tr
                    key={u.id}
                    style={{
                      cursor: "pointer",
                    }}
                  >
                    <td>
                      <Link
                        href={`/dashboard/units/${u.id}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          textDecoration: "none",
                          color: "inherit",
                        }}
                      >
                        {thumbnail ? (
                          <img
                            src={thumbnail}
                            alt={`${u.unit_code} thumbnail`}
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: 7,
                              objectFit: "cover",
                              display: "block",
                              flexShrink: 0,
                              background: "#f2f5f8",
                            }}
                          />
                        ) : (
                          <span
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: 7,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: "#f2f5f8",
                              border: "1px solid #e7ebf0",
                              color: "#9aa6b5",
                              fontSize: 16,
                              flexShrink: 0,
                            }}
                          >
                            ⌂
                          </span>
                        )}
                        <span className="unit-name">
                          <b>{u.unit_code}</b>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <Link
                        href={`/dashboard/units/${u.id}`}
                        style={{
                          textDecoration: "none",
                          color: "inherit",
                          display: "block",
                        }}
                      >
                        {projectName}
                      </Link>
                    </td>
                    <td>
                      <Link
                        href={`/dashboard/units/${u.id}`}
                        style={{
                          textDecoration: "none",
                          color: "inherit",
                          display: "block",
                        }}
                      >
                        {u.unit_type ?? "—"}
                      </Link>
                    </td>
                    <td>
                      <Link
                        href={`/dashboard/units/${u.id}`}
                        style={{
                          textDecoration: "none",
                          color: "inherit",
                          display: "block",
                        }}
                      >
                        <b>{gh(u.price)}</b>
                      </Link>
                    </td>
                    <td>
                      <Link
                        href={`/dashboard/units/${u.id}`}
                        style={{
                          textDecoration: "none",
                          color: "inherit",
                          display: "block",
                        }}
                      >
                        <span
                          className={`table-status ${
                            STATUS_CLASS[u.availability] ?? "reserved"
                          }`}
                        >
                          {u.availability}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <Link
                        href={`/dashboard/units/${u.id}`}
                        style={{
                          textDecoration: "none",
                          color: "inherit",
                          display: "block",
                        }}
                      >
                        {new Date(u.updated_at).toLocaleDateString("en-GB")}
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {(!units || units.length === 0) && (
                <tr>
                  <td colSpan={6} style={{ color: "#8794a5" }}>
                    No units yet — add a project first, then units will list
                    here.
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