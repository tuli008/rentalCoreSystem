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

  // Fetch quote with items and status before deleting
  const { getQuoteWithItems } = await import("@/lib/quotes");
  const quote = await getQuoteWithItems(quoteId);

  if (!quote) {
    return { error: "Quote not found" };
  }

  // If quote is accepted (confirmed), restore inventory for all items
  if (quote.status === "accepted" && quote.items.length > 0) {
    for (const item of quote.items) {
      // Check if item is serialized
      const { data: inventoryItem, error: itemError } = await supabase
        .from("inventory_items")
        .select("is_serialized")
        .eq("id", item.item_id)
        .eq("tenant_id", tenantId)
        .single();

      if (itemError || !inventoryItem) {
        console.error(
          `[deleteQuote] Error fetching item ${item.item_id}:`,
          itemError,
        );
        continue;
      }

      if (inventoryItem.is_serialized) {
        // For serialized items, change unit statuses from "out" back to "available"
        const { data: outUnits, error: unitsError } = await supabase
          .from("inventory_units")
          .select("id")
          .eq("item_id", item.item_id)
          .eq("status", "out")
          .limit(item.quantity);

        if (unitsError) {
          console.error(
            `[deleteQuote] Error fetching units for item ${item.item_id}:`,
            unitsError,
          );
        } else if (outUnits && outUnits.length >= item.quantity) {
          const unitIds = outUnits.slice(0, item.quantity).map((u) => u.id);
          const { error: updateUnitsError } = await supabase
            .from("inventory_units")
            .update({ status: "available" })
            .in("id", unitIds);

          if (updateUnitsError) {
            console.error(
              `[deleteQuote] Error updating units for item ${item.item_id}:`,
              updateUnitsError,
            );
          }
        }
      } else {
        // For non-serialized items, increase total_quantity in inventory_stock
        const { data: stock, error: stockError } = await supabase
          .from("inventory_stock")
          .select("total_quantity, out_of_service_quantity")
          .eq("item_id", item.item_id)
          .single();

        if (stockError && stockError.code !== "PGRST116") {
          console.error(
            `[deleteQuote] Error fetching stock for item ${item.item_id}:`,
            stockError,
          );
        } else if (stock) {
          const newTotalQuantity = stock.total_quantity + item.quantity;
          const { error: updateStockError } = await supabase
            .from("inventory_stock")
            .update({ total_quantity: newTotalQuantity })
            .eq("item_id", item.item_id);

          if (updateStockError) {
            console.error(
              `[deleteQuote] Error updating stock for item ${item.item_id}:`,
              updateStockError,
            );
          }
        } else {
          // Stock doesn't exist, create it with the restored quantity
          const { error: insertStockError } = await supabase
            .from("inventory_stock")
            .insert({
              item_id: item.item_id,
              location_id: "22222222-2222-2222-2222-222222222222", // Main Warehouse
              total_quantity: item.quantity,
              out_of_service_quantity: 0,
              tenant_id: tenantId,
            });

          if (insertStockError) {
            console.error(
              `[deleteQuote] Error creating stock for item ${item.item_id}:`,
              insertStockError,
            );
          }
        }
      }
    }
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
  revalidatePath("/"); // Revalidate inventory page to show restored availability

  return { success: true };
}

