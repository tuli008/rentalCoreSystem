import { supabase } from "./supabase";

export interface InventoryItem {
  id: string;
  name: string;
  available: number;
  total: number;
  group_id: string;
  is_serialized: boolean;
  price: number;
}

export interface InventoryGroup {
  id: string;
  name: string;
  items: InventoryItem[];
}

export async function getInventoryData(): Promise<InventoryGroup[]> {
  // Fetch all inventory groups first, ordered by display_order
  const { data: groups, error: groupsError } = await supabase
    .from("inventory_groups")
    .select("id, name")
    .order("display_order");

  if (groupsError) {
    console.error("Error fetching inventory groups:", groupsError);
    return [];
  }

  if (!groups || groups.length === 0) {
    return [];
  }

  // Fetch all active inventory items separately, ordered by display_order
  const { data: items, error: itemsError } = await supabase
    .from("inventory_items")
    .select("id, name, group_id, is_serialized, active, price")
    .eq("active", true)
    .order("display_order");

  if (itemsError) {
    console.error("Error fetching inventory items:", itemsError);
    return [];
  }

  // Separate serialized and non-serialized items
  const serializedItemIds: string[] = [];
  const nonSerializedItemIds: string[] = [];

  items?.forEach((item: any) => {
    if (item.is_serialized) {
      serializedItemIds.push(item.id);
    } else {
      nonSerializedItemIds.push(item.id);
    }
  });

  // Fetch availability for serialized items (from inventory_units)
  const serializedAvailability = new Map<
    string,
    { available: number; total: number }
  >();

  if (serializedItemIds.length > 0) {
    const { data: units, error: unitsError } = await supabase
      .from("inventory_units")
      .select("item_id, status")
      .in("item_id", serializedItemIds);

    if (!unitsError && units) {
      // Count units per item
      units.forEach((unit: any) => {
        const itemId = unit.item_id;
        if (!serializedAvailability.has(itemId)) {
          serializedAvailability.set(itemId, { available: 0, total: 0 });
        }
        const counts = serializedAvailability.get(itemId)!;
        counts.total++;
        if (unit.status === "available") {
          counts.available++;
        }
      });
    }
  }

  // Fetch availability for non-serialized items (from inventory_stock)
  const nonSerializedAvailability = new Map<
    string,
    { available: number; total: number }
  >();

  if (nonSerializedItemIds.length > 0) {
    const { data: stock, error: stockError } = await supabase
      .from("inventory_stock")
      .select("item_id, total_quantity, out_of_service_quantity")
      .in("item_id", nonSerializedItemIds);

    if (!stockError && stock) {
      stock.forEach((s: any) => {
        nonSerializedAvailability.set(s.item_id, {
          available: s.total_quantity - (s.out_of_service_quantity || 0),
          total: s.total_quantity,
        });
      });
    }
  }

  // Build inventory items with availability
  const itemsWithAvailability: (InventoryItem & {
    group_id: string;
  })[] = [];

  items?.forEach((item: any) => {
    let available = 0;
    let total = 0;

    if (item.is_serialized) {
      const counts = serializedAvailability.get(item.id);
      if (counts) {
        available = counts.available;
        total = counts.total;
      }
    } else {
      const counts = nonSerializedAvailability.get(item.id);
      if (counts) {
        available = counts.available;
        total = counts.total;
      }
    }

    itemsWithAvailability.push({
      id: item.id,
      name: item.name,
      available,
      total,
      group_id: item.group_id,
      is_serialized: item.is_serialized,
      price: item.price || 0,
    });
  });

  // Create a map of items by group_id
  const itemsByGroupId = new Map<string, InventoryItem[]>();
  itemsWithAvailability.forEach((item) => {
    if (!itemsByGroupId.has(item.group_id)) {
      itemsByGroupId.set(item.group_id, []);
    }
    itemsByGroupId.get(item.group_id)!.push({
      id: item.id,
      name: item.name,
      available: item.available,
      total: item.total,
      group_id: item.group_id,
      is_serialized: item.is_serialized,
      price: item.price,
    });
  });

  // Build result: all groups with their items (or empty array if no items)
  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    items: itemsByGroupId.get(group.id) || [],
  }));
}
