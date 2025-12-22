"use client";

import { useState, useEffect, useRef } from "react";

interface Stock {
  total_quantity: number;
  out_of_service_quantity: number;
}

interface StockEditorProps {
  stock: Stock | null;
  isLoadingStock: boolean;
  isSavingStock: boolean;
  stockError: string | null;
  onStockChange: (
    field: "total_quantity" | "out_of_service_quantity",
    value: string,
  ) => void;
  onStockSave: () => void;
}

export default function StockEditor({
  stock,
  isLoadingStock,
  isSavingStock,
  stockError,
  onStockChange,
  onStockSave,
}: StockEditorProps) {
  // Draft string state for smooth typing
  const [totalDraft, setTotalDraft] = useState("");
  const [outDraft, setOutDraft] = useState("");

  // Track which field is being edited to prevent syncing from overwriting user input
  const editingFieldRef = useRef<"total" | "out" | null>(null);

  // Sync draft state from numeric stock when stock changes, but not while editing
  useEffect(() => {
    if (!stock) {
      setTotalDraft("");
      setOutDraft("");
      return;
    }

    // Don't sync if user is currently editing a field
    if (editingFieldRef.current !== null) return;

    setTotalDraft(stock.total_quantity.toString());
    setOutDraft(stock.out_of_service_quantity.toString());
  }, [stock?.total_quantity, stock?.out_of_service_quantity]);

  const handleTotalChange = (value: string) => {
    // Allow empty string and numeric input only
    if (value === "" || /^\d+$/.test(value)) {
      setTotalDraft(value);
      // Only update numeric stock if draft parses to valid non-negative integer
      if (value !== "") {
        const numValue = parseInt(value, 10);
        if (!Number.isNaN(numValue) && numValue >= 0) {
          onStockChange("total_quantity", numValue.toString());
        }
      }
    }
  };

  const handleOutChange = (value: string) => {
    // Allow empty string and numeric input only
    if (value === "" || /^\d+$/.test(value)) {
      setOutDraft(value);
      // Only update numeric stock if draft parses to valid non-negative integer and respects constraint
      if (value !== "" && stock) {
        const numValue = parseInt(value, 10);
        if (!Number.isNaN(numValue) && numValue >= 0) {
          const total = stock.total_quantity;
          const clamped = Math.min(numValue, total);
          onStockChange("out_of_service_quantity", clamped.toString());
          // Update draft if clamped
          if (clamped !== numValue) {
            setOutDraft(clamped.toString());
          }
        }
      }
    }
  };

  const handleTotalFocus = () => {
    editingFieldRef.current = "total";
  };

  const handleOutFocus = () => {
    editingFieldRef.current = "out";
  };

  const handleTotalBlur = () => {
    editingFieldRef.current = null;
    if (!stock) return;

    const numValue = totalDraft === "" ? 0 : parseInt(totalDraft, 10);
    if (Number.isNaN(numValue) || numValue < 0) {
      // Reset to current stock value on invalid input
      setTotalDraft(stock.total_quantity.toString());
      return;
    }
    // Ensure numeric stock is updated with final value
    onStockChange("total_quantity", numValue.toString());
    onStockSave();
  };

  const handleOutBlur = () => {
    editingFieldRef.current = null;
    if (!stock) return;

    const numValue = outDraft === "" ? 0 : parseInt(outDraft, 10);
    if (Number.isNaN(numValue) || numValue < 0) {
      // Reset to current stock value on invalid input
      setOutDraft(stock.out_of_service_quantity.toString());
      return;
    }
    // Clamp to total and ensure numeric stock is updated
    const clamped = Math.min(numValue, stock.total_quantity);
    setOutDraft(clamped.toString());
    onStockChange("out_of_service_quantity", clamped.toString());
    onStockSave();
  };
  if (isLoadingStock) {
    return (
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Stock</h4>
        <div className="text-sm text-gray-500 py-2">Loading stock...</div>
      </div>
    );
  }

  if (!stock) {
    return (
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Stock</h4>
        <div className="text-sm text-gray-500 py-2">
          {stockError || "No stock data"}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Stock</h4>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">
            Total Quantity
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={totalDraft}
            onChange={(e) => handleTotalChange(e.target.value)}
            onFocus={handleTotalFocus}
            onBlur={handleTotalBlur}
            disabled={isSavingStock}
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">
            Out of Service
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={outDraft}
            onChange={(e) => handleOutChange(e.target.value)}
            onFocus={handleOutFocus}
            onBlur={handleOutBlur}
            disabled={isSavingStock}
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div className="pt-2 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Available</span>
            <span className="text-sm font-semibold text-gray-900">
              {stock.total_quantity - stock.out_of_service_quantity}
            </span>
          </div>
        </div>
        {isSavingStock && (
          <div className="text-xs text-gray-500">Saving...</div>
        )}
        {stockError && <div className="text-xs text-red-600">{stockError}</div>}
      </div>
    </div>
  );
}
