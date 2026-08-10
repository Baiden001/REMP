"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ProjectActions({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${projectName}"? This will also delete its units and related project media.`
    );

    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (error) {
      setError(error.message);
      setDeleting(false);
      return;
    }

    setDeleting(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Actions for ${projectName}`}
        style={{
          width: 32,
          height: 32,
          border: "1px solid #dce4ed",
          borderRadius: 7,
          background: "#fff",
          color: "#566a83",
          cursor: "pointer",
          fontSize: 18,
          lineHeight: 1,
        }}
      >
        ⋮
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: 38,
            right: 0,
            zIndex: 20,
            width: 140,
            padding: 5,
            background: "#fff",
            border: "1px solid #e1e7ee",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(25, 45, 70, 0.12)",
          }}
        >
          <button
            type="button"
            onClick={() => router.push(`/dashboard/projects/${projectId}/edit`)}
            style={{
              display: "block",
              width: "100%",
              padding: "8px 10px",
              border: 0,
              background: "transparent",
              textAlign: "left",
              cursor: "pointer",
              fontSize: 12,
              color: "#223b59",
            }}
          >
            Edit
          </button>

          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            style={{
              display: "block",
              width: "100%",
              padding: "8px 10px",
              border: 0,
              background: "transparent",
              textAlign: "left",
              cursor: deleting ? "default" : "pointer",
              fontSize: 12,
              color: "#c0392b",
            }}
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>

          {error && (
            <p
              style={{
                margin: "6px 8px",
                fontSize: 10,
                color: "#c0392b",
              }}
            >
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}