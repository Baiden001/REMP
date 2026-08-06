"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ROLE_OPTIONS = [
  { value: "sales", label: "Sales" },
  { value: "marketing", label: "Marketing" },
  { value: "finance", label: "Finance" },
  { value: "management", label: "Management" },
  { value: "it", label: "IT" },
  { value: "ceo", label: "CEO" },
];

export default function InviteMemberButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const form = event.currentTarget;

  setSaving(true);
  setError(null);

  const data = new FormData(form);

  const res = await fetch("/api/invite-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: data.get("email"),
      full_name: data.get("full_name"),
      role: data.get("role"),
    }),
  });

  const body = await res.json();

  setSaving(false);

  if (!res.ok) {
    setError(body.error ?? "Something went wrong.");
    return;
  }

  form.reset();
  setOpen(false);
  router.refresh();
}
  return (
    <>
      <button className="button primary" onClick={() => setOpen(true)}>
        ＋ Invite team member
      </button>

      <div
        className="modal-backdrop"
        hidden={!open}
        onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      >
        <section className="modal" role="dialog" aria-modal="true">
          <button className="modal-close" aria-label="Close" onClick={() => setOpen(false)}>
            ×
          </button>
          <p className="eyebrow">TEAM &amp; ACCESS</p>
          <h2>Invite a team member</h2>
          <p>They'll get an email invite to set their password and sign in.</p>

          <form onSubmit={handleSubmit}>
            <label>
              Full name
              <input required name="full_name" placeholder="e.g. Ama Owusu" />
            </label>
            <label>
              Work email
<input
  required
  type="email"
  name="email"
  placeholder="name@resilienceghana.com"
  pattern="^[^@\s]+@resilienceghana\.com$"
  title="Use a Resilience Estate email address ending in @resilienceghana.com"
/>            </label>
            <label>
              Role
              <select name="role" defaultValue="sales">
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

            {error && <p style={{ color: "#c0392b", fontSize: 12 }}>{error}</p>}

            <div className="modal-actions">
              <button type="button" className="button ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="button primary" type="submit" disabled={saving}>
                {saving ? "Sending invite…" : "Send invite"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
