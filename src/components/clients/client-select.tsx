"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/icon";

type ClientOption = { id: string; full_name: string };

/**
 * Client dropdown for the add sale / add rental forms, with a small
 * "New client" panel so a client can be created without leaving the form.
 * The select keeps name="client_id", so the parent form reads it like before.
 * The panel inputs have no name and are not required, so they never
 * submit or block the parent form.
 */
export default function ClientSelect({
  clients,
  placeholder = "Select a client",
}: {
  clients: ClientOption[];
  placeholder?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const wrapRef = useRef<HTMLDivElement>(null);

  const [added, setAdded] = useState<ClientOption[]>([]);
  const [value, setValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ message: string; id: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");

  const options = useMemo(() => {
    const known = new Set(clients.map((c) => c.id));
    return [...clients, ...added.filter((c) => !known.has(c.id))].sort((a, b) =>
      a.full_name.localeCompare(b.full_name),
    );
  }, [clients, added]);

  // When the parent form is reset after saving, clear this picker too.
  useEffect(() => {
    const form = wrapRef.current?.closest("form");
    if (!form) return;
    const onReset = () => {
      setValue("");
      setAdding(false);
      setNotice(null);
      setError(null);
      setName("");
      setPhone("");
      setEmail("");
      setLocation("");
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  function fail(message: string) {
    setSaving(false);
    setError({ message, id: Date.now() });
  }

  function finish(message: string) {
    setAdding(false);
    setSaving(false);
    setError(null);
    setNotice(message);
    setName("");
    setPhone("");
    setEmail("");
    setLocation("");
  }

  function pickExisting(client: ClientOption, message: string) {
    setAdded((prev) => (prev.some((c) => c.id === client.id) ? prev : [...prev, client]));
    setValue(client.id);
    finish(message);
  }

  async function saveClient() {
    const fullName = name.trim();
    const phoneText = phone.trim();
    const emailText = email.trim();
    const locationText = location.trim();

    if (!fullName || !phoneText) {
      fail("Enter the client's full name and phone number.");
      return;
    }
    if (emailText && !/^\S+@\S+\.\S+$/.test(emailText)) {
      fail("That email address doesn't look right.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    // Don't create a duplicate: reuse a client with the same phone or email.
    const byPhone = await supabase
      .from("clients")
      .select("id, full_name")
      .eq("phone", phoneText)
      .limit(1);
    const byEmail = emailText
      ? await supabase
          .from("clients")
          .select("id, full_name")
          .ilike("email", emailText.replace(/[\\%_]/g, "\\$&"))
          .limit(1)
      : null;
    const existing = byPhone.data?.[0] ?? byEmail?.data?.[0];
    if (existing) {
      pickExisting(existing, `${existing.full_name} is already a client, so they have been selected.`);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("clients")
      .insert({
        full_name: fullName,
        phone: phoneText,
        email: emailText || null,
        location: locationText || null,
      })
      .select("id, full_name")
      .single();

    if (insertError || !data) {
      const message = insertError?.message ?? "";
      fail(
        /row-level security/i.test(message)
          ? "Your role isn't allowed to add clients yet. Ask an admin to turn this on."
          : message || "Could not save the client. Try again.",
      );
      return;
    }

    setAdded((prev) => [...prev, data]);
    setValue(data.id);
    finish(`${data.full_name} was added and selected.`);
    router.refresh();
  }

  return (
    <div ref={wrapRef} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label>
        Client
        <select
          required
          name="client_id"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setNotice(null);
          }}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((client) => (
            <option key={client.id} value={client.id}>
              {client.full_name}
            </option>
          ))}
        </select>
      </label>

      {notice && !adding && (
        <p
          key={notice}
          className="row-confirmed"
          style={{ margin: 0, fontSize: 12, color: "#15946b", padding: "4px 6px", borderRadius: 6 }}
        >
          ✓ {notice}
        </p>
      )}

      {!adding ? (
        <button
          type="button"
          className="button ghost"
          style={{ alignSelf: "flex-start" }}
          onClick={() => {
            setAdding(true);
            setNotice(null);
          }}
        >
          <Icon name="plus" size={14} /> New client
        </button>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            padding: 12,
            border: "1px solid #d6e4dc",
            borderRadius: 10,
            background: "#f6faf8",
          }}
          onKeyDown={(event) => {
            // Enter in a panel field saves the client, never the whole sale/rental form.
            if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT") {
              event.preventDefault();
              void saveClient();
            }
          }}
        >
          <strong style={{ fontSize: 12 }}>New client</strong>
          <label>
            Full name
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Nana Owusu"
            />
          </label>
          <label>
            Phone
            <input
              value={phone}
              inputMode="tel"
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+233 24 000 0000"
            />
          </label>
          <label>
            Email (optional)
            <input
              value={email}
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="client@example.com"
            />
          </label>
          <label>
            Location (optional)
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="e.g. East Legon, Accra"
            />
          </label>

          {error && (
            <p
              key={error.id}
              className="form-error"
              role="alert"
              style={{ margin: 0, color: "#c0392b", fontSize: 12 }}
            >
              {error.message}
            </p>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="button primary"
              disabled={saving}
              aria-busy={saving}
              onClick={() => void saveClient()}
            >
              {saving ? "Saving…" : "Save client"}
            </button>
            <button
              type="button"
              className="button ghost"
              disabled={saving}
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
