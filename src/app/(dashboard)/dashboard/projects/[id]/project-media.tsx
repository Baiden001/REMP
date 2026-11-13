"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/icon";
import { isPhoto } from "@/lib/projects";

export type MediaItem = {
  id: string;
  url: string;
  storage_path: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  // "documents" = uploaded on the Documents page; managed there, shown here.
  source?: "project" | "documents";
};


function fileLabel(item: MediaItem) {
  return item.caption || item.storage_path.split("/").pop()?.replace(/^\d+-/, "") || "File";
}

function useUpload(projectId: string, onDone: () => void) {
  const supabase = createClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ kind: string; text: string } | null>(null);
  const [done, setDone] = useState<{ kind: string; text: string } | null>(null);

  async function upload(files: File[], mediaType: string) {
    if (files.length === 0) return;
    const kind = mediaType === "image" ? "photos" : "files";
    const fail = (text: string) => {
      setError({ kind, text });
      setBusy(null);
    };
    setBusy(kind);
    setError(null);
    setDone(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `projects/${projectId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("property-media").upload(path, file);
      if (uploadError) {
        fail(`Upload failed for ${file.name}: ${uploadError.message}`);
        return;
      }
      const { error: rowError } = await supabase.from("property_media").insert({
        project_id: projectId,
        storage_path: path,
        media_type: mediaType,
        caption: mediaType === "image" ? null : file.name,
        uploaded_by: user?.id,
      });
      if (rowError) {
        await supabase.storage.from("property-media").remove([path]);
        fail(rowError.message.includes("row-level security") ? "You don't have permission to add files to projects." : rowError.message);
        return;
      }
    }

    setBusy(null);
    setDone({ kind, text: `${files.length === 1 ? "File" : `${files.length} files`} uploaded.` });
    onDone();
  }

  return { busy, error, setError, done, upload };
}

export default function ProjectMedia({
  projectId,
  coverMediaId,
  media,
  canManage,
  canSetCover,
}: {
  projectId: string;
  coverMediaId: string | null;
  media: MediaItem[];
  canManage: boolean;
  canSetCover: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const photoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [viewing, setViewing] = useState<MediaItem | null>(null);
  const { busy, error, setError, done, upload } = useUpload(projectId, () => router.refresh());
  const showError = (text: string) => setError({ kind: "photos", text });

  const photos = media.filter(isPhoto);
  const files = media.filter((item) => !isPhoto(item));

  async function setCover(item: MediaItem) {
    setWorking(item.id);
    setError(null);
    const { data, error: coverError } = await supabase
      .from("projects")
      .update({ cover_media_id: item.id })
      .eq("id", projectId)
      .select("id");
    setWorking(null);
    if (coverError || !data?.length) {
      showError(coverError?.message ?? "You don't have permission to change the cover photo.");
      return;
    }
    router.refresh();
  }

  async function remove(item: MediaItem) {
    if (!window.confirm(`Delete ${isPhoto(item) ? "this photo" : `"${fileLabel(item)}"`}? This can't be undone.`)) return;
    setWorking(item.id);
    setError(null);
    const { data, error: deleteError } = await supabase.from("property_media").delete().eq("id", item.id).select("id");
    if (deleteError || !data?.length) {
      setWorking(null);
      setError({
        kind: isPhoto(item) ? "photos" : "files",
        text: deleteError?.message ?? "You don't have permission to delete project files.",
      });
      return;
    }
    await supabase.storage.from("property-media").remove([item.storage_path]);
    if (item.id === coverMediaId) {
      await supabase.from("projects").update({ cover_media_id: null }).eq("id", projectId);
    }
    setWorking(null);
    router.refresh();
  }

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h3>Photos</h3>
            <p>
              {photos.length} photo{photos.length === 1 ? "" : "s"}
              {canSetCover && photos.length > 0 ? " · choose which one appears on the project card" : ""}
            </p>
          </div>
          {canManage && (
            <>
              <button type="button" className="button ghost" disabled={!!busy} onClick={() => photoInput.current?.click()}>
                <Icon name="upload" size={15} /> {busy === "photos" ? "Uploading…" : "Add photos"}
              </button>
              <input
                ref={photoInput}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(event) => {
                  // Copy the files first: clearing the input empties the live
                  // FileList, which would leave nothing to upload.
                  const selected = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  upload(selected, "image");
                }}
              />
            </>
          )}
        </div>

        {error?.kind === "photos" && <p className="media-error">{error.text}</p>}
        {done?.kind === "photos" && <p className="media-done">{done.text}</p>}

        {photos.length === 0 ? (
          <div className="media-empty">
            <Icon name="image" size={26} />
            <p>No photos yet.{canManage ? " Add some to show this project off." : ""}</p>
          </div>
        ) : (
          <div className="photo-grid">
            {photos.map((item) => {
              const isCover = item.id === coverMediaId;
              return (
                <figure key={item.id} className={`photo-tile${isCover ? " is-cover" : ""}`}>
                  <button type="button" className="photo-open" onClick={() => setViewing(item)} aria-label="View photo">
                    <img src={item.url} alt="" loading="lazy" />
                  </button>
                  {isCover && <span className="cover-badge">Cover photo</span>}
                  {(canSetCover || canManage) && (
                    <figcaption>
                      {canSetCover && !isCover && (
                        <button type="button" disabled={working === item.id} onClick={() => setCover(item)}>
                          <Icon name="image" size={13} /> Set as cover
                        </button>
                      )}
                      {canManage && (
                        <button
                          type="button"
                          className="photo-delete"
                          disabled={working === item.id}
                          onClick={() => remove(item)}
                          aria-label="Delete photo"
                        >
                          <Icon name="x" size={13} />
                        </button>
                      )}
                    </figcaption>
                  )}
                </figure>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h3>Brochures &amp; documents</h3>
            <p>Brochures, price lists and floor plans for this project.</p>
          </div>
          {canManage && (
            <>
              <button type="button" className="button ghost" disabled={!!busy} onClick={() => fileInput.current?.click()}>
                <Icon name="upload" size={15} /> {busy === "files" ? "Uploading…" : "Upload file"}
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*"
                multiple
                hidden
                onChange={(event) => {
                  // Copy the files first: clearing the input empties the live
                  // FileList, which would leave nothing to upload.
                  const selected = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  upload(selected, "brochure");
                }}
              />
            </>
          )}
        </div>

        {error?.kind === "files" && <p className="media-error">{error.text}</p>}
        {done?.kind === "files" && <p className="media-done">{done.text}</p>}

        {files.length === 0 ? (
          <div className="media-empty">
            <Icon name="fileText" size={26} />
            <p>No brochures yet.</p>
          </div>
        ) : (
          <ul className="file-list">
            {files.map((item) => (
              <li key={item.id}>
                <Icon name={item.media_type === "floor_plan" ? "floorPlan" : "fileText"} size={18} />
                <span>
                  <b>{fileLabel(item)}</b>
                  <small>
                    {new Date(item.created_at).toLocaleDateString("en-GB")}
                    {item.source === "documents" ? " · from Documents" : ""}
                  </small>
                </span>
                <a href={item.url} target="_blank" rel="noreferrer" className="text-button">
                  Open <Icon name="external" size={12} />
                </a>
                {canManage && item.source !== "documents" && (
                  <button
                    type="button"
                    className="photo-delete"
                    disabled={working === item.id}
                    onClick={() => remove(item)}
                    aria-label={`Delete ${fileLabel(item)}`}
                  >
                    <Icon name="x" size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {viewing && (
        <div className="modal-backdrop photo-viewer" onClick={() => setViewing(null)}>
          <img src={viewing.url} alt="" />
          <button type="button" className="photo-viewer-close" aria-label="Close" onClick={() => setViewing(null)}>
            <Icon name="x" size={22} />
          </button>
        </div>
      )}
    </>
  );
}
