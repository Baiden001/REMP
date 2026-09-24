export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import ScheduleViewingButton from "./schedule-viewing-button";
import ViewingStatusSelect from "./viewing-status-select";

function dateBadge(iso: string) {
  const d = new Date(iso);
  return {
    day: d.getDate(),
    month: d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase(),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
}

export default async function ViewingsPage() {
  const supabase = createClient();

  const [{ data: viewings }, { data: clients }, { data: projects }] = await Promise.all([
    supabase
      .from("viewings")
      .select(
        "id, scheduled_at, status, notes, clients(full_name, phone), projects(name), profiles:assigned_agent(full_name)"
      )
      .order("scheduled_at", { ascending: true }),
    supabase.from("clients").select("id, full_name, phone").order("full_name"),
    supabase.from("projects").select("id, name").order("name"),
  ]);

  const now = Date.now();
  const upcoming = (viewings ?? []).filter((v) => new Date(v.scheduled_at).getTime() >= now);
  const past = (viewings ?? []).filter((v) => new Date(v.scheduled_at).getTime() < now);

  function renderList(list: typeof viewings) {
    return (list ?? []).map((v) => {
      const badge = dateBadge(v.scheduled_at);
      const client = v.clients as unknown as { full_name: string; phone: string | null } | null;
      const project = v.projects as unknown as { name: string } | null;
      const agent = v.profiles as unknown as { full_name: string } | null;

      return (
        <div
          key={v.id}
          className="agenda-item"
          style={{ gridTemplateColumns: "6px 43px 1fr auto", cursor: "pointer" }}
        >
          <span className="agenda-color"></span>
          <div className="date-badge">
            {badge.day}
            <small>{badge.month}</small>
          </div>
          <Link
            href={`/dashboard/viewings/${v.id}`}
            style={{ textDecoration: "none", color: "inherit", flex: 1 }}
          >
            <b style={{ display: "block", fontSize: 11 }}>{client?.full_name ?? "Unknown client"}</b>
            <small style={{ fontSize: 9, color: "#909d98" }}>
              {project?.name ?? "No project"} · {badge.time}
              {client?.phone ? ` · ${client.phone}` : ""}
              {agent?.full_name ? ` · ${agent.full_name}` : ""}
            </small>
          </Link>
          <ViewingStatusSelect viewingId={v.id} status={v.status} />
        </div>
      );
    });
  }

  return (
    <div>
      <div className="view-heading">
        <div>
          <p className="eyebrow">SITE TOURS</p>
          <h1>SITE TOURS</h1>
          <p className="subtitle">Every scheduled property visit, and who's handling it.</p>
        </div>
        <ScheduleViewingButton clients={clients ?? []} projects={projects ?? []} />
      </div>

      <div className="panel agenda-panel">
        <div className="panel-head">
          <div>
            <h3>Upcoming</h3>
            <p>{upcoming.length} scheduled</p>
          </div>
        </div>
        <div className="agenda-list">
          {upcoming.length > 0 ? (
            renderList(upcoming)
          ) : (
            <p className="subtitle" style={{ padding: "12px 0" }}>
              No upcoming site tours — schedule one to get started.
            </p>
          )}
        </div>
      </div>

      {past.length > 0 && (
        <div className="panel agenda-panel" style={{ marginTop: 18 }}>
          <div className="panel-head">
            <div>
              <h3>Past</h3>
              <p>{past.length} site tours</p>
            </div>
          </div>
          <div className="agenda-list">{renderList(past)}</div>
        </div>
      )}
    </div>
  );
}
