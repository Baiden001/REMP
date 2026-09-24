import { createClient } from "@/lib/supabase/server";
import AddProjectButton from "./add-project-button";
import ProjectActions from "./project-actions";
import Icon from "@/components/icon";

const STATUS_LABEL: Record<string, string> = {
  upcoming: "Upcoming",
  off_plan: "Off-plan",
  under_construction: "Under construction",
  completed: "Completed",
};

const STATUS_CLASS: Record<string, string> = {
  off_plan: "offplan",
  completed: "complete",
};

export default async function ProjectsPage() {
  const supabase = createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select(
      "id, name, location, status, construction_progress, units(id, availability), property_media(storage_path, created_at, unit_id)"
    )
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="view-heading">
        <div>
          <p className="eyebrow">PORTFOLIO</p>
          <h1>Projects</h1>
          <p className="subtitle">
            Monitor development progress, inventory, and sales at a glance.
          </p>
        </div>

        <AddProjectButton />
      </div>

      {(!projects || projects.length === 0) && (
        <div className="panel">
          <p className="subtitle">
            No projects yet. Click “Add project” to create your first one.
          </p>
        </div>
      )}

      <div className="project-cards">
        {(projects ?? []).map((p) => {
          const units = (p.units ?? []) as {
            id: string;
            availability: string;
          }[];

          const available = units.filter(
            (u) => u.availability === "available"
          ).length;

          const total = units.length;

          const media = (p.property_media ?? []) as {
            storage_path: string;
            created_at: string;
            unit_id: string | null;
          }[];

          const projectPhotos = media.filter(
            (item) => item.unit_id === null
          );

          const latestPhoto = [...projectPhotos].sort((a, b) =>
            a.created_at < b.created_at ? 1 : -1
          )[0];

          const photoUrl = latestPhoto
            ? supabase.storage
                .from("property-media")
                .getPublicUrl(latestPhoto.storage_path).data.publicUrl
            : null;

          return (
            <article
              className="project-card"
              key={p.id}
              style={{ position: "relative" }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  zIndex: 10,
                }}
              >
                <ProjectActions
                  projectId={p.id}
                  projectName={p.name}
                />
              </div>

              <div
                className={`property-visual${photoUrl ? " has-photo" : ""}`}
                style={
                  photoUrl
                    ? {
                        background: `center / cover no-repeat url(${photoUrl})`,
                      }
                    : undefined
                }
              >
                <span
                  className={`status-label ${STATUS_CLASS[p.status] ?? ""}`}
                >
                  {STATUS_LABEL[p.status] ?? p.status}
                </span>
              </div>

              <div className="project-card-body">
                <h3>{p.name}</h3>

                <p>
                  <Icon name="mapPin" size={12} /> {p.location ?? "Location not set"}
                </p>

                <div className="project-info">
                  <span>
                    {available} of {total} units available
                  </span>

                  <b>{p.construction_progress}%</b>
                </div>

                <div className="progress-line">
                  <i
                    style={{
                      width: `${p.construction_progress}%`,
                    }}
                  ></i>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}