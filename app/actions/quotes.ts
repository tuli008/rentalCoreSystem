"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";

const tenantId = "11111111-1111-1111-1111-111111111111";

export async function createQuote(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const startDate = String(formData.get("start_date") || "");
  const endDate = String(formData.get("end_date") || "");

  if (!name || !startDate || !endDate) {
    return { error: "Name, start date, and end date are required" };
  }

  const { error } = await supabase.from("quotes").insert({
    name,
    start_date: startDate,
    end_date: endDate,
    status: "draft",
    tenant_id: tenantId,
  });

  if (error) {
    console.error("[createQuote] Error creating quote:", {
      action: "createQuote",
      name,
      error: error.message,
    });
    return { error: "Failed to create quote" };
  }

  revalidatePath("/quotes");
  return { success: true };
}

export async function updateQuote(formData: FormData) {
  const quoteId = String(formData.get("quote_id"));
  const name = String(formData.get("name") || "").trim();
  const startDate = String(formData.get("start_date") || "");
  const endDate = String(formData.get("end_date") || "");

  if (!quoteId || !name || !startDate || !endDate) {
    return { error: "Quote ID, name, start date, and end date are required" };
  }

  const { error } = await supabase
    .from("quotes")
    .update({
      name,
      start_date: startDate,
      end_date: endDate,
    })
    .eq("id", quoteId)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("[updateQuote] Error updating quote:", {
      action: "updateQuote",
      quote_id: quoteId,
      error: error.message,
    });
    return { error: "Failed to update quote" };
  }

  revalidatePath("/quotes");
  return { success: true };
}

export async function deleteQuote(formData: FormData) {
  const quoteId = String(formData.get("quote_id"));

  if (!quoteId) {
    return { error: "Quote ID is required" };
  }

  // Delete quote items first (cascade should handle this, but being explicit)
  const { error: itemsError } = await supabase
    .from("quote_items")
    .delete()
    .eq("quote_id", quoteId);

  if (itemsError) {
    console.error("[deleteQuote] Error deleting quote items:", {
      action: "deleteQuote",
      quote_id: quoteId,
      error: itemsError.message,
    });
    return { error: "Failed to delete quote items" };
  }

  // Delete quote
  const { error } = await supabase
    .from("quotes")
    .delete()
    .eq("id", quoteId)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("[deleteQuote] Error deleting quote:", {
      action: "deleteQuote",
      quote_id: quoteId,
      error: error.message,
    });
    return { error: "Failed to delete quote" };
  }

  revalidatePath("/quotes");
  return { success: true };
}

export async function addQuoteItem(formData: FormData) {
  const quoteId = String(formData.get("quote_id"));
  const itemId = String(formData.get("item_id"));
  const quantity = Number(formData.get("quantity"));

  if (!quoteId || !itemId || !quantity || quantity <= 0) {
    return { error: "Quote ID, item ID, and valid quantity are required" };
  }

  // Fetch item to get current price and check if serialized
  const { data: item, error: itemError } = await supabase
    .from("inventory_items")
    .select("price, is_serialized")
    .eq("id", itemId)
    .eq("tenant_id", tenantId)
    .single();

  if (itemError || !item) {
    console.error("[addQuoteItem] Error fetching item:", {
      action: "addQuoteItem",
      item_id: itemId,
      error: itemError?.message,
    });
    return { error: "Failed to fetch item" };
  }

  // Validate availability (read-only check)
  let available = 0;
  if (item.is_serialized) {
    const { data: units } = await supabase
      .from("inventory_units")
      .select("status")
      .eq("item_id", itemId);

    if (units) {
      available = units.filter((u) => u.status === "available").length;
    }
  } else {
    const { data: stock } = await supabase
      .from("inventory_stock")
      .select("total_quantity, out_of_service_quantity")
      .eq("item_id", itemId)
      .single();

    if (stock) {
      available = stock.total_quantity - (stock.out_of_service_quantity || 0);
    }
  }

  if (quantity > available) {
    return {
      error: `Insufficient availability. Only ${available} available.`,
    };
  }

  // Insert quote item with price snapshot
  const { error } = await supabase.from("quote_items").insert({
    quote_id: quoteId,
    item_id: itemId,
    quantity,
    unit_price_snapshot: item.price,
  });

  if (error) {
    console.error("[addQuoteItem] Error adding quote item:", {
      action: "addQuoteItem",
      quote_id: quoteId,
      item_id: itemId,
      error: error.message,
    });
    return { error: "Failed to add item to quote" };
  }

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${quoteId}`);
  return { success: true };
}

export async function updateQuoteItem(formData: FormData) {
  const quoteItemId = String(formData.get("quote_item_id"));
  const quantity = Number(formData.get("quantity"));

  if (!quoteItemId || !quantity || quantity <= 0) {
    return { error: "Quote item ID and valid quantity are required" };
  }

  // Get quote item to find item_id and quote_id
  const { data: quoteItem, error: fetchError } = await supabase
    .from("quote_items")
    .select("item_id, quote_id")
    .eq("id", quoteItemId)
    .single();

  if (fetchError || !quoteItem) {
    return { error: "Quote item not found" };
  }

  // Validate availability
  const { data: item } = await supabase
    .from("inventory_items")
    .select("is_serialized")
    .eq("id", quoteItem.item_id)
    .single();

  if (item) {
    let available = 0;
    if (item.is_serialized) {
      const { data: units } = await supabase
        .from("inventory_units")
        .select("status")
        .eq("item_id", quoteItem.item_id);

      if (units) {
        available = units.filter((u) => u.status === "available").length;
      }
    } else {
      const { data: stock } = await supabase
        .from("inventory_stock")
        .select("total_quantity, out_of_service_quantity")
        .eq("item_id", quoteItem.item_id)
        .single();

      if (stock) {
        available = stock.total_quantity - (stock.out_of_service_quantity || 0);
      }
    }

    if (quantity > available) {
      return {
        error: `Insufficient availability. Only ${available} available.`,
      };
    }
  }

  const { error } = await supabase
    .from("quote_items")
    .update({ quantity })
    .eq("id", quoteItemId);

  if (error) {
    console.error("[updateQuoteItem] Error updating quote item:", {
      action: "updateQuoteItem",
      quote_item_id: quoteItemId,
      error: error.message,
    });
    return { error: "Failed to update quote item" };
  }

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${quoteItem.quote_id}`);
  return { success: true };
}

