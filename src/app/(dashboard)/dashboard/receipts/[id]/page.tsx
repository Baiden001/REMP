import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

function gh(value: number) {
  return `GH₵${value.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function ReceiptPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const { data: receipt } = await supabase
    .from("receipts")
    .select(
      `
      id,
      receipt_number,
      amount,
      issued_at,
      sales(
        sale_date,
        clients(full_name, phone, email),
        units(
          unit_code,
          unit_type,
          projects(name, location)
        )
      )
      `
    )
    .eq("id", params.id)
    .single();

  if (!receipt) notFound();

  const sale = receipt.sales as unknown as {
    sale_date: string;
    clients: {
      full_name: string;
      phone: string | null;
      email: string | null;
    } | null;
    units: {
      unit_code: string;
      unit_type: string;
      projects: {
        name: string;
        location: string | null;
      } | null;
    } | null;
  } | null;

  const client = sale?.clients;
  const unit = sale?.units;
  const project = unit?.projects;

  return (
    <div style={{ maxWidth: 850, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <div>
          <p className="eyebrow">PAYMENT RECEIPT</p>
          <h1>Receipt</h1>
          <p className="subtitle">
            Official payment receipt issued by Resilience Estate Ltd.
          </p>
        </div>

        <Link
          href="/dashboard/sales"
          className="button ghost"
          style={{ textDecoration: "none" }}
        >
          ← Back to sales
        </Link>
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid #dfe6ee",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 10px 30px rgba(25, 45, 70, 0.06)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "28px 32px",
            borderBottom: "1px solid #e8edf2",
            display: "flex",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img
              src="/images/resilience-logo-bg.PNG"
              alt="Resilience Estate"
              style={{
                width: 58,
                height: 58,
                objectFit: "contain",
              }}
            />

            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 20,
                  color: "#17395f",
                }}
              >
                RESILIENCE ESTATE LTD
              </h2>

              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 10,
                  color: "#8794a5",
                  letterSpacing: 1,
                }}
              >
                PROPERTY DEVELOPMENT &amp; REAL ESTATE
              </p>
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <p
              style={{
                margin: 0,
                fontSize: 10,
                color: "#8794a5",
                letterSpacing: 1,
              }}
            >
              RECEIPT NO.
            </p>

            <strong
              style={{
                display: "block",
                marginTop: 5,
                fontSize: 17,
                color: "#17395f",
              }}
            >
              {receipt.receipt_number}
            </strong>

            <p
              style={{
                margin: "5px 0 0",
                fontSize: 11,
                color: "#68788c",
              }}
            >
              {new Date(receipt.issued_at).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* Amount */}
        <div
          style={{
            padding: "25px 32px",
            background: "#f5f8fb",
            borderBottom: "1px solid #e5ebf1",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 10,
              color: "#8794a5",
              letterSpacing: 1,
            }}
          >
            AMOUNT RECEIVED
          </p>

          <h1
            style={{
              margin: "7px 0 0",
              fontSize: 32,
              color: "#17395f",
            }}
          >
            {gh(Number(receipt.amount))}
          </h1>
        </div>

        {/* Details */}
        <div
          style={{
            padding: "28px 32px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 35,
          }}
        >
          <div>
            <h3
              style={{
                margin: "0 0 12px",
                fontSize: 12,
                color: "#17395f",
                letterSpacing: 1,
              }}
            >
              RECEIVED FROM
            </h3>

            <p style={{ margin: "0 0 8px", fontWeight: 700 }}>
              {client?.full_name ?? "—"}
            </p>

            {client?.phone && (
              <p style={{ margin: "4px 0", fontSize: 12, color: "#68788c" }}>
                {client.phone}
              </p>
            )}

            {client?.email && (
              <p style={{ margin: "4px 0", fontSize: 12, color: "#68788c" }}>
                {client.email}
              </p>
            )}
          </div>

          <div>
            <h3
              style={{
                margin: "0 0 12px",
                fontSize: 12,
                color: "#17395f",
                letterSpacing: 1,
              }}
            >
              PROPERTY
            </h3>

            <p style={{ margin: "0 0 8px", fontWeight: 700 }}>
              {project?.name ?? "—"}
            </p>

            <p style={{ margin: "4px 0", fontSize: 12, color: "#68788c" }}>
              Unit: {unit?.unit_code ?? "—"}
            </p>

            <p style={{ margin: "4px 0", fontSize: 12, color: "#68788c" }}>
              Type: {unit?.unit_type ?? "—"}
            </p>

            {project?.location && (
              <p style={{ margin: "4px 0", fontSize: 12, color: "#68788c" }}>
                Location: {project.location}
              </p>
            )}
          </div>
        </div>

        {/* Payment purpose */}
        <div
          style={{
            margin: "0 32px",
            padding: "18px 0",
            borderTop: "1px solid #e8edf2",
            borderBottom: "1px solid #e8edf2",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 10,
              color: "#8794a5",
              letterSpacing: 1,
            }}
          >
            PAYMENT FOR
          </p>

          <p
            style={{
              margin: "7px 0 0",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Property purchase instalment
          </p>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "28px 32px",
            display: "flex",
            justifyContent: "space-between",
            gap: 40,
          }}
        >
          <div style={{ maxWidth: 420 }}>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                color: "#68788c",
                lineHeight: 1.6,
              }}
            >
              This receipt confirms payment received by Resilience Estate Ltd.
              Please retain this document for your records.
            </p>
          </div>

          <div
            style={{
              minWidth: 160,
              textAlign: "center",
            }}
          >
            <div
              style={{
                height: 45,
                borderBottom: "1px solid #8794a5",
              }}
            />

            <p
              style={{
                margin: "7px 0 0",
                fontSize: 10,
                color: "#68788c",
              }}
            >
              AUTHORIZED SIGNATURE
            </p>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: 16,
        }}
      >
        <button
          className="button primary"
          onClick={() => {}}
          style={{ fontSize: 11 }}
        >
          Print receipt
        </button>
      </div>
    </div>
  );
}