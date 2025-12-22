"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";

export async function createItem(
  formData: FormData,
): Promise<
  | { ok: true }
  | { ok: false; error: "DUPLICATE_NAME" | "VALIDATION_ERROR" | "SERVER_ERROR" }
> {
  const name = String(formData.get("name") || "").trim();
  const groupId = String(formData.get("group_id"));
  const isSerialized = formData.get("is_serialized") === "on";
  const tenantId = "11111111-1111-1111-1111-111111111111";

  if (!name || !groupId) {
    return { ok: false, error: "VALIDATION_ERROR" };
  }

  const { data: existingItem, error: checkError } = await supabase
    .from("inventory_items")
    .select("id")
    .eq("name", name)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (checkError) {
    console.error("[createItem] Error checking for duplicate name:", {
      action: "createItem",
      group_id: groupId,
      name,
      error: checkError.message,
    });
    return { ok: false, error: "SERVER_ERROR" };
  }

  if (existingItem) {
    return { ok: false, error: "DUPLICATE_NAME" };
  }

  const { data: max, error: maxError } = await supabase
    .from("inventory_items")
    .select("display_order")
    .eq("group_id", groupId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxError) {
    console.error("[createItem] Error fetching max display_order:", {
      action: "createItem",
      group_id: groupId,
      error: maxError.message,
    });
    return { ok: false, error: "SERVER_ERROR" };
  }

  const { error: insertError } = await supabase.from("inventory_items").insert({
    name,
    category: "General",
    price: 0,
    group_id: groupId,
    is_serialized: isSerialized,
    active: true,
    tenant_id: tenantId,
    display_order: (max?.display_order ?? 0) + 1,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return { ok: false, error: "DUPLICATE_NAME" };
    }

    console.error("[createItem] Error inserting item:", {
      action: "createItem",
      group_id: groupId,
      name,
      error: insertError.message,
    });
    return { ok: false, error: "SERVER_ERROR" };
  }

  revalidatePath("/");
  return { ok: true };
}

export async function updateItem(formData: FormData) {
  const itemId = String(formData.get("item_id"));
  const name = String(formData.get("name") || "").trim();
  const price = Number(formData.get("price"));

  if (!name || price < 0 || Number.isNaN(price)) return;

  const { error } = await supabase
    .from("inventory_items")
    .update({ name, price })
    .eq("id", itemId);

  if (error) {
    console.error("[updateItem] Error updating item:", {
      action: "updateItem",
      item_id: itemId,
      error: error.message,
    });
    return;
  }

  revalidatePath("/");
}

export async function reorderItems(formData: FormData) {
  const itemOrdersJson = String(formData.get("item_orders") || "{}");
  const itemOrders = JSON.parse(itemOrdersJson) as Record<string, number>;
  const groupId = String(formData.get("group_id"));

  if (!groupId) return;

  const updates = Object.entries(itemOrders).map(([itemId, displayOrder]) =>
    supabase
      .from("inventory_items")
      .update({ display_order: displayOrder })
      .eq("id", itemId)
      .eq("group_id", groupId),
  );

  const results = await Promise.all(updates);

  results.forEach((result, index) => {
    if (result.error) {
      const itemId = Object.keys(itemOrders)[index];
      console.error("[reorderItems] Error updating item:", {
        action: "reorderItems",
        item_id: itemId,
        group_id: groupId,
        error: result.error.message,
      });
    }
  });

  revalidatePath("/");
}

export async function deleteItem(formData: FormData) {
  const itemId = String(formData.get("item_id"));

  if (!itemId) return { error: "Item ID is required" };

  const { data: item, error: itemError } = await supabase
    .from("inventory_items")
    .select("name")
    .eq("id", itemId)
    .single();

  if (itemError) {
    console.error("[deleteItem] Error fetching item:", {
      action: "deleteItem",
      item_id: itemId,
      error: itemError.message,
    });
    return { error: "Failed to fetch item" };
  }

  if (!item) {
    return { error: "Item not found" };
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const milliseconds = String(now.getMilliseconds()).padStart(4, "0").slice(-4);
  const archivedDate = `${year}${month}${day}-${hours}${minutes}${seconds}${milliseconds}`;

  const archivedName = `${item.name} (archived-${archivedDate})`;

  const { error: updateError } = await supabase
    .from("inventory_items")
    .update({ active: false, name: archivedName })
    .eq("id", itemId);

  if (updateError) {
    console.error("[deleteItem] Error soft deleting item:", {
      action: "deleteItem",
      item_id: itemId,
      error: updateError.message,
    });
    return { error: "Failed to delete item" };
  }

  revalidatePath("/");
  return { success: true };
}
