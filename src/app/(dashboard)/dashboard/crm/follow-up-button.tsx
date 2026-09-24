"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/icon";

type FollowUp = {
  id: string;
  follow_up_date: string;
  follow_up_time: string;
  note: string | null;
  status: string;
};

export default function FollowUpButton({
  clientId,
  existingFollowUp,
}: {
  clientId: string;
  existingFollowUp?: FollowUp | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(
    existingFollowUp?.follow_up_date ?? ""
  );

  const [time, setTime] = useState(
    existingFollowUp?.follow_up_time ?? ""
  );

  const [note, setNote] = useState(
    existingFollowUp?.note ?? ""
  );

  function closeModal() {
    if (saving) return;

    setOpen(false);
    setError(null);
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!date || !time) {
      setError("Please select a date and time.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      client_id: clientId,
      follow_up_date: date,
      follow_up_time: time,
      note: note.trim() || null,
      status: "pending",
    };

    let result;

    if (existingFollowUp) {
      result = await supabase
        .from("follow_ups")
        .update(payload)
        .eq("id", existingFollowUp.id);
    } else {
      result = await supabase
        .from("follow_ups")
        .insert(payload);
    }

    if (result.error) {
      setSaving(false);
      setError(result.error.message);
      return;
    }

    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        className="button primary small"
        type="button"
        onClick={() => setOpen(true)}
      >
        {existingFollowUp
          ? "Edit Follow-up"
          : "+ Add Follow-up"}
      </button>

      <div
        className="modal-backdrop"
        hidden={!open}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeModal();
          }
        }}
      >
        <section
          className="modal followup-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="followup-title"
        >
          <button
            className="modal-close"
            type="button"
            aria-label="Close"
            onClick={closeModal}
          >
            <Icon name="x" size={20} />
          </button>

          <p className="eyebrow">CLIENT FOLLOW-UP</p>

          <h2 id="followup-title">
            {existingFollowUp
              ? "Edit Follow-up"
              : "Add Follow-up"}
          </h2>

          <p>
            Set a date and time for the next client follow-up.
            The reminder will appear in notifications.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-pair">
              <label>
                Follow-up date

                <input
                  type="date"
                  value={date}
                  onChange={(event) =>
                    setDate(event.target.value)
                  }
                  required
                />
              </label>

              <label>
                Follow-up time

                <input
                  type="time"
                  value={time}
                  onChange={(event) =>
                    setTime(event.target.value)
                  }
                  required
                />
              </label>
            </div>

            <label>
              Reminder note

              <textarea
                value={note}
                onChange={(event) =>
                  setNote(event.target.value)
                }
                placeholder="e.g. Call client about Parkchester unit availability"
                rows={4}
              />
            </label>

            {error && (
              <p
                style={{
                  color: "#c0392b",
                  fontSize: 12,
                  marginTop: 8,
                }}
              >
                {error}
              </p>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="button ghost"
                onClick={closeModal}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="button primary"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : existingFollowUp
                    ? "Save Changes"
                    : "Add Follow-up"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}