export async function addQuoteItem(formData: FormData) {
  const quoteId = String(formData.get("quote_id"));
  const itemId = String(formData.get("item_id"));
  const quantity = Number(formData.get("quantity"));
  const customPrice = formData.get("unit_price");
  const unitPrice = customPrice
    ? Number(customPrice)
    : null; // If custom price provided, use it; otherwise fetch from item

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

  // Use custom price if provided, otherwise use item's current price
  const priceToUse = unitPrice !== null && !Number.isNaN(unitPrice) && unitPrice >= 0
    ? unitPrice
    : item.price;

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
    unit_price_snapshot: priceToUse,
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
  const newQuantity = Number(formData.get("quantity"));

  if (!quoteItemId || !newQuantity || newQuantity <= 0) {
    return { error: "Quote item ID and valid quantity are required" };
  }

  // Get quote item with current quantity and quote status
  const { data: quoteItem, error: fetchError } = await supabase
    .from("quote_items")
    .select(
      `
      id,
      item_id,
      quote_id,
      quantity,
      quotes:quote_id (
        id,
        status,
        start_date,
        end_date
      )
    `,
    )
    .eq("id", quoteItemId)
    .single();

  if (fetchError || !quoteItem) {
    return { error: "Quote item not found" };
  }

  const quote = quoteItem.quotes as any;
  const quoteStatus = quote?.status;
  const oldQuantity = quoteItem.quantity;
  const itemId = quoteItem.item_id;
  const quantityDifference = newQuantity - oldQuantity;

  // Check if item is serialized
  const { data: item, error: itemError } = await supabase
    .from("inventory_items")
    .select("is_serialized")
    .eq("id", itemId)
    .eq("tenant_id", tenantId)
    .single();

  if (itemError || !item) {
    return { error: "Item not found" };
  }

  // If quote is accepted, handle inventory changes
  if (quoteStatus === "accepted") {
    if (quantityDifference < 0) {
      // Quantity reduced - restore inventory
      const restoreQuantity = Math.abs(quantityDifference);

      if (item.is_serialized) {
        // For serialized items, change unit statuses from "out" back to "available"
        const { data: outUnits, error: unitsError } = await supabase
          .from("inventory_units")
          .select("id")
          .eq("item_id", itemId)
          .eq("status", "out")
          .limit(restoreQuantity);

        if (unitsError) {
          console.error(
            `[updateQuoteItem] Error fetching units for item ${itemId}:`,
            unitsError,
          );
        } else if (outUnits && outUnits.length >= restoreQuantity) {
          const unitIds = outUnits.slice(0, restoreQuantity).map((u) => u.id);
          const { error: updateUnitsError } = await supabase
            .from("inventory_units")
            .update({ status: "available" })
            .in("id", unitIds);

          if (updateUnitsError) {
            console.error(
              `[updateQuoteItem] Error updating units for item ${itemId}:`,
              updateUnitsError,
            );
          }
        }
      } else {
        // For non-serialized items, increase total_quantity
        const { data: stock, error: stockError } = await supabase
          .from("inventory_stock")
          .select("total_quantity, out_of_service_quantity")
          .eq("item_id", itemId)
          .single();

        if (stockError && stockError.code !== "PGRST116") {
          console.error(
            `[updateQuoteItem] Error fetching stock for item ${itemId}:`,
            stockError,
          );
        } else if (stock) {
          const newTotalQuantity = stock.total_quantity + restoreQuantity;
          const { error: updateStockError } = await supabase
            .from("inventory_stock")
            .update({ total_quantity: newTotalQuantity })
            .eq("item_id", itemId);

          if (updateStockError) {
            console.error(
              `[updateQuoteItem] Error updating stock for item ${itemId}:`,
              updateStockError,
            );
          }
        } else {
          // Stock doesn't exist, create it with the restored quantity
          const { error: insertStockError } = await supabase
            .from("inventory_stock")
            .insert({
              item_id: itemId,
              location_id: "22222222-2222-2222-2222-222222222222",
              total_quantity: restoreQuantity,
              out_of_service_quantity: 0,
              tenant_id: tenantId,
            });

          if (insertStockError) {
            console.error(
              `[updateQuoteItem] Error creating stock for item ${itemId}:`,
              insertStockError,
            );
          }
        }
      }
    } else if (quantityDifference > 0) {
      // Quantity increased - need to reduce inventory further
      // Validate date-aware availability first
      const quoteStartDate = quote?.start_date;
      const quoteEndDate = quote?.end_date;

      let availableForIncrease = 0;

      if (quoteStartDate && quoteEndDate) {
        // Use date-aware availability calculation
        const { getItemAvailabilityBreakdown } = await import("@/lib/quotes");
        const breakdown = await getItemAvailabilityBreakdown(itemId, {
          quoteId: quoteItem.quote_id,
          startDate: quoteStartDate,
          endDate: quoteEndDate,
        });

        // Get all quantities of this item already in this quote (including current item)
        const { data: allQuoteItems, error: quoteItemsError } = await supabase
          .from("quote_items")
          .select("quantity")
          .eq("quote_id", quoteItem.quote_id)
          .eq("item_id", itemId);

        if (quoteItemsError) {
          console.error(
            `[updateQuoteItem] Error fetching quote items for validation:`,
            quoteItemsError,
          );
          // Fallback to basic availability
          if (item.is_serialized) {
            const { data: units } = await supabase
              .from("inventory_units")
              .select("status")
              .eq("item_id", itemId);
            if (units) {
              availableForIncrease = units.filter(
                (u) => u.status === "available",
              ).length;
            }
          } else {
            const { data: stock } = await supabase
              .from("inventory_stock")
              .select("total_quantity, out_of_service_quantity")
              .eq("item_id", itemId)
              .single();
            if (stock) {
              availableForIncrease =
                stock.total_quantity - (stock.out_of_service_quantity || 0);
            }
          }
        } else {
          // Calculate total quantity already in this quote
          const totalInThisQuote =
            allQuoteItems?.reduce((sum, qi) => sum + qi.quantity, 0) || 0;
          // Subtract the old quantity (since we're updating it)
          const otherItemsInQuote = totalInThisQuote - oldQuantity;

          // Effective available = date-aware available - other items in this quote
          const effectiveAvailable =
            breakdown.effectiveAvailable !== undefined
              ? breakdown.effectiveAvailable
              : breakdown.available;
          availableForIncrease = Math.max(
            0,
            effectiveAvailable - otherItemsInQuote,
          );
        }
      } else {
        // Fallback to basic availability if quote dates are missing
        if (item.is_serialized) {
          const { data: units } = await supabase
            .from("inventory_units")
            .select("status")
            .eq("item_id", itemId);

          if (units) {
            availableForIncrease = units.filter(
              (u) => u.status === "available",
            ).length;
          }
        } else {
          const { data: stock } = await supabase
            .from("inventory_stock")
            .select("total_quantity, out_of_service_quantity")
            .eq("item_id", itemId)
            .single();

          if (stock) {
            availableForIncrease =
              stock.total_quantity - (stock.out_of_service_quantity || 0);
          }
        }

        // Get all quantities of this item already in this quote
        const { data: allQuoteItems } = await supabase
          .from("quote_items")
          .select("quantity")
          .eq("quote_id", quoteItem.quote_id)
          .eq("item_id", itemId);

        const totalInThisQuote =
          allQuoteItems?.reduce((sum, qi) => sum + qi.quantity, 0) || 0;
        const otherItemsInQuote = totalInThisQuote - oldQuantity;
        availableForIncrease = Math.max(0, availableForIncrease - otherItemsInQuote);
      }

      if (quantityDifference > availableForIncrease) {
        return {
          error: `Insufficient availability. Only ${availableForIncrease} available to add for this date range (accounting for overlapping events and items already in this quote).`,
        };
      }

      // Reduce inventory by the difference
      if (item.is_serialized) {
        const { data: availableUnits, error: unitsError } = await supabase
          .from("inventory_units")
          .select("id")
          .eq("item_id", itemId)
          .eq("status", "available")
          .limit(quantityDifference);

        if (unitsError) {
          console.error(
            `[updateQuoteItem] Error fetching units for item ${itemId}:`,
            unitsError,
          );
        } else if (availableUnits && availableUnits.length >= quantityDifference) {
          const unitIds = availableUnits
            .slice(0, quantityDifference)
            .map((u) => u.id);
          const { error: updateUnitsError } = await supabase
            .from("inventory_units")
            .update({ status: "out" })
            .in("id", unitIds);

          if (updateUnitsError) {
            console.error(
              `[updateQuoteItem] Error updating units for item ${itemId}:`,
              updateUnitsError,
            );
          }
        }
      } else {
        const { data: stock, error: stockError } = await supabase
          .from("inventory_stock")
          .select("total_quantity, out_of_service_quantity")
          .eq("item_id", itemId)
          .single();

        if (stockError && stockError.code !== "PGRST116") {
          console.error(
            `[updateQuoteItem] Error fetching stock for item ${itemId}:`,
            stockError,
          );
        } else if (stock) {
          const newTotalQuantity = Math.max(
            0,
            stock.total_quantity - quantityDifference,
          );
          const { error: updateStockError } = await supabase
            .from("inventory_stock")
            .update({ total_quantity: newTotalQuantity })
            .eq("item_id", itemId);

          if (updateStockError) {
            console.error(
              `[updateQuoteItem] Error updating stock for item ${itemId}:`,
              updateStockError,
            );
          }
        }
      }
    }
  } else {
    // Quote is draft - validate date-aware availability
    // Get quote dates for date-aware calculation
    const quoteStartDate = quote?.start_date;
    const quoteEndDate = quote?.end_date;

    if (quoteStartDate && quoteEndDate) {
      // Use date-aware availability calculation
      const { getItemAvailabilityBreakdown } = await import("@/lib/quotes");
      const breakdown = await getItemAvailabilityBreakdown(itemId, {
        quoteId: quoteItem.quote_id,
        startDate: quoteStartDate,
        endDate: quoteEndDate,
      });

      // Get all quantities of this item already in this quote (including current item)
      const { data: allQuoteItems, error: quoteItemsError } = await supabase
        .from("quote_items")
        .select("quantity")
        .eq("quote_id", quoteItem.quote_id)
        .eq("item_id", itemId);

      if (quoteItemsError) {
        console.error(
          `[updateQuoteItem] Error fetching quote items for validation:`,
          quoteItemsError,
        );
      } else {
        // Calculate total quantity already in this quote
        const totalInThisQuote =
          allQuoteItems?.reduce((sum, qi) => sum + qi.quantity, 0) || 0;
        // Subtract the old quantity (since we're updating it)
        const otherItemsInQuote = totalInThisQuote - oldQuantity;

        // Effective available = date-aware available - other items in this quote
        const effectiveAvailable =
          breakdown.effectiveAvailable !== undefined
            ? breakdown.effectiveAvailable
            : breakdown.available;
        const availableForThisQuote = Math.max(
          0,
          effectiveAvailable - otherItemsInQuote,
        );

        if (newQuantity > availableForThisQuote) {
          return {
            error: `Insufficient availability. Only ${availableForThisQuote} available for this date range (accounting for overlapping events and items already in this quote).`,
          };
        }
      }
    } else {
      // Fallback to basic availability if quote dates are missing
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

      // Get all quantities of this item already in this quote
      const { data: allQuoteItems } = await supabase
        .from("quote_items")
        .select("quantity")
        .eq("quote_id", quoteItem.quote_id)
        .eq("item_id", itemId);

      const totalInThisQuote =
        allQuoteItems?.reduce((sum, qi) => sum + qi.quantity, 0) || 0;
      const otherItemsInQuote = totalInThisQuote - oldQuantity;
      const availableForThisQuote = Math.max(0, available - otherItemsInQuote);

      if (newQuantity > availableForThisQuote) {
        return {
          error: `Insufficient availability. Only ${availableForThisQuote} available (accounting for items already in this quote).`,
        };
      }
    }
  }

  // Update the quote item quantity
  const { error } = await supabase
    .from("quote_items")
    .update({ quantity: newQuantity })
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
  revalidatePath("/"); // Revalidate inventory page

  return { success: true };
}

