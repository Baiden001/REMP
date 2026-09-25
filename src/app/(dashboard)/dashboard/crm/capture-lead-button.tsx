"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/icon";

const SOURCE_MAP: Record<string, string> = {
  Website: "website",
  Instagram: "instagram",
  Referral: "referral",
  "Walk-in": "walk_in",
};

export default function CaptureLeadButton({
  projects,
}: {
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const text = (key: string) => ((data.get(key) as string) ?? "").trim() || null;
    const budget = data.get("budget") ? Number(data.get("budget")) : null;
    const interestProjectId = data.get("interest") as string;

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert({
        full_name: text("name"),
        phone: text("phone"),
        email: text("email"),
        location: text("location"),
        budget: budget && budget > 0 ? budget : null,
        notes: text("notes"),
        preferred_project_id: interestProjectId || null,
      })
      .select("id")
      .single();

    if (clientError) {
      setSaving(false);
      setError(clientError.message);
      return;
    }

    const { error: leadError } = await supabase.from("leads").insert({
      client_id: client.id,
      source: SOURCE_MAP[data.get("source") as string] ?? "other",
      stage: "new",
    });

    setSaving(false);

    if (leadError) {
      setError(leadError.message);
      return;
    }

    setOpen(false);
    form.reset();
    router.refresh();
  }

  return (
    <>
      <button className="button primary" onClick={() => setOpen(true)}>
        <Icon name="plus" size={15} /> Capture lead
      </button>

      <div
        className="modal-backdrop"
        hidden={!open}
        onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      >
        <section className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 520, maxHeight: "92vh", overflowY: "auto" }}>
          <button className="modal-close" aria-label="Close" onClick={() => setOpen(false)}>
            <Icon name="x" size={20} />
          </button>
          <p className="eyebrow">CRM</p>
          <h2>Capture a new lead</h2>
          <p>Assign the right owner and keep every opportunity moving.</p>

          <form onSubmit={handleSubmit}>
            <label>
              Full name
              <input required name="name" placeholder="e.g. Nana Owusu" />
            </label>
            <div className="form-pair">
              <label>
                Phone
                <input required name="phone" placeholder="+233 24 000 0000" />
              </label>
              <label>
                Lead source
                <select name="source" defaultValue="Website">
                  {Object.keys(SOURCE_MAP).map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-pair">
              <label>
                Email
                <input type="email" name="email" placeholder="client@example.com" />
              </label>
              <label>
                Location
                <input name="location" placeholder="e.g. East Legon, Accra" />
              </label>
            </div>
            <label>
              Budget (GH₵)
              <input type="number" name="budget" min="0" step="0.01" placeholder="e.g. 850000" />
            </label>
            <label>
              Property interest
              <select name="interest" defaultValue="">
                <option value="">No preference yet</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Notes
              <textarea name="notes" rows={2} placeholder="e.g. Wants a 3 bedroom with sea view" />
            </label>

            {error && <p style={{ color: "#c0392b", fontSize: 12 }}>{error}</p>}

            <div className="modal-actions">
              <button type="button" className="button ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="button primary" type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create lead"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
