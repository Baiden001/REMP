"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ROLES = [
  "ceo",
  "management",
  "administration",
  "sales",
  "marketing",
  "finance",
  "legal",
  "it",
];
export default function RoleSelect({
  profileId,
  currentRole,
  canEdit,
}: {
  profileId: string;
  currentRole: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);

  if (!canEdit) {
    return <span className="capitalize">{currentRole}</span>;
  }

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    setSaving(true);
    await supabase.from("profiles").update({ role: event.target.value }).eq("id", profileId);
    setSaving(false);
    router.refresh();
  }

  return (
    <select
      defaultValue={currentRole}
      disabled={saving}
      onChange={handleChange}
      style={{
        height: 28,
        border: "1px solid #dce4ed",
        borderRadius: 6,
        fontSize: 11,
        color: "#223b59",
      }}
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  );
}