export async function deleteQuoteItem(formData: FormData) {
  const quoteItemId = String(formData.get("quote_item_id"));

  if (!quoteItemId) {
    return { error: "Quote item ID is required" };
  }

  // Get quote item details and quote status before deleting
  const { data: quoteItem, error: fetchError } = await supabase
    .from("quote_items")
    .select(
      `
      id,
      quote_id,
      item_id,
      quantity,
      quotes:quote_id (
        id,
        status
      )
    `,
    )
    .eq("id", quoteItemId)
    .single();

  if (fetchError || !quoteItem) {
    console.error("[deleteQuoteItem] Error fetching quote item:", {
      action: "deleteQuoteItem",
      quote_item_id: quoteItemId,
      error: fetchError?.message,
    });
    return { error: "Quote item not found" };
  }

  const quote = quoteItem.quotes as any;
  const quoteStatus = quote?.status;
  const itemId = quoteItem.item_id;
  const quantity = quoteItem.quantity;

  // If quote is accepted (confirmed), restore inventory
  if (quoteStatus === "accepted") {
    // Check if item is serialized
    const { data: item, error: itemError } = await supabase
      .from("inventory_items")
      .select("is_serialized")
      .eq("id", itemId)
      .eq("tenant_id", tenantId)
      .single();

    if (itemError || !item) {
      console.error(
        `[deleteQuoteItem] Error fetching item ${itemId}:`,
        itemError,
      );
      // Continue with deletion even if we can't restore inventory
    } else {
      if (item.is_serialized) {
        // For serialized items, change unit statuses from "out" back to "available"
        const { data: outUnits, error: unitsError } = await supabase
          .from("inventory_units")
          .select("id")
          .eq("item_id", itemId)
          .eq("status", "out")
          .limit(quantity);

        if (unitsError) {
          console.error(
            `[deleteQuoteItem] Error fetching units for item ${itemId}:`,
            unitsError,
          );
        } else if (outUnits && outUnits.length >= quantity) {
          const unitIds = outUnits.slice(0, quantity).map((u) => u.id);
          const { error: updateUnitsError } = await supabase
            .from("inventory_units")
            .update({ status: "available" })
            .in("id", unitIds);

          if (updateUnitsError) {
            console.error(
              `[deleteQuoteItem] Error updating units for item ${itemId}:`,
              updateUnitsError,
            );
          }
        }
      } else {
        // For non-serialized items, increase total_quantity in inventory_stock
        const { data: stock, error: stockError } = await supabase
          .from("inventory_stock")
          .select("total_quantity, out_of_service_quantity")
          .eq("item_id", itemId)
          .single();

        if (stockError && stockError.code !== "PGRST116") {
          console.error(
            `[deleteQuoteItem] Error fetching stock for item ${itemId}:`,
            stockError,
          );
        } else if (stock) {
          const newTotalQuantity = stock.total_quantity + quantity;
          const { error: updateStockError } = await supabase
            .from("inventory_stock")
            .update({ total_quantity: newTotalQuantity })
            .eq("item_id", itemId);

          if (updateStockError) {
            console.error(
              `[deleteQuoteItem] Error updating stock for item ${itemId}:`,
              updateStockError,
            );
          }
        } else {
          // Stock doesn't exist, create it with the restored quantity
          const { error: insertStockError } = await supabase
            .from("inventory_stock")
            .insert({
              item_id: itemId,
              location_id: "22222222-2222-2222-2222-222222222222", // Main Warehouse
              total_quantity: quantity,
              out_of_service_quantity: 0,
              tenant_id: tenantId,
            });

          if (insertStockError) {
            console.error(
              `[deleteQuoteItem] Error creating stock for item ${itemId}:`,
              insertStockError,
            );
          }
        }
      }
    }
  }

  // Delete the quote item
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
  revalidatePath(`/quotes/${quoteItem.quote_id}`);
  revalidatePath("/"); // Revalidate inventory page to show restored availability

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
    .select("id, name, price, is_serialized, group_id")
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

  // Fetch group names for the items
  const groupIds = [...new Set(items.map((item) => item.group_id))];
  const { data: groups, error: groupsError } = await supabase
    .from("inventory_groups")
    .select("id, name")
    .in("id", groupIds);

  const groupMap = new Map(
    (groups || []).map((group) => [group.id, group.name]),
  );

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
          group_id: item.group_id,
          group_name: groupMap.get(item.group_id) || "Unknown",
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
          group_id: item.group_id,
          group_name: groupMap.get(item.group_id) || "Unknown",
          available,
          total,
        };
      }
    }),
  );

  return itemsWithAvailability;
}

