import { createClient } from "@/lib/supabase/server";
import CaptureLeadButton from "./capture-lead-button";
import LeadCard from "./lead-card";

const COLUMNS: { label: string; stages: string[]; avatarClass: string }[] = [
  { label: "New lead", stages: ["new", "contacted"], avatarClass: "teal" },
  { label: "Qualified", stages: ["qualified"], avatarClass: "navy-avatar" },
  { label: "Viewing scheduled", stages: ["viewing_scheduled"], avatarClass: "beige" },
  { label: "Negotiation", stages: ["negotiation"], avatarClass: "purple" },
];

const SOURCE_LABEL: Record<string, string> = {
  website: "Website",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  referral: "Referral",
  walk_in: "Walk-in",
  advertisement: "Advertisement",
  other: "Other",
};

function initialsFor(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString("en-GB");
}

export default async function CrmPage() {
  const supabase = createClient();

  const [{ data: leads }, { data: projects }] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, stage, source, created_at, clients(full_name, preferred_project_id, projects:preferred_project_id(name))"
      )
      .order("created_at", { ascending: false }),
    supabase.from("projects").select("id, name").order("name"),
  ]);

  const totalLeads = leads?.length ?? 0;
  const newThisWeek = (leads ?? []).filter(
    (l) => Date.now() - new Date(l.created_at).getTime() < 7 * 24 * 60 * 60 * 1000
  ).length;

  return (
    <div>
      <div className="view-heading">
        <div>
          <p className="eyebrow">CRM</p>
          <h1>Leads &amp; clients</h1>
          <p className="subtitle">Every opportunity, from first contact to close.</p>
        </div>
        <CaptureLeadButton projects={projects ?? []} />
      </div>

      <div className="crm-toolbar">
        <div className="lead-stat">
          <b>{totalLeads}</b>
          <span>Total leads</span>
        </div>
        <div className="lead-stat" style={{ borderRight: 0 }}>
          <b>{newThisWeek}</b>
          <span>New this week</span>
        </div>
      </div>

      <div className="kanban" style={{ marginTop: 17 }}>
        {COLUMNS.map((col) => {
          const columnLeads = (leads ?? []).filter((l) => col.stages.includes(l.stage));
          return (
            <section className="kanban-column" key={col.label}>
              <div className="kanban-heading">
                <b>{col.label}</b>
                <span>{columnLeads.length}</span>
              </div>

              {columnLeads.map((lead) => {
                const client = lead.clients as unknown as {
                  full_name: string;
                  projects: { name: string } | null;
                } | null;
                const name = client?.full_name ?? "Unnamed";
                const interest = client?.projects?.name ?? "No preference yet";

                return (
                  <LeadCard
                    key={lead.id}
                    leadId={lead.id}
                    stage={lead.stage}
                    avatarClass={col.avatarClass}
                    avatarInitials={initialsFor(name)}
                    name={name}
                    interest={interest}
                    addedLabel={timeAgo(lead.created_at)}
                    sourceLabel={SOURCE_LABEL[lead.source] ?? lead.source}
                  />
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
