"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/icon";
import { COMPANY } from "@/lib/brand";

type ResetRequest = {
  id: string;
  email: string;
  note: string | null;
  status: "pending" | "approved" | "declined";
  requested_at: string;
  handled_at: string | null;
  name: string;
  phone: string | null;
  handledBy: string | null;
};

function whatsappNumber(phone: string | null) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 && digits.startsWith("0")) return `233${digits.slice(1)}`;
  return digits;
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Forgotten-password requests: approve to get a one-time link to send, or decline.
export default function ResetRequests({ requests }: { requests: ResetRequest[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ request: ResetRequest; link: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function act(request: ResetRequest, action: "approve" | "decline") {
    if (action === "decline" && !window.confirm(`Decline the password request from ${request.name}?`)) return;
    setBusy(request.id);
    setError(null);
    const res = await fetch(`/api/password-reset/${request.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      return;
    }
    if (action === "approve") {
      setCopied(false);
      setIssued({ request, link: json.link });
    }
    router.refresh();
  }

  async function copy() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.link);
      setCopied(true);
    } catch {
      window.prompt("Copy this link", issued.link);
    }
  }

  const pending = requests.filter((r) => r.status === "pending");
  const recent = requests.filter((r) => r.status !== "pending").slice(0, 5);

  const message = issued
    ? `Hello ${issued.request.name.split(" ")[0]}, here is your link to set a new REMP password: ${issued.link}\n\nIt works once and expires in about an hour. — ${COMPANY.name} IT`
    : "";

  return (
    <div className="panel" style={{ marginTop: 18 }}>
      <div className="panel-head">
        <div>
          <h3>Password reset requests</h3>
          <p>
            {pending.length > 0
              ? `${pending.length} waiting. Check it's really them before approving.`
              : "Staff who forget their password can ask from the sign-in page."}
          </p>
        </div>
      </div>

      {error && <p style={{ color: "#c0392b", fontSize: 12 }}>{error}</p>}

      <div className="reset-list">
        {pending.map((r) => (
          <div className="reset-row" key={r.id}>
            <span className="reset-who">
              <b>{r.name}</b>
              <small>
                {r.email} · {when(r.requested_at)}
              </small>
              {r.note && <em>&ldquo;{r.note}&rdquo;</em>}
            </span>
            <span className="reset-actions">
              <button type="button" className="button ghost small" disabled={busy === r.id} onClick={() => act(r, "decline")}>
                Decline
              </button>
              <button type="button" className="button primary small" disabled={busy === r.id} onClick={() => act(r, "approve")}>
                {busy === r.id ? "Working…" : "Approve & get link"}
              </button>
            </span>
          </div>
        ))}

        {recent.map((r) => (
          <div className="reset-row done" key={r.id}>
            <span className="reset-who">
              <b>{r.name}</b>
              <small>
                {r.status === "approved" ? "Link sent" : "Declined"}
                {r.handledBy ? ` by ${r.handledBy}` : ""}
                {r.handled_at ? ` · ${when(r.handled_at)}` : ""}
              </small>
            </span>
            {r.status === "approved" && (
              <span className="reset-actions">
                <button type="button" className="text-button" disabled={busy === r.id} onClick={() => act(r, "approve")}>
                  New link
                </button>
              </span>
            )}
          </div>
        ))}

        {requests.length === 0 && <p className="field-hint">No requests yet.</p>}
      </div>

      <div className="modal-backdrop" hidden={!issued} onClick={(e) => e.target === e.currentTarget && setIssued(null)}>
        {issued && (
          <section className="modal share-modal" role="dialog" aria-modal="true">
            <button className="modal-close" aria-label="Close" onClick={() => setIssued(null)}>
              <Icon name="x" size={20} />
            </button>
            <p className="eyebrow">PASSWORD RESET</p>
            <h2>Send this link to {issued.request.name.split(" ")[0]}</h2>
            <p>
              It opens a page to set a new password. It works once, expires in about an hour, and stops working if you
              create a newer link. Only send it to them directly.
            </p>
            <div className="modal-form">
              <div className="share-link-row">
                <input readOnly value={issued.link} onFocus={(e) => e.currentTarget.select()} aria-label="Reset link" />
                <button type="button" className="button ghost" onClick={copy}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="share-options">
                <a
                  className="button primary"
                  href={`https://wa.me/${whatsappNumber(issued.request.phone)}?text=${encodeURIComponent(message)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon name="message" size={15} /> WhatsApp
                </a>
                <a
                  className="button ghost"
                  href={`mailto:${issued.request.email}?subject=${encodeURIComponent("Your REMP password reset link")}&body=${encodeURIComponent(message)}`}
                >
                  <Icon name="mail" size={15} /> Email
                </a>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
