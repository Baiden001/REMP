"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const PLATFORMS = ["Instagram", "Facebook", "TikTok", "LinkedIn"];

export default function AddCampaignButton({
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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("campaigns").insert({
      name: data.get("name"),
      platform: data.get("platform"),
      project_id: data.get("project_id") || null,
      budget: Number(data.get("budget")) || null,
      starts_on: data.get("starts_on") || null,
      ends_on: data.get("ends_on") || null,
      created_by: user?.id,
    });

    setSaving(false);
    if (error) { setError(error.message); return; }

    setOpen(false);
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <>
      <button className="button primary" onClick={() => setOpen(true)}>
        ＋ Add campaign
      </button>

      <div
        className="modal-backdrop"
        hidden={!open}
        onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      >
        <section className="modal" role="dialog" aria-modal="true">
          <button className="modal-close" aria-label="Close" onClick={() => setOpen(false)}>×</button>
          <p className="eyebrow">MARKETING</p>
          <h2>Add a campaign</h2>
          <p>Track a social media or advertising campaign.</p>

          <form onSubmit={handleSubmit}>
            <label>
              Campaign name
              <input required name="name" placeholder="e.g. Cantonments Q3 Instagram Push" />
            </label>
            <div className="form-pair">
              <label>
                Platform
                <select name="platform" defaultValue="Instagram">
                  {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </label>
              <label>
                Project
                <select name="project_id" defaultValue="">
                  <option value="">All projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-pair">
              <label>
                Budget (GH₵)
                <input type="number" name="budget" min={0} placeholder="Optional" />
              </label>
              <label>
                Start date
                <input type="date" name="starts_on" />
              </label>
            </div>
            <label>
              End date
              <input type="date" name="ends_on" />
            </label>

            {error && <p style={{ color: "#c0392b", fontSize: 12 }}>{error}</p>}

            <div className="modal-actions">
              <button type="button" className="button ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="button primary" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Add campaign"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
