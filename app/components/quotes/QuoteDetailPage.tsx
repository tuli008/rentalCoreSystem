"use client";

import { useState, useEffect, useMemo, useRef, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  MeasuringStrategy,
  useDroppable,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { QuoteWithItems, QuoteItem } from "@/lib/quotes";
import {
  getItemAvailabilityBreakdown,
  calculateQuoteRisk,
  type ItemAvailabilityBreakdown,
  type RiskLevel,
} from "@/lib/quotes";
import { generateQuotePDF } from "@/lib/pdfGenerator";
import { confirmQuotation } from "@/app/actions/quotes";
import { createEventForAcceptedQuote } from "@/app/actions/events";
import AddItemModal from "./AddItemModal";
import QuoteDropZone from "./QuoteDropZone";
import QuoteSidebar from "./QuoteSidebar";

interface QuoteDetailPageProps {
  initialQuote: QuoteWithItems;
  updateQuote: (
    formData: FormData,
  ) => Promise<{ error?: string; success?: boolean }>;
  deleteQuote: (
    formData: FormData,
  ) => Promise<{ error?: string; success?: boolean }>;
  addQuoteItem: (
    formData: FormData,
  ) => Promise<{ error?: string; success?: boolean }>;
  updateQuoteItem: (
    formData: FormData,
  ) => Promise<{ error?: string; success?: boolean }>;
  deleteQuoteItem: (
    formData: FormData,
  ) => Promise<{ error?: string; success?: boolean }>;
}

export default function QuoteDetailPage({
  initialQuote,
  updateQuote,
  deleteQuote,
  addQuoteItem,
  updateQuoteItem,
  deleteQuoteItem,
}: QuoteDetailPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [quote, setQuote] = useState<QuoteWithItems>(initialQuote);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [hasEvent, setHasEvent] = useState(false);
  const [draggedItem, setDraggedItem] = useState<any>(null);
  const [activeDraggedItem, setActiveDraggedItem] = useState<any>(null);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [quantityModalItem, setQuantityModalItem] = useState<any>(null);
  const [quantityModalQuantity, setQuantityModalQuantity] = useState("1");
  const [quantityModalPrice, setQuantityModalPrice] = useState("");
  const [itemAvailabilities, setItemAvailabilities] = useState<
    Map<string, ItemAvailabilityBreakdown>
  >(new Map());
  const [isLoadingAvailabilities, setIsLoadingAvailabilities] = useState(true);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastOverIdRef = useRef<string | null>(null);
  const lastOverAtMsRef = useRef<number>(0);
  const isDraggingRef = useRef(false);
  const deferredRefreshRef = useRef(false);
  const refreshTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const draggedItemRef = useRef<any>(null);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth < 1024; // lg breakpoint
      setIsMobile(isTouchDevice || isSmallScreen);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Configure sensors - remove activation constraint for maximum reliability
  // This ensures drag starts immediately on mouse down
  // Disable sensors on mobile
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );
  // Local quantity state for instant UI updates (quoteItemId -> quantity string)
  const [localQuantities, setLocalQuantities] = useState<Map<string, string>>(
    new Map(),
  );
  // Debounce timers for each quote item
  const debounceTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  // Track previous item IDs to prevent unnecessary availability re-fetches
  const prevItemIdsStringRef = useRef<string>('');

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  }, []);

  const scheduleRefresh = useCallback(
    (key: string, delayMs: number) => {
      const existing = refreshTimersRef.current.get(key);
      if (existing) {
        clearTimeout(existing);
      }

      // Never refresh while dragging; it remounts DOM and breaks drop detection.
      if (isDraggingRef.current) {
        deferredRefreshRef.current = true;
        return;
      }

      const t = setTimeout(() => {
        refreshTimersRef.current.delete(key);
        router.refresh();
      }, delayMs);
      refreshTimersRef.current.set(key, t);
    },
    [router],
  );

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      refreshTimersRef.current.forEach((t) => clearTimeout(t));
      refreshTimersRef.current.clear();
    };
  }, []);

  // Sync quote when initialQuote changes (after router.refresh())
  useEffect(() => {
    setQuote(initialQuote);
    // Sync local quantities with server data
    const newQuantities = new Map<string, string>();
    initialQuote.items.forEach((item) => {
      newQuantities.set(item.id, item.quantity.toString());
    });
    setLocalQuantities(newQuantities);
  }, [initialQuote]);

  // Memoize item IDs string - only changes when item IDs change, not quantities
  // Create a stable string dependency
  const itemIdsDependency = useMemo(() => 
    quote.items.map(item => item.item_id).sort().join(','),
    [quote.items]
  );
  
  const itemIdsString = useMemo(() => {
    // Only update if item IDs actually changed (not just quantities)
    if (itemIdsDependency === prevItemIdsStringRef.current) {
      return prevItemIdsStringRef.current;
    }
    prevItemIdsStringRef.current = itemIdsDependency;
    return itemIdsDependency;
  }, [itemIdsDependency]);

  // Fetch availability breakdowns for all items with quote context for date-aware calculation
  // Only fetch when item IDs actually change, not on every render
  useEffect(() => {
    let cancelled = false;
    
    const fetchAvailabilities = async () => {
      // Ensure loading state is set immediately
      setIsLoadingAvailabilities(true);
      const availMap = new Map<string, ItemAvailabilityBreakdown>();
      
      // Get items from current quote state
      const currentItems = quote.items;
      if (currentItems.length === 0) {
        setItemAvailabilities(new Map());
        setIsLoadingAvailabilities(false);
        return;
      }
      
      // Fetch availability for all items in parallel
      const promises = currentItems.map(async (item) => {
        if (cancelled) return { itemId: item.item_id, breakdown: null };
        
        try {
          const breakdown = await getItemAvailabilityBreakdown(item.item_id, {
            quoteId: quote.id,
            startDate: quote.start_date,
            endDate: quote.end_date,
          });
          return { itemId: item.item_id, breakdown };
        } catch (error) {
          console.error(
            `Error fetching availability breakdown for item ${item.item_id}:`,
            error,
          );
          return { itemId: item.item_id, breakdown: null };
        }
      });
      
      // Wait for all availability data to load
      const results = await Promise.all(promises);
      
      if (cancelled) return;
      
      results.forEach(({ itemId, breakdown }) => {
        if (breakdown) {
          availMap.set(itemId, breakdown);
        }
      });
      
      // Only set loading to false after all data is loaded
      setItemAvailabilities(availMap);
      setIsLoadingAvailabilities(false);
    };

    fetchAvailabilities();
    
    return () => {
      cancelled = true;
    };
  }, [itemIdsString, quote.id, quote.start_date, quote.end_date]);

  // Calculate event-level risk indicator (using local quantities for real-time updates)
  // Only calculate when availability data is loaded to prevent incorrect risk level display
  const riskLevel = useMemo<RiskLevel>(() => {
    if (quote.items.length === 0) return "green";
    // Don't calculate risk if availability data isn't loaded yet
    if (isLoadingAvailabilities || itemAvailabilities.size === 0) {
      return "green"; // Default to green while loading
    }
    return calculateQuoteRisk(
      quote.items.map((item) => {
        // Use local quantity if available, otherwise fall back to server quantity
        const localQuantityStr = localQuantities.get(item.id);
        const quantity = localQuantityStr
          ? parseInt(localQuantityStr, 10) || 0
          : item.quantity;
        return {
          item_id: item.item_id,
          quantity,
          item_is_serialized: item.item_is_serialized,
        };
      }),
      itemAvailabilities,
    );
  }, [quote.items, itemAvailabilities, localQuantities, isLoadingAvailabilities]);

  const handleAddItem = useCallback(async (
    itemId: string,
    itemName: string,
    unitPrice: number,
    quantity: number,
  ) => {
    // Check if item already exists in this quote
    const existingItem = quote.items.find((item) => item.item_id === itemId);

    if (existingItem) {
      // Item already exists - defer all UI updates to avoid flickering
      setTimeout(() => {
        // Set highlight state
        setHighlightedItemId(existingItem.id);
        
        // Scroll to the existing item
        requestAnimationFrame(() => {
          setTimeout(() => {
            const itemElement = document.getElementById(`quote-item-${existingItem.id}`);
            if (itemElement) {
              itemElement.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }, 100);
        });
        
        // Remove highlight after animation completes
        setTimeout(() => {
          setHighlightedItemId(null);
        }, 2000);
        
        // Show message last, after all visual updates
        setTimeout(() => {
          showToast(
            `"${itemName}" is already in the quote. Update the existing quantity.`
          );
        }, 300);
      }, 100);
      return;
    }
    
    // Optimistically add item to quote state immediately
    // This makes the UI update instantly without waiting for server
    const optimisticItem: QuoteItem = {
      id: `temp-${Date.now()}`, // Temporary ID
      quote_id: quote.id,
      item_id: itemId,
      item_name: itemName,
      quantity,
      unit_price_snapshot: unitPrice,
      item_is_serialized: false, // Will be updated on refresh
    };
    
    // Batch state updates using React's automatic batching
    // Update both quote and localQuantities together
    setQuote((prevQuote) => ({
      ...prevQuote,
      items: [...prevQuote.items, optimisticItem],
    }));
    setLocalQuantities((prev) => {
      const newMap = new Map(prev);
      newMap.set(optimisticItem.id, quantity.toString());
      return newMap;
    });
    
    // Item doesn't exist: create new quote_item
    const formData = new FormData();
    formData.append("quote_id", quote.id);
    formData.append("item_id", itemId);
    formData.append("quantity", quantity.toString());
    formData.append("unit_price", unitPrice.toString());

    try {
      const result = await addQuoteItem(formData);
      if (result.success) {
        // Refresh in background after delay to sync with server
        // Use a longer delay to batch multiple adds
        scheduleRefresh(`add-${itemId}`, 1500);
      } else if (result.error) {
        // Revert optimistic update on error
        setQuote((prevQuote) => ({
          ...prevQuote,
          items: prevQuote.items.filter((item) => item.id !== optimisticItem.id),
        }));
        setLocalQuantities((prev) => {
          const newMap = new Map(prev);
          newMap.delete(optimisticItem.id);
          return newMap;
        });
        showToast(result.error);
      }
    } catch (error) {
      // Revert on error
      setQuote((prevQuote) => ({
        ...prevQuote,
        items: prevQuote.items.filter((item) => item.id !== optimisticItem.id),
      }));
      setLocalQuantities((prev) => {
        const newMap = new Map(prev);
        newMap.delete(optimisticItem.id);
        return newMap;
      });
      showToast("Failed to add item. Please try again.");
    }
  }, [quote.items, quote.id, scheduleRefresh, showToast]);

  // Debounced save function with instant UI updates
  const saveQuantity = useCallback(async (quoteItemId: string, quantity: number) => {
    // Validate: integers >= 0 only
    if (!Number.isInteger(quantity) || quantity < 0) {
      return;
    }

    // Update quote state optimistically for instant UI feedback
    // This makes subtotals, totals, and all calculations update immediately
    setQuote((prevQuote) => {
      const updatedItems = prevQuote.items.map((item) =>
        item.id === quoteItemId
          ? { ...item, quantity }
          : item
      );
      return { ...prevQuote, items: updatedItems };
    });

    const formData = new FormData();
    formData.append("quote_item_id", quoteItemId);
    formData.append("quantity", quantity.toString());
    formData.append("quote_id", quote.id);

    try {
      const result = await updateQuoteItem(formData);
      if (result.success) {
        // Silently refresh in background without blocking UI
        // Use a longer delay to batch multiple updates
        scheduleRefresh(`qty-${quoteItemId}`, 2000);
      } else if (result.error) {
        // Revert optimistic update on error
        const item = quote.items.find((i) => i.id === quoteItemId);
        if (item) {
          setQuote((prevQuote) => {
            const updatedItems = prevQuote.items.map((i) =>
              i.id === quoteItemId ? item : i
            );
            return { ...prevQuote, items: updatedItems };
          });
          setLocalQuantities((prev) => {
            const newMap = new Map(prev);
            newMap.set(quoteItemId, item.quantity.toString());
            return newMap;
          });
        }
        showToast(result.error);
      }
    } catch (error) {
      // Revert on error
      const item = quote.items.find((i) => i.id === quoteItemId);
      if (item) {
        setQuote((prevQuote) => {
          const updatedItems = prevQuote.items.map((i) =>
            i.id === quoteItemId ? item : i
          );
          return { ...prevQuote, items: updatedItems };
        });
        setLocalQuantities((prev) => {
          const newMap = new Map(prev);
          newMap.set(quoteItemId, item.quantity.toString());
          return newMap;
        });
      }
    }
  }, [quote.items, quote.id, scheduleRefresh, showToast, updateQuoteItem]);

  // Update local quantity and schedule debounced save
  const updateQuantity = useCallback((quoteItemId: string, newQuantity: number) => {
    // Update local state immediately for instant UI feedback
    setLocalQuantities((prev) => {
      const newMap = new Map(prev);
      newMap.set(quoteItemId, newQuantity.toString());
      return newMap;
    });

    // Cancel previous debounce timer for this item
    const existingTimer = debounceTimersRef.current.get(quoteItemId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule new save with longer debounce to reduce server calls (600ms)
    const timer = setTimeout(() => {
      saveQuantity(quoteItemId, newQuantity);
      debounceTimersRef.current.delete(quoteItemId);
    }, 600);

    debounceTimersRef.current.set(quoteItemId, timer);
  }, [saveQuantity]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      debounceTimersRef.current.forEach((timer) => clearTimeout(timer));
      debounceTimersRef.current.clear();
    };
  }, []);

  const handleDeleteItem = useCallback(async (quoteItemId: string) => {
    // Optimistically remove from UI
    setQuote((prevQuote) => ({
      ...prevQuote,
      items: prevQuote.items.filter((item) => item.id !== quoteItemId),
    }));

    const formData = new FormData();
    formData.append("quote_item_id", quoteItemId);

    const result = await deleteQuoteItem(formData);
    if (result.success) {
      // Refresh after delay to batch updates
      scheduleRefresh(`delete-${quoteItemId}`, 500);
    } else {
      // Revert on error
      scheduleRefresh(`delete-revert-${quoteItemId}`, 0);
    }
  }, [deleteQuoteItem, scheduleRefresh]);

  const handleDeleteQuote = async () => {
    if (
      !confirm(
        `Are you sure you want to delete "${quote.name}"? This action cannot be undone.`,
      )
    ) {
      return;
    }

    const formData = new FormData();
    formData.append("quote_id", quote.id);

    const result = await deleteQuote(formData);
    if (result.success) {
      router.push("/quotes");
    } else if (result.error) {
      showToast(result.error);
    }
  };

  const handleConfirmQuotation = async () => {
    setIsConfirming(true);
    const formData = new FormData();
    formData.append("quote_id", quote.id);

    const result = await confirmQuotation(formData);
    if (result.ok) {
      scheduleRefresh("confirm", 0);
      showToast(result.message || "Quotation confirmed successfully! Event created automatically.");
    } else {
      showToast(result.error || "Failed to confirm quotation.");
    }
    setIsConfirming(false);
  };

  // Check if event exists for this quote
  const checkForEvent = async () => {
    if (quote.status !== "accepted") {
      setHasEvent(false);
      return;
    }

    try {
      const { supabase } = await import("@/lib/supabase");
      const { data } = await supabase
        .from("events")
        .select("id")
        .eq("quote_id", quote.id)
        .single();

      setHasEvent(!!data);
    } catch (error) {
      setHasEvent(false);
    }
  };

  // Check for event when quote is accepted
  useEffect(() => {
    if (quote.status === "accepted") {
      checkForEvent();
    }
  }, [quote.status, quote.id]);

  const handleCreateEvent = async () => {
    setIsCreatingEvent(true);
    const result = await createEventForAcceptedQuote(quote.id);

    if (result.error) {
      showToast(result.error);
    } else if (result.eventId) {
      showToast("Event created successfully!");
      setHasEvent(true);
      router.push(`/events/${result.eventId}`);
      router.refresh();
    }
    setIsCreatingEvent(false);
  };

  const handleDragStart = useCallback((event: DragStartEvent) => {
    isDraggingRef.current = true;
    if (refreshTimersRef.current.size > 0) {
      deferredRefreshRef.current = true;
      refreshTimersRef.current.forEach((t) => clearTimeout(t));
      refreshTimersRef.current.clear();
    }
    const { active } = event;
    const itemData = active.data.current;
    if (itemData?.type === "inventory-item" && itemData?.item) {
      // Set active item immediately for drag overlay
      setActiveDraggedItem(itemData.item);
      // Persist dragged item data in case the draggable unmounts mid-drag
      draggedItemRef.current = itemData.item;
    }
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    if (event.over?.id) {
      lastOverIdRef.current = String(event.over.id);
      lastOverAtMsRef.current = Date.now();
    }
  }, []);

  // DragOver only fires when `over` changes; DragMove fires continuously.
  // Using DragMove makes drop detection stable even during fast drags / heavy re-renders.
  const handleDragMove = useCallback((event: DragMoveEvent) => {
    if (event.over?.id) {
      lastOverIdRef.current = String(event.over.id);
      lastOverAtMsRef.current = Date.now();
    }
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveDraggedItem(null);
    isDraggingRef.current = false;
    lastOverIdRef.current = null;
    lastOverAtMsRef.current = 0;
    draggedItemRef.current = null;

    if (deferredRefreshRef.current) {
      deferredRefreshRef.current = false;
      scheduleRefresh("deferred", 250);
    }
  }, [scheduleRefresh]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    // Store item data IMMEDIATELY before any state changes
    const itemData = active.data.current;
    const draggedItem =
      (itemData?.type === "inventory-item" ? itemData.item : null) ??
      draggedItemRef.current;
    
    // Clear active dragged item immediately
    setActiveDraggedItem(null);
    isDraggingRef.current = false;
    draggedItemRef.current = null;

    // DnD-kit sometimes reports `over` as null at drop time due to layout shifts.
    // Fall back to the last known valid over-id for stability.
    const overId = (over?.id ? String(over.id) : lastOverIdRef.current) ?? null;
    lastOverIdRef.current = null;
    const lastOverAgeMs = Date.now() - (lastOverAtMsRef.current || 0);
    lastOverAtMsRef.current = 0;

    // If drop-time `over` gets lost due to a render, allow a short fallback window.
    const isInDropZone =
      overId === "quote-drop-zone" ||
      (lastOverAgeMs > 0 && lastOverAgeMs < 250 && overId === "quote-drop-zone");

    if (!isInDropZone) {
      // If this happens while the overlay says "Drop here", it means drop target resolution failed.
      return;
    }

    // Validate dragged item exists
    if (!draggedItem) {
      // Item unmounted mid-drag; should be prevented by draggedItemRef fallback.
      return;
    }

    // Don't process if quote is read-only
    if (quote.status === "accepted") {
      return;
    }

    const draggedItemId = draggedItem.id;
    
    // Check if this item already exists in the quote
    const existingItem = quote.items.find(
      (quoteItem) => quoteItem.item_id === draggedItemId
    );
    
    if (existingItem) {
      // Item already exists - show feedback
      setHighlightedItemId(existingItem.id);
      
      setTimeout(() => {
        const itemElement = document.getElementById(`quote-item-${existingItem.id}`);
        if (itemElement) {
          itemElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        setTimeout(() => {
          setHighlightedItemId(null);
        }, 2000);
        showToast(
          `"${draggedItem.name}" is already in the quote. Update the existing quantity.`
        );
      }, 50);
      return;
    }
    
    // Item doesn't exist - open modal immediately
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      setQuantityModalItem(draggedItem);
      setQuantityModalPrice(draggedItem.price.toFixed(2));
      setQuantityModalQuantity("1");
      setShowQuantityModal(true);
      setShowAddItemModal(false);
    });

    if (deferredRefreshRef.current) {
      deferredRefreshRef.current = false;
      scheduleRefresh("deferred", 250);
    }
  }, [quote.items, quote.status, showToast]);

  const handleQuantityModalConfirm = useCallback(async () => {
    if (!quantityModalItem) return;

    const qty = parseInt(quantityModalQuantity, 10);
    if (Number.isNaN(qty) || qty <= 0) {
      alert("Please enter a valid quantity");
      return;
    }

    const price = parseFloat(quantityModalPrice);
    if (Number.isNaN(price) || price < 0) {
      alert("Please enter a valid price");
      return;
    }

    // Close modal immediately for better UX
    setShowQuantityModal(false);
    const itemToAdd = quantityModalItem;
    const priceToAdd = price;
    const qtyToAdd = qty;
    
    // Reset modal state
    setQuantityModalItem(null);
    setQuantityModalQuantity("1");
    setQuantityModalPrice("");

    // Add item (this will handle optimistic updates)
    await handleAddItem(
      itemToAdd.id,
      itemToAdd.name,
      priceToAdd,
      qtyToAdd,
    );
  }, [quantityModalItem, quantityModalQuantity, quantityModalPrice, handleAddItem]);

  const numberOfDays = Math.ceil(
    (new Date(quote.end_date).getTime() -
      new Date(quote.start_date).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  // Memoize quoteContext to prevent sidebar reloads
  const memoizedQuoteContext = useMemo(() => ({
    quoteId: quote.id,
    startDate: quote.start_date,
    endDate: quote.end_date,
  }), [quote.id, quote.start_date, quote.end_date]);

  // Calculate subtotal using local quantities for real-time updates
  const subtotal = useMemo(() => {
    return quote.items.reduce((sum, item) => {
      // Use local quantity if available, otherwise use server quantity
      const localQuantityStr = localQuantities.get(item.id);
      const quantity = localQuantityStr
        ? parseInt(localQuantityStr, 10) || 0
        : item.quantity;
      return sum + quantity * item.unit_price_snapshot * numberOfDays;
    }, 0);
  }, [quote.items, localQuantities, numberOfDays]);

  // Consistent date formatting to avoid hydration errors
  const formatDate = (date: Date) => {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();
    return `${year}-${month}-${day}`; // Consistent format
  };

  const isReadOnly = quote.status === "accepted";

  // Content wrapper - same for both mobile and desktop
  const content = (
    <>
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row w-full overflow-x-hidden">
        {toastMessage ? (
          <div className="fixed top-4 right-4 z-[1000]">
            <div className="bg-gray-900 text-white text-sm px-4 py-2 rounded-md shadow-lg">
              {toastMessage}
            </div>
          </div>
        ) : null}
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto min-w-0 lg:order-1">
          <div className="max-w-6xl mx-auto p-4 sm:p-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/quotes"
            className="text-sm text-gray-600 hover:text-gray-900 mb-4 inline-block"
          >
            ← Back to Quotes
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">
                  {quote.name}
                </h1>
                {/* Event-level risk indicator - only show when availability data is loaded */}
                {quote.items.length > 0 && !isLoadingAvailabilities && (
                  <div
                    className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap ${
                      riskLevel === "green"
                        ? "bg-green-100 text-green-800"
                        : riskLevel === "yellow"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        riskLevel === "green"
                          ? "bg-green-600"
                          : riskLevel === "yellow"
                            ? "bg-yellow-600"
                            : "bg-red-600"
                      }`}
                    />
                    <span className="hidden sm:inline">
                      {riskLevel === "green"
                        ? "Sufficient inventory"
                        : riskLevel === "yellow"
                          ? "Tight availability"
                          : "Insufficient inventory"}
                    </span>
                    <span className="sm:hidden">
                      {riskLevel === "green"
                        ? "Sufficient"
                        : riskLevel === "yellow"
                          ? "Tight"
                          : "Insufficient"}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-sm sm:text-base text-gray-600">
                {formatDate(new Date(quote.start_date))} -{" "}
                {formatDate(new Date(quote.end_date))} ({numberOfDays}{" "}
                days)
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="lg:hidden w-full sm:w-auto px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
              >
                Products
              </button>
              <span
                className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium text-center sm:text-left whitespace-nowrap ${
                  quote.status === "draft"
                    ? "bg-gray-100 text-gray-800"
                    : quote.status === "sent"
                      ? "bg-blue-100 text-blue-800"
                      : quote.status === "accepted"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                }`}
              >
                {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
              </span>
              <button
                onClick={handleDeleteQuote}
                className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
              >
                Delete Event
              </button>
            </div>
          </div>
        </div>

        {/* Items Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          <div className="mb-2">
            <h2 className="text-lg font-semibold text-gray-900">Items</h2>
          </div>

          {quote.items.length === 0 ? (
            <QuoteDropZone isEmpty={true} isReadOnly={isReadOnly} />
          ) : isLoadingAvailabilities && !isReadOnly ? (
            // Show loading state while fetching availability data (only for draft quotes)
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-sm text-gray-600">Loading availability data...</p>
              </div>
            </div>
          ) : isReadOnly ? (
            // Table format for accepted quotes
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 text-sm">
                      Item Name
                    </th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700 text-sm">
                      Quantity
                    </th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700 text-sm">
                      Price
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items.map((item) => {
                    const localQuantityStr = localQuantities.get(item.id);
                    const displayQuantity = localQuantityStr
                      ? parseInt(localQuantityStr, 10) || 0
                      : item.quantity;
                    const lineTotal =
                      displayQuantity * item.unit_price_snapshot * numberOfDays;

                    return (
                      <tr
                        key={item.id}
                        className="border-b border-gray-200 hover:bg-gray-50"
                      >
                        <td className="py-2 px-3 text-gray-900 font-medium">
                          {item.item_name || "Unknown Item"}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-700">
                          {displayQuantity}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-900 font-semibold">
                          ${lineTotal.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <QuoteDropZone isEmpty={false} isReadOnly={isReadOnly}>
              {/* Only render items when availability data is loaded to prevent flash of incorrect data */}
              {isLoadingAvailabilities ? (
                <div className="flex items-center justify-center py-12 mt-4">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-sm text-gray-600">Loading availability data...</p>
                  </div>
                </div>
              ) : (
              <div className="mt-1 space-y-1">
              {quote.items.map((item) => {
                // Only get breakdown if data is loaded, otherwise use safe defaults
                const breakdown = isLoadingAvailabilities
                  ? null
                  : (itemAvailabilities.get(item.item_id) || {
                      available: 0,
                      reserved: 0,
                      inTransit: 0,
                      outOfService: 0,
                      total: 0,
                    });
                // Use local quantity if available, otherwise fall back to server quantity
                const localQuantityStr = localQuantities.get(item.id);
                const displayQuantity = localQuantityStr
                  ? parseInt(localQuantityStr, 10) || 0
                  : item.quantity;
                // Reserved shows what the user typed (this quote's quantity)
                const realTimeReserved = displayQuantity;
                const lineTotal =
                  displayQuantity * item.unit_price_snapshot * numberOfDays;
                // Use effectiveAvailable if available (date-aware), otherwise fall back to available
                // Only calculate if breakdown is loaded
                const effectiveAvailable = breakdown
                  ? (breakdown.effectiveAvailable !== undefined
                      ? breakdown.effectiveAvailable
                      : breakdown.available)
                  : 0;
                const isOverAvailable = breakdown ? displayQuantity > effectiveAvailable : false;
                const isHighlighted = highlightedItemId === item.id;

                // Full view for draft quotes
                return (
                  <div
                    id={`quote-item-${item.id}`}
                    key={item.id}
                    className={`p-2.5 bg-gray-50 rounded-lg border border-gray-200 transition-all ${
                      isHighlighted ? "ring-2 ring-blue-500 ring-offset-2" : ""
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-medium text-gray-900 truncate">
                            {item.item_name || "Unknown Item"}
                          </h3>
                          {!isLoadingAvailabilities && isOverAvailable && (
                            <span
                              className={`px-2 py-0.5 text-xs rounded whitespace-nowrap ${
                                effectiveAvailable === 0
                                  ? "bg-red-100 text-red-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              Over available ({effectiveAvailable} effective
                              available)
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-gray-600 mb-1">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                const newQty = Math.max(0, displayQuantity - 1);
                                updateQuantity(item.id, newQty);
                              }}
                              disabled={displayQuantity <= 0}
                              className="w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M20 12H4"
                                />
                              </svg>
                            </button>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={
                                localQuantityStr ?? item.quantity.toString()
                              }
                              onChange={(e) => {
                                const value = e.target.value;
                                // Allow empty string for typing
                                if (value === "") {
                                  // Cancel any pending debounce timer
                                  const existingTimer =
                                    debounceTimersRef.current.get(item.id);
                                  if (existingTimer) {
                                    clearTimeout(existingTimer);
                                    debounceTimersRef.current.delete(item.id);
                                  }
                                  setLocalQuantities((prev) => {
                                    const newMap = new Map(prev);
                                    newMap.set(item.id, "");
                                    return newMap;
                                  });
                                  return;
                                }
                                const numValue = parseInt(value, 10);
                                // Only update if it's a valid integer >= 0
                                if (!Number.isNaN(numValue) && numValue >= 0) {
                                  updateQuantity(item.id, numValue);
                                }
                              }}
                              onBlur={(e) => {
                                const value = e.target.value;
                                // On blur, if empty or invalid, set to 0
                                const numValue = parseInt(value, 10);
                                if (Number.isNaN(numValue) || numValue < 0) {
                                  updateQuantity(item.id, 0);
                                }
                              }}
                              className="w-16 sm:w-16 px-2 py-1.5 sm:py-1 text-center font-medium border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                              onClick={() => {
                                const newQty = displayQuantity + 1;
                                updateQuantity(item.id, newQty);
                              }}
                              className="w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-100 transition-colors"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 4v16m8-8H4"
                                />
                              </svg>
                            </button>
                          </div>
                          <span className="whitespace-nowrap">
                            × ${item.unit_price_snapshot.toFixed(2)}
                          </span>
                          <span className="whitespace-nowrap">
                            × {numberOfDays} day{numberOfDays !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {/* Availability breakdown - only show when data is loaded */}
                        {!isLoadingAvailabilities && breakdown && (
                        <div className="mt-1 flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-gray-500">
                          <span className="whitespace-nowrap">
                            <span className="font-medium text-gray-700">
                              {breakdown.effectiveAvailable !== undefined
                                ? "Effective Available:"
                                : "Available:"}
                            </span>{" "}
                            {breakdown.effectiveAvailable !== undefined
                              ? breakdown.effectiveAvailable
                              : breakdown.available}
                          </span>
                          {breakdown.reservedInOverlappingEvents !==
                            undefined &&
                            breakdown.reservedInOverlappingEvents > 0 && (
                              <span className="whitespace-nowrap">
                                <span className="font-medium text-gray-700">
                                  Reserved in overlapping events:
                                </span>{" "}
                                {breakdown.reservedInOverlappingEvents}
                              </span>
                            )}
                          {realTimeReserved > 0 && (
                            <span className="whitespace-nowrap">
                              <span className="font-medium text-gray-700">
                                Reserved:
                              </span>{" "}
                              {realTimeReserved}
                            </span>
                          )}
                          {/* Only show In-Transit for serialized items */}
                          {item.item_is_serialized &&
                            breakdown.inTransit > 0 && (
                              <span className="whitespace-nowrap">
                                <span className="font-medium text-gray-700">
                                  In-Transit:
                                </span>{" "}
                                {breakdown.inTransit}
                              </span>
                            )}
                          {breakdown.outOfService > 0 && (
                            <span className="whitespace-nowrap">
                              <span className="font-medium text-gray-700">
                                Out-of-Service:
                              </span>{" "}
                              {breakdown.outOfService}
                            </span>
                          )}
                          <span className="whitespace-nowrap">
                            <span className="font-medium text-gray-700">
                              Total:
                            </span>{" "}
                            {breakdown.total}
                          </span>
                        </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-2 sm:flex-col sm:items-end">
                        <div className="text-right sm:text-right">
                          <div className="text-sm font-semibold text-gray-900">
                            ${lineTotal.toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Line total
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-2 sm:p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
              )}
            </QuoteDropZone>
          )}
        </div>

        {/* Summary */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Days</span>
              <span>
                {numberOfDays} day{numberOfDays !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <span className="text-base font-semibold text-gray-900">
                Total
              </span>
              <span className="text-2xl font-bold text-gray-900">
                ${subtotal.toFixed(2)}
              </span>
            </div>

            {/* Action Buttons - Only show for draft quotes */}
            {quote.status === "draft" && (
              <div className="pt-4 border-t border-gray-200 mt-4 flex gap-2">
                <button
                  onClick={() => generateQuotePDF(quote)}
                  className="flex-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors font-medium flex items-center justify-center gap-1.5"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  Generate PDF
                </button>
                <button
                  onClick={handleConfirmQuotation}
                  disabled={isConfirming}
                  className="flex-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConfirming ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Confirming...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Confirm
                    </>
                  )}
                </button>
              </div>
            )}
            {quote.status === "accepted" && !hasEvent && (
              <div className="pt-4 border-t border-gray-200 mt-4 flex gap-2">
                <button
                  onClick={handleCreateEvent}
                  disabled={isCreatingEvent}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  {isCreatingEvent ? "Creating Event..." : "Create Event"}
                </button>
              </div>
            )}
            {quote.status === "accepted" && hasEvent && (
              <div className="pt-4 border-t border-gray-200 mt-4 flex gap-2">
                <Link
                  href={`/events?quote=${quote.id}`}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors text-center"
                >
                  View Event
                </Link>
              </div>
            )}
          </div>
        </div>
          </div>
        </div>

        {/* Right Sidebar (Desktop) */}
        <div className="hidden lg:flex lg:order-2 flex-shrink-0">
          <QuoteSidebar
            onAddItem={handleAddItem}
            existingQuoteItems={quote.items}
            quoteContext={memoizedQuoteContext}
            quoteSummary={{
              totalItems: quote.items.length,
              subtotal,
              numberOfDays,
            }}
            isReadOnly={quote.status === "accepted"}
            variant="desktop"
          />
        </div>

        {/* Products Drawer (Mobile) */}
        {isMobileSidebarOpen && (
          <div className="fixed inset-0 z-[950] lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Close products"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
            <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-2xl border-t border-gray-200">
              <div className="h-1 w-12 bg-gray-300 rounded-full mx-auto mt-2" />
              <QuoteSidebar
                onAddItem={handleAddItem}
                existingQuoteItems={quote.items}
                quoteContext={memoizedQuoteContext}
                quoteSummary={{
                  totalItems: quote.items.length,
                  subtotal,
                  numberOfDays,
                }}
                isReadOnly={quote.status === "accepted"}
                variant="mobile"
                onClose={() => setIsMobileSidebarOpen(false)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Add Item Modal (fallback for mobile) */}
      {showAddItemModal && (
        <AddItemModal
          onClose={() => setShowAddItemModal(false)}
          onAddItem={handleAddItem}
          existingQuoteItems={quote.items}
          quoteContext={{
            quoteId: quote.id,
            startDate: quote.start_date,
            endDate: quote.end_date,
          }}
        />
      )}

      {/* Quantity Selector Modal (for drag and drop) */}
      {showQuantityModal && quantityModalItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Add {quantityModalItem.name}
              </h3>
              <button
                onClick={() => {
                  setShowQuantityModal(false);
                  setQuantityModalItem(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-md transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Item Info */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                {quantityModalItem.group_name && (
                  <div className="text-sm text-gray-600 mb-1">
                    <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded mr-2">
                      {quantityModalItem.group_name}
                    </span>
                  </div>
                )}
                <div className="text-sm text-gray-600">
                  Available:{" "}
                  <span className="font-mono">
                    {quantityModalItem.effectiveAvailable !== undefined
                      ? quantityModalItem.effectiveAvailable
                      : quantityModalItem.available || 0}{" "}
                    / {quantityModalItem.total || 0}
                  </span>
                </div>
              </div>

              {/* Quantity Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity *
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantityModalQuantity}
                  onChange={(e) => setQuantityModalQuantity(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                {parseInt(quantityModalQuantity, 10) >
                  (quantityModalItem.effectiveAvailable !== undefined
                    ? quantityModalItem.effectiveAvailable
                    : quantityModalItem.available || 0) && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-800">
                      Quantity exceeds available (
                      {quantityModalItem.effectiveAvailable !== undefined
                        ? quantityModalItem.effectiveAvailable
                        : quantityModalItem.available || 0}
                      )
                    </p>
                  </div>
                )}
              </div>

              {/* Unit Price Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit Price ($) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={quantityModalPrice}
                  onChange={(e) => setQuantityModalPrice(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Default: ${quantityModalItem.price.toFixed(2)} - You can modify this
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowQuantityModal(false);
                  setQuantityModalItem(null);
                }}
                className="px-4 py-2.5 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleQuantityModalConfirm}
                disabled={
                  !quantityModalQuantity ||
                  parseInt(quantityModalQuantity, 10) <= 0 ||
                  !quantityModalPrice ||
                  parseFloat(quantityModalPrice) < 0
                }
                className="px-4 py-2.5 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add to Quote
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // On mobile, render without DndContext (drag disabled)
  if (isMobile) {
    return (
      <>
        {content}
        {toastMessage ? (
          <div className="fixed top-4 right-4 z-[1000]">
            <div className="bg-gray-900 text-white text-sm px-4 py-2 rounded-md shadow-lg">
              {toastMessage}
            </div>
          </div>
        ) : null}
      </>
    );
  }

  // On desktop, render with DndContext (drag enabled)
  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={pointerWithin}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragMove={handleDragMove}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      {content}
      <DragOverlay 
        zIndex={9999} 
        dropAnimation={null}
        style={{ cursor: 'grabbing' }}
      >
        {activeDraggedItem ? (
          <div className="p-4 bg-white rounded-lg shadow-2xl border-2 border-blue-500 w-80 pointer-events-none">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <svg
                    className="w-4 h-4 text-gray-400 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8h16M4 16h16"
                    />
                  </svg>
                  <span className="font-medium text-gray-900">{activeDraggedItem.name}</span>
                  {activeDraggedItem.group_name && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                      {activeDraggedItem.group_name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600 ml-7">
                  <span>
                    Available:{" "}
                    <span className="font-mono text-gray-700">
                      {activeDraggedItem.effectiveAvailable ?? activeDraggedItem.available ?? 0} / {activeDraggedItem.total || 0}
                    </span>
                  </span>
                  <span>
                    Rate:{" "}
                    <span className="font-semibold text-gray-900">
                      ${activeDraggedItem.price.toFixed(2)}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}