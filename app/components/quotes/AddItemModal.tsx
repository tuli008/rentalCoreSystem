"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { searchInventoryItems } from "@/app/actions/quotes";
import { calculateBufferQuantity, type QuoteItem } from "@/lib/quotes";

interface InventoryItem {
  id: string;
  name: string;
  price: number;
  is_serialized?: boolean;
  available?: number;
  total?: number;
  effectiveAvailable?: number;
  reservedInOverlappingEvents?: number;
}

interface AddItemModalProps {
  onClose: () => void;
  onAddItem: (
    itemId: string,
    itemName: string,
    unitPrice: number,
    quantity: number,
  ) => void;
  existingQuoteItems: QuoteItem[];
  quoteContext?: {
    quoteId: string;
    startDate: string;
    endDate: string;
  };
}

export default function AddItemModal({
  onClose,
  onAddItem,
  existingQuoteItems,
  quoteContext,
}: AddItemModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<InventoryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [showQuantityPrompt, setShowQuantityPrompt] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Create a set of item_ids that are already in the quote for quick lookup
  const existingItemIds = useMemo(() => {
    return new Set(existingQuoteItems.map((item) => item.item_id));
  }, [existingQuoteItems]);

  // Check if an item is already in the quote
  const isItemAlreadyAdded = (itemId: string) => {
    return existingItemIds.has(itemId);
  };

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchInventoryItems(searchQuery, quoteContext);
        setSearchResults(results);
      } catch (error) {
        console.error("Error searching items:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, quoteContext]);

  const handleSelectItem = (item: InventoryItem) => {
    // Prevent selecting items that are already in the quote
    if (isItemAlreadyAdded(item.id)) {
      return;
    }
    setSelectedItem(item);
    setShowQuantityPrompt(true);
    setSearchQuery(item.name);
    setSearchResults([]);
    // Set initial quantity to 1
    setQuantity("1");
  };

  // Calculate buffer suggestions when item is selected and quantity changes
  const bufferSuggestions = useMemo(() => {
    if (!selectedItem || !selectedItem.total) return [];
    const baseQty = parseInt(quantity, 10) || 1;
    const isSerialized = selectedItem.is_serialized || false;
    const buffer = calculateBufferQuantity(
      isSerialized,
      selectedItem.total,
      baseQty,
    );
    if (buffer > 0) {
      return [baseQty + buffer];
    }
    return [];
  }, [selectedItem, quantity]);

  // Check if quantity exceeds effective available
  const quantityExceedsAvailable = useMemo(() => {
    if (!selectedItem) return false;
    const qty = parseInt(quantity, 10) || 0;
    const effectiveAvailable =
      selectedItem.effectiveAvailable !== undefined
        ? selectedItem.effectiveAvailable
        : selectedItem.available;
    return effectiveAvailable !== undefined && qty > effectiveAvailable;
  }, [selectedItem, quantity]);

  const handleConfirmAdd = () => {
    if (!selectedItem) return;

    const qty = parseInt(quantity, 10);
    if (Number.isNaN(qty) || qty <= 0) {
      alert("Please enter a valid quantity");
      return;
    }

    onAddItem(selectedItem.id, selectedItem.name, selectedItem.price, qty);
    // Reset state
    setSelectedItem(null);
    setShowQuantityPrompt(false);
    setQuantity("1");
    setSearchQuery("");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] sm:max-h-[80vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">
            Add Item to Quote
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-1 text-gray-400 hover:text-gray-600 rounded-md transition-colors"
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

        <div className="flex-1 overflow-y-auto space-y-4">
          {!showQuantityPrompt ? (
            <>
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search Items
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type to search..."
                  className="w-full px-3 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                {isSearching && (
                  <p className="text-xs text-gray-500 mt-1">Searching...</p>
                )}
              </div>

              {/* Search Results */}
              {searchQuery.trim().length >= 2 && (
                <div className="border border-gray-200 rounded-md max-h-64 overflow-y-auto">
                  {searchResults.length === 0 && !isSearching ? (
                    <div className="p-4 text-center text-sm text-gray-500">
                      No items found
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {searchResults.map((item) => {
                        const alreadyAdded = isItemAlreadyAdded(item.id);
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleSelectItem(item)}
                            disabled={alreadyAdded}
                            className={`w-full p-3 text-left transition-colors ${
                              alreadyAdded
                                ? "opacity-50 cursor-not-allowed bg-gray-50"
                                : "hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-medium text-gray-900">
                                {item.name}
                              </div>
                              {alreadyAdded && (
                                <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-700 rounded">
                                  Already added
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-600">
                              <span>${item.price.toFixed(2)}</span>
                              {item.effectiveAvailable !== undefined ? (
                                <span
                                  className={`text-xs ${
                                    item.effectiveAvailable === 0
                                      ? "text-red-600 font-medium"
                                      : item.effectiveAvailable < 5
                                        ? "text-yellow-600"
                                        : "text-gray-500"
                                  }`}
                                >
                                  ({item.effectiveAvailable} / {item.total || 0}{" "}
                                  effective available
                                  {item.reservedInOverlappingEvents &&
                                  item.reservedInOverlappingEvents > 0
                                    ? `, ${item.reservedInOverlappingEvents} reserved in overlapping events`
                                    : ""}
                                  )
                                </span>
                              ) : item.available !== undefined ? (
                                <span className="text-xs text-gray-500">
                                  ({item.available} / {item.total || 0}{" "}
                                  available)
                                </span>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Selected Item */}
              {selectedItem && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="font-medium text-gray-900 mb-1">
                    {selectedItem.name}
                  </div>
                  <div className="text-sm text-gray-600">
                    Price: ${selectedItem.price.toFixed(2)}
                  </div>
                  {selectedItem.effectiveAvailable !== undefined && (
                    <div className="text-sm text-gray-600 mt-1">
                      Effective Available: {selectedItem.effectiveAvailable} /{" "}
                      {selectedItem.total || 0}
                      {selectedItem.reservedInOverlappingEvents &&
                      selectedItem.reservedInOverlappingEvents > 0 ? (
                        <span className="text-xs text-gray-500">
                          {" "}
                          ({selectedItem.reservedInOverlappingEvents} reserved
                          in overlapping events)
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
              )}

              {/* Quantity Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className={`w-full px-3 py-2.5 bg-white text-gray-900 border rounded-md focus:outline-none focus:ring-2 ${
                    quantityExceedsAvailable
                      ? "border-red-300 focus:ring-red-500"
                      : "border-gray-300 focus:ring-blue-500"
                  }`}
                  autoFocus
                />
                {quantityExceedsAvailable && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-800">
                      Quantity exceeds effective available (
                      {selectedItem?.effectiveAvailable !== undefined
                        ? selectedItem.effectiveAvailable
                        : selectedItem?.available || 0}
                      )
                    </p>
                  </div>
                )}
                {/* Buffer suggestions */}
                {bufferSuggestions.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-600 mb-1">
                      Suggested with buffer:
                    </p>
                    <div className="flex gap-2">
                      {bufferSuggestions.map((suggestedQty) => (
                        <button
                          key={suggestedQty}
                          type="button"
                          onClick={() => setQuantity(suggestedQty.toString())}
                          className="px-3 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                        >
                          {suggestedQty} (+
                          {suggestedQty - (parseInt(quantity, 10) || 1)})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end mt-4 pt-4 border-t border-gray-200">
          {showQuantityPrompt ? (
            <>
              <button
                onClick={() => {
                  setShowQuantityPrompt(false);
                  setSelectedItem(null);
                  setQuantity("1");
                }}
                className="w-full sm:w-auto px-4 py-2.5 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleConfirmAdd}
                className="w-full sm:w-auto px-4 py-2.5 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                Add to Quote
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}