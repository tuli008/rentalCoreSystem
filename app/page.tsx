import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { getInventoryData } from "@/lib/inventory";
import InventoryPageContent from "./components/InventoryPageContent";

/* =========================
   CREATE GROUP
========================= */
async function createGroup(formData: FormData) {
  "use server";

  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  const { data: max, error: maxError } = await supabase
    .from("inventory_groups")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .single();

  if (maxError && maxError.code !== "PGRST116") {
    // PGRST116 means no rows found, which is fine
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

/* =========================
   CREATE ITEM
========================= */
async function createItem(
  formData: FormData,
): Promise<
  | { ok: true }
  | { ok: false; error: "DUPLICATE_NAME" | "VALIDATION_ERROR" | "SERVER_ERROR" }
> {
  "use server";

  const name = String(formData.get("name") || "").trim();
  const groupId = String(formData.get("group_id"));
  const isSerialized = formData.get("is_serialized") === "on";
  const tenantId = "11111111-1111-1111-1111-111111111111";

  if (!name || !groupId) {
    return { ok: false, error: "VALIDATION_ERROR" };
  }

  // Check for duplicate name within tenant
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
    // Check for unique constraint violation (duplicate name)
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

/* =========================
   REORDER GROUPS
========================= */
async function reorderGroups(formData: FormData) {
  "use server";

  const groupOrdersJson = String(formData.get("group_orders") || "{}");
  const groupOrders = JSON.parse(groupOrdersJson) as Record<string, number>;

  // Update all groups in a transaction-like manner
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

/* =========================
   REORDER ITEMS
========================= */
async function reorderItems(formData: FormData) {
  "use server";

  const itemOrdersJson = String(formData.get("item_orders") || "{}");
  const itemOrders = JSON.parse(itemOrdersJson) as Record<string, number>;
  const groupId = String(formData.get("group_id"));

  if (!groupId) return;

  // Update all items in the group
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

/* =========================
   UPDATE ITEM
========================= */
async function updateItem(formData: FormData) {
  "use server";

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

/* =========================
   UPDATE STOCK
========================= */
async function updateStock(formData: FormData) {
  "use server";

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

  // Check if stock record exists
  const { data: existingStock, error: selectError } = await supabase
    .from("inventory_stock")
    .select("id")
    .eq("item_id", itemId)
    .limit(1)
    .single();

  if (selectError && selectError.code !== "PGRST116") {
    // PGRST116 means no rows found, which is fine
    console.error("[updateStock] Error checking existing stock:", {
      action: "updateStock",
      item_id: itemId,
      error: selectError.message,
    });
    return;
  }

  if (existingStock) {
    // Update existing stock
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
    // Create new stock record
    const { error: insertError } = await supabase
      .from("inventory_stock")
      .insert({
        item_id: itemId,
        location_id: "22222222-2222-2222-2222-222222222222", // Main Warehouse
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

/* =========================
   ADD MAINTENANCE LOG
========================= */
async function addMaintenanceLog(formData: FormData) {
  "use server";

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

/* =========================
   UPDATE UNIT STATUS
========================= */
async function updateUnitStatus(formData: FormData) {
  "use server";

  const unitId = String(formData.get("unit_id"));
  const newStatus = String(formData.get("status"));

  if (!unitId || !newStatus) return;

  // Validate status
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

/* =========================
   DELETE ITEM (SOFT DELETE)
========================= */
async function deleteItem(formData: FormData) {
  "use server";

  const itemId = String(formData.get("item_id"));

  if (!itemId) return { error: "Item ID is required" };

  // Get current item name
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

  // Format date as YYYYMMDD-HHMMSSmmmm for uniqueness (matches archived-20241215-1734059123 format)
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  // Use 4-digit milliseconds (pad with leading zeros, then take last 4 digits to handle >999ms edge cases)
  const milliseconds = String(now.getMilliseconds()).padStart(4, "0").slice(-4);
  const archivedDate = `${year}${month}${day}-${hours}${minutes}${seconds}${milliseconds}`;

  // Rename: {name} (archived-YYYYMMDD-HHMMSSmmmm)
  const archivedName = `${item.name} (archived-${archivedDate})`;

  // Soft delete: set active = false and rename
  // Do NOT delete units or stock
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

/* =========================
   DELETE GROUP (HARD DELETE)
========================= */
async function deleteGroup(formData: FormData) {
  "use server";

  const groupId = String(formData.get("group_id"));
  const tenantId = "11111111-1111-1111-1111-111111111111";

  if (!groupId) return { error: "Group ID is required" };

  // Fetch the group to check its name
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

  // Prevent deletion of system "Uncategorized" group
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

  // Ensure "Uncategorized" group exists (per tenant)
  let { data: uncategorizedGroup, error: findError } = await supabase
    .from("inventory_groups")
    .select("id")
    .eq("name", "Uncategorized")
    .eq("tenant_id", tenantId)
    .single();

  if (findError && findError.code !== "PGRST116") {
    // PGRST116 means no rows found, which is fine
    console.error("[deleteGroup] Error finding Uncategorized group:", {
      action: "deleteGroup",
      group_id: groupId,
      error: findError.message,
    });
    return { error: "Failed to find Uncategorized group" };
  }

  // Create "Uncategorized" group if it doesn't exist
  if (!uncategorizedGroup) {
    // Get max display_order for positioning
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

  // Fetch all items to be moved (active + archived)
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
    // No items to move, safe to delete group
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

  // Fetch all existing item names in "Uncategorized" (active + archived) for collision detection
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

  // Format timestamp as YYYYMMDD-HHMMSS
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;

  // Track names that will exist after renaming (to avoid collisions within the batch)
  const usedNames = new Set(existingNames);
  const nameCounters = new Map<string, number>();

  // Prepare updates: check for collisions and rename if needed
  const updates = itemsToMove.map((item) => {
    let newName = item.name;
    const itemNameLower = item.name.toLowerCase();

    // Check if name collides with existing items or items already processed in this batch
    if (usedNames.has(itemNameLower)) {
      // Need to rename - ensure uniqueness within batch
      const baseName = item.name;
      let counter = nameCounters.get(baseName) || 0;
      counter++;
      nameCounters.set(baseName, counter);

      // Generate unique name: {name} (migrated-YYYYMMDD-HHMMSS) or {name} (migrated-YYYYMMDD-HHMMSS-{counter})
      const suffix = counter > 1 ? `${timestamp}-${counter}` : timestamp;
      newName = `${baseName} (migrated-${suffix})`;

      // Keep trying until we find a unique name
      let attempts = 0;
      while (usedNames.has(newName.toLowerCase()) && attempts < 100) {
        counter++;
        nameCounters.set(baseName, counter);
        newName = `${baseName} (migrated-${timestamp}-${counter})`;
        attempts++;
      }
    }

    // Track this name as used
    usedNames.add(newName.toLowerCase());

    return {
      id: item.id,
      name: newName,
      group_id: uncategorizedGroupId,
    };
  });

  // Update all items atomically (all succeed or all fail)
  const updatePromises = updates.map((update) =>
    supabase
      .from("inventory_items")
      .update({ name: update.name, group_id: update.group_id })
      .eq("id", update.id),
  );

  const updateResults = await Promise.all(updatePromises);

  // Check for any failures
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

  // All items moved successfully, now delete the group
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

/* =========================
   PAGE
========================= */
export default async function Home() {
  const inventoryGroups = await getInventoryData();

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Inventory List
        </h1>

        <form
          action={createGroup}
          className="mb-8 p-4 bg-white rounded-lg shadow-sm border border-gray-200"
        >
          <div className="flex gap-2">
            <input
              name="name"
              placeholder="New group name"
              required
              className="flex-1 px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button className="px-4 py-2 bg-blue-600 text-white rounded">
              Add Group
            </button>
          </div>
        </form>

        <InventoryPageContent
          groups={inventoryGroups}
          createItem={createItem}
          updateItem={updateItem}
          updateStock={updateStock}
          addMaintenanceLog={addMaintenanceLog}
          updateUnitStatus={updateUnitStatus}
          reorderGroups={reorderGroups}
          reorderItems={reorderItems}
          deleteItem={deleteItem}
          deleteGroup={deleteGroup}
        />
      </div>
    </main>
  );
}
