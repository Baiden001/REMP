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

export default function ViewingStatusSelect({
  viewingId,
  status,
}: {
  viewingId: string;
  status: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    setSaving(true);
    await supabase.from("viewings").update({ status: event.target.value }).eq("id", viewingId);
    setSaving(false);
    router.refresh();
  }

  return (
    <select
      defaultValue={status}
      disabled={saving}
      onChange={handleChange}
      style={{
        height: 26,
        border: "1px solid #e1e6ed",
        borderRadius: 5,
        fontSize: 10,
        color: "#3573ba",
        background: "#eaf4ff",
        padding: "0 4px",
      }}
    >
      {STATUS_OPTIONS.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
