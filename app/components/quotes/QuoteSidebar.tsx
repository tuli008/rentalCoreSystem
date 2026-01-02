"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  searchInventoryItems,
  getAllInventoryItemsForQuote,
} from "@/app/actions/quotes";
import type { QuoteItem } from "@/lib/quotes";
import DraggableItemCard from "./DraggableItemCard";

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
  quantityInQuote?: number; // Quantity already in the quote
}

interface QuoteSidebarProps {
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
  quoteSummary?: {
    totalItems: number;
    subtotal: number;
    numberOfDays: number;
  };
  isReadOnly?: boolean;
}

export default function QuoteSidebar({
  onAddItem,
  existingQuoteItems,
  quoteContext,
  quoteSummary,
  isReadOnly = false,
}: QuoteSidebarProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "search" | "quick">(
    "search",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [allItems, setAllItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [quickAddProduct, setQuickAddProduct] = useState("");
  const [quickAddQty, setQuickAddQty] = useState("1");
  const [quickAddPrice, setQuickAddPrice] = useState("0");
  const [quickAddResults, setQuickAddResults] = useState<InventoryItem[]>([]);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Create a map of item_id -> quantity already in quote
  const itemsInQuote = useMemo(() => {
    const map = new Map<string, number>();
    existingQuoteItems.forEach((item) => {
      const currentQty = map.get(item.item_id) || 0;
      map.set(item.item_id, currentQty + item.quantity);
    });
    return map;
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

    if (activeTab === "search") {
      loadItems();
    }
  }, [quoteContext, activeTab]);

  // Handle search
  useEffect(() => {
    if (activeTab !== "search") return;

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
  }, [searchQuery, quoteContext, activeTab]);

  // Quick add search
  useEffect(() => {
    if (activeTab !== "quick" || !quickAddProduct.trim()) {
      setQuickAddResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setIsLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchInventoryItems(
          quickAddProduct,
          quoteContext,
        );
        setQuickAddResults(results);
      } catch (error) {
        console.error("Error searching items:", error);
        setQuickAddResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [quickAddProduct, quoteContext, activeTab]);

  // Filter items by selected groups and adjust availability
  const filteredItems = useMemo(() => {
    let items = allItems;

    // Filter by groups if any are selected
    if (selectedGroups.size > 0) {
      items = items.filter(
        (item) => item.group_id && selectedGroups.has(item.group_id),
      );
    }

    // Adjust availability for items already in quote (but keep them visible)
    return items.map((item) => {
      const quantityInQuote = itemsInQuote.get(item.id) || 0;
      if (quantityInQuote > 0) {
        // Adjust effective available by subtracting what's already in quote
        // Note: effectiveAvailable from server already excludes overlapping events,
        // so we only need to subtract what's in THIS quote
        const currentAvailable = item.effectiveAvailable !== undefined
          ? item.effectiveAvailable
          : item.available || 0;
        return {
          ...item,
          // Don't modify total - it represents the actual inventory total
          effectiveAvailable: Math.max(0, currentAvailable - quantityInQuote),
          quantityInQuote, // Add this for display
        };
      }
      return item;
    });
  }, [allItems, selectedGroups, itemsInQuote]);

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
    if (isReadOnly) {
      return;
    }
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

  const handleQuickAdd = () => {
    if (quickAddResults.length === 0 || !quickAddProduct.trim()) {
      alert("Please search and select a product first");
      return;
    }

    const selectedItem = quickAddResults[0]; // Use first result
    const qty = parseInt(quickAddQty, 10);
    const price = parseFloat(quickAddPrice);

    if (Number.isNaN(qty) || qty <= 0) {
      alert("Please enter a valid quantity");
      return;
    }

    if (Number.isNaN(price) || price < 0) {
      alert("Please enter a valid price");
      return;
    }

    onAddItem(selectedItem.id, selectedItem.name, price, qty);
    // Reset
    setQuickAddProduct("");
    setQuickAddQty("1");
    setQuickAddPrice("0");
    setQuickAddResults([]);
  };

  const effectiveAvailable = (item: InventoryItem) => {
    return item.effectiveAvailable !== undefined
      ? item.effectiveAvailable
      : item.available || 0;
  };

  return (
    <div className="w-80 lg:w-96 bg-white border-l border-gray-200 flex flex-col h-screen flex-shrink-0 overflow-y-auto order-2">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab("summary")}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "summary"
              ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          Summary
        </button>
        <button
          onClick={() => setActiveTab("search")}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "search"
              ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          Product Search
        </button>
        <button
          onClick={() => setActiveTab("quick")}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "quick"
              ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          Quick Add
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "summary" && quoteSummary && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Quote Summary
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Items:</span>
                  <span className="font-medium text-gray-900">
                    {quoteSummary.totalItems}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Days:</span>
                  <span className="font-medium text-gray-900">
                    {quoteSummary.numberOfDays}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="text-gray-900 font-semibold">Subtotal:</span>
                  <span className="font-bold text-gray-900">
                    ${quoteSummary.subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-900 font-semibold">Total:</span>
                  <span className="font-bold text-lg text-gray-900">
                    ${quoteSummary.subtotal.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "search" && (
          <div className="space-y-4">
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
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${
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
                      className="px-2 py-1 text-xs rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
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
                <div className="text-center text-gray-500 py-8 text-sm">
                  Loading items...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center text-gray-500 py-8 text-sm">
                  {searchQuery.trim().length >= 2
                    ? "No items found"
                    : selectedGroups.size > 0
                      ? "No items in selected groups"
                      : "No items available"}
                </div>
              ) : (
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
                    {filteredItems.map((item) => {
                      const avail = effectiveAvailable(item);
                      return (
                        <DraggableItemCard
                          key={item.id}
                          item={item}
                          effectiveAvailable={avail}
                          onAddClick={handleAddClick}
                          isReadOnly={isReadOnly}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "quick" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product
              </label>
              <input
                type="text"
                value={quickAddProduct}
                onChange={(e) => setQuickAddProduct(e.target.value)}
                placeholder="Type to search..."
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                autoFocus
              />
              {quickAddResults.length > 0 && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-xs text-gray-600 mb-1">
                    Selected: {quickAddResults[0].name}
                  </p>
                  <p className="text-xs text-gray-500">
                    Available: {effectiveAvailable(quickAddResults[0])} /{" "}
                    {quickAddResults[0].total || 0} | Rate: $
                    {quickAddResults[0].price.toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Qty
              </label>
              <input
                type="number"
                min="1"
                value={quickAddQty}
                onChange={(e) => setQuickAddQty(e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={quickAddPrice}
                onChange={(e) => setQuickAddPrice(e.target.value)}
                placeholder={
                  quickAddResults.length > 0
                    ? quickAddResults[0].price.toFixed(2)
                    : "0"
                }
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <button
              onClick={handleQuickAdd}
              disabled={
                isReadOnly ||
                !quickAddProduct.trim() ||
                quickAddResults.length === 0 ||
                !quickAddQty ||
                parseInt(quickAddQty, 10) <= 0
              }
              className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ADD
            </button>
          </div>
        )}
      </div>

      {/* Quantity Modal */}
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
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                {selectedItem.group_name && (
                  <div className="text-sm text-gray-600 mb-1">
                    <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded mr-2">
                      {selectedItem.group_name}
                    </span>
                  </div>
                )}
                <div className="text-sm text-gray-600">
                  Available:{" "}
                  <span className="font-mono">
                    {effectiveAvailable(selectedItem)} / {selectedItem.total || 0}
                  </span>
                </div>
              </div>

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
              </div>

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
                  Default: ${selectedItem.price.toFixed(2)}
                </p>
              </div>
            </div>

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
    </div>
  );
}

