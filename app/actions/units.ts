"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

export async function updateUnitStatus(formData: FormData) {
  // Require admin access
  try {
    await requireAdmin();
  } catch (error) {
    return;
  }
  const unitId = String(formData.get("unit_id"));
  const newStatus = String(formData.get("status"));

  if (!unitId || !newStatus) return;

  if (!["available", "out", "maintenance"].includes(newStatus)) return;

  const { error } = await supabase
    .from("inventory_units")
    .update({ status: newStatus })
    .eq("id", unitId);

  if (error) {
    console.error("[updateUnitStatus] Error updating unit status:", {
      action: "updateUnitStatus",
      unit_id: unitId,
      error: error.message,
    });
    return;
  }

  revalidatePath("/");
}