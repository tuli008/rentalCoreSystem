"use server";

import { supabase } from "@/lib/supabase";

export interface SearchResult {
  id: string;
  name: string;
  group_id: string;
  group_name: string;
  available: number;
  total: number;
  is_serialized: boolean;
}

export async function searchInventory(query: string): Promise<SearchResult[]> {
  const tenantId = "11111111-1111-1111-1111-111111111111";

  if (!query || query.trim().length === 0) {
    return [];
  }

  const searchTerm = query.trim();

  // Fetch items matching the search term (case-insensitive partial match)
  const { data: items, error: itemsError } = await supabase
    .from("inventory_items")
    .select("id, name, group_id, is_serialized, active")
    .eq("active", true)
    .eq("tenant_id", tenantId)
    .ilike("name", `%${searchTerm}%`)
    .limit(20);

  if (itemsError) {
    console.error("[searchInventory] Error searching items:", {
      action: "searchInventory",
      query: searchTerm,
      error: itemsError.message,
    });
    return [];
  }

  if (!items || items.length === 0) {
    return [];
  }

  // Fetch group names for the items
  const groupIds = [...new Set(items.map((item) => item.group_id))];
  const { data: groups, error: groupsError } = await supabase
    .from("inventory_groups")
    .select("id, name")
    .in("id", groupIds);

  if (groupsError) {
    console.error("[searchInventory] Error fetching groups:", {
      action: "searchInventory",
      error: groupsError.message,
    });
    return [];
  }

  const groupMap = new Map(
    (groups || []).map((group) => [group.id, group.name]),
  );

  // Separate serialized and non-serialized items
  const serializedItemIds: string[] = [];
  const nonSerializedItemIds: string[] = [];

  items.forEach((item: any) => {
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

  // Build results with availability
  const results: SearchResult[] = items.map((item: any) => {
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

    return {
      id: item.id,
      name: item.name,
      group_id: item.group_id,
      group_name: groupMap.get(item.group_id) || "Unknown",
      available,
      total,
      is_serialized: item.is_serialized,
    };
  });

  return results;
}
