// Receipt numbers: REMP{yy}/{sequence}/{ddmm}, sequence = paid payments so far + 1.
type CountClient = {
  from: (table: "payments") => {
    select: (
      columns: string,
      options: { count: "exact"; head: true }
    ) => { eq: (column: string, value: string) => PromiseLike<{ count: number | null; error: { message: string } | null }> };
  };
};

export async function nextReceiptNumber(supabase: unknown, paidDate: string) {
  const { count, error } = await (supabase as CountClient)
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("status", "paid");
  if (error) return { error: error.message };

  const date = new Date(`${paidDate}T12:00:00`);
  const yy = String(date.getFullYear()).slice(-2);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return { receiptNumber: `REMP${yy}/${String((count ?? 0) + 1).padStart(3, "0")}/${dd}${mm}` };
}
