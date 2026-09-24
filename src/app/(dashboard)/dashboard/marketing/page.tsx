import { createClient } from "@/lib/supabase/server";
import AddCampaignButton from "./add-campaign-button";
import UploadContentButton from "./upload-content-button";

const PLATFORM_CLASS: Record<string, string> = {
  Instagram: "warm",
  Facebook: "blue",
  TikTok: "navy-avatar",
  LinkedIn: "teal",
};

const TYPE_ICON: Record<string, string> = {
  description: "✦",
  price_sheet: "◇",
  photo: "▧",
  video: "▶",
  brochure: "▤",
  floor_plan: "⌂",
};

function gh(v: number) {
  if (v >= 1_000_000) return `GH₵ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `GH₵ ${(v / 1_000).toFixed(0)}K`;
  return `GH₵ ${v.toLocaleString("en-GH")}`;
}

export default async function MarketingPage() {
  const supabase = createClient();

  const [{ data: campaigns }, { data: content }, { data: projects }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, name, platform, budget, leads_generated, starts_on, ends_on, projects(name)")
      .order("starts_on", { ascending: false }),
    supabase
      .from("marketing_content")
      .select("id, title, content_type, approved, storage_path, created_at, projects(name)")
      .order("created_at", { ascending: false }),
    supabase.from("projects").select("id, name").order("name"),
  ]);

  return (
    <div>
      <div className="view-heading">
        <div>
          <p className="eyebrow">MARKETING</p>
          <h1>Marketing center</h1>
          <p className="subtitle">
            Verified property content and campaign tracking — one source of truth for the
            marketing team.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <UploadContentButton projects={projects ?? []} />
          <AddCampaignButton projects={projects ?? []} />
        </div>
      </div>

      {/* Content library */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <div>
            <h3>Content library</h3>
            <p>Approved assets the marketing team can use immediately</p>
          </div>
        </div>

        {(!content || content.length === 0) ? (
          <p className="subtitle" style={{ padding: "12px 0" }}>
            No content yet — upload the first asset above.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>TITLE</th>
                  <th>TYPE</th>
                  <th>PROJECT</th>
                  <th>STATUS</th>
                  <th>FILE</th>
                  <th>DATE</th>
                </tr>
              </thead>
              <tbody>
                {(content ?? []).map((c) => {
                  const project = c.projects as unknown as { name: string } | null;
                  const publicUrl = c.storage_path
                    ? supabase.storage.from("property-media").getPublicUrl(c.storage_path).data.publicUrl
                    : null;
                  return (
                    <tr key={c.id}>
                      <td><b>{c.title}</b></td>
                      <td>
                        <span style={{ fontSize: 13, marginRight: 5 }}>
                          {TYPE_ICON[c.content_type] ?? "▦"}
                        </span>
                        {c.content_type?.replace("_", " ")}
                      </td>
                      <td>{project?.name ?? "General"}</td>
                      <td>
                        <span className={`table-status ${c.approved ? "complete" : "reserved"}`}>
                          {c.approved ? "Approved" : "Pending"}
                        </span>
                      </td>
                      <td>
                        {publicUrl ? (
                          <a
                            href={publicUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "#1f5a44", fontSize: 11 }}
                          >
                            View ↗
                          </a>
                        ) : "—"}
                      </td>
                      <td>{new Date(c.created_at).toLocaleDateString("en-GB")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Campaigns */}
      <div className="panel">
        <div className="panel-head">
          <div>
            <h3>Campaigns</h3>
            <p>{campaigns?.length ?? 0} campaigns tracked</p>
          </div>
        </div>

        {(!campaigns || campaigns.length === 0) ? (
          <p className="subtitle" style={{ padding: "12px 0" }}>
            No campaigns yet — add one above.
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: 14, marginTop: 14 }}>
            {(campaigns ?? []).map((c) => {
              const project = c.projects as unknown as { name: string } | null;
              return (
                <div
                  key={c.id}
                  className="kpi-card"
                  style={{ flexDirection: "column", alignItems: "flex-start", gap: 10 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
                    <span className={`avatar ${PLATFORM_CLASS[c.platform ?? ""] ?? "teal"}`} style={{ fontSize: 9 }}>
                      {(c.platform ?? "?")[0]}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ fontSize: 12, display: "block" }}>{c.name}</b>
                      <small style={{ color: "#8e9e98" }}>{c.platform} · {project?.name ?? "General"}</small>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    <div>
                      <small style={{ color: "#8e9e98", fontSize: 9 }}>BUDGET</small>
                      <b style={{ display: "block", fontSize: 12 }}>{c.budget ? gh(c.budget) : "—"}</b>
                    </div>
                    <div>
                      <small style={{ color: "#8e9e98", fontSize: 9 }}>LEADS</small>
                      <b style={{ display: "block", fontSize: 12 }}>{c.leads_generated}</b>
                    </div>
                    <div>
                      <small style={{ color: "#8e9e98", fontSize: 9 }}>PERIOD</small>
                      <b style={{ display: "block", fontSize: 12 }}>
                        {c.starts_on ? new Date(c.starts_on).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "?"}
                        {" — "}
                        {c.ends_on ? new Date(c.ends_on).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "?"}
                      </b>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
