import { supabase } from "./supabase";

export interface Quote {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: "draft" | "sent" | "accepted" | "rejected";
  created_at: string;
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  item_id: string;
  quantity: number;
  unit_price_snapshot: number;
  // Joined data
  item_name?: string;
  item_price?: number;
  item_is_serialized?: boolean;
}

export interface QuoteWithItems extends Quote {
  items: QuoteItem[];
}

export interface ItemAvailability {
  available: number;
  total: number;
}

export interface ItemAvailabilityBreakdown {
  available: number;
  reserved: number; // From quote_items (read-only)
  inTransit: number; // Units with status "out" (serialized) or out_of_service_quantity (non-serialized)
  outOfService: number; // Units with status "maintenance" (serialized) or 0 (non-serialized)
  total: number;
  effectiveAvailable?: number; // total - out_of_service - reserved_in_overlapping_events
  reservedInOverlappingEvents?: number; // Sum from other overlapping quotes/events
}

export async function getQuotes(): Promise<Quote[]> {
  const tenantId = "11111111-1111-1111-1111-111111111111";

  const { data: quotes, error } = await supabase
    .from("quotes")
    .select("id, name, start_date, end_date, status, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching quotes:", error);
    return [];
  }

  return quotes || [];
}

export async function getQuoteWithItems(
  quoteId: string,
): Promise<QuoteWithItems | null> {
  if (!quoteId) {
    return null;
  }

  const tenantId = "11111111-1111-1111-1111-111111111111";

  // Fetch quote
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, name, start_date, end_date, status, created_at")
    .eq("id", quoteId)
    .eq("tenant_id", tenantId)
    .single();

  if (quoteError) {
    // PGRST116 is "not found" error, which is fine - quote doesn't exist
    // 22P02 is "invalid input syntax for type uuid" - also means quote doesn't exist or invalid ID
    // Only log actual errors, not "not found" or invalid UUID errors
    if (
      quoteError.code &&
      quoteError.code !== "PGRST116" &&
      quoteError.code !== "22P02"
    ) {
      console.error("Error fetching quote:", quoteError);
    }
    return null;
  }

  if (!quote) {
    return null;
  }

  // Fetch quote items with item details
  const { data: quoteItems, error: itemsError } = await supabase
    .from("quote_items")
    .select(
      `
      id,
      quote_id,
      item_id,
      quantity,
      unit_price_snapshot,
      inventory_items:item_id (
        name,
        price,
        is_serialized
      )
    `,
    )
    .eq("quote_id", quoteId)
    .order("created_at", { ascending: true });

  if (itemsError) {
    console.error("Error fetching quote items:", itemsError);
    return { ...quote, items: [] };
  }

  const items: QuoteItem[] =
    quoteItems?.map((qi: any) => ({
      id: qi.id,
      quote_id: qi.quote_id,
      item_id: qi.item_id,
      quantity: qi.quantity,
      unit_price_snapshot: qi.unit_price_snapshot,
      item_name: qi.inventory_items?.name,
      item_price: qi.inventory_items?.price,
      item_is_serialized: qi.inventory_items?.is_serialized,
    })) || [];

  return { ...quote, items };
}

export async function getItemAvailability(
  itemId: string,
): Promise<ItemAvailability> {
  const tenantId = "11111111-1111-1111-1111-111111111111";

  // First, check if item is serialized
  const { data: item, error: itemError } = await supabase
    .from("inventory_items")
    .select("is_serialized")
    .eq("id", itemId)
    .eq("tenant_id", tenantId)
    .single();

  if (itemError || !item) {
    return { available: 0, total: 0 };
  }

  if (item.is_serialized) {
    // For serialized items, count units
    const { data: units, error: unitsError } = await supabase
      .from("inventory_units")
      .select("status")
      .eq("item_id", itemId);

    if (unitsError || !units) {
      return { available: 0, total: 0 };
    }

    const total = units.length;
    const available = units.filter((u) => u.status === "available").length;

    return { available, total };
  } else {
    // For non-serialized items, check stock
    const { data: stock, error: stockError } = await supabase
      .from("inventory_stock")
      .select("total_quantity, out_of_service_quantity")
      .eq("item_id", itemId)
      .single();

    if (stockError || !stock) {
      return { available: 0, total: 0 };
    }

    const total = stock.total_quantity;
    const available =
      stock.total_quantity - (stock.out_of_service_quantity || 0);

    return { available, total };
  }
}

