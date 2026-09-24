"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
const STATUS_OPTIONS = [
  { value: "requested", label: "Requested" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
];
function getStatusStyle(status: string) {
  switch (status) {
    case "confirmed":
      return {
        color: "#1f5a44",
        background: "#effaf6",
        border: "#dbf3e9",
      };
    case "completed":
      return {
        color: "#237a57",
        background: "#eaf8f1",
        border: "#ccebdd",
      };
    case "cancelled":
      return {
        color: "#b23b3b",
        background: "#fff0f0",
        border: "#f1cccc",
      };
    case "no_show":
      return {
        color: "#8a6517",
        background: "#fff8e6",
        border: "#f1dfad",
      };
    case "requested":
    default:
      return {
        color: "#6d7e77",
        background: "#f4f7f6",
        border: "#e2e7e5",
      };
  }
}
export default function ViewingStatusSelect({
  viewingId,
  status,
}: {
  viewingId: string;
  status: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [currentStatus, setCurrentStatus] = useState(status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function handleChange(
    event: React.ChangeEvent<HTMLSelectElement>
  ) {
    const newStatus = event.target.value;
    const previousStatus = currentStatus;
    setSaving(true);
    setError(null);
    setCurrentStatus(newStatus);
    const { error: updateError } = await supabase
      .from("viewings")
      .update({ status: newStatus })
      .eq("id", viewingId);
    if (updateError) {
      console.error("Viewing status update failed:", updateError);
      setCurrentStatus(previousStatus);
      setError("Could not update status.");
      setSaving(false);
      return;
    }
    setSaving(false);
    // Refresh the Server Component so the rest of the page
    // reflects the new status immediately.
    router.refresh();
  }
  const style = getStatusStyle(currentStatus);
  return (
    <div style={{ position: "relative" }}>
      <select
        value={currentStatus}
        disabled={saving}
        onChange={handleChange}
        aria-label="Viewing status"
        style={{
          height: 28,
          border: `1px solid ${style.border}`,
          borderRadius: 6,
          fontSize: 10,
          fontWeight: 600,
          color: style.color,
          background: style.background,
          padding: "0 20px 0 7px",
          cursor: saving ? "wait" : "pointer",
          outline: "none",
          opacity: saving ? 0.65 : 1,
        }}
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <span
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            whiteSpace: "nowrap",
            fontSize: 9,
            color: "#b23b3b",
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}