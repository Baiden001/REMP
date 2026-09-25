"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const PROJECT_STAGES = [
  { value: "upcoming", label: "Upcoming" },
  { value: "off_plan", label: "Off-plan" },
  { value: "under_construction", label: "Under construction" },
  { value: "completed", label: "Completed" },
];

export default function StatusPanel({
  projectId,
  status,
  progress,
  canEdit,
}: {
  projectId: string;
  status: string;
  progress: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const initialStage = Math.max(0, PROJECT_STAGES.findIndex((s) => s.value === status));
  const [stage, setStage] = useState(initialStage);
  const [percent, setPercent] = useState(progress);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const changed = stage !== initialStage || percent !== progress;

  async function save() {
    setSaving(true);
    setMessage(null);
    const { data, error } = await supabase
      .from("projects")
      .update({
        status: PROJECT_STAGES[stage].value,
        construction_progress: percent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)
      .select("id");
    setSaving(false);

    if (error || !data?.length) {
      setMessage({ ok: false, text: error?.message ?? "You don't have permission to update this project." });
      return;
    }
    setMessage({ ok: true, text: "Saved." });
    router.refresh();
  }

  return (
    <section className="panel status-panel">
      <div className="panel-head">
        <div>
          <h3>Status &amp; progress</h3>
          <p>{canEdit ? "Drag the sliders, then save." : "Current stage and construction progress."}</p>
        </div>
      </div>

      <div className="slider-block">
        <div className="slider-label">
          <span>Stage</span>
          <b>{PROJECT_STAGES[stage].label}</b>
        </div>
        <input
          type="range"
          min={0}
          max={PROJECT_STAGES.length - 1}
          step={1}
          value={stage}
          disabled={!canEdit}
          onChange={(event) => setStage(Number(event.target.value))}
          aria-label="Project stage"
          style={{ ["--fill" as string]: `${(stage / (PROJECT_STAGES.length - 1)) * 100}%` }}
        />
        <div className="slider-stops">
          {PROJECT_STAGES.map((s, index) => (
            <button
              key={s.value}
              type="button"
              disabled={!canEdit}
              className={index <= stage ? "reached" : ""}
              onClick={() => setStage(index)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="slider-block">
        <div className="slider-label">
          <span>Construction progress</span>
          <b>{percent}%</b>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={percent}
          disabled={!canEdit}
          onChange={(event) => setPercent(Number(event.target.value))}
          aria-label="Construction progress"
          style={{ ["--fill" as string]: `${percent}%` }}
        />
        <div className="slider-scale">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {canEdit && (
        <div className="status-actions">
          {message && <span className={message.ok ? "save-ok" : "save-error"}>{message.text}</span>}
          <button
            type="button"
            className="button ghost"
            disabled={!changed || saving}
            onClick={() => {
              setStage(initialStage);
              setPercent(progress);
              setMessage(null);
            }}
          >
            Reset
          </button>
          <button type="button" className="button primary" disabled={!changed || saving} onClick={save}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </section>
  );
}
