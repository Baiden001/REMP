import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FollowUpButton from "../follow-up-button";
import { DeleteClientButton, EditClientButton } from "./client-actions";
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

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

export default async function ClientProfilePage({
  params,
}: {
  params: { clientId: string };
}) {
  const supabase = createClient();

  const { data: client, error } = await supabase
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
        id,
        name
      )
    `)
    .eq("id", params.clientId)
    .single();

  if (error || !client) {
    notFound();
  }

  const { data: followUps } = await supabase
    .from("follow_ups")
    .select(`
      id,
      client_id,
      follow_up_date,
      follow_up_time,
      note,
      status,
      created_at,
      updated_at
    `)
    .eq("client_id", client.id)
    .order("follow_up_date", { ascending: false })
    .order("follow_up_time", { ascending: false });

  const { data: projectOptions } = await supabase.from("projects").select("id, name").order("name");

  const allFollowUps = followUps ?? [];

  const pendingFollowUp =
    allFollowUps.find(
      (followUp) => followUp.status === "pending"
    ) ?? null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayString = today.toISOString().split("T")[0];

  const isOverdue =
    pendingFollowUp &&
    pendingFollowUp.follow_up_date < todayString;

  const project = client.projects as unknown as {
    id: string;
    name: string;
  } | null;

  return (
    <div className="view active-view">
      <div className="view-heading">
        <div>
          <Link
            href="/dashboard/crm"
            className="button ghost small"
            style={{ marginBottom: 14 }}
          >
            <Icon name="arrowLeft" size={15} /> Back to Clients
          </Link>

          <p className="eyebrow">CRM / CLIENT PROFILE</p>

          <h1>{client.full_name}</h1>

          <p className="subtitle">
            View client information and manage follow-ups.
          </p>
        </div>

        <div className="hero-actions">
          <EditClientButton
            client={{
              id: client.id,
              full_name: client.full_name,
              phone: client.phone,
              email: client.email,
              location: client.location,
              budget: client.budget === null ? null : Number(client.budget),
              preferred_project_id: client.preferred_project_id,
              notes: client.notes,
            }}
            projects={projectOptions ?? []}
          />
          <DeleteClientButton clientId={client.id} clientName={client.full_name} />
        </div>
      </div>

      <div
        className="split-grid"
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 1.5fr) minmax(280px, 0.8fr)",
          gap: 18,
          alignItems: "start",
        }}
      >
        <section className="panel">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              paddingBottom: 20,
              borderBottom: "1px solid #eff3f1",
            }}
          >
            <div className="avatar navy-avatar">
              {initialsFor(client.full_name)}
            </div>

            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".7px",
                  color: "#909d98",
                  textTransform: "uppercase",
                }}
              >
                Client
              </p>

              <h2
                style={{
                  margin: "5px 0 0",
                  color: "#162a22",
                }}
              >
                {client.full_name}
              </h2>
            </div>
          </div>

          <div
            className="pair-grid"
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0, 1fr))",
              gap: 18,
              marginTop: 22,
            }}
          >
            <div>
              <span className="eyebrow">PHONE</span>
              <strong>
                {client.phone || "Not provided"}
              </strong>
            </div>

            <div>
              <span className="eyebrow">EMAIL</span>
              <strong>
                {client.email || "Not provided"}
              </strong>
            </div>

            <div>
              <span className="eyebrow">LOCATION</span>
              <strong>
                {client.location || "Not specified"}
              </strong>
            </div>

            <div>
              <span className="eyebrow">BUDGET</span>
              <strong>
                {money(
                  client.budget !== null
                    ? Number(client.budget)
                    : null
                )}
              </strong>
            </div>

            <div>
              <span className="eyebrow">
                PROPERTY INTEREST
              </span>

              <strong>
                {project?.name || "No preference yet"}
              </strong>
            </div>

            <div>
              <span className="eyebrow">
                CLIENT SINCE
              </span>

              <strong>
                {formatDate(client.created_at)}
              </strong>
            </div>
          </div>

          <div
            style={{
              marginTop: 24,
              paddingTop: 20,
              borderTop: "1px solid #eff3f1",
            }}
          >
            <span className="eyebrow">CLIENT NOTES</span>

            <p
              style={{
                margin: "8px 0 0",
                color: "#5c6f67",
                lineHeight: 1.6,
              }}
            >
              {client.notes || "No notes have been added."}
            </p>
          </div>
        </section>

        <section className="panel">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <div>
              <span className="eyebrow">
                NEXT FOLLOW-UP
              </span>

              <h3
                style={{
                  margin: "6px 0 0",
                  color: "#162a22",
                }}
              >
                {pendingFollowUp
                  ? isOverdue
                    ? "Follow-up overdue"
                    : "Follow-up scheduled"
                  : "No follow-up"}
              </h3>
            </div>

            {isOverdue && (
              <span className="followup-overdue">
                Overdue
              </span>
            )}
          </div>

          {pendingFollowUp ? (
            <div style={{ marginTop: 18 }}>
              <strong
                style={{
                  display: "block",
                  color: isOverdue
                    ? "#bd4c43"
                    : "#1a3a2d",
                  fontSize: 17,
                }}
              >
                {formatFollowUpDate(
                  pendingFollowUp.follow_up_date,
                  pendingFollowUp.follow_up_time
                )}
              </strong>

              {pendingFollowUp.note && (
                <p
                  style={{
                    margin: "10px 0 18px",
                    color: "#6e8079",
                    lineHeight: 1.5,
                  }}
                >
                  {pendingFollowUp.note}
                </p>
              )}

              <FollowUpButton
                clientId={client.id}
                existingFollowUp={{
                  id: pendingFollowUp.id,
                  follow_up_date:
                    pendingFollowUp.follow_up_date,
                  follow_up_time:
                    pendingFollowUp.follow_up_time,
                  note: pendingFollowUp.note,
                  status: pendingFollowUp.status,
                }}
              />
            </div>
          ) : (
            <div style={{ marginTop: 18 }}>
              <p
                style={{
                  color: "#909d98",
                  marginBottom: 16,
                }}
              >
                There is no pending follow-up for this
                client.
              </p>

              <FollowUpButton
                clientId={client.id}
                existingFollowUp={null}
              />
            </div>
          )}
        </section>
      </div>

      <section
        className="panel"
        style={{ marginTop: 18 }}
      >
        <div>
          <span className="eyebrow">
            FOLLOW-UP HISTORY
          </span>

          <h2
            style={{
              margin: "5px 0 0",
              color: "#162a22",
            }}
          >
            Client follow-ups
          </h2>
        </div>

        {allFollowUps.length === 0 ? (
          <p
            style={{
              marginTop: 18,
              color: "#909d98",
            }}
          >
            No follow-up history yet.
          </p>
        ) : (
          <div style={{ marginTop: 18 }}>
            {allFollowUps.map((followUp) => {
              const overdue =
                followUp.status === "pending" &&
                followUp.follow_up_date < todayString;

              return (
                <div
                  key={followUp.id}
                  style={{
                    display: "flex",
                    gap: 14,
                    padding: "15px 0",
                    borderTop:
                      "1px solid #eff3f1",
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      flexShrink: 0,
                      borderRadius: 9,
                      background: overdue
                        ? "#fceceb"
                        : "#f0f8f5",
                      color: overdue
                        ? "#bd4c43"
                        : "#1a3a2d",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    <Icon name={overdue ? "alert" : "clock"} size={16} />
                  </div>

                  <div style={{ flex: 1 }}>
                    <strong
                      style={{
                        display: "block",
                        color: "#21352d",
                      }}
                    >
                      {formatFollowUpDate(
                        followUp.follow_up_date,
                        followUp.follow_up_time
                      )}
                    </strong>

                    <span
                      style={{
                        display: "inline-block",
                        marginTop: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        color:
                          followUp.status ===
                          "completed"
                            ? "#2f8f68"
                            : overdue
                              ? "#bd4c43"
                              : "#84948e",
                      }}
                    >
                      {overdue
                        ? "Overdue"
                        : followUp.status}
                    </span>

                    {followUp.note && (
                      <p
                        style={{
                          margin: "7px 0 0",
                          color: "#6e8079",
                          fontSize: 12,
                          lineHeight: 1.5,
                        }}
                      >
                        {followUp.note}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section
        className="panel"
        style={{ marginTop: 18 }}
      >
        <div
          className="pair-grid"
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
            gap: 18,
          }}
        >
          <div>
            <span className="eyebrow">
              CREATED
            </span>

            <strong>
              {formatDate(client.created_at)}
            </strong>
          </div>

          <div>
            <span className="eyebrow">
              LAST UPDATED
            </span>

            <strong>
              {formatDate(client.updated_at)}
            </strong>
          </div>
        </div>
      </section>
    </div>
  );
}
