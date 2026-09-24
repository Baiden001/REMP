import { createClient } from "@/lib/supabase/server";
import UploadDocumentButton from "./upload-document-button";
import Icon, { type IconName } from "@/components/icon";

const FOLDERS: { value: string; label: string; icon: IconName }[] = [
  { value: "project_documents", label: "Project documents", icon: "building" },
  { value: "sales_contracts", label: "Sales contracts", icon: "fileSigned" },
  { value: "marketing_assets", label: "Marketing assets", icon: "megaphone" },
  { value: "company_docs", label: "Company documents", icon: "fileText" },
  { value: "general", label: "General", icon: "folder" },
];

function fileSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
}

function fileIcon(path: string): IconName {
  const ext = path.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext ?? "")) return "image";
  if (ext === "pdf") return "fileText";
  if (["doc", "docx"].includes(ext ?? "")) return "fileText";
  if (["xls", "xlsx"].includes(ext ?? "")) return "fileSheet";
  if (["mp4", "mov", "avi"].includes(ext ?? "")) return "video";
  return "paperclip";
}

export default async function DocumentsPage() {
  const supabase = createClient();

  const [{ data: documents }, { data: projects }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, title, folder, storage_path, file_size_bytes, created_at, projects(name), profiles:uploaded_by(full_name)")
      .order("created_at", { ascending: false }),
    supabase.from("projects").select("id, name").order("name"),
  ]);

  const byFolder = FOLDERS.map((f) => ({
    ...f,
    docs: (documents ?? []).filter((d) => d.folder === f.value),
  }));

  return (
    <div>
      <div className="view-heading">
        <div>
          <p className="eyebrow">DOCUMENTS</p>
          <h1>Documents</h1>
          <p className="subtitle">
            Centralized storage for contracts, brochures, floor plans, and company files.
          </p>
        </div>
        <UploadDocumentButton projects={projects ?? []} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {byFolder.map((folder) => (
          <div className="panel" key={folder.value}>
            <div className="panel-head">
              <div>
                <h3>
                  <span style={{ marginRight: 8, color: "#1f5a44" }}><Icon name={folder.icon} size={16} /></span>
                  {folder.label}
                </h3>
                <p>{folder.docs.length} file{folder.docs.length !== 1 ? "s" : ""}</p>
              </div>
            </div>

            {folder.docs.length === 0 ? (
              <p className="subtitle" style={{ padding: "10px 0" }}>No files in this folder yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>FILE</th>
                      <th>PROJECT</th>
                      <th>UPLOADED BY</th>
                      <th>SIZE</th>
                      <th>DATE</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {folder.docs.map((d) => {
                      const project = d.projects as unknown as { name: string } | null;
                      const uploader = d.profiles as unknown as { full_name: string } | null;
                      const publicUrl = supabase.storage
                        .from("property-media")
                        .getPublicUrl(d.storage_path).data.publicUrl;

                      return (
                        <tr key={d.id}>
                          <td>
                            <span style={{ marginRight: 6, color: "#61786f" }}><Icon name={fileIcon(d.storage_path)} size={15} /></span>
                            <b>{d.title}</b>
                          </td>
                          <td>{project?.name ?? "—"}</td>
                          <td>{uploader?.full_name ?? "—"}</td>
                          <td>{fileSize(d.file_size_bytes)}</td>
                          <td>{new Date(d.created_at).toLocaleDateString("en-GB")}</td>
                          <td>
                            <a
                              href={publicUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: "#1f5a44", fontSize: 11 }}
                            >
                              Open <Icon name="external" size={12} />
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
