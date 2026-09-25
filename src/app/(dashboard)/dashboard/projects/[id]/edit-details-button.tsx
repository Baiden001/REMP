"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/icon";

export default function EditDetailsButton({
  project,
}: {
  project: {
    id: string;
    name: string;
    location: string | null;
    description: string | null;
    expected_completion: string | null;
  };
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
    const text = (key: string) => ((data.get(key) as string) ?? "").trim() || null;

    const { data: updated, error: updateError } = await supabase
      .from("projects")
      .update({
        name: text("name"),
        location: text("location"),
        description: text("description"),
        expected_completion: text("expected_completion"),
        updated_at: new Date().toISOString(),
      })
      .eq("id", project.id)
      .select("id");

    setSaving(false);
    if (updateError || !updated?.length) {
      setError(updateError?.message ?? "You don't have permission to edit this project.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        className="button primary"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Icon name="fileText" size={15} /> Edit details
      </button>

      <div
        className="modal-backdrop"
        hidden={!open}
        onClick={(event) => event.target === event.currentTarget && !saving && setOpen(false)}
      >
        <section className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 540, maxHeight: "92vh", overflowY: "auto" }}>
          <button className="modal-close" aria-label="Close" onClick={() => !saving && setOpen(false)}>
            <Icon name="x" size={20} />
          </button>
          <p className="eyebrow">PORTFOLIO</p>
          <h2>Edit project details</h2>
          <p>Name, location, description and expected completion.</p>

          <form onSubmit={handleSubmit} key={open ? "open" : "closed"}>
            <label>
              Project name
              <input required name="name" defaultValue={project.name} />
            </label>
            <label>
              Location
              <input name="location" defaultValue={project.location ?? ""} placeholder="e.g. Airport West, Accra" />
            </label>
            <label>
              Expected completion
              <input type="date" name="expected_completion" defaultValue={project.expected_completion ?? ""} />
            </label>
            <label>
              Description
              <textarea
                name="description"
                rows={5}
                defaultValue={project.description ?? ""}
                placeholder="What makes this project special — amenities, finishes, nearby landmarks…"
              />
            </label>

            {error && <p style={{ color: "#c0392b", fontSize: 12 }}>{error}</p>}

            <div className="modal-actions">
              <button type="button" className="button ghost" disabled={saving} onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="button primary" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
