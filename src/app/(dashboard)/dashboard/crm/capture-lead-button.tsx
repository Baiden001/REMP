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

    const data = new FormData(event.currentTarget);
    const interestProjectId = data.get("interest") as string;

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert({
        full_name: data.get("name"),
        phone: data.get("phone"),
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
    event.currentTarget.reset();
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
        <section className="modal" role="dialog" aria-modal="true">
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
