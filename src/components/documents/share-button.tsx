"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/icon";
import { COMPANY } from "@/lib/brand";

// Ghana numbers: 024 123 4567 → 233241234567 (wa.me wants country code, digits only).
function whatsappNumber(phone: string | null | undefined) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.length === 10 && digits.startsWith("0")) return `233${digits.slice(1)}`;
  if (digits.length === 9) return `233${digits}`;
  return digits;
}

// Creates (or reuses) a no-login link to one invoice or receipt, then offers WhatsApp, email and copy.
export default function ShareButton({
  kind,
  invoiceId,
  paymentId,
  docLabel,
  clientName,
  phone,
  email,
}: {
  kind: "invoice" | "receipt";
  invoiceId?: string;
  paymentId?: string;
  docLabel: string;
  clientName?: string | null;
  phone?: string | null;
  email?: string | null;
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [linkId, setLinkId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const column = kind === "invoice" ? "invoice_id" : "payment_id";
  const targetId = kind === "invoice" ? invoiceId : paymentId;

  async function start() {
    setOpen(true);
    setError(null);
    setCopied(false);
    if (url) return;
    setBusy(true);

    const { data: existing } = await supabase
      .from("share_links")
      .select("id, token")
      .eq(column, targetId!)
      .eq("revoked", false)
      .gt("expires_at", new Date(Date.now() + 7 * 86400000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    let link = existing?.[0] ?? null;
    if (!link) {
      const { data, error: insertError } = await supabase
        .from("share_links")
        .insert({ kind, [column]: targetId })
        .select("id, token")
        .single();
      if (insertError || !data) {
        setError(insertError?.message ?? "You don't have permission to share documents.");
        setBusy(false);
        return;
      }
      link = data;
    }

    setUrl(`${window.location.origin}/share/${link.token}`);
    setLinkId(link.id);
    setBusy(false);
  }

  async function stopSharing() {
    if (!linkId || !window.confirm("Turn off this link? Anyone who has it will no longer be able to open it.")) return;
    setBusy(true);
    const { data, error: updateError } = await supabase
      .from("share_links")
      .update({ revoked: true })
      .eq(column, targetId!)
      .eq("revoked", false)
      .select("id");
    setBusy(false);
    if (updateError || !data?.length) {
      setError(updateError?.message ?? "Could not turn off the link.");
      return;
    }
    setUrl(null);
    setLinkId(null);
    setOpen(false);
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  const greeting = clientName ? `Hello ${clientName.split(" ")[0]},` : "Hello,";
  const message = url ? `${greeting} here is your ${docLabel} from ${COMPANY.name}: ${url}` : "";
  const waNumber = whatsappNumber(phone);
  const waHref = `https://wa.me/${waNumber ?? ""}?text=${encodeURIComponent(message)}`;
  const mailHref = `mailto:${email ?? ""}?subject=${encodeURIComponent(`${docLabel} from ${COMPANY.name}`)}&body=${encodeURIComponent(
    `${message}\n\nThe link works for 90 days. You can print it or save it as PDF from your browser.\n\n${COMPANY.name}`
  )}`;

  return (
    <>
      <button className="button ghost" type="button" onClick={start}>
        <Icon name="share" size={15} /> Share
      </button>

      <div
        className="modal-backdrop"
        hidden={!open}
        onClick={(event) => event.target === event.currentTarget && !busy && setOpen(false)}
      >
        <section className="modal share-modal" role="dialog" aria-modal="true">
          <button className="modal-close" aria-label="Close" onClick={() => !busy && setOpen(false)}>
            <Icon name="x" size={20} />
          </button>
          <p className="eyebrow">SHARE</p>
          <h2>Send {kind === "invoice" ? "invoice" : "receipt"}</h2>
          <p>
            The client opens it with this link, no login needed. It works for 90 days unless you turn it off.
          </p>

          {busy && !url && <p className="field-hint">Creating link…</p>}
          {error && <p style={{ color: "#c0392b", fontSize: 12 }}>{error}</p>}

          {url && (
            <div className="modal-form">
              <div className="share-link-row">
                <input readOnly value={url} onFocus={(event) => event.currentTarget.select()} aria-label="Share link" />
                <button type="button" className="button ghost" onClick={copy}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              <div className="share-options">
                <a className="button primary" href={waHref} target="_blank" rel="noreferrer">
                  <Icon name="message" size={15} /> WhatsApp{waNumber ? "" : " (choose contact)"}
                </a>
                <a className="button ghost" href={mailHref}>
                  <Icon name="mail" size={15} /> Email{email ? "" : " (add address)"}
                </a>
              </div>

              <button type="button" className="text-button muted" disabled={busy} onClick={stopSharing}>
                Stop sharing this link
              </button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
