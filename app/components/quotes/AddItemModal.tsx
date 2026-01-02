"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  searchInventoryItems,
  getAllInventoryItemsForQuote,
} from "@/app/actions/quotes";
import type { QuoteItem } from "@/lib/quotes";

interface InventoryItem {
  id: string;
  name: string;
  price: number;
  is_serialized?: boolean;
  available?: number;
  total?: number;
  effectiveAvailable?: number;
  reservedInOverlappingEvents?: number;
  group_id?: string;
  group_name?: string;
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
  const [allItems, setAllItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Create a set of item_ids that are already in the quote
  const existingItemIds = useMemo(() => {
    return new Set(existingQuoteItems.map((item) => item.item_id));
  }, [existingQuoteItems]);

  // Get unique groups from items
  const availableGroups = useMemo(() => {
    const groupMap = new Map<string, string>();
    allItems.forEach((item) => {
      if (item.group_id && item.group_name) {
        groupMap.set(item.group_id, item.group_name);
      }
    });
    return Array.from(groupMap.entries()).map(([id, name]) => ({
      id,
      name,
    }));
  }, [allItems]);

  // Load all items on mount
  useEffect(() => {
    const loadItems = async () => {
      setIsLoading(true);
      try {
        const items = await getAllInventoryItemsForQuote(quoteContext);
        setAllItems(items);
      } catch (error) {
        console.error("Error loading items:", error);
        setAllItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadItems();
  }, [quoteContext]);

  // Handle search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length < 2) {
      // If search is cleared, reload all items
      const loadItems = async () => {
        const items = await getAllInventoryItemsForQuote(quoteContext);
        setAllItems(items);
      };
      loadItems();
      return;
    }

    setIsLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchInventoryItems(searchQuery, quoteContext);
        setAllItems(results);
      } catch (error) {
        console.error("Error searching items:", error);
        setAllItems([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, quoteContext]);

  // Filter items by selected groups
  const filteredItems = useMemo(() => {
    let items = allItems;

    // Filter by groups if any are selected
    if (selectedGroups.size > 0) {
      items = items.filter(
        (item) => item.group_id && selectedGroups.has(item.group_id),
      );
    }

    // Filter out items already in quote
    return items.filter((item) => !existingItemIds.has(item.id));
  }, [allItems, selectedGroups, existingItemIds]);

  const handleGroupToggle = (groupId: string) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleAddClick = (item: InventoryItem) => {
    setSelectedItem(item);
    setUnitPrice(item.price.toFixed(2));
    setQuantity("1");
    setShowQuantityModal(true);
  };

  const handleConfirmAdd = () => {
    if (!selectedItem) return;

    const qty = parseInt(quantity, 10);
    if (Number.isNaN(qty) || qty <= 0) {
      alert("Please enter a valid quantity");
      return;
    }

    const price = parseFloat(unitPrice);
    if (Number.isNaN(price) || price < 0) {
      alert("Please enter a valid price");
      return;
    }

    onAddItem(selectedItem.id, selectedItem.name, price, qty);
    // Reset state
    setSelectedItem(null);
    setShowQuantityModal(false);
    setQuantity("1");
    setUnitPrice("");
  };

  const effectiveAvailable = (item: InventoryItem) => {
    return item.effectiveAvailable !== undefined
      ? item.effectiveAvailable
      : item.available || 0;
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-4 sm:p-6 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl">
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
            {/* Search Bar */}
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
            </div>

            {/* Group Filter */}
            {availableGroups.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Group
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableGroups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => handleGroupToggle(group.id)}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        selectedGroups.has(group.id)
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {group.name}
                    </button>
                  ))}
                  {selectedGroups.size > 0 && (
                    <button
                      onClick={() => setSelectedGroups(new Set())}
                      className="px-3 py-1.5 text-sm rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Items List */}
            <div>
              {isLoading ? (
                <div className="text-center text-gray-500 py-8">
                  Loading items...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  {searchQuery.trim().length >= 2
                    ? "No items found"
                    : selectedGroups.size > 0
                      ? "No items in selected groups"
                      : "No items available"}
                </div>
              ) : (
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                    {filteredItems.map((item) => {
                      const avail = effectiveAvailable(item);
                      const isLowStock = avail === 0;
                      const isMediumStock = avail > 0 && avail < 5;

                      return (
                        <div
                          key={item.id}
                          className="p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-1">
                                <span className="font-medium text-gray-900">
                                  {item.name}
                                </span>
                                {item.group_name && (
                                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                                    {item.group_name}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-600">
                                <span>
                                  Available:{" "}
                                  <span
                                    className={`font-mono ${
                                      isLowStock
                                        ? "text-red-600 font-semibold"
                                        : isMediumStock
                                          ? "text-yellow-600"
                                          : "text-gray-700"
                                    }`}
                                  >
                                    {avail} / {item.total || 0}
                                  </span>
                                </span>
                                <span>
                                  Rate:{" "}
                                  <span className="font-semibold text-gray-900">
                                    ${item.price.toFixed(2)}
                                  </span>
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleAddClick(item)}
                              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Quantity Selection Modal */}
      {showQuantityModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Add {selectedItem.name}
              </h3>
              <button
                onClick={() => {
                  setShowQuantityModal(false);
                  setSelectedItem(null);
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
                <div className="text-sm text-gray-600 mb-1">
                  {selectedItem.group_name && (
                    <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded mr-2">
                      {selectedItem.group_name}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  Available:{" "}
                  <span className="font-mono">
                    {effectiveAvailable(selectedItem)} / {selectedItem.total || 0}
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
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                {parseInt(quantity, 10) > effectiveAvailable(selectedItem) && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-800">
                      Quantity exceeds available ({effectiveAvailable(selectedItem)})
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
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Default: ${selectedItem.price.toFixed(2)} - You can modify this
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowQuantityModal(false);
                  setSelectedItem(null);
                }}
                className="px-4 py-2.5 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAdd}
                disabled={
                  !quantity ||
                  parseInt(quantity, 10) <= 0 ||
                  !unitPrice ||
                  parseFloat(unitPrice) < 0
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
}
