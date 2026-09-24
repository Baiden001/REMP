import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import ViewingStatusSelect from "../viewing-status-select";

export default async function ViewingDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: v } = await supabase
    .from("viewings")
    .select(
      "id, scheduled_at, status, notes, clients(full_name, phone, email, location), projects(name), units(unit_code, unit_type, price), profiles:assigned_agent(full_name)"
    )
    .eq("id", params.id)
    .single();

  if (!v) notFound();

  const client = v.clients as unknown as {
    full_name: string;
    phone: string | null;
    email: string | null;
    location: string | null;
  } | null;

  const project = v.projects as unknown as { name: string } | null;
  const unit = v.units as unknown as { unit_code: string; unit_type: string; price: number } | null;
  const agent = v.profiles as unknown as { full_name: string } | null;

  const d = new Date(v.scheduled_at);
  const formattedDate = d.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const formattedTime = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  function Detail({ label, value }: { label: string; value: string | null }) {
    if (!value) return null;
    return (
      <div style={{ padding: "13px 0", borderBottom: "1px solid #eff2f1" }}>
        <small style={{ display: "block", fontSize: 10, color: "#8e9e98", marginBottom: 4 }}>
          {label}
        </small>
        <b style={{ fontSize: 13 }}>{value}</b>
      </div>
    );
  }

  return (
    <div>
      <div className="view-heading">
        <div>
          <p className="eyebrow">
            <Link href="/dashboard/viewings" style={{ color: "inherit", textDecoration: "none" }}>
              ← Viewings
            </Link>
          </p>
          <h1>{client?.full_name ?? "Viewing detail"}</h1>
          <p className="subtitle">
            {formattedDate} at {formattedTime}
          </p>
        </div>
        <ViewingStatusSelect viewingId={v.id} status={v.status} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div className="panel">
          <div className="panel-head"><div><h3>Client</h3></div></div>
          <Detail label="FULL NAME" value={client?.full_name ?? null} />
          <Detail label="PHONE" value={client?.phone ?? null} />
          <Detail label="EMAIL" value={client?.email ?? null} />
          <Detail label="LOCATION" value={client?.location ?? null} />
        </div>

        <div className="panel">
          <div className="panel-head"><div><h3>Viewing details</h3></div></div>
          <Detail label="DATE" value={formattedDate} />
          <Detail label="TIME" value={formattedTime} />
          <Detail label="PROJECT" value={project?.name ?? "Not specified"} />
          <Detail label="UNIT" value={unit ? `${unit.unit_code} · ${unit.unit_type}` : null} />
          <Detail label="ASSIGNED AGENT" value={agent?.full_name ?? "Not assigned"} />
          <Detail
            label="STATUS"
            value={v.status.replace("_", " ").replace(/^\w/, (c: string) => c.toUpperCase())}
          />
        </div>

        {v.notes && (
          <div className="panel" style={{ gridColumn: "span 2" }}>
            <div className="panel-head"><div><h3>Notes</h3></div></div>
            <p style={{ margin: "13px 0 0", fontSize: 13, lineHeight: 1.7, color: "#445b52" }}>
              {v.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
