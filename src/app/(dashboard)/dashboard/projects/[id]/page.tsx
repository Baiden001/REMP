import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/icon";
import { unitPriceLabel } from "@/lib/listing";
import EditDetailsButton from "./edit-details-button";
import ProjectMedia, { type MediaItem } from "./project-media";
import { isPhoto, PROJECT_STAGES } from "@/lib/projects";
import StatusPanel from "./status-panel";

const STATUS_CLASS: Record<string, string> = {
  available: "available",
  reserved: "reserved",
  sold: "sold",
  rented: "sold",
  unavailable: "reserved",
};

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: project }, { data: media }, { data: units }, { data: profile }, { data: documents }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, description, location, status, construction_progress, expected_completion, cover_media_id")
      .eq("id", params.id)
      .single(),
    supabase
      .from("property_media")
      .select("id, storage_path, media_type, caption, created_at")
      .eq("project_id", params.id)
      .is("unit_id", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("units")
      .select("id, unit_code, unit_type, availability, listing_type, price, nightly_rate, monthly_rate")
      .eq("project_id", params.id)
      .order("unit_code"),
    user ? supabase.from("profiles").select("role").eq("id", user.id).single() : Promise.resolve({ data: null }),
    // Files added for this project from the Documents page.
    supabase
      .from("documents")
      .select("id, title, storage_path, created_at")
      .eq("project_id", params.id)
      .order("created_at", { ascending: false }),
  ]);

  if (!project) notFound();

  const role = (profile as { role: string } | null)?.role ?? "";
  const canEditProject = ["ceo", "management", "it"].includes(role);
  const canManageMedia = ["ceo", "management", "it", "marketing"].includes(role);

  const items: MediaItem[] = (media ?? []).map((m) => ({
    ...m,
    url: supabase.storage.from("property-media").getPublicUrl(m.storage_path).data.publicUrl,
  }));
  const linkedDocuments: MediaItem[] = (documents ?? []).map((d) => ({
    id: d.id,
    url: supabase.storage.from("property-media").getPublicUrl(d.storage_path).data.publicUrl,
    storage_path: d.storage_path,
    media_type: "document",
    caption: d.title,
    created_at: d.created_at,
    source: "documents",
  }));
  const photos = items.filter(isPhoto);
  const cover = photos.find((p) => p.id === project.cover_media_id) ?? photos[photos.length - 1] ?? null;

  const allUnits = units ?? [];
  const count = (status: string) => allUnits.filter((u) => u.availability === status).length;
  const stageLabel = PROJECT_STAGES.find((s) => s.value === project.status)?.label ?? project.status;
  const mapsQuery = project.location ? encodeURIComponent(project.location) : null;

  return (
    <div>
      <div className="view-heading">
        <div>
          <Link href="/dashboard/projects" className="back-link">
            <Icon name="arrowLeft" size={14} /> Projects
          </Link>
          <p className="eyebrow">PROJECT · {stageLabel.toUpperCase()}</p>
          <h1>{project.name}</h1>
          <p className="subtitle">
            <Icon name="mapPin" size={13} /> {project.location ?? "Location not set"}
          </p>
        </div>
        {canEditProject && (
          <div className="hero-actions">
            <EditDetailsButton
              project={{
                id: project.id,
                name: project.name,
                location: project.location,
                description: project.description,
                expected_completion: project.expected_completion,
              }}
            />
          </div>
        )}
      </div>

      <div className="project-hero" style={cover ? { backgroundImage: `url(${cover.url})` } : undefined}>
        {!cover && (
          <div className="project-hero-empty">
            <Icon name="building" size={34} />
            <span>No cover photo yet</span>
          </div>
        )}
      </div>

      <div className="kpi-grid" style={{ marginBottom: 18 }}>
        <article className="kpi-card">
          <div className="kpi-icon navy"><Icon name="home" /></div>
          <div>
            <p>Units</p>
            <h2>{allUnits.length}</h2>
          </div>
        </article>
        <article className="kpi-card">
          <div className="kpi-icon green"><Icon name="doorOpen" /></div>
          <div>
            <p>Available</p>
            <h2>{count("available")}</h2>
          </div>
        </article>
        <article className="kpi-card">
          <div className="kpi-icon blue"><Icon name="checkCircle" /></div>
          <div>
            <p>Sold · Rented</p>
            <h2>
              {count("sold")} · {count("rented")}
            </h2>
          </div>
        </article>
        <article className="kpi-card">
          <div className="kpi-icon warm"><Icon name="calendar" /></div>
          <div>
            <p>Expected completion</p>
            <h2 style={{ fontSize: 16 }}>
              {project.expected_completion
                ? new Date(project.expected_completion).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
                : "Not set"}
            </h2>
          </div>
        </article>
      </div>

      <div className="project-layout">
        <div className="project-main">
          <ProjectMedia
            projectId={project.id}
            coverMediaId={cover?.id ?? null}
            media={[...items, ...linkedDocuments]}
            canManage={canManageMedia}
            canSetCover={canEditProject}
          />

          <section className="panel table-panel">
            <div className="table-toolbar">
              <h3>Units in this project</h3>
              <Link href="/dashboard/units" className="text-button">
                All units <Icon name="arrowRight" size={12} />
              </Link>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>UNIT</th>
                    <th>TYPE</th>
                    <th>LISTING</th>
                    <th>PRICE</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {allUnits.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <Link href={`/dashboard/units/${u.id}`} className="text-button" style={{ padding: 0 }}>
                          {u.unit_code}
                        </Link>
                      </td>
                      <td>{u.unit_type ?? "—"}</td>
                      <td>
                        <span className={`listing-chip ${u.listing_type === "rent" ? "rent" : "sale"}`}>
                          {u.listing_type === "rent" ? "For rent" : "For sale"}
                        </span>
                      </td>
                      <td>{unitPriceLabel(u)}</td>
                      <td>
                        <span className={`table-status ${STATUS_CLASS[u.availability] ?? "reserved"}`}>{u.availability}</span>
                      </td>
                    </tr>
                  ))}
                  {allUnits.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ color: "#8e9e98" }}>
                        No units in this project yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="project-side">
          <StatusPanel
            projectId={project.id}
            status={project.status}
            progress={project.construction_progress}
            canEdit={canEditProject}
          />

          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>About this project</h3>
              </div>
            </div>
            <p className="project-description">
              {project.description || (canEditProject ? "No description yet — add one with “Edit details”." : "No description yet.")}
            </p>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>Location</h3>
                <p>{project.location ?? "Location not set"}</p>
              </div>
            </div>
            {mapsQuery && (
              <>
                <iframe
                  className="project-map"
                  title={`Map of ${project.name}`}
                  src={`https://www.google.com/maps?q=${mapsQuery}&output=embed`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <a
                  className="button ghost"
                  href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ width: "100%", marginTop: 10 }}
                >
                  <Icon name="mapPin" size={14} /> Open in Google Maps
                </a>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
