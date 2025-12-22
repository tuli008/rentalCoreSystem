"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";

export async function createGroup(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  const { data: max, error: maxError } = await supabase
    .from("inventory_groups")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .single();

  if (maxError && maxError.code !== "PGRST116") {
    console.error("[createGroup] Error fetching max display_order:", {
      action: "createGroup",
      error: maxError.message,
    });
    return;
  }

  const { error: insertError } = await supabase
    .from("inventory_groups")
    .insert({
      name,
      tenant_id: "11111111-1111-1111-1111-111111111111",
      display_order: (max?.display_order ?? 0) + 1,
    });

  if (insertError) {
    console.error("[createGroup] Error inserting group:", {
      action: "createGroup",
      name,
      error: insertError.message,
    });
    return;
  }

  revalidatePath("/");
}

export async function reorderGroups(formData: FormData) {
  const groupOrdersJson = String(formData.get("group_orders") || "{}");
  const groupOrders = JSON.parse(groupOrdersJson) as Record<string, number>;

  const updates = Object.entries(groupOrders).map(([groupId, displayOrder]) =>
    supabase
      .from("inventory_groups")
      .update({ display_order: displayOrder })
      .eq("id", groupId),
  );

  const results = await Promise.all(updates);

  results.forEach((result, index) => {
    if (result.error) {
      const groupId = Object.keys(groupOrders)[index];
      console.error("[reorderGroups] Error updating group:", {
        action: "reorderGroups",
        group_id: groupId,
        error: result.error.message,
      });
    }
  });

  revalidatePath("/");
}

export async function deleteGroup(formData: FormData) {
  const groupId = String(formData.get("group_id"));
  const tenantId = "11111111-1111-1111-1111-111111111111";

  if (!groupId) return { error: "Group ID is required" };

  const { data: group, error: groupError } = await supabase
    .from("inventory_groups")
    .select("name")
    .eq("id", groupId)
    .single();

  if (groupError) {
    console.error("[deleteGroup] Error fetching group:", {
      action: "deleteGroup",
      group_id: groupId,
      error: groupError.message,
    });
    return { error: "Failed to fetch group" };
  }

  if (group && group.name === "Uncategorized") {
    console.error("[deleteGroup] Attempted to delete system group:", {
      action: "deleteGroup",
      group_id: groupId,
      group_name: group.name,
    });
    return {
      error: "This group is required by the system and cannot be deleted.",
    };
  }

  let { data: uncategorizedGroup, error: findError } = await supabase
    .from("inventory_groups")
    .select("id")
    .eq("name", "Uncategorized")
    .eq("tenant_id", tenantId)
    .single();

  if (findError && findError.code !== "PGRST116") {
    console.error("[deleteGroup] Error finding Uncategorized group:", {
      action: "deleteGroup",
      group_id: groupId,
      error: findError.message,
    });
    return { error: "Failed to find Uncategorized group" };
  }

  if (!uncategorizedGroup) {
    const { data: max } = await supabase
      .from("inventory_groups")
      .select("display_order")
      .order("display_order", { ascending: false })
      .limit(1)
      .single();

    const { data: newGroup, error: createError } = await supabase
      .from("inventory_groups")
      .insert({
        name: "Uncategorized",
        tenant_id: tenantId,
        display_order: (max?.display_order ?? 0) + 1,
      })
      .select("id")
      .single();

    if (createError) {
      console.error("[deleteGroup] Error creating Uncategorized group:", {
        action: "deleteGroup",
        group_id: groupId,
        error: createError.message,
      });
      return { error: "Failed to create Uncategorized group" };
    }

    uncategorizedGroup = newGroup;
  }

  const uncategorizedGroupId = uncategorizedGroup.id;

  const { data: itemsToMove, error: fetchError } = await supabase
    .from("inventory_items")
    .select("id, name")
    .eq("group_id", groupId);

  if (fetchError) {
    console.error("[deleteGroup] Error fetching items to move:", {
      action: "deleteGroup",
      group_id: groupId,
      error: fetchError.message,
    });
    return { error: "Failed to fetch items to move" };
  }

  if (!itemsToMove || itemsToMove.length === 0) {
    const { error: deleteError } = await supabase
      .from("inventory_groups")
      .delete()
      .eq("id", groupId);

    if (deleteError) {
      console.error("[deleteGroup] Error deleting group:", {
        action: "deleteGroup",
        group_id: groupId,
        error: deleteError.message,
      });
      return { error: "Failed to delete group" };
    }

    revalidatePath("/");
    return { success: true };
  }

  const { data: existingItems, error: existingError } = await supabase
    .from("inventory_items")
    .select("name")
    .eq("group_id", uncategorizedGroupId)
    .eq("tenant_id", tenantId);

  if (existingError) {
    console.error(
      "[deleteGroup] Error fetching existing items in Uncategorized:",
      {
        action: "deleteGroup",
        group_id: groupId,
        error: existingError.message,
      },
    );
    return { error: "Failed to check for name collisions" };
  }

  const existingNames = new Set(
    (existingItems || []).map((item) => item.name.toLowerCase()),
  );

  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;

  const usedNames = new Set(existingNames);
  const nameCounters = new Map<string, number>();

  const updates = itemsToMove.map((item) => {
    let newName = item.name;
    const itemNameLower = item.name.toLowerCase();

    if (usedNames.has(itemNameLower)) {
      const baseName = item.name;
      let counter = nameCounters.get(baseName) || 0;
      counter++;
      nameCounters.set(baseName, counter);

      const suffix = counter > 1 ? `${timestamp}-${counter}` : timestamp;
      newName = `${baseName} (migrated-${suffix})`;

      let attempts = 0;
      while (usedNames.has(newName.toLowerCase()) && attempts < 100) {
        counter++;
        nameCounters.set(baseName, counter);
        newName = `${baseName} (migrated-${timestamp}-${counter})`;
        attempts++;
      }
    }

    usedNames.add(newName.toLowerCase());

    return {
      id: item.id,
      name: newName,
      group_id: uncategorizedGroupId,
    };
  });

  const updatePromises = updates.map((update) =>
    supabase
      .from("inventory_items")
      .update({ name: update.name, group_id: update.group_id })
      .eq("id", update.id),
  );

  const updateResults = await Promise.all(updatePromises);

  const failedUpdates = updateResults.filter((result) => result.error);
  if (failedUpdates.length > 0) {
    const firstError = failedUpdates[0].error;
    console.error("[deleteGroup] Error moving items to Uncategorized:", {
      action: "deleteGroup",
      group_id: groupId,
      failed_count: failedUpdates.length,
      total_count: updates.length,
      error: firstError?.message,
    });
    return {
      error: `Failed to move ${failedUpdates.length} of ${updates.length} items to Uncategorized`,
    };
  }

  const { error: deleteError } = await supabase
    .from("inventory_groups")
    .delete()
    .eq("id", groupId);

  if (deleteError) {
    console.error("[deleteGroup] Error deleting group:", {
      action: "deleteGroup",
      group_id: groupId,
      error: deleteError.message,
    });
    return { error: "Failed to delete group" };
  }

  revalidatePath("/");
  return { success: true };
}
