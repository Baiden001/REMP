"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
const FOLDERS = [
  { value: "project_documents", label: "Project documents" },
  { value: "sales_contracts", label: "Sales contracts" },
  { value: "marketing_assets", label: "Marketing assets" },
  { value: "company_docs", label: "Company documents" },
  { value: "general", label: "General" },
];
export default function UploadDocumentButton({
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
    // Capture the form before any await operations.
    const form = event.currentTarget;
    setSaving(true);
    setError(null);
    const data = new FormData(form);
    const file = data.get("file") as File | null;
    const folder = data.get("folder") as string;
    if (!file || file.size === 0) {
      setSaving(false);
      setError("Please select a file.");
      return;
    }
    const path = `documents/${folder}/${Date.now()}-${file.name}`;
    // Upload file to storage.
    const { error: uploadError } = await supabase.storage
      .from("property-media")
      .upload(path, file);
    if (uploadError) {
      setSaving(false);
      setError(`Upload failed: ${uploadError.message}`);
      return;
    }
    // Get currently signed-in user.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // Create document record.
    const { error: insertError } = await supabase
      .from("documents")
      .insert({
        title: data.get("title") || file.name,
        folder,
        project_id: data.get("project_id") || null,
        storage_path: path,
        file_size_bytes: file.size,
        uploaded_by: user?.id,
      });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    // Reset form and close modal.
    form.reset();
    setOpen(false);
    // Refresh the Server Component so the new document appears immediately.
    router.refresh();
  }
  return (
    <>
      <button
        className="button primary"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        ↑ Upload document
      </button>
      <div
        className="modal-backdrop"
        hidden={!open}
        onClick={(e) =>
          e.target === e.currentTarget && setOpen(false)
        }
      >
        <section className="modal" role="dialog" aria-modal="true">
          <button
            className="modal-close"
            aria-label="Close"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
          <p className="eyebrow">DOCUMENTS</p>
          <h2>Upload a document</h2>
          <p>Add a file to the company document library.</p>
          <form onSubmit={handleSubmit}>
            <label>
              Title
              <input
                name="title"
                placeholder="Leave blank to use the filename"
              />
            </label>
            <div className="form-pair">
              <label>
                Folder
                <select name="folder" defaultValue="general">
                  {FOLDERS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Project (optional)
                <select name="project_id" defaultValue="">
                  <option value="">Not project-specific</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              File
              <input required type="file" name="file" />
            </label>
            {error && (
              <p style={{ color: "#c0392b", fontSize: 12 }}>
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="button ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                className="button primary"
                type="submit"
                disabled={saving}
              >
                {saving ? "Uploading…" : "Upload"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}