export async function getAllInventoryItemsForQuote(
  quoteContext?: {
    quoteId: string;
    startDate: string;
    endDate: string;
  },
) {
  // Fetch items and groups in parallel
  const [itemsResult, groupsResult] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("id, name, price, is_serialized, group_id")
      .eq("active", true)
      .eq("tenant_id", tenantId)
      .order("name"),
    supabase
      .from("inventory_groups")
      .select("id, name")
      .order("name"),
  ]);

  if (itemsResult.error) {
    console.error("[getAllInventoryItemsForQuote] Error fetching items:", {
      action: "getAllInventoryItemsForQuote",
      error: itemsResult.error.message,
    });
    return [];
  }

  const items = itemsResult.data || [];
  if (items.length === 0) {
    return [];
  }

  const groupMap = new Map(
    (groupsResult.data || []).map((group) => [group.id, group.name]),
  );

  // Separate serialized and non-serialized items for batch queries
  const serializedItemIds: string[] = [];
  const nonSerializedItemIds: string[] = [];
  
  items.forEach((item) => {
    if (item.is_serialized) {
      serializedItemIds.push(item.id);
    } else {
      nonSerializedItemIds.push(item.id);
    }
  });

  // Batch fetch all availability data in parallel
  const [serializedUnits, nonSerializedStock, overlappingReservations] = await Promise.all([
    // Fetch all serialized units in one query
    serializedItemIds.length > 0
      ? supabase
          .from("inventory_units")
          .select("item_id, status")
          .in("item_id", serializedItemIds)
      : Promise.resolve({ data: [], error: null }),
    
    // Fetch all non-serialized stock in one query
    nonSerializedItemIds.length > 0
      ? supabase
          .from("inventory_stock")
          .select("item_id, total_quantity, out_of_service_quantity")
          .in("item_id", nonSerializedItemIds)
      : Promise.resolve({ data: [], error: null }),
    
    // Fetch overlapping reservations if quoteContext provided
    quoteContext
      ? (async () => {
          const { data: allQuoteItems } = await supabase
            .from("quote_items")
            .select(
              `
              item_id,
              quantity,
              quote_id,
              quotes:quote_id (
                id,
                start_date,
                end_date
              )
            `,
            )
            .neq("quote_id", quoteContext.quoteId);

          if (!allQuoteItems) return new Map<string, number>();

          // Filter overlapping quotes and sum by item_id
          const reservedMap = new Map<string, number>();
          const quoteStart = new Date(quoteContext.startDate);
          const quoteEnd = new Date(quoteContext.endDate);

          allQuoteItems.forEach((qi: any) => {
            const quote = qi.quotes;
            if (!quote) return;

            const qStart = new Date(quote.start_date);
            const qEnd = new Date(quote.end_date);

            // Check overlap: start1 <= end2 && start2 <= end1
            if (quoteStart <= qEnd && qStart <= quoteEnd) {
              const current = reservedMap.get(qi.item_id) || 0;
              reservedMap.set(qi.item_id, current + qi.quantity);
            }
          });

          return reservedMap;
        })()
      : Promise.resolve(new Map<string, number>()),
  ]);

  // Build availability maps for fast lookup
  const serializedAvailability = new Map<string, { available: number; total: number }>();
  if (serializedUnits.data) {
    serializedUnits.data.forEach((unit: any) => {
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

  const nonSerializedAvailability = new Map<string, { available: number; total: number; outOfService: number }>();
  if (nonSerializedStock.data) {
    nonSerializedStock.data.forEach((stock: any) => {
      const outOfService = stock.out_of_service_quantity || 0;
      nonSerializedAvailability.set(stock.item_id, {
        available: stock.total_quantity - outOfService,
        total: stock.total_quantity,
        outOfService,
      });
    });
  }

  // For non-serialized items, calculate original total (add back accepted quote quantities)
  const acceptedReservations = new Map<string, number>();
  if (nonSerializedItemIds.length > 0) {
    const { data: acceptedQuoteItems } = await supabase
      .from("quote_items")
      .select("item_id, quantity, quotes:quote_id!inner(status)")
      .in("item_id", nonSerializedItemIds)
      .eq("quotes.status", "accepted");

    if (acceptedQuoteItems) {
      acceptedQuoteItems.forEach((qi: any) => {
        const current = acceptedReservations.get(qi.item_id) || 0;
        acceptedReservations.set(qi.item_id, current + qi.quantity);
      });
    }
  }

  // Build result array with pre-calculated availability
  const itemsWithAvailability = items.map((item) => {
    const groupName = groupMap.get(item.group_id) || "Unknown";
    const overlappingReserved = overlappingReservations.get(item.id) || 0;

    if (item.is_serialized) {
      const availability = serializedAvailability.get(item.id) || { available: 0, total: 0 };
      // For serialized: effectiveAvailable = total - outOfService - overlappingReserved
      // But we need to count outOfService (maintenance status units)
      // For now, use a simplified calculation
      const effectiveAvailable = quoteContext
        ? Math.max(0, availability.available - overlappingReserved)
        : undefined;

      return {
        id: item.id,
        name: item.name,
        price: item.price,
        is_serialized: item.is_serialized,
        group_id: item.group_id,
        group_name: groupName,
        available: availability.available,
        total: availability.total,
        effectiveAvailable,
        reservedInOverlappingEvents: quoteContext ? overlappingReserved : undefined,
      };
    } else {
      const availability = nonSerializedAvailability.get(item.id) || { available: 0, total: 0, outOfService: 0 };
      const acceptedQty = acceptedReservations.get(item.id) || 0;
      const originalTotal = availability.total + acceptedQty;
      // effectiveAvailable = originalTotal - outOfService - overlappingReserved
      const effectiveAvailable = quoteContext
        ? Math.max(0, originalTotal - availability.outOfService - overlappingReserved)
        : undefined;

      return {
        id: item.id,
        name: item.name,
        price: item.price,
        is_serialized: item.is_serialized,
        group_id: item.group_id,
        group_name: groupName,
        available: availability.available,
        total: originalTotal,
        effectiveAvailable,
        reservedInOverlappingEvents: quoteContext ? overlappingReserved : undefined,
      };
    }
  });

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

export async function confirmQuotation(formData: FormData) {
  const quoteId = String(formData.get("quote_id"));

  if (!quoteId) {
    return { ok: false, error: "Quote ID is required." };
  }

  // Fetch the quote with items
  const { getQuoteWithItems } = await import("@/lib/quotes");
  const quote = await getQuoteWithItems(quoteId);

  if (!quote) {
    return { ok: false, error: "Quote not found." };
  }

  if (quote.status !== "draft") {
    return { ok: false, error: "Only draft quotes can be confirmed." };
  }

  if (quote.items.length === 0) {
    return { ok: false, error: "Cannot confirm a quote with no items." };
  }

  // Check availability for all items before confirming
  const { getItemAvailabilityBreakdown } = await import("@/lib/quotes");
  const availabilityChecks = await Promise.all(
    quote.items.map(async (item) => {
      const breakdown = await getItemAvailabilityBreakdown(item.item_id, {
        quoteId: quote.id,
        startDate: quote.start_date,
        endDate: quote.end_date,
      });
      return {
        itemId: item.item_id,
        itemName: item.item_name || "Unknown",
        required: item.quantity,
        available: breakdown.effectiveAvailable ?? breakdown.available,
        isSerialized: item.item_is_serialized ?? false,
      };
    }),
  );

  // Check if all items have sufficient availability
  const insufficientItems = availabilityChecks.filter(
    (check) => check.required > check.available,
  );

  if (insufficientItems.length > 0) {
    const itemNames = insufficientItems.map((i) => i.itemName).join(", ");
    return {
      ok: false,
      error: `Insufficient availability for: ${itemNames}`,
    };
  }

  // Update quote status to "accepted"
  const { error: updateQuoteError } = await supabase
    .from("quotes")
    .update({ status: "accepted" })
    .eq("id", quoteId)
    .eq("tenant_id", tenantId);

  if (updateQuoteError) {
    console.error("[confirmQuotation] Error updating quote status:", updateQuoteError);
    return { ok: false, error: "Failed to update quote status." };
  }

  // Reduce inventory availability for each item
  for (const item of quote.items) {
    const check = availabilityChecks.find((c) => c.itemId === item.item_id);
    if (!check) continue;

    if (check.isSerialized) {
      // For serialized items, update unit statuses from "available" to "out"
      const { data: availableUnits, error: unitsError } = await supabase
        .from("inventory_units")
        .select("id")
        .eq("item_id", item.item_id)
        .eq("status", "available")
        .limit(item.quantity);

      if (unitsError) {
        console.error(
          `[confirmQuotation] Error fetching units for item ${item.item_id}:`,
          unitsError,
        );
        continue;
      }

      if (availableUnits && availableUnits.length >= item.quantity) {
        const unitIds = availableUnits.slice(0, item.quantity).map((u) => u.id);
        const { error: updateUnitsError } = await supabase
          .from("inventory_units")
          .update({ status: "out" })
          .in("id", unitIds);

        if (updateUnitsError) {
          console.error(
            `[confirmQuotation] Error updating units for item ${item.item_id}:`,
            updateUnitsError,
          );
        }
      }
    } else {
      // For non-serialized items, reduce total_quantity in inventory_stock
      const { data: stock, error: stockError } = await supabase
        .from("inventory_stock")
        .select("total_quantity, out_of_service_quantity")
        .eq("item_id", item.item_id)
        .single();

      if (stockError && stockError.code !== "PGRST116") {
        console.error(
          `[confirmQuotation] Error fetching stock for item ${item.item_id}:`,
          stockError,
        );
        continue;
      }

      if (stock) {
        const newTotalQuantity = Math.max(0, stock.total_quantity - item.quantity);
        const { error: updateStockError } = await supabase
          .from("inventory_stock")
          .update({ total_quantity: newTotalQuantity })
          .eq("item_id", item.item_id);

        if (updateStockError) {
          console.error(
            `[confirmQuotation] Error updating stock for item ${item.item_id}:`,
            updateStockError,
          );
        }
      } else {
        // Stock doesn't exist, create it with negative quantity (shouldn't happen if availability check worked)
        console.warn(
          `[confirmQuotation] No stock record found for item ${item.item_id}, creating one.`,
        );
        const { error: insertStockError } = await supabase
          .from("inventory_stock")
          .insert({
            item_id: item.item_id,
            location_id: "22222222-2222-2222-2222-222222222222", // Main Warehouse
            total_quantity: -item.quantity, // Negative to reflect the reduction
            out_of_service_quantity: 0,
            tenant_id: tenantId,
          });

        if (insertStockError) {
          console.error(
            `[confirmQuotation] Error creating stock for item ${item.item_id}:`,
            insertStockError,
          );
        }
      }
    }
  }

  // Automatically create Event from approved quote
  try {
    const { createEvent } = await import("@/app/actions/events");
    const eventFormData = new FormData();
    eventFormData.append("name", quote.name);
    eventFormData.append("description", `Event created from quote: ${quote.name}`);
    eventFormData.append("start_date", quote.start_date);
    eventFormData.append("end_date", quote.end_date);
    eventFormData.append("quote_id", quoteId);
    eventFormData.append("status", "confirmed");

    const eventResult = await createEvent(eventFormData);
    if (eventResult.error) {
      console.error("[confirmQuotation] Error creating event:", eventResult.error);
      // Don't fail the quote confirmation if event creation fails
      // Event can be created manually later if needed
    }
  } catch (error) {
    console.error("[confirmQuotation] Unexpected error creating event:", error);
    // Don't fail the quote confirmation if event creation fails
  }

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/events"); // Revalidate events page
  revalidatePath("/"); // Revalidate inventory page

  return { ok: true, message: "Quotation confirmed successfully! Event created automatically." };
}