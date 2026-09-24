import { createClient } from "@/lib/supabase/server";
import CaptureLeadButton from "./capture-lead-button";
import FollowUpButton from "./follow-up-button";
import Icon from "@/components/icon";

function initialsFor(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function money(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "Not specified";
  }

  return `GH₵ ${value.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function CrmPage() {
  const supabase = createClient();

  const [{ data: clients }, { data: projects }] = await Promise.all([
    supabase
      .from("clients")
      .select(`
        id,
        full_name,
        phone,
        email,
        location,
        budget,
        preferred_project_id,
        notes,
        created_at,
        updated_at,
        projects:preferred_project_id (
          name
        )
      `)
      .order("created_at", { ascending: false }),

    supabase
      .from("projects")
      .select("id, name")
      .order("name"),
  ]);

  const clientList = clients ?? [];
  const clientIds = clientList.map((client) => client.id);

  let followUps: {
    id: string;
    client_id: string;
    follow_up_date: string;
    follow_up_time: string;
    note: string | null;
    status: string;
  }[] = [];

  if (clientIds.length > 0) {
    const { data } = await supabase
      .from("follow_ups")
      .select(
        "id, client_id, follow_up_date, follow_up_time, note, status"
      )
      .in("client_id", clientIds)
      .eq("status", "pending")
      .order("follow_up_date", { ascending: true })
      .order("follow_up_time", { ascending: true });

    followUps = data ?? [];
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayString = today.toISOString().split("T")[0];

  const followUpsToday = followUps.filter(
    (followUp) => followUp.follow_up_date === todayString
  ).length;

  const upcomingFollowUps = followUps.filter(
    (followUp) => followUp.follow_up_date > todayString
  ).length;

  const overdueFollowUps = followUps.filter(
    (followUp) => followUp.follow_up_date < todayString
  ).length;

  const clientsWithPropertyInterest = clientList.filter(
    (client) => !!client.preferred_project_id
  ).length;

  function getClientFollowUp(clientId: string) {
    return followUps.find(
      (followUp) => followUp.client_id === clientId
    );
  }

  function formatFollowUpDate(date: string, time: string) {
    const dateTime = new Date(`${date}T${time}`);

    const formattedDate = dateTime.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const formattedTime = dateTime.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return `${formattedDate} · ${formattedTime}`;
  }

  return (
    <div className="view active-view">
      <div className="view-heading">
        <div>
          <p className="eyebrow">CRM</p>

          <h1>Clients</h1>

          <p className="subtitle">
            Manage client interests and keep track of follow-ups.
          </p>
        </div>

        <CaptureLeadButton projects={projects ?? []} />
      </div>

      <div className="crm-overview">
        <div className="crm-overview-header">
          <div>
            <span>PROSPECT OVERVIEW</span>

            <h2>Your client pipeline</h2>

            <p>
              Keep track of prospects, property interests and follow-ups.
            </p>
          </div>

          <div className="crm-overview-icon"><Icon name="pipeline" size={22} /></div>
        </div>

        <div className="crm-overview-stats">
          <article className="crm-stat-card prospects">
            <div className="crm-stat-icon"><Icon name="users" /></div>

            <div>
              <span>TOTAL CLIENTS</span>

              <strong>{clientList.length}</strong>

              <small>All captured clients</small>
            </div>
          </article>

          <article className="crm-stat-card new">
            <div className="crm-stat-icon"><Icon name="home" /></div>

            <div>
              <span>PROPERTY INTEREST</span>

              <strong>{clientsWithPropertyInterest}</strong>

              <small>Clients with an interest</small>
            </div>
          </article>

          <article className="crm-stat-card interest">
            <div className="crm-stat-icon"><Icon name="clock" /></div>

            <div>
              <span>FOLLOW-UPS TODAY</span>

              <strong>{followUpsToday}</strong>

              <small>
                {upcomingFollowUps} upcoming
              </small>
            </div>
          </article>

          <article className="crm-stat-card followup">
            <div className="crm-stat-icon"><Icon name="alert" /></div>

            <div>
              <span>OVERDUE</span>

              <strong>{overdueFollowUps}</strong>

              <small>
                {overdueFollowUps === 0
                  ? "No overdue follow-ups"
                  : "Needs attention"}
              </small>
            </div>
          </article>
        </div>
      </div>

      <div className="client-list">
        {clientList.length === 0 ? (
          <section className="panel crm-empty-state">
            <h3>No clients yet</h3>

            <p>
              Add your first client to start tracking property
              interests and follow-ups.
            </p>
          </section>
        ) : (
          clientList.map((client) => {
            const project = client.projects as unknown as {
              name: string;
            } | null;

            const followUp = getClientFollowUp(client.id);

            const isOverdue =
              followUp &&
              followUp.follow_up_date < todayString;

            return (
              <article
                className="client-card"
                key={client.id}
              >
                <div className="client-card-header">
                  <div className="client-identity">
                    <div className="avatar navy-avatar">
                      {initialsFor(client.full_name)}
                    </div>

                    <div>
                      <h3>{client.full_name}</h3>

                      <div className="client-contact">
                        {client.phone && (
                          <span>{client.phone}</span>
                        )}

                        {client.email && (
                          <span>{client.email}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="client-card-details">
                  <div>
                    <span>PROPERTY INTEREST</span>

                    <strong>
                      {project?.name ?? "No preference yet"}
                    </strong>
                  </div>

                  <div>
                    <span>LOCATION</span>

                    <strong>
                      {client.location || "Not specified"}
                    </strong>
                  </div>

                  <div>
                    <span>BUDGET</span>

                    <strong>
                      {money(
                        client.budget !== null
                          ? Number(client.budget)
                          : null
                      )}
                    </strong>
                  </div>
                </div>

                {client.notes && (
                  <div className="client-notes">
                    <span>NOTES</span>

                    <p>{client.notes}</p>
                  </div>
                )}

                <div className="client-followup">
                  <div>
                    <span>NEXT FOLLOW-UP</span>

                    {followUp ? (
                      <>
                        <strong
                          className={
                            isOverdue
                              ? "followup-overdue"
                              : ""
                          }
                        >
                          {formatFollowUpDate(
                            followUp.follow_up_date,
                            followUp.follow_up_time
                          )}
                        </strong>

                        {followUp.note && (
                          <small>{followUp.note}</small>
                        )}

                        {isOverdue && (
                          <em>Overdue</em>
                        )}
                      </>
                    ) : (
                      <strong className="followup-none">
                        No follow-up scheduled
                      </strong>
                    )}
                  </div>

                  <div className="client-card-actions">
 <a
  className="button ghost small"
  href={`/dashboard/crm/${client.id}`}
>
  View Client
</a>

  <FollowUpButton
    clientId={client.id}
    existingFollowUp={followUp}
  />
</div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}