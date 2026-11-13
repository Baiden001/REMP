"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/icon";

const STATUS_OPTIONS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "off_plan", label: "Off-plan" },
  { value: "under_construction", label: "Under construction" },
  { value: "completed", label: "Completed" },
];

export default function AddProjectButton() {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    // Keep a reference now: React clears event.currentTarget once the handler
    // has awaited anything, so it can't be used later to reset the form.
    const form = event.currentTarget;
    const data = new FormData(form);
    const photo = data.get("photo") as File | null;

    const { data: inserted, error } = await supabase
      .from("projects")
      .insert({
        name: data.get("name"),
        location: data.get("location"),
        status: data.get("status"),
        construction_progress: Number(data.get("progress")) || 0,
      })
      .select("id")
      .single();

    if (error) {
      setSaving(false);
      setError(error.message);
      return;
    }

    // Upload the cover photo, if one was chosen, then link it to the project.
    if (photo && photo.size > 0) {
      // File names with spaces, brackets or special characters (phone and Mac
      // screenshots often have them) make Supabase reject the upload as an
      // "Invalid key", so clean the name first.
      const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `projects/${inserted.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("property-media")
        .upload(path, photo);

      if (uploadError) {
        setSaving(false);
        setError(`Project created, but the photo failed to upload: ${uploadError.message}`);
        return;
      }

      const { error: mediaError } = await supabase.from("property_media").insert({
        project_id: inserted.id,
        storage_path: path,
        media_type: "image",
      });

      if (mediaError) {
        // Don't leave an orphaned file behind, and say what went wrong.
        await supabase.storage.from("property-media").remove([path]);
        setSaving(false);
        setError(
          `Project created, but the photo could not be saved: ${
            mediaError.message.includes("row-level security")
              ? "your role can't add photos."
              : mediaError.message
          }`
        );
        router.refresh();
        return;
      }
    }

    setSaving(false);
    setOpen(false);
    form.reset();
    router.refresh();
  }

  return (
    <>
      <button className="button primary" onClick={() => setOpen(true)}>
        <Icon name="plus" size={15} /> Add project
      </button>

      <div className="modal-backdrop" hidden={!open} onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
        <section className="modal" role="dialog" aria-modal="true">
          <button className="modal-close" aria-label="Close" onClick={() => setOpen(false)}>
            <Icon name="x" size={20} />
          </button>
          <p className="eyebrow">PORTFOLIO</p>
          <h2>Add a project</h2>
          <p>Create a new development to start tracking its units and progress.</p>

          <form onSubmit={handleSubmit}>
            <label>
              Project name
              <input required name="name" placeholder="e.g. Cantonments Court" />
            </label>
            <div className="form-pair">
              <label>
                Location
                <input required name="location" placeholder="e.g. Cantonments, Accra" />
              </label>
              <label>
                Status
                <select name="status" defaultValue="upcoming">
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Construction progress (%)
              <input type="number" name="progress" min={0} max={100} defaultValue={0} />
            </label>
            <label>
              Cover photo (optional)
              <input type="file" name="photo" accept="image/*" />
            </label>

            {error && <p style={{ color: "#c0392b", fontSize: 12 }}>{error}</p>}

            <div className="modal-actions">
              <button type="button" className="button ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="button primary" type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create project"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
