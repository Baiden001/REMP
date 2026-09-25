"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/icon";

export type EditableClient = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  location: string | null;
  budget: number | null;
  preferred_project_id: string | null;
  notes: string | null;
};

export function EditClientButton({
  client,
  projects,
}: {
  client: EditableClient;
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const data = new FormData(event.currentTarget);
    const text = (key: string) => ((data.get(key) as string) ?? "").trim() || null;
    const budget = data.get("budget") ? Number(data.get("budget")) : null;

    if (!text("full_name")) {
      setError("Please enter the client's name.");
      setSaving(false);
      return;
    }

    const { data: updated, error: updateError } = await supabase
      .from("clients")
      .update({
        full_name: text("full_name"),
        phone: text("phone"),
        email: text("email"),
        location: text("location"),
        budget: budget && budget > 0 ? budget : null,
        preferred_project_id: text("preferred_project_id"),
        notes: text("notes"),
        updated_at: new Date().toISOString(),
      })
      .eq("id", client.id)
      .select("id");

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    if (!updated || updated.length === 0) {
      setError("You don't have permission to edit clients. Ask a manager or IT.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        className="button primary"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Icon name="fileText" size={15} /> Edit client
      </button>

      <div
        className="modal-backdrop"
        hidden={!open}
        onClick={(event) => event.target === event.currentTarget && !saving && setOpen(false)}
      >
        <section
          className="modal"
          role="dialog"
          aria-modal="true"
          style={{ maxWidth: 520, maxHeight: "92vh", overflowY: "auto" }}
        >
          <button className="modal-close" aria-label="Close" onClick={() => !saving && setOpen(false)}>
            <Icon name="x" size={20} />
          </button>
          <p className="eyebrow">CRM</p>
          <h2>Edit client</h2>
          <p>Update this client&apos;s contact details, budget and interests.</p>

          {/* key resets the fields to the saved values each time it opens */}
          <form onSubmit={handleSubmit} key={open ? "open" : "closed"}>
            <label>
              Full name
              <input required name="full_name" defaultValue={client.full_name} />
            </label>
            <div className="form-pair">
              <label>
                Phone
                <input name="phone" defaultValue={client.phone ?? ""} placeholder="+233 24 000 0000" />
              </label>
              <label>
                Email
                <input type="email" name="email" defaultValue={client.email ?? ""} placeholder="client@example.com" />
              </label>
            </div>
            <div className="form-pair">
              <label>
                Location
                <input name="location" defaultValue={client.location ?? ""} placeholder="e.g. East Legon, Accra" />
              </label>
              <label>
                Budget (GH₵)
                <input
                  type="number"
                  name="budget"
                  min="0"
                  step="0.01"
                  defaultValue={client.budget ?? ""}
                  placeholder="e.g. 850000"
                />
              </label>
            </div>
            <label>
              Property interest
              <select name="preferred_project_id" defaultValue={client.preferred_project_id ?? ""}>
                <option value="">No preference yet</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Notes
              <textarea name="notes" rows={3} defaultValue={client.notes ?? ""} />
            </label>

            {error && <p style={{ color: "#c0392b", fontSize: 12 }}>{error}</p>}

            <div className="modal-actions">
              <button type="button" className="button ghost" disabled={saving} onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="button primary" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}

export function DeleteClientButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    const { data: deleted, error: deleteError } = await supabase
      .from("clients")
      .delete()
      .eq("id", clientId)
      .select("id");

    if (deleteError) {
      setDeleting(false);
      setError(
        deleteError.code === "23503"
          ? "This client has a sale or rental recorded, so they can't be deleted. Their payment history must be kept."
          : deleteError.message
      );
      return;
    }

    if (!deleted || deleted.length === 0) {
      setDeleting(false);
      setError("You don't have permission to delete clients. Ask a manager or IT.");
      return;
    }

    router.push("/dashboard/crm");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        className="button ghost danger"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Icon name="x" size={15} /> Delete client
      </button>

      <div
        className="modal-backdrop"
        hidden={!open}
        onClick={(event) => event.target === event.currentTarget && !deleting && setOpen(false)}
      >
        <section className="modal" role="alertdialog" aria-modal="true">
          <p className="eyebrow">CRM</p>
          <h2>Delete {clientName}?</h2>
          <p>
            This permanently removes the client along with their leads, site tours and follow-ups. Clients with a
            recorded sale or rental can&apos;t be deleted.
          </p>

          {error && <p style={{ color: "#c0392b", fontSize: 12 }}>{error}</p>}

          <div className="modal-actions">
            <button type="button" className="button ghost" disabled={deleting} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className="button danger-solid" disabled={deleting} onClick={handleDelete}>
              {deleting ? "Deleting…" : "Delete client"}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
