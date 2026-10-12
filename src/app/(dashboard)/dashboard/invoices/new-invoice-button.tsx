"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/money";
import Icon from "@/components/icon";

type Client = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  location: string | null;
};

type LineItem = { description: string; quantity: string; unitPrice: string };

export type PurchasableUnit = { id: string; label: string; unitType: string | null; price: number; availability: string };

const BLANK_LINE: LineItem = { description: "", quantity: "1", unitPrice: "" };

function lineAmount(item: LineItem) {
  return (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
}

type BillTo = { name: string; phone: string; email: string; address: string };

export type InvoicePreset = {
  clientId?: string | null;
  billTo?: Partial<BillTo>;
  saleId?: string;
  rentalId?: string;
  items?: LineItem[];
};

// An invoice being edited.
export type ExistingInvoice = {
  id: string;
  clientId: string | null;
  saleId: string | null;
  rentalId: string | null;
  unitId: string | null;
  agreedPrice: number | null;
  billTo: BillTo;
  invoiceDate: string;
  dueDate: string | null;
  tax: number;
  notes: string | null;
  items: { id: string; description: string; quantity: number | null; unitPrice: number | null; amount: number }[];
};

// Readable one-line summary of the lines, kept on the invoice so edits show in Activity.
export function summariseLines(lines: { description: string; quantity: number; unit_price: number }[]) {
  return lines
    .map((l) => `${l.description} ×${Number(l.quantity)} @ ${Number(l.unit_price).toLocaleString("en-GH", { minimumFractionDigits: 2 })}`)
    .join("; ");
}

const EMPTY_BILL_TO: BillTo = { name: "", phone: "", email: "", address: "" };

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function NewInvoiceButton({
  label = "New invoice",
  clients,
  units = [],
  preset,
  existing,
}: {
  label?: string;
  clients: Client[];
  units?: PurchasableUnit[];
  preset?: InvoicePreset;
  existing?: ExistingInvoice;
}) {
  const router = useRouter();
  const supabase = createClient();
  const editing = !!existing;

  const initialItems = (): LineItem[] =>
    existing?.items.length
      ? existing.items.map((item) => ({
          description: item.description,
          quantity: String(item.quantity ?? 1),
          unitPrice: String(item.unitPrice ?? item.amount),
        }))
      : preset?.items?.length
        ? preset.items
        : [BLANK_LINE];
  const initialClientId = existing ? existing.clientId ?? "" : preset?.clientId ?? "";
  const initialBillTo = (): BillTo => (existing ? existing.billTo : { ...EMPTY_BILL_TO, ...preset?.billTo });

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState(initialClientId);
  const [billTo, setBillTo] = useState<BillTo>(initialBillTo);
  const [items, setItems] = useState<LineItem[]>(initialItems);
  const [tax, setTax] = useState(String(existing?.tax ?? 0));
  // A new invoice can be for buying a unit: paying it then creates the sale automatically.
  // (Once the sale exists, the unit can't change from here.)
  const canPickUnit =
    !preset?.saleId && !preset?.rentalId && !existing?.saleId && !existing?.rentalId && units.length > 0;
  const initialPurpose = (): "purchase" | "other" => (existing?.unitId ? "purchase" : "other");
  const [purpose, setPurpose] = useState<"purchase" | "other">(initialPurpose);
  const [unitId, setUnitId] = useState(existing?.unitId ?? "");
  const [agreedPrice, setAgreedPrice] = useState(existing?.agreedPrice ? String(existing.agreedPrice) : "");
  const chosenUnit = units.find((u) => u.id === unitId);

  const subtotal = items.reduce((sum, item) => sum + lineAmount(item), 0);
  const total = subtotal + (Number(tax) || 0);

  function reset() {
    setError(null);
    setClientId(initialClientId);
    setBillTo(initialBillTo());
    setItems(initialItems());
    setTax(String(existing?.tax ?? 0));
    setPurpose(initialPurpose());
    setUnitId(existing?.unitId ?? "");
    setAgreedPrice(existing?.agreedPrice ? String(existing.agreedPrice) : "");
  }

  function pickUnit(id: string) {
    setUnitId(id);
    const unit = units.find((u) => u.id === id);
    if (!unit) return;
    setAgreedPrice(unit.price ? String(unit.price) : "");
    // Start the first line off with what's being bought, if it's still empty.
    setItems((current) =>
      current.length === 1 && !current[0].description.trim()
        ? [{ ...current[0], description: `${unit.label}${unit.unitType ? ` (${unit.unitType})` : ""} — deposit` }]
        : current
    );
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
        quantity: Number(item.quantity),
        unit_price: Number(item.unitPrice),
        amount: Math.round(lineAmount(item) * 100) / 100,
        position,
      }))
      .filter((item) => item.description || item.unit_price);

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

    if (
      lines.some(
        (item) =>
          !item.description ||
          !(item.quantity > 0) ||
          !(item.unit_price >= 0) ||
          Number.isNaN(item.quantity) ||
          Number.isNaN(item.unit_price)
      )
    ) {
      setError("Each line needs a description, a quantity above zero and a unit price.");
      setSaving(false);
      return;
    }

    const buying = canPickUnit && purpose === "purchase";
    if (buying && !chosenUnit) {
      setError("Choose the unit being bought.");
      setSaving(false);
      return;
    }
    if (buying && !(Number(agreedPrice) > 0)) {
      setError("Enter the agreed sale price for the unit.");
      setSaving(false);
      return;
    }

    const taxValue = Number(tax) || 0;
    if (taxValue < 0) {
      setError("Tax cannot be negative.");
      setSaving(false);
      return;
    }

    const fields = {
      client_id: clientId || null,
      unit_id: buying ? chosenUnit!.id : canPickUnit ? null : existing?.unitId ?? null,
      agreed_price: buying ? Number(agreedPrice) : canPickUnit ? null : existing?.agreedPrice ?? null,
      bill_to_name: billTo.name.trim(),
      bill_to_phone: billTo.phone.trim() || null,
      bill_to_email: billTo.email.trim() || null,
      bill_to_address: billTo.address.trim() || null,
      invoice_date: (data.get("invoice_date") as string) || today(),
      due_date: (data.get("due_date") as string) || null,
      tax: taxValue,
      notes: ((data.get("notes") as string) ?? "").trim() || null,
      line_items: summariseLines(lines),
    };

    if (existing) {
      // New lines go in first; the old ones are removed only once that worked.
      const { error: itemsError } = await supabase
        .from("invoice_items")
        .insert(lines.map((item) => ({ ...item, invoice_id: existing.id })));
      if (itemsError) {
        setError(itemsError.message);
        setSaving(false);
        return;
      }
      const oldIds = existing.items.map((item) => item.id);
      if (oldIds.length) {
        const { error: removeError } = await supabase.from("invoice_items").delete().in("id", oldIds);
        if (removeError) {
          setError(removeError.message);
          setSaving(false);
          router.refresh();
          return;
        }
      }
      const { data: saved, error: updateError } = await supabase
        .from("invoices")
        .update(fields)
        .eq("id", existing.id)
        .select("id");
      if (updateError || !saved?.length) {
        setError(updateError?.message ?? "You don't have permission to edit this invoice.");
        setSaving(false);
        router.refresh();
        return;
      }
      // Totals may have changed: recalculate paid / part-paid / unpaid.
      await supabase.rpc("refresh_invoice_payment_status", { target: existing.id });
      setSaving(false);
      setOpen(false);
      router.refresh();
      return;
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        ...fields,
        sale_id: preset?.saleId ?? null,
        rental_id: preset?.rentalId ?? null,
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
        className={preset || editing ? "button ghost" : "button primary"}
        style={preset ? { fontSize: 11 } : undefined}
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <Icon name={editing ? "fileText" : preset ? "fileText" : "plus"} size={preset ? 14 : 15} /> {label}
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
            <Icon name="x" size={20} />
          </button>
          <p className="eyebrow">FINANCE</p>
          <h2>{editing ? "Edit invoice" : "Create an invoice"}</h2>
          <p>
            {editing
              ? "Changes are saved to this invoice and recorded in Activity."
              : "Bill a client. The invoice prints on the company letterhead with bank details for payment."}
          </p>

          <form onSubmit={handleSubmit} key={open ? "open" : "closed"}>
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

            {canPickUnit && (
              <>
                <label>
                  What is this invoice for?
                  <select value={purpose} onChange={(event) => setPurpose(event.target.value as "purchase" | "other")}>
                    <option value="other">Something else (rent, fees, services…)</option>
                    <option value="purchase">Buying a property</option>
                  </select>
                </label>

                {purpose === "purchase" && (
                  <div className="invoice-purchase">
                    <div className="form-pair">
                      <label>
                        Unit being bought
                        <select value={unitId} onChange={(event) => pickUnit(event.target.value)}>
                          <option value="">Choose a unit…</option>
                          {units.map((unit) => (
                            <option key={unit.id} value={unit.id}>
                              {unit.label}
                              {unit.availability === "reserved" ? " (reserved)" : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Agreed sale price (GH₵)
                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          value={agreedPrice}
                          onChange={(event) => setAgreedPrice(event.target.value)}
                          placeholder="Full price of the unit"
                        />
                      </label>
                    </div>
                    <p className="field-hint" style={{ margin: 0 }}>
                      Bill the deposit or installment below. When the client pays, REMP creates the sale for this unit
                      {clientId ? "" : " (and adds them as a client)"}, records the payment and issues the receipt.
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="form-pair">
              <label>
                Invoice date
                <input required type="date" name="invoice_date" defaultValue={existing?.invoiceDate ?? today()} />
              </label>
              <label>
                Due date
                <input type="date" name="due_date" defaultValue={existing?.dueDate ?? ""} />
              </label>
            </div>

            <div className="invoice-lines">
              <div className="invoice-lines-head">
                <span>Line items</span>
              </div>

              {items.map((item, index) => (
                <div className="invoice-line" key={index}>
                  <input
                    className="invoice-line-desc"
                    value={item.description}
                    onChange={(event) => updateItem(index, { description: event.target.value })}
                    placeholder="e.g. Monthly rent — October to December 2026"
                    aria-label={`Line ${index + 1} description`}
                  />
                  <div className="invoice-line-calc">
                    <label>
                      Qty
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={item.quantity}
                        onChange={(event) => updateItem(index, { quantity: event.target.value })}
                        aria-label={`Line ${index + 1} quantity`}
                      />
                    </label>
                    <label>
                      Unit price
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(event) => updateItem(index, { unitPrice: event.target.value })}
                        placeholder="GH₵ 0.00"
                        aria-label={`Line ${index + 1} unit price`}
                      />
                    </label>
                    <div className="invoice-line-amount">
                      <span>Amount</span>
                      <b>{money(lineAmount(item))}</b>
                    </div>
                    <button
                      type="button"
                      className="invoice-line-remove"
                      aria-label={`Remove line ${index + 1}`}
                      disabled={items.length === 1}
                      onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                    >
                      <Icon name="x" size={16} />
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="text-button"
                onClick={() => setItems((current) => [...current, { ...BLANK_LINE }])}
              >
                <Icon name="plus" size={13} /> Add line
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
              <textarea name="notes" rows={2} defaultValue={existing?.notes ?? ""} placeholder="e.g. Payment reference: your name and unit number" />
            </label>

            {error && <p style={{ color: "#c0392b", fontSize: 12 }}>{error}</p>}

            <div className="modal-actions">
              <button type="button" className="button ghost" disabled={saving} onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="button primary" type="submit" disabled={saving}>
                {saving ? (editing ? "Saving…" : "Creating…") : editing ? "Save changes" : "Create invoice"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