export async function deleteQuoteItem(formData: FormData) {
  const quoteItemId = String(formData.get("quote_item_id"));

  if (!quoteItemId) {
    return { error: "Quote item ID is required" };
  }

  // Get quote_id before deleting for revalidation
  const { data: quoteItem } = await supabase
    .from("quote_items")
    .select("quote_id")
    .eq("id", quoteItemId)
    .single();

  const { error } = await supabase
    .from("quote_items")
    .delete()
    .eq("id", quoteItemId);

  if (error) {
    console.error("[deleteQuoteItem] Error deleting quote item:", {
      action: "deleteQuoteItem",
      quote_item_id: quoteItemId,
      error: error.message,
    });
    return { error: "Failed to delete quote item" };
  }

  revalidatePath("/quotes");
  if (quoteItem) {
    revalidatePath(`/quotes/${quoteItem.quote_id}`);
  }
  return { success: true };
}

export async function searchInventoryItems(
  query: string,
  quoteContext?: {
    quoteId: string;
    startDate: string;
    endDate: string;
  },
) {
  const searchTerm = `%${query.toLowerCase()}%`;

  const { data: items, error } = await supabase
    .from("inventory_items")
    .select("id, name, price, is_serialized")
    .eq("active", true)
    .eq("tenant_id", tenantId)
    .ilike("name", searchTerm)
    .limit(20);

  if (error) {
    console.error("[searchInventoryItems] Error searching items:", {
      action: "searchInventoryItems",
      query,
      error: error.message,
    });
    return [];
  }

  if (!items || items.length === 0) {
    return [];
  }

  // Fetch availability for each item (use getItemAvailabilityBreakdown for date-aware calculation if quoteContext provided)
  const itemsWithAvailability = await Promise.all(
    items.map(async (item) => {
      if (quoteContext) {
        // Use date-aware availability calculation
        const { getItemAvailabilityBreakdown } = await import("@/lib/quotes");
        const breakdown = await getItemAvailabilityBreakdown(
          item.id,
          quoteContext,
        );
        return {
          id: item.id,
          name: item.name,
          price: item.price,
          is_serialized: item.is_serialized,
          available:
            breakdown.effectiveAvailable !== undefined
              ? breakdown.effectiveAvailable
              : breakdown.available,
          total: breakdown.total,
          effectiveAvailable: breakdown.effectiveAvailable,
          reservedInOverlappingEvents: breakdown.reservedInOverlappingEvents,
        };
      } else {
        // Fallback to simple availability calculation
        let available = 0;
        let total = 0;

        if (item.is_serialized) {
          const { data: units } = await supabase
            .from("inventory_units")
            .select("status")
            .eq("item_id", item.id);

          if (units) {
            total = units.length;
            available = units.filter((u) => u.status === "available").length;
          }
        } else {
          const { data: stock } = await supabase
            .from("inventory_stock")
            .select("total_quantity, out_of_service_quantity")
            .eq("item_id", item.id)
            .single();

          if (stock) {
            total = stock.total_quantity;
            available =
              stock.total_quantity - (stock.out_of_service_quantity || 0);
          }
        }

        return {
          id: item.id,
          name: item.name,
          price: item.price,
          is_serialized: item.is_serialized,
          available,
          total,
        };
      }
    }),
  );

  return itemsWithAvailability;
}

export async function refreshQuoteItemPrices(itemId: string) {
  // Get current item price
  const { data: item, error: itemError } = await supabase
    .from("inventory_items")
    .select("price")
    .eq("id", itemId)
    .eq("tenant_id", tenantId)
    .single();

  if (itemError || !item) {
    console.error("[refreshQuoteItemPrices] Error fetching item:", itemError);
    return;
  }

  // Fetch all draft quote IDs
  const { data: draftQuotes, error: quotesError } = await supabase
    .from("quotes")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("status", "draft");

  if (quotesError) {
    console.error("[refreshQuoteItemPrices] Error fetching draft quotes:", quotesError);
    return;
  }

  if (!draftQuotes || draftQuotes.length === 0) {
    return; // No draft quotes to update
  }

  const draftQuoteIds = draftQuotes.map((q) => q.id);

  // Update prices for all quote items in draft quotes that use this item
  const { error } = await supabase
    .from("quote_items")
    .update({ unit_price_snapshot: item.price })
    .in("quote_id", draftQuoteIds)
    .eq("item_id", itemId);

  if (error) {
    console.error("[refreshQuoteItemPrices] Error updating quote item prices:", error);
  } else {
    // Revalidate quote pages
    revalidatePath("/quotes");
    for (const quoteId of draftQuoteIds) {
      revalidatePath(`/quotes/${quoteId}`);
    }
  }
}