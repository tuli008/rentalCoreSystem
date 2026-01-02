"use client";

import { useState, useEffect } from "react";
import AddItemModal from "./AddItemModal";

interface QuoteItem {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
}

interface QuoteDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuoteDrawer({ isOpen, onClose }: QuoteDrawerProps) {
  const [quoteName, setQuoteName] = useState("New Quote");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 8);
    return date.toISOString().split("T")[0];
  });
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [showAddItemModal, setShowAddItemModal] = useState(false);

  // Calculate number of days
  const numberOfDays =
    startDate && endDate
      ? Math.ceil(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

  // Calculate totals
  const subtotal = items.reduce((sum, item) => {
    return sum + item.quantity * item.unitPrice * numberOfDays;
  }, 0);

  const handleStartEditName = () => {
    setIsEditingName(true);
    setEditNameValue(quoteName);
  };

  const handleSaveName = () => {
    if (editNameValue.trim()) {
      setQuoteName(editNameValue.trim());
    }
    setIsEditingName(false);
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setEditNameValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveName();
    } else if (e.key === "Escape") {
      handleCancelEditName();
    }
  };

  const handleQuantityChange = (itemId: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item,
      ),
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleAddItem = (
    itemId: string,
    itemName: string,
    unitPrice: number,
  ) => {
    const newItem: QuoteItem = {
      id: `item-${Date.now()}`,
      itemId,
      itemName,
      quantity: 1,
      unitPrice,
    };
    setItems((prev) => [...prev, newItem]);
    setShowAddItemModal(false);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div
        className={`fixed inset-y-0 right-0 w-full sm:w-full md:max-w-2xl bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              {isEditingName ? (
                <input
                  type="text"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSaveName}
                  autoFocus
                  className="w-full text-xl font-bold text-gray-900 bg-white border-b-2 border-blue-500 focus:outline-none"
                />
              ) : (
                <h2
                  onClick={handleStartEditName}
                  className="text-xl font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors line-clamp-2"
                  title={quoteName}
                >
                  {quoteName}
                </h2>
              )}
            </div>
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <span className="px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-gray-100 text-gray-800">
                Draft
              </span>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <svg
                  className="w-6 h-6"
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

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            <div className="space-y-6">
              {/* Date Range */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  Rental Period
                </h4>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-600 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-600 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate}
                      className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>
                {numberOfDays > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    {numberOfDays} day{numberOfDays !== 1 ? "s" : ""}
                  </p>
                )}
              </div>

              {/* Items Section */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <h4 className="text-sm font-semibold text-gray-700">Items</h4>
                  <button
                    onClick={() => setShowAddItemModal(true)}
                    className="w-full sm:w-auto px-3 py-2 sm:py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                  >
                    + Add Item
                  </button>
                </div>

                {items.length === 0 ? (
                  <div className="text-center text-gray-500 py-8 text-sm bg-gray-50 rounded-lg border border-gray-200">
                    No items yet. Click "+ Add Item" to get started.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => {
                      const lineTotal =
                        item.quantity * item.unitPrice * numberOfDays;
                      return (
                        <div
                          key={item.id}
                          className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors group"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              {/* Drag handle (placeholder for future drag-and-drop) */}
                              <div className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing pt-1 flex-shrink-0">
                                <svg
                                  className="w-5 h-5 text-gray-400"
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
                              </div>
                              <div className="flex-1 min-w-0">
                                <h5 className="font-medium text-gray-900 mb-2 truncate">
                                  {item.itemName}
                                </h5>
                                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-gray-600">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() =>
                                        handleQuantityChange(item.id, -1)
                                      }
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
                                          d="M20 12H4"
                                        />
                                      </svg>
                                    </button>
                                    <span className="w-8 text-center font-medium">
                                      {item.quantity}
                                    </span>
                                    <button
                                      onClick={() =>
                                        handleQuantityChange(item.id, 1)
                                      }
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
                                    × ${item.unitPrice.toFixed(2)}
                                  </span>
                                  {numberOfDays > 0 && (
                                    <span className="whitespace-nowrap">
                                      × {numberOfDays} day
                                      {numberOfDays !== 1 ? "s" : ""}
                                    </span>
                                  )}
                                </div>
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
                                onClick={() => handleRemoveItem(item.id)}
                                className="p-2 sm:p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                                title="Remove item"
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
            </div>
          </div>

          {/* Pricing Summary (Sticky Bottom) */}
          <div className="border-t border-gray-200 bg-white px-4 sm:px-6 py-4">
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
            </div>
          </div>
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddItemModal && (
        <AddItemModal
          onClose={() => setShowAddItemModal(false)}
          onAddItem={handleAddItem}
          existingQuoteItems={items.map((item) => ({
            id: item.id,
            quote_id: "",
            item_id: item.itemId,
            quantity: item.quantity,
            unit_price_snapshot: item.unitPrice,
          }))}
        />
      )}
    </>
  );
}