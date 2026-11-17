
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/icon";

export type UnitPhoto = {
  id: string;
  storage_path: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  url: string;
};

export default function UnitPhotoGallery({
  photos,
  unitCode,
  canDelete,
}: {
  photos: UnitPhoto[];
  unitCode: string;
  canDelete: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function removePhoto(photo: UnitPhoto) {
    if (
      !window.confirm(
        "Delete this photo? This cannot be undone."
      )
    ) {
      return;
    }

    setWorking(photo.id);
    setError(null);

    const { data, error: deleteError } = await supabase
      .from("property_media")
      .delete()
      .eq("id", photo.id)
      .select("id");

    if (deleteError || !data?.length) {
      setWorking(null);
      setError(
        deleteError?.message ??
          "You don't have permission to delete this photo."
      );
      return;
    }

    const { error: storageError } = await supabase.storage
      .from("property-media")
      .remove([photo.storage_path]);

    setWorking(null);

    if (storageError) {
      setError(
        "The photo record was deleted, but its storage file could not be removed: " +
          storageError.message
      );
    }

    router.refresh();
  }

  return (
    <div>
      {error && (
        <p
          style={{
            color: "#c0392b",
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          {error}
        </p>
      )}

      {photos.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              photos.length === 1
                ? "1fr"
                : "repeat(2, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          {photos.map((photo) => (
            <div
              key={photo.id}
              style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: 10,
                background: "#f3f7f5",
                minHeight: 180,
              }}
            >
              <a
                href={photo.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "block",
                  height: "100%",
                  minHeight: 180,
                }}
              >
                <img
                  src={photo.url}
                  alt={photo.caption ?? `${unitCode} photo`}
                  style={{
                    width: "100%",
                    height: "100%",
                    minHeight: 180,
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </a>

              {canDelete && (
                <button
                  type="button"
                  disabled={working === photo.id}
                  onClick={() => removePhoto(photo)}
                  aria-label="Delete photo"
                  title="Delete photo"
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    width: 30,
                    height: 30,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.95)",
                    color: "#c0392b",
                    cursor:
                      working === photo.id
                        ? "not-allowed"
                        : "pointer",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.16)",
                    opacity: working === photo.id ? 0.5 : 1,
                    zIndex: 2,
                  }}
                >
                  <Icon name="x" size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            minHeight: 260,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
            background: "#f6f9f8",
            color: "#8e9e98",
            fontSize: 12,
          }}
        >
          No photos available for this unit.
        </div>
      )}
    </div>
  );
}
