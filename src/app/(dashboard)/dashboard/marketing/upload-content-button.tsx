"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const CONTENT_TYPES = [
  "Description",
  "Price sheet",
  "Photo",
  "Video",
  "Brochure",
  "Floor plan",
];

export default function UploadContentButton({
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
    const file = data.get("file") as File | null;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let storagePath: string | null = null;

    if (file && file.size > 0) {
      const path = `marketing/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("property-media")
        .upload(path, file);

      if (uploadError) {
        setSaving(false);
        setError(`Upload failed: ${uploadError.message}`);
        return;
      }
      storagePath = path;
    }

    const { error } = await supabase.from("marketing_content").insert({
      title: data.get("title"),
      content_type: (data.get("content_type") as string).toLowerCase().replace(" ", "_"),
      project_id: data.get("project_id") || null,
      storage_path: storagePath,
      approved: false,
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
      <button className="button ghost" onClick={() => setOpen(true)}>
        ↑ Upload content
      </button>

      <div
        className="modal-backdrop"
        hidden={!open}
        onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      >
        <section className="modal" role="dialog" aria-modal="true">
          <button className="modal-close" aria-label="Close" onClick={() => setOpen(false)}>×</button>
          <p className="eyebrow">MARKETING</p>
          <h2>Upload content</h2>
          <p>Add verified property content for the marketing team to use.</p>

          <form onSubmit={handleSubmit}>
            <label>
              Title
              <input required name="title" placeholder="e.g. Cantonments Court — price list Q3" />
            </label>
            <div className="form-pair">
              <label>
                Content type
                <select name="content_type" defaultValue="Description">
                  {CONTENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label>
                Project
                <select name="project_id" defaultValue="">
                  <option value="">Not project-specific</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              File (optional)
              <input type="file" name="file" />
            </label>

            {error && <p style={{ color: "#c0392b", fontSize: 12 }}>{error}</p>}

            <div className="modal-actions">
              <button type="button" className="button ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="button primary" type="submit" disabled={saving}>
                {saving ? "Uploading…" : "Upload"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
