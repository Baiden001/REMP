import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import Icon, { type IconName } from "@/components/icon";

const ENTITY: Record<string, { noun: string; icon: IconName; href?: (id: string) => string }> = {
  projects: { noun: "project", icon: "building", href: (id) => `/dashboard/projects/${id}` },
  units: { noun: "unit", icon: "home", href: (id) => `/dashboard/units/${id}` },
  clients: { noun: "client", icon: "user", href: (id) => `/dashboard/crm/${id}` },
  leads: { noun: "lead", icon: "target" },
  viewings: { noun: "site tour", icon: "calendarCheck", href: (id) => `/dashboard/viewings/${id}` },
  sales: { noun: "sale", icon: "trendingUp", href: (id) => `/dashboard/sales/${id}` },
  payments: { noun: "payment", icon: "banknote" },
  rentals: { noun: "rental", icon: "key", href: (id) => `/dashboard/rentals/${id}` },
  invoices: { noun: "invoice", icon: "fileText", href: (id) => `/dashboard/invoices/${id}` },
  documents: { noun: "document", icon: "folder" },
  property_media: { noun: "project file", icon: "image" },
  campaigns: { noun: "campaign", icon: "megaphone" },
  marketing_content: { noun: "marketing file", icon: "megaphone" },
  profiles: { noun: "staff profile", icon: "shieldUser" },
};

const VERB: Record<string, string> = { insert: "added", update: "updated", delete: "deleted" };

const PAGE_SIZE = 60;

type Change = { from: unknown; to: unknown };

function fieldName(key: string) {
  return key.replace(/_id$/, "").replace(/_/g, " ");
}

function show(value: unknown, limit = 40) {
  if (value === null || value === undefined || value === "") return "empty";
  if (Array.isArray(value)) return value.join(", ") || "empty";
  const text = String(value);
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

// Fields whose whole value matters (e.g. an invoice's line items) get more room.
const LONG_FIELDS = new Set(["line_items", "notes"]);

function describeChanges(changes: Record<string, Change> | null) {
  if (!changes) return [];
  return Object.entries(changes).map(([key, { from, to }]) =>
    key.endsWith("_id")
      ? `${fieldName(key)} changed`
      : `${fieldName(key)}: ${show(from, LONG_FIELDS.has(key) ? 240 : 40)} → ${show(to, LONG_FIELDS.has(key) ? 240 : 40)}`
  );
}

function when(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: { type?: string; person?: string; before?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!me || !["ceo", "management", "it"].includes(me.role)) redirect("/dashboard");

  let query = supabase
    .from("audit_logs")
    .select("id, action, entity_table, entity_id, details, created_at, actor:profiles!audit_logs_actor_id_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (searchParams.type && ENTITY[searchParams.type]) query = query.eq("entity_table", searchParams.type);
  if (searchParams.person) query = query.eq("actor_id", searchParams.person);
  if (searchParams.before) query = query.lt("created_at", searchParams.before);

  const [{ data: logs }, { data: staff }] = await Promise.all([
    query,
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);

  const rows = logs ?? [];
  const last = rows[rows.length - 1];
  const params = (extra: Record<string, string | undefined>) => {
    const merged = { type: searchParams.type, person: searchParams.person, ...extra };
    const qs = Object.entries(merged)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
      .join("&");
    return qs ? `/dashboard/activity?${qs}` : "/dashboard/activity";
  };

  return (
    <div>
      <div className="view-heading">
        <div>
          <p className="eyebrow">SYSTEM</p>
          <h1>Activity</h1>
          <p className="subtitle">Who added, changed or deleted what — newest first.</p>
        </div>
      </div>

      <form className="panel activity-filters" action="/dashboard/activity">
        <label>
          Type
          <select name="type" defaultValue={searchParams.type ?? ""}>
            <option value="">Everything</option>
            {Object.entries(ENTITY).map(([key, e]) => (
              <option key={key} value={key}>
                {e.noun[0].toUpperCase() + e.noun.slice(1)}s
              </option>
            ))}
          </select>
        </label>
        <label>
          Person
          <select name="person" defaultValue={searchParams.person ?? ""}>
            <option value="">Everyone</option>
            {(staff ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
        </label>
        <button className="button primary" type="submit">
          Filter
        </button>
        {(searchParams.type || searchParams.person) && (
          <Link href="/dashboard/activity" className="button ghost">
            Clear
          </Link>
        )}
      </form>

      <section className="panel activity-feed">
        {rows.length === 0 && (
          <p className="subtitle" style={{ margin: 0 }}>
            No activity recorded yet. Changes made from now on will appear here.
          </p>
        )}
        <ul>
          {rows.map((log) => {
            const entity = ENTITY[log.entity_table] ?? { noun: log.entity_table, icon: "file" as IconName };
            const details = (log.details ?? {}) as { label?: string; changes?: Record<string, Change> | null };
            const actor = (log.actor as unknown as { full_name: string } | null)?.full_name;
            const changes = describeChanges(details.changes ?? null);
            const href = log.action !== "delete" && log.entity_id && entity.href ? entity.href(log.entity_id) : null;
            return (
              <li key={log.id} className={`activity-${log.action}`}>
                <span className="activity-icon">
                  <Icon name={entity.icon} size={15} />
                </span>
                <div>
                  <p>
                    <b>{actor ?? "System"}</b> {VERB[log.action] ?? log.action} {entity.noun}{" "}
                    {href ? (
                      <Link href={href} className="activity-target">
                        {details.label ?? "record"}
                      </Link>
                    ) : (
                      <span className="activity-target">{details.label ?? "record"}</span>
                    )}
                  </p>
                  {changes.length > 0 && (
                    <small className="activity-changes">
                      {changes.slice(0, 4).join(" · ")}
                      {changes.length > 4 ? ` · +${changes.length - 4} more` : ""}
                    </small>
                  )}
                </div>
                <time>{when(log.created_at)}</time>
              </li>
            );
          })}
        </ul>
        {rows.length === PAGE_SIZE && last && (
          <Link href={params({ before: last.created_at })} className="button ghost" style={{ width: "100%" }}>
            Show older activity
          </Link>
        )}
      </section>
    </div>
  );
}
