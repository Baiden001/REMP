"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/icon";

export default function ScheduleViewingButton({
  clients,
  projects,
}: {
  clients: { id: string; full_name: string; phone: string | null }[];
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  function handleClientChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const selected = clients.find((c) => c.id === event.target.value);
    setPhone(selected?.phone ?? "");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const data = new FormData(event.currentTarget);
    const date = data.get("date") as string;
    const time = data.get("time") as string;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("viewings").insert({
      client_id: data.get("client_id"),
      project_id: data.get("project_id") || null,
      scheduled_at: new Date(`${date}T${time}`).toISOString(),
      assigned_agent: user?.id,
      notes: data.get("notes") || null,
      status: "confirmed",
    });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setOpen(false);
    setPhone("");
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <>
      <button className="button primary" onClick={() => setOpen(true)}>
        <Icon name="plus" size={15} /> Schedule viewing
      </button>

      <div
        className="modal-backdrop"
        hidden={!open}
        onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      >
        <section className="modal" role="dialog" aria-modal="true">
          <button className="modal-close" aria-label="Close" onClick={() => setOpen(false)}>
            <Icon name="x" size={20} />
          </button>
          <p className="eyebrow">VIEWINGS</p>
          <h2>Schedule a viewing</h2>
          <p>Book a client in to see a property.</p>

          <form ref={formRef} onSubmit={handleSubmit}>
            <label>
              Client
              <select required name="client_id" defaultValue="" onChange={handleClientChange}>
                <option value="" disabled>Select a client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}{c.phone ? ` · ${c.phone}` : ""}
                  </option>
                ))}
              </select>
            </label>

            {phone && (
              <label>
                Client phone
                <input
                  readOnly
                  value={phone}
                  style={{ background: "#f6f9f8", color: "#61786f" }}
                />
              </label>
            )}

            <label>
              Project
              <select name="project_id" defaultValue="">
                <option value="">Not sure yet</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <div className="form-pair">
              <label>
                Date
                <input required type="date" name="date" />
              </label>
              <label>
                Time
                <input required type="time" name="time" />
              </label>
            </div>
            <label>
              Notes
              <input name="notes" placeholder="Anything the agent should know" />
            </label>

            {error && <p style={{ color: "#c0392b", fontSize: 12 }}>{error}</p>}

            <div className="modal-actions">
              <button type="button" className="button ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="button primary" type="submit" disabled={saving}>
                {saving ? "Scheduling…" : "Schedule viewing"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
