"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";

export async function addMaintenanceLog(formData: FormData) {
  const itemId = String(formData.get("item_id"));
  const note = String(formData.get("note") || "").trim();

  if (!note) return;

  const { error } = await supabase.from("inventory_maintenance_logs").insert({
    item_id: itemId,
    tenant_id: "11111111-1111-1111-1111-111111111111",
    note,
  });

  if (error) {
    console.error("[addMaintenanceLog] Error inserting maintenance log:", {
      action: "addMaintenanceLog",
      item_id: itemId,
      error: error.message,
    });
    return;
  }

  revalidatePath("/");
}
