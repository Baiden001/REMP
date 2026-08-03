"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const STAGE_OPTIONS = [
  { value: "new", label: "New lead" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "viewing_scheduled", label: "Viewing scheduled" },
  { value: "negotiation", label: "Negotiation" },
  { value: "sale", label: "Sale" },
  { value: "after_sales", label: "After-sales" },
];

export default function LeadCard({
  leadId,
  stage,
  avatarClass,
  avatarInitials,
  name,
  interest,
  addedLabel,
  sourceLabel,
}: {
  leadId: string;
  stage: string;
  avatarClass: string;
  avatarInitials: string;
  name: string;
  interest: string;
  addedLabel: string;
  sourceLabel: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);

  async function handleStageChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const newStage = event.target.value;
    if (newStage === stage) return;

    setSaving(true);

    const { error } = await supabase.from("leads").update({ stage: newStage }).eq("id", leadId);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await supabase.from("lead_activities").insert({
        lead_id: leadId,
        activity_type: "stage_change",
        notes: `Moved from ${stage} to ${newStage}`,
        performed_by: user?.id,
      });
    }

    setSaving(false);
    router.refresh();
  }

  return (
    <article className="lead-card">
      <div className="lead-card-top">
        <i className={`avatar ${avatarClass}`}>{avatarInitials}</i>
        <span>
          <b>{name}</b>
          <small>{interest}</small>
        </span>
      </div>
      <p>Added {addedLabel}</p>
      <div className="lead-card-foot">
        <span className="source-chip">{sourceLabel}</span>
        <select
          value={stage}
          disabled={saving}
          onChange={handleStageChange}
          onClick={(e) => e.stopPropagation()}
          style={{
            border: "1px solid #e3e8ef",
            borderRadius: 5,
            fontSize: 9,
            color: "#61758d",
            background: "#f2f6fa",
            padding: "2px 3px",
          }}
        >
          {STAGE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </article>
  );
}
