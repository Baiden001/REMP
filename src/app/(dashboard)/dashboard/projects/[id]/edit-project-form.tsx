"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const STATUS_OPTIONS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "off_plan", label: "Off-plan" },
  { value: "under_construction", label: "Under construction" },
  { value: "completed", label: "Completed" },
];

type Project = {
  id: string;
  name: string;
  location: string | null;
  status: string;
  construction_progress: number;
};

export default function EditProjectForm({
  project,
}: {
  project: Project;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError(null);

    const data = new FormData(event.currentTarget);

    const { error } = await supabase
      .from("projects")
      .update({
        name: data.get("name"),
        location: data.get("location"),
        status: data.get("status"),
        construction_progress:
          Number(data.get("progress")) || 0,
      })
      .eq("id", project.id);

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    router.push("/dashboard/projects");
    router.refresh();
  }

  return (
    <div>
      <div className="view-heading">
        <div>
          <p className="eyebrow">PORTFOLIO</p>
          <h1>Edit project</h1>
          <p className="subtitle">
            Update the project information and construction progress.
          </p>
        </div>
      </div>

      <div className="panel" style={{ maxWidth: 700 }}>
        <form onSubmit={handleSubmit}>
          <label>
            Project name
            <input
              required
              name="name"
              defaultValue={project.name}
            />
          </label>

          <label>
            Location
            <input
              required
              name="location"
              defaultValue={project.location ?? ""}
            />
          </label>

          <label>
            Status
            <select
              name="status"
              defaultValue={project.status}
            >
              {STATUS_OPTIONS.map((status) => (
                <option
                  key={status.value}
                  value={status.value}
                >
                  {status.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Construction progress (%)
            <input
              type="number"
              name="progress"
              min={0}
              max={100}
              defaultValue={project.construction_progress}
            />
          </label>

          {error && (
            <p
              style={{
                color: "#c0392b",
                fontSize: 12,
                marginTop: 12,
              }}
            >
              {error}
            </p>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="button ghost"
              disabled={saving}
              onClick={() =>
                router.push("/dashboard/projects")
              }
            >
              Cancel
            </button>

            <button
              type="submit"
              className="button primary"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}