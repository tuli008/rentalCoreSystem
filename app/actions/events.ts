"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";

const tenantId = "11111111-1111-1111-1111-111111111111";

export interface Event {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  location: string | null;
  status: "draft" | "confirmed" | "in_progress" | "completed" | "cancelled";
  quote_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventInventory {
  id: string;
  event_id: string;
  item_id: string;
  quantity: number;
  unit_price_snapshot: number;
  notes: string | null;
  item_name?: string; // Joined from inventory_items
}

export interface EventCrew {
  id: string;
  event_id: string;
  crew_member_id: string;
  role: string;
  call_time: string | null;
  end_time: string | null;
  hourly_rate: number | null;
  notes: string | null;
  crew_member_name?: string; // Joined from crew_members
  crew_member_email?: string;
  crew_member_contact?: string;
}

export interface EventTask {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  assigned_to_crew_id: string | null;
  due_time: string | null;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  created_at: string;
  updated_at: string;
}

/**
 * Get all events
 */
export async function getEvents(): Promise<Event[]> {
  try {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("start_date", { ascending: false });

    if (error) {
      console.error("[getEvents] Error:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("[getEvents] Unexpected error:", error);
    return [];
  }
}

/**
 * Copy quote items to event inventory
 */
async function copyQuoteItemsToEvent(eventId: string, quoteId: string): Promise<boolean> {
  try {
    // Check if items already exist
    const { data: existingItems } = await supabase
      .from("event_inventory")
      .select("id")
      .eq("event_id", eventId)
      .eq("tenant_id", tenantId)
      .limit(1);

    if (existingItems && existingItems.length > 0) {
      // Items already exist, don't copy again
      return true;
    }

    // Fetch all quote items
    const { data: quoteItems, error: quoteItemsError } = await supabase
      .from("quote_items")
      .select("item_id, quantity, unit_price_snapshot")
      .eq("quote_id", quoteId);

    if (quoteItemsError) {
      console.error("[copyQuoteItemsToEvent] Error fetching quote items:", quoteItemsError);
      return false;
    }

    if (!quoteItems || quoteItems.length === 0) {
      console.log("[copyQuoteItemsToEvent] No quote items to copy");
      return true; // Not an error, just no items
    }

    // Insert all quote items into event_inventory
    const eventInventoryItems = quoteItems.map((item) => ({
      event_id: eventId,
      item_id: item.item_id,
      quantity: item.quantity,
      unit_price_snapshot: item.unit_price_snapshot,
      tenant_id: tenantId,
      notes: null,
    }));

    const { error: inventoryError } = await supabase
      .from("event_inventory")
      .insert(eventInventoryItems);

    if (inventoryError) {
      console.error("[copyQuoteItemsToEvent] Error copying items to event inventory:", inventoryError);
      return false;
    }

    console.log(`[copyQuoteItemsToEvent] Successfully copied ${quoteItems.length} items to event ${eventId}`);
    return true;
  } catch (error) {
    console.error("[copyQuoteItemsToEvent] Unexpected error:", error);
    return false;
  }
}

/**
 * Get event with all related data
 */
export async function getEventWithDetails(eventId: string): Promise<{
  event: Event | null;
  inventory: EventInventory[];
  crew: EventCrew[];
  tasks: EventTask[];
}> {
  try {
    const [eventResult, inventoryResult, crewResult, tasksResult] =
      await Promise.all([
        supabase
          .from("events")
          .select("*")
          .eq("id", eventId)
          .eq("tenant_id", tenantId)
          .single(),
        supabase
          .from("event_inventory")
          .select(
            `
            *,
            inventory_items:item_id (
              name
            )
          `,
          )
          .eq("event_id", eventId)
          .eq("tenant_id", tenantId),
        supabase
          .from("event_crew")
          .select(
            `
            *,
            crew_members:crew_member_id (
              name,
              email,
              contact
            )
          `,
          )
          .eq("event_id", eventId)
          .eq("tenant_id", tenantId),
        supabase
          .from("event_tasks")
          .select("*")
          .eq("event_id", eventId)
          .eq("tenant_id", tenantId)
          .order("due_time", { ascending: true, nullsFirst: false }),
      ]);

    if (eventResult.error) {
      console.error("[getEventWithDetails] Error fetching event:", eventResult.error);
      return { event: null, inventory: [], crew: [], tasks: [] };
    }

    const event = eventResult.data;

    // If event has quote_id but no inventory items, copy from quote
    if (event.quote_id && (!inventoryResult.data || inventoryResult.data.length === 0)) {
      console.log(`[getEventWithDetails] Event ${eventId} has quote_id ${event.quote_id} but no inventory, copying items...`);
      const copied = await copyQuoteItemsToEvent(eventId, event.quote_id);
      
      if (copied) {
        // Re-fetch inventory after copying
        const { data: updatedInventory } = await supabase
          .from("event_inventory")
          .select(
            `
            *,
            inventory_items:item_id (
              name
            )
          `,
          )
          .eq("event_id", eventId)
          .eq("tenant_id", tenantId);

        const inventory = (updatedInventory || []).map((item: any) => ({
          ...item,
          item_name: item.inventory_items?.name,
        }));

        const crew = (crewResult.data || []).map((member: any) => ({
          ...member,
          crew_member_name: member.crew_members?.name,
          crew_member_email: member.crew_members?.email,
          crew_member_contact: member.crew_members?.contact,
        }));

        return {
          event,
          inventory,
          crew,
          tasks: tasksResult.data || [],
        };
      }
    }

    const inventory = (inventoryResult.data || []).map((item: any) => ({
      ...item,
      item_name: item.inventory_items?.name,
    }));

    const crew = (crewResult.data || []).map((member: any) => ({
      ...member,
      crew_member_name: member.crew_members?.name,
      crew_member_email: member.crew_members?.email,
      crew_member_contact: member.crew_members?.contact,
    }));

    return {
      event,
      inventory,
      crew,
      tasks: tasksResult.data || [],
    };
  } catch (error) {
    console.error("[getEventWithDetails] Unexpected error:", error);
    return { event: null, inventory: [], crew: [], tasks: [] };
  }
}

/**
 * Create a new event
 */
export async function createEvent(formData: FormData): Promise<{
  success?: boolean;
  error?: string;
  eventId?: string;
}> {
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const startDate = String(formData.get("start_date") || "");
  const endDate = String(formData.get("end_date") || "");
  const location = String(formData.get("location") || "").trim() || null;
  const quoteId = String(formData.get("quote_id") || "").trim() || null;
  const statusParam = String(formData.get("status") || "").trim();

  if (!name || !startDate || !endDate) {
    return { error: "Name, start date, and end date are required" };
  }

  if (new Date(endDate) < new Date(startDate)) {
    return { error: "End date must be after start date" };
  }

  // Use status from form if provided, otherwise use "confirmed" for quotes or "draft"
  const eventStatus = statusParam || (quoteId ? "confirmed" : "draft");

  try {
    const { data, error: insertError } = await supabase
      .from("events")
      .insert({
        name,
        description,
        start_date: startDate,
        end_date: endDate,
        location,
        quote_id: quoteId,
        status: eventStatus,
        tenant_id: tenantId,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[createEvent] Error:", insertError);
      return { error: "Failed to create event" };
    }

    const eventId = data.id;

    // If event is created from a quote, copy all quote items to event_inventory
    if (quoteId) {
      const copied = await copyQuoteItemsToEvent(eventId, quoteId);
      if (!copied) {
        console.error("[createEvent] Failed to copy quote items, but event was created");
      }
    }

    revalidatePath("/events");
    return { success: true, eventId };
  } catch (error) {
    console.error("[createEvent] Unexpected error:", error);
    return { error: "An unexpected error occurred" };
  }
}

/**
 * Update an event
 */
export async function updateEvent(formData: FormData): Promise<{
  success?: boolean;
  error?: string;
}> {
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const startDate = String(formData.get("start_date") || "");
  const endDate = String(formData.get("end_date") || "");
  const location = String(formData.get("location") || "").trim() || null;
  const status = String(formData.get("status") || "").trim();

  if (!id || !name || !startDate || !endDate) {
    return { error: "ID, name, start date, and end date are required" };
  }

  if (new Date(endDate) < new Date(startDate)) {
    return { error: "End date must be after start date" };
  }

  try {
    const updateData: any = {
      name,
      description,
      start_date: startDate,
      end_date: endDate,
      location,
      updated_at: new Date().toISOString(),
    };

    if (status && ["draft", "confirmed", "in_progress", "completed", "cancelled"].includes(status)) {
      updateData.status = status;
    }

    const { error: updateError } = await supabase
      .from("events")
      .update(updateData)
      .eq("id", id)
      .eq("tenant_id", tenantId);

    if (updateError) {
      console.error("[updateEvent] Error:", updateError);
      return { error: "Failed to update event" };
    }

    revalidatePath("/events");
    revalidatePath(`/events/${id}`);
    return { success: true };
  } catch (error) {
    console.error("[updateEvent] Unexpected error:", error);
    return { error: "An unexpected error occurred" };
  }
}

/**
 * Delete an event
 */
export async function deleteEvent(formData: FormData): Promise<{
  success?: boolean;
  error?: string;
}> {
  const id = String(formData.get("id") || "");

  if (!id) {
    return { error: "Event ID is required" };
  }

  try {
    const { error: deleteError } = await supabase
      .from("events")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId);

    if (deleteError) {
      console.error("[deleteEvent] Error:", deleteError);
      return { error: "Failed to delete event" };
    }

    revalidatePath("/events");
    return { success: true };
  } catch (error) {
    console.error("[deleteEvent] Unexpected error:", error);
    return { error: "An unexpected error occurred" };
  }
}

/**
 * Create event for an already accepted quote
 * Checks if event already exists before creating
 */
export async function createEventForAcceptedQuote(quoteId: string): Promise<{
  success?: boolean;
  error?: string;
  eventId?: string;
}> {
  try {
    // Check if quote exists and is accepted
    const { getQuoteWithItems } = await import("@/lib/quotes");
    const quote = await getQuoteWithItems(quoteId);

    if (!quote) {
      return { error: "Quote not found" };
    }

    if (quote.status !== "accepted") {
      return { error: "Only accepted quotes can be converted to events" };
    }

    // Check if event already exists for this quote
    const { data: existingEvent } = await supabase
      .from("events")
      .select("id")
      .eq("quote_id", quoteId)
      .eq("tenant_id", tenantId)
      .single();

    if (existingEvent) {
      return { success: true, eventId: existingEvent.id };
    }

    // Create event (this will automatically copy quote items to event_inventory)
    const eventFormData = new FormData();
    eventFormData.append("name", quote.name);
    eventFormData.append("description", `Event created from quote: ${quote.name}`);
    eventFormData.append("start_date", quote.start_date);
    eventFormData.append("end_date", quote.end_date);
    eventFormData.append("quote_id", quoteId);
    eventFormData.append("status", "confirmed");

    const result = await createEvent(eventFormData);
    return result;
  } catch (error) {
    console.error("[createEventForAcceptedQuote] Unexpected error:", error);
    return { error: "An unexpected error occurred" };
  }
}
