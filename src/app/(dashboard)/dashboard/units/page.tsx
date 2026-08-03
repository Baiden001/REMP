import { createClient } from "@/lib/supabase/server";

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

  const { data: units } = await supabase
    .from("units")
    .select("id, unit_code, unit_type, price, availability, updated_at, projects(name)")
    .order("updated_at", { ascending: false });

  const total = units?.length ?? 0;
  const available = (units ?? []).filter((u) => u.availability === "available").length;
  const reserved = (units ?? []).filter((u) => u.availability === "reserved").length;
  const sold = (units ?? []).filter((u) => u.availability === "sold").length;

  return (
    <div>
      <div className="view-heading">
        <div>
          <p className="eyebrow">INVENTORY</p>
          <h1>Properties &amp; Units</h1>
          <p className="subtitle">A single source of truth for every available residence.</p>
        </div>
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
            style={{ width: total ? `${(available / total) * 100}%` : "0%" }}
          ></span>
          <span
            className="reserved-bar"
            style={{ width: total ? `${(reserved / total) * 100}%` : "0%" }}
          ></span>
          <span
            className="sold-bar"
            style={{ width: total ? `${(sold / total) * 100}%` : "0%" }}
          ></span>
          <small>{total ? Math.round((available / total) * 100) : 0}% available</small>
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
              {(units ?? []).map((u) => (
                <tr key={u.id}>
                  <td>
                    <span className="unit-name">
                      <i className="unit-thumb"></i>
                      <b>{u.unit_code}</b>
                    </span>
                  </td>
                  <td>{Array.isArray(u.projects) ? u.projects[0]?.name ?? "—" : (u.projects as { name: string } | null)?.name ?? "—"}</td>
                  <td>{u.unit_type ?? "—"}</td>
                  <td>
                    <b>{gh(u.price)}</b>
                  </td>
                  <td>
                    <span className={`table-status ${STATUS_CLASS[u.availability]}`}>
                      {u.availability}
                    </span>
                  </td>
                  <td>{new Date(u.updated_at).toLocaleDateString("en-GB")}</td>
                </tr>
              ))}
              {(!units || units.length === 0) && (
                <tr>
                  <td colSpan={6} style={{ color: "#8794a5" }}>
                    No units yet — add a project first, then units will list here.
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
