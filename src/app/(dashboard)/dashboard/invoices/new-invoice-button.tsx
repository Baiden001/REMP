"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/money";

type Client = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  location: string | null;
};

type LineItem = { description: string; amount: string };

type BillTo = { name: string; phone: string; email: string; address: string };

export type InvoicePreset = {
  clientId?: string | null;
  billTo?: Partial<BillTo>;
  saleId?: string;
  rentalId?: string;
  items?: LineItem[];
};

const EMPTY_BILL_TO: BillTo = { name: "", phone: "", email: "", address: "" };

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function NewInvoiceButton({
  label = "＋ New invoice",
  clients,
  preset,
}: {
  label?: string;
  clients: Client[];
  preset?: InvoicePreset;
}) {
  const router = useRouter();
  const supabase = createClient();

  const initialItems = () => (preset?.items?.length ? preset.items : [{ description: "", amount: "" }]);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState(preset?.clientId ?? "");
  const [billTo, setBillTo] = useState<BillTo>({ ...EMPTY_BILL_TO, ...preset?.billTo });
  const [items, setItems] = useState<LineItem[]>(initialItems);
  const [tax, setTax] = useState("0");

  const subtotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const total = subtotal + (Number(tax) || 0);

  function reset() {
    setError(null);
    setClientId(preset?.clientId ?? "");
    setBillTo({ ...EMPTY_BILL_TO, ...preset?.billTo });
    setItems(initialItems());
    setTax("0");
  }

  function pickClient(id: string) {
    setClientId(id);
    const client = clients.find((c) => c.id === id);
    if (client) {
      setBillTo({
        name: client.full_name,
        phone: client.phone ?? "",
        email: client.email ?? "",
        address: client.location ?? "",
      });
    }
  }

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const data = new FormData(event.currentTarget);

    const lines = items
      .map((item, position) => ({
        description: item.description.trim(),
        amount: Number(item.amount),
        position,
      }))
      .filter((item) => item.description || item.amount);

    if (!billTo.name.trim()) {
      setError("Enter who the invoice is billed to.");
      setSaving(false);
      return;
    }

    if (lines.length === 0) {
      setError("Add at least one line item.");
      setSaving(false);
      return;
    }

    if (lines.some((item) => !item.description || !(item.amount >= 0) || Number.isNaN(item.amount))) {
      setError("Each line item needs a description and a valid amount.");
      setSaving(false);
      return;
    }

    const taxValue = Number(tax) || 0;
    if (taxValue < 0) {
      setError("Tax cannot be negative.");
      setSaving(false);
      return;
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        client_id: clientId || null,
        sale_id: preset?.saleId ?? null,
        rental_id: preset?.rentalId ?? null,
        bill_to_name: billTo.name.trim(),
        bill_to_phone: billTo.phone.trim() || null,
        bill_to_email: billTo.email.trim() || null,
        bill_to_address: billTo.address.trim() || null,
        invoice_date: (data.get("invoice_date") as string) || today(),
        due_date: (data.get("due_date") as string) || null,
        tax: taxValue,
        notes: ((data.get("notes") as string) ?? "").trim() || null,
      })
      .select("id")
      .single();

    if (invoiceError || !invoice) {
      setError(invoiceError?.message ?? "Could not create the invoice.");
      setSaving(false);
      return;
    }

    const { error: itemsError } = await supabase
      .from("invoice_items")
      .insert(lines.map((item) => ({ ...item, invoice_id: invoice.id })));

    if (itemsError) {
      // Don't leave an invoice without lines behind.
      await supabase.from("invoices").delete().eq("id", invoice.id);
      setError(itemsError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setOpen(false);
    router.push(`/dashboard/invoices/${invoice.id}`);
  }

  return (
    <>
      <button
        className={preset ? "button ghost" : "button primary"}
        style={preset ? { fontSize: 11 } : undefined}
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        {label}
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
          style={{ maxWidth: 640, maxHeight: "92vh", overflowY: "auto" }}
        >
          <button className="modal-close" aria-label="Close" onClick={() => !saving && setOpen(false)}>
            ×
          </button>
          <p className="eyebrow">FINANCE</p>
          <h2>Create an invoice</h2>
          <p>Bill a client. The invoice prints on the company letterhead with bank details for payment.</p>

          <form onSubmit={handleSubmit}>
            {clients.length > 0 && (
              <label>
                Client (optional — fills in the details below)
                <select value={clientId} onChange={(event) => pickClient(event.target.value)}>
                  <option value="">Not an existing client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.full_name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="form-pair">
              <label>
                Bill to
                <input
                  required
                  value={billTo.name}
                  onChange={(event) => setBillTo({ ...billTo, name: event.target.value })}
                  placeholder="Client or company name"
                />
              </label>
              <label>
                Phone
                <input
                  value={billTo.phone}
                  onChange={(event) => setBillTo({ ...billTo, phone: event.target.value })}
                  placeholder="e.g. 024 000 0000"
                />
              </label>
            </div>

            <div className="form-pair">
              <label>
                Email
                <input
                  type="email"
                  value={billTo.email}
                  onChange={(event) => setBillTo({ ...billTo, email: event.target.value })}
                  placeholder="client@example.com"
                />
              </label>
              <label>
                Address
                <input
                  value={billTo.address}
                  onChange={(event) => setBillTo({ ...billTo, address: event.target.value })}
                  placeholder="Optional"
                />
              </label>
            </div>

            <div className="form-pair">
              <label>
                Invoice date
                <input required type="date" name="invoice_date" defaultValue={today()} />
              </label>
              <label>
                Due date
                <input type="date" name="due_date" />
              </label>
            </div>

            <div className="invoice-lines">
              <div className="invoice-lines-head">
                <span>Description</span>
                <span>Amount (GH₵)</span>
                <span aria-hidden="true" />
              </div>

              {items.map((item, index) => (
                <div className="invoice-line" key={index}>
                  <input
                    value={item.description}
                    onChange={(event) => updateItem(index, { description: event.target.value })}
                    placeholder="e.g. Monthly rent — October 2026"
                    aria-label={`Line ${index + 1} description`}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.amount}
                    onChange={(event) => updateItem(index, { amount: event.target.value })}
                    placeholder="0.00"
                    aria-label={`Line ${index + 1} amount`}
                  />
                  <button
                    type="button"
                    className="invoice-line-remove"
                    aria-label={`Remove line ${index + 1}`}
                    disabled={items.length === 1}
                    onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                  >
                    ×
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="text-button"
                onClick={() => setItems((current) => [...current, { description: "", amount: "" }])}
              >
                ＋ Add line
              </button>
            </div>

            <div className="form-pair">
              <label>
                Tax (GH₵)
                <input type="number" min="0" step="0.01" value={tax} onChange={(event) => setTax(event.target.value)} />
              </label>
              <div className="invoice-total-preview">
                <span>Total</span>
                <b>{money(total)}</b>
              </div>
            </div>

            <label>
              Notes (optional)
              <textarea name="notes" rows={2} placeholder="e.g. Payment reference: your name and unit number" />
            </label>

            {error && <p style={{ color: "#c0392b", fontSize: 12 }}>{error}</p>}

            <div className="modal-actions">
              <button type="button" className="button ghost" disabled={saving} onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="button primary" type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create invoice"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
