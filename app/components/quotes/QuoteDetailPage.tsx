"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { QuoteWithItems } from "@/lib/quotes";
import {
  getItemAvailabilityBreakdown,
  calculateQuoteRisk,
  type ItemAvailabilityBreakdown,
  type RiskLevel,
} from "@/lib/quotes";
import { generateQuotePDF } from "@/lib/pdfGenerator";
import { confirmQuotation } from "@/app/actions/quotes";
import AddItemModal from "./AddItemModal";

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
  const [quote, setQuote] = useState<QuoteWithItems>(initialQuote);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [itemAvailabilities, setItemAvailabilities] = useState<
    Map<string, ItemAvailabilityBreakdown>
  >(new Map());
  // Local quantity state for instant UI updates (quoteItemId -> quantity string)
  const [localQuantities, setLocalQuantities] = useState<Map<string, string>>(
    new Map(),
  );
  // Debounce timers for each quote item
  const debounceTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

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

  // Fetch availability breakdowns for all items with quote context for date-aware calculation
  useEffect(() => {
    const fetchAvailabilities = async () => {
      const availMap = new Map<string, ItemAvailabilityBreakdown>();
      for (const item of quote.items) {
        try {
          const breakdown = await getItemAvailabilityBreakdown(item.item_id, {
            quoteId: quote.id,
            startDate: quote.start_date,
            endDate: quote.end_date,
          });
          availMap.set(item.item_id, breakdown);
        } catch (error) {
          console.error(
            `Error fetching availability breakdown for item ${item.item_id}:`,
            error,
          );
        }
      }
      setItemAvailabilities(availMap);
    };

    if (quote.items.length > 0) {
      fetchAvailabilities();
    } else {
      setItemAvailabilities(new Map());
    }
  }, [quote.items, quote.id, quote.start_date, quote.end_date]);

  // Calculate event-level risk indicator (using local quantities for real-time updates)
  const riskLevel = useMemo<RiskLevel>(() => {
    if (quote.items.length === 0) return "green";
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
  }, [quote.items, itemAvailabilities, localQuantities]);

  const handleAddItem = async (
    itemId: string,
    itemName: string,
    unitPrice: number,
    quantity: number,
  ) => {
    // Check if item already exists in this quote
    const existingItem = quote.items.find((item) => item.item_id === itemId);

    if (existingItem) {
      // Item exists: increment quantity using local quantity if available
      const localQuantityStr = localQuantities.get(existingItem.id);
      const currentQuantity = localQuantityStr
        ? parseInt(localQuantityStr, 10) || 0
        : existingItem.quantity;
      const newQuantity = currentQuantity + quantity;

      const formData = new FormData();
      formData.append("quote_item_id", existingItem.id);
      formData.append("quantity", newQuantity.toString());
      formData.append("quote_id", quote.id);

      const result = await updateQuoteItem(formData);
      if (result.success) {
        router.refresh();
      } else if (result.error) {
        alert(result.error);
      }
    } else {
      // Item doesn't exist: create new quote_item
      const formData = new FormData();
      formData.append("quote_id", quote.id);
      formData.append("item_id", itemId);
      formData.append("quantity", quantity.toString());
      formData.append("unit_price", unitPrice.toString());

      const result = await addQuoteItem(formData);
      if (result.success) {
        router.refresh();
      } else if (result.error) {
        alert(result.error);
      }
    }
  };

  // Debounced save function
  const saveQuantity = async (quoteItemId: string, quantity: number) => {
    // Validate: integers >= 0 only
    if (!Number.isInteger(quantity) || quantity < 0) {
      return;
    }

    const formData = new FormData();
    formData.append("quote_item_id", quoteItemId);
    formData.append("quantity", quantity.toString());
    formData.append("quote_id", quote.id);

    const result = await updateQuoteItem(formData);
    if (result.success) {
      router.refresh();
    } else if (result.error) {
      alert(result.error);
      // Revert local quantity on error by syncing with server
      const item = quote.items.find((i) => i.id === quoteItemId);
      if (item) {
        setLocalQuantities((prev) => {
          const newMap = new Map(prev);
          newMap.set(quoteItemId, item.quantity.toString());
          return newMap;
        });
      }
    }
  };

  // Update local quantity and schedule debounced save
  const updateQuantity = (quoteItemId: string, newQuantity: number) => {
    // Update local state immediately
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

    // Schedule new save (300-500ms debounce, using 400ms)
    const timer = setTimeout(() => {
      saveQuantity(quoteItemId, newQuantity);
      debounceTimersRef.current.delete(quoteItemId);
    }, 400);

    debounceTimersRef.current.set(quoteItemId, timer);
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      debounceTimersRef.current.forEach((timer) => clearTimeout(timer));
      debounceTimersRef.current.clear();
    };
  }, []);

  const handleDeleteItem = async (quoteItemId: string) => {
    const formData = new FormData();
    formData.append("quote_item_id", quoteItemId);

    const result = await deleteQuoteItem(formData);
    if (result.success) {
      router.refresh();
    }
  };

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
      alert(result.error);
    }
  };

  const handleConfirmQuotation = async () => {
    setIsConfirming(true);
    const formData = new FormData();
    formData.append("quote_id", quote.id);

    const result = await confirmQuotation(formData);
    if (result.ok) {
      router.refresh();
      alert(result.message || "Quotation confirmed successfully!");
    } else {
      alert(result.error || "Failed to confirm quotation.");
    }
    setIsConfirming(false);
  };

  const numberOfDays = Math.ceil(
    (new Date(quote.end_date).getTime() -
      new Date(quote.start_date).getTime()) /
      (1000 * 60 * 60 * 24),
  );

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

  return (
    <div className="min-h-screen bg-gray-50">
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
                {/* Event-level risk indicator */}
                {quote.items.length > 0 && (
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Items</h2>
            <button
              onClick={() => setShowAddItemModal(true)}
              className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              + Add Item
            </button>
          </div>

          {quote.items.length === 0 ? (
            <div className="text-center text-gray-500 py-8 text-sm">
              No items yet. Click "+ Add Item" to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {quote.items.map((item) => {
                const breakdown = itemAvailabilities.get(item.item_id) || {
                  available: 0,
                  reserved: 0,
                  inTransit: 0,
                  outOfService: 0,
                  total: 0,
                };
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
                const effectiveAvailable =
                  breakdown.effectiveAvailable !== undefined
                    ? breakdown.effectiveAvailable
                    : breakdown.available;
                const isOverAvailable = displayQuantity > effectiveAvailable;

                return (
                  <div
                    key={item.id}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="font-medium text-gray-900 truncate">
                            {item.item_name || "Unknown Item"}
                          </h3>
                          {isOverAvailable && (
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
                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-gray-600 mb-2">
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
                        {/* Availability breakdown */}
                        <div className="mt-2 flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-gray-500">
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
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-4 sm:flex-col sm:items-end">
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
          </div>
        </div>
      </div>

      {/* Add Item Modal */}
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
    </div>
  );
}