/**
 * Get reserved quantity for an item from all quote_items (read-only)
 */
export async function getReservedQuantity(itemId: string): Promise<number> {
  const tenantId = "11111111-1111-1111-1111-111111111111";

  // Sum all quantities for this item across all quotes
  const { data: quoteItems, error } = await supabase
    .from("quote_items")
    .select("quantity")
    .eq("item_id", itemId);

  if (error || !quoteItems) {
    return 0;
  }

  return quoteItems.reduce((sum, qi) => sum + qi.quantity, 0);
}

/**
 * Check if two date ranges overlap
 */
function dateRangesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): boolean {
  const startDate1 = new Date(start1);
  const endDate1 = new Date(end1);
  const startDate2 = new Date(start2);
  const endDate2 = new Date(end2);

  // Two ranges overlap if: start1 <= end2 && start2 <= end1
  return startDate1 <= endDate2 && startDate2 <= endDate1;
}

/**
 * Get reserved quantity for an item from OTHER overlapping quotes/events (excluding current quote)
 * Read-only calculation - no mutations
 */
export async function getReservedQuantityFromOverlappingEvents(
  itemId: string,
  excludeQuoteId: string,
  quoteStartDate: string,
  quoteEndDate: string,
): Promise<number> {
  const tenantId = "11111111-1111-1111-1111-111111111111";

  // Fetch all quotes with their items for this item_id, excluding the current quote
  const { data: quoteItems, error } = await supabase
    .from("quote_items")
    .select(
      `
      quantity,
      quote_id,
      quotes:quote_id (
        id,
        start_date,
        end_date
      )
    `,
    )
    .eq("item_id", itemId)
    .neq("quote_id", excludeQuoteId);

  if (error || !quoteItems) {
    return 0;
  }

  // Filter to only overlapping quotes and sum their quantities
  let reserved = 0;
  for (const qi of quoteItems) {
    const quote = qi.quotes as any;
    if (
      quote &&
      dateRangesOverlap(
        quoteStartDate,
        quoteEndDate,
        quote.start_date,
        quote.end_date,
      )
    ) {
      reserved += qi.quantity;
    }
  }

  return reserved;
}

/**
 * Get detailed availability breakdown for an item
 * @param itemId - The item ID
 * @param quoteContext - Optional quote context for date-aware availability calculation
 */
