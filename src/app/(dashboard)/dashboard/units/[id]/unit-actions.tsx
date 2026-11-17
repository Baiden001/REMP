
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UnitActions({
  unitId,
  unitCode,
}: {
  unitId: string;
  unitCode: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete unit "${unitCode}"? This action may be blocked if the unit has related sales, payments or other records.`
    );

    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    const { data, error: deleteError } = await supabase
      .from("units")
      .delete()
      .eq("id", unitId)
      .select("id")
      .maybeSingle();

    if (deleteError || !data) {
      setDeleting(false);
      setError(
        deleteError?.message ??
          "The unit was not deleted. Check its related records and your permissions."
      );
      return;
    }

    router.push("/dashboard/units");
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        className="button ghost"
        disabled={deleting}
        onClick={handleDelete}
        style={{ color: "#c0392b" }}
      >
        {deleting ? "Deleting..." : "Delete unit"}
      </button>

      {error && (
        <p style={{ color: "#c0392b", fontSize: 12, marginTop: 8 }}>
          {error}
        </p>
      )}
    </div>
  );
}
