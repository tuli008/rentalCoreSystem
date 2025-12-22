"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";

export async function updateStock(formData: FormData) {
  const itemId = String(formData.get("item_id"));
  const totalQuantity = Number(formData.get("total_quantity"));
  const outOfServiceQuantity = Number(formData.get("out_of_service_quantity"));

  if (
    Number.isNaN(totalQuantity) ||
    Number.isNaN(outOfServiceQuantity) ||
    totalQuantity < 0 ||
    outOfServiceQuantity < 0 ||
    outOfServiceQuantity > totalQuantity
  ) {
    return;
  }

  const { data: existingStock, error: selectError } = await supabase
    .from("inventory_stock")
    .select("id")
    .eq("item_id", itemId)
    .limit(1)
    .single();

  if (selectError && selectError.code !== "PGRST116") {
    console.error("[updateStock] Error checking existing stock:", {
      action: "updateStock",
      item_id: itemId,
      error: selectError.message,
    });
    return;
  }

  if (existingStock) {
    const { error: updateError } = await supabase
      .from("inventory_stock")
      .update({
        total_quantity: totalQuantity,
        out_of_service_quantity: outOfServiceQuantity,
      })
      .eq("item_id", itemId);

    if (updateError) {
      console.error("[updateStock] Error updating stock:", {
        action: "updateStock",
        item_id: itemId,
        error: updateError.message,
      });
      return;
    }
  } else {
    const { error: insertError } = await supabase
      .from("inventory_stock")
      .insert({
        item_id: itemId,
        location_id: "22222222-2222-2222-2222-222222222222",
        total_quantity: totalQuantity,
        out_of_service_quantity: outOfServiceQuantity,
        tenant_id: "11111111-1111-1111-1111-111111111111",
      });

    if (insertError) {
      console.error("[updateStock] Error inserting stock:", {
        action: "updateStock",
        item_id: itemId,
        error: insertError.message,
      });
      return;
    }
  }

  revalidatePath("/");
}
