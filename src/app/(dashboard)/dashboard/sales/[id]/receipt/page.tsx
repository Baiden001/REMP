import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Older links pointed here; send them to the latest paid receipt for the sale.
export default async function LatestReceiptRedirect({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: latest } = await supabase
    .from("payments")
    .select("id")
    .eq("sale_id", params.id)
    .eq("status", "paid")
    .order("paid_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  redirect(latest ? `/dashboard/sales/${params.id}/receipt/${latest.id}` : `/dashboard/sales/${params.id}`);
}
