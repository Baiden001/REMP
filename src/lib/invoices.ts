// Shared by server pages and client components.
export const INVOICE_STATUS: Record<string, { label: string; cls: string }> = {
  unpaid: { label: "Unpaid", cls: "reserved" },
  part_paid: { label: "Part-paid", cls: "offplan" },
  paid: { label: "Paid", cls: "complete" },
  cancelled: { label: "Cancelled", cls: "cancelled" },
};

export function invoiceTotal(invoice: { tax: number | null; invoice_items?: { amount: number }[] | null }) {
  return (invoice.invoice_items ?? []).reduce((sum, item) => sum + Number(item.amount || 0), 0) + Number(invoice.tax || 0);
}

export function isOpenInvoice(status: string) {
  return status === "unpaid" || status === "part_paid";
}

type InvoiceQueryClient = {
  from: (table: "invoices") => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        in: (column: string, values: string[]) => PromiseLike<{ data: unknown[] | null }>;
      };
    };
  };
};

// Unpaid / part-paid invoices raised for a sale or rental, with their balance.
export async function openInvoicesFor(supabase: unknown, column: "sale_id" | "rental_id", id: string) {
  const { data } = await (supabase as InvoiceQueryClient)
    .from("invoices")
    .select("id, invoice_number, tax, amount_paid, invoice_items(amount)")
    .eq(column, id)
    .in("status", ["unpaid", "part_paid"]);
  return ((data ?? []) as { id: string; invoice_number: string; tax: number; amount_paid: number; invoice_items: { amount: number }[] }[]).map(
    (inv) => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      balance: Math.max(invoiceTotal(inv) - Number(inv.amount_paid || 0), 0),
    })
  );
}
