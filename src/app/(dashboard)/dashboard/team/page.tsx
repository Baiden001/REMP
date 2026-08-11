import { createClient } from "@/lib/supabase/server";
import InviteMemberButton from "./invite-member-button";
import RoleSelect from "./role-select";

function initialsFor(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function TeamPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, role, department, is_active, created_at")
    .order("created_at", { ascending: true });

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id)
    .single();

const canManage = !!me && ["it", "ceo"].includes(me.role);
  const roleCounts = (members ?? []).reduce<Record<string, number>>((acc, m) => {
    acc[m.role] = (acc[m.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="view-heading">
        <div>
          <p className="eyebrow">SYSTEM</p>
          <h1>Team &amp; Access</h1>
          <p className="subtitle">Everyone with access to REMP, and what they can do here.</p>
        </div>
        {canManage && <InviteMemberButton />}
      </div>

      <div className="team-grid">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Staff</h3>
              <p>{members?.length ?? 0} people with access</p>
            </div>
          </div>

          <div className="team-list">
            {(members ?? []).map((m) => (
              <div className="team-member" key={m.id}>
                <span className="avatar avatar-ceo">{initialsFor(m.full_name)}</span>
                <span>
                  <b>{m.full_name}</b>
                  <small>{m.department ?? "—"}</small>
                </span>
                <RoleSelect profileId={m.id} currentRole={m.role} canEdit={canManage} />
                <span>{m.is_active ? "🟢" : "⚪"}</span>
              </div>
            ))}
            {(!members || members.length === 0) && (
              <p className="subtitle">No staff yet.</p>
            )}
          </div>
        </div>

        <div className="panel access-panel">
          <div className="panel-head">
            <div>
              <h3>Role breakdown</h3>
              <p>Access is enforced by role at the database level</p>
            </div>
          </div>

          <div className="role-breakdown">
            {Object.entries(roleCounts).map(([role, count]) => (
              <span key={role}>
                <i className={`role-dot ${role}`}></i>
                <b className="capitalize">{role}</b>
                <em>{count}</em>
              </span>
            ))}
          </div>

          {!canManage && (
            <p className="subtitle">
              Only IT and CEO accounts can invite people or change roles.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
