"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ROLES = [
  "ceo",
  "management",
  "sales",
  "marketing",
  "finance",
  "legal",
  "administration",
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

  async function handleChange(
    event: React.ChangeEvent<HTMLSelectElement>
  ) {
    const newRole = event.target.value;

    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", profileId);

    if (error) {
      alert(`Could not update role: ${error.message}`);
      setSaving(false);
      return;
    }

    setSaving(false);
    router.refresh();
  }

  return (
    <select
      value={currentRole}
      disabled={saving}
      onChange={handleChange}
      style={{
        height: 28,
        border: "1px solid #dce4ed",
        borderRadius: 6,
        fontSize: 11,
        color: "#223b59",
        background: "#fff",
        cursor: saving ? "default" : "pointer",
      }}
    >
      {ROLES.map((role) => (
        <option key={role} value={role}>
          {role}
        </option>
      ))}
    </select>
  );
}