export async function getItemAvailabilityBreakdown(
  itemId: string,
  quoteContext?: {
    quoteId: string;
    startDate: string;
    endDate: string;
  },
): Promise<ItemAvailabilityBreakdown> {
  const tenantId = "11111111-1111-1111-1111-111111111111";

  // First, check if item is serialized
  const { data: item, error: itemError } = await supabase
    .from("inventory_items")
    .select("is_serialized")
    .eq("id", itemId)
    .eq("tenant_id", tenantId)
    .single();

  if (itemError || !item) {
    return {
      available: 0,
      reserved: 0,
      inTransit: 0,
      outOfService: 0,
      total: 0,
    };
  }

  // Get reserved quantity from quote_items (all quotes, for backward compatibility)
  const reserved = await getReservedQuantity(itemId);

  // Get reserved quantity from overlapping events (if quote context provided)
  let reservedInOverlappingEvents = 0;
  if (quoteContext) {
    reservedInOverlappingEvents =
      await getReservedQuantityFromOverlappingEvents(
        itemId,
        quoteContext.quoteId,
        quoteContext.startDate,
        quoteContext.endDate,
      );
  }

  if (item.is_serialized) {
    // For serialized items, count units by status
    const { data: units, error: unitsError } = await supabase
      .from("inventory_units")
      .select("status")
      .eq("item_id", itemId);

    if (unitsError || !units) {
      return {
        available: 0,
        reserved,
        inTransit: 0,
        outOfService: 0,
        total: 0,
      };
    }

    const total = units.length;
    const available = units.filter((u) => u.status === "available").length;
    const inTransit = units.filter((u) => u.status === "out").length;
    const outOfService = units.filter((u) => u.status === "maintenance").length;

    // Calculate effective available: total - out_of_service - reserved_in_overlapping_events
    const effectiveAvailable = Math.max(
      0,
      total - outOfService - reservedInOverlappingEvents,
    );

    return {
      available,
      reserved,
      inTransit,
      outOfService,
      total,
      effectiveAvailable: quoteContext ? effectiveAvailable : undefined,
      reservedInOverlappingEvents: quoteContext
        ? reservedInOverlappingEvents
        : undefined,
    };
  } else {
    // For non-serialized items, check stock
    const { data: stock, error: stockError } = await supabase
      .from("inventory_stock")
      .select("total_quantity, out_of_service_quantity")
      .eq("item_id", itemId)
      .single();

    if (stockError || !stock) {
      return {
        available: 0,
        reserved,
        inTransit: 0,
        outOfService: 0,
        total: 0,
      };
    }

    const total = stock.total_quantity;
    const outOfService = stock.out_of_service_quantity || 0;
    const available = total - outOfService;
    // For non-serialized items, In-Transit does not apply (always 0)
    const inTransit = 0;

    // Calculate effective available: total - out_of_service - reserved_in_overlapping_events
    const effectiveAvailable = Math.max(
      0,
      total - outOfService - reservedInOverlappingEvents,
    );

    return {
      available,
      reserved,
      inTransit,
      outOfService,
      total,
      effectiveAvailable: quoteContext ? effectiveAvailable : undefined,
      reservedInOverlappingEvents: quoteContext
        ? reservedInOverlappingEvents
        : undefined,
    };
  }
}

/**
 * Calculate suggested buffer quantity for an item
 * Serialized: +1 if total units < 5
 * Non-serialized: +10-20% rounded up
 */
export function calculateBufferQuantity(
  isSerialized: boolean,
  total: number,
  requestedQuantity: number,
): number {
  if (isSerialized) {
    // Serialized: suggest +1 if total units < 5
    if (total < 5) {
      return 1;
    }
    return 0;
  } else {
    // Non-serialized: suggest +10-20% rounded up
    const bufferPercent = requestedQuantity < 10 ? 0.2 : 0.1; // 20% for small quantities, 10% for larger
    const buffer = Math.ceil(requestedQuantity * bufferPercent);
    return buffer;
  }
}

/**
 * Calculate risk level for a quote based on availability vs requested quantities
 * Green: sufficient available + buffer (available >= requested + buffer)
 * Yellow: tight but possible (available >= requested but < requested + buffer)
 * Red: insufficient inventory (available < requested)
 */
export type RiskLevel = "green" | "yellow" | "red";

export function calculateQuoteRisk(
  items: Array<{
    item_id: string;
    quantity: number;
    item_is_serialized?: boolean;
  }>,
  availabilities: Map<string, ItemAvailabilityBreakdown>,
): RiskLevel {
  let hasRed = false;
  let hasYellow = false;

  for (const item of items) {
    const breakdown = availabilities.get(item.item_id);
    if (!breakdown) {
      hasRed = true;
      continue;
    }

    const requested = item.quantity;
    const buffer = calculateBufferQuantity(
      item.item_is_serialized || false,
      breakdown.total,
      requested,
    );
    // Use effectiveAvailable if available (date-aware), otherwise fall back to available
    const available =
      breakdown.effectiveAvailable !== undefined
        ? breakdown.effectiveAvailable
        : breakdown.available;

    if (available < requested) {
      hasRed = true;
    } else if (available < requested + buffer) {
      hasYellow = true;
    }
  }

  if (hasRed) return "red";
  if (hasYellow) return "yellow";
  return "green";
}