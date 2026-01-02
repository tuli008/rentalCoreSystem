"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

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

interface DraggableItemCardProps {
  item: InventoryItem;
  effectiveAvailable: number;
  onAddClick: (item: InventoryItem) => void;
  isReadOnly?: boolean;
}

export default function DraggableItemCard({
  item,
  effectiveAvailable,
  onAddClick,
  isReadOnly = false,
}: DraggableItemCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `item-${item.id}`,
    data: {
      type: "inventory-item",
      item: item,
    },
    disabled: isReadOnly,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.2 : 1,
    transition: isDragging ? undefined : "opacity 0.15s ease",
  };

  const isLowStock = effectiveAvailable === 0;
  const isMediumStock = effectiveAvailable > 0 && effectiveAvailable < 5;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isReadOnly ? {} : { ...attributes, ...listeners })}
      className={`p-4 hover:bg-gray-50 transition-colors border-b border-gray-200 last:border-b-0 ${
        isReadOnly ? "cursor-default" : "cursor-grab active:cursor-grabbing"
      }`}
    >
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
            <span className="font-medium text-gray-900">{item.name}</span>
            {item.group_name && (
              <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                {item.group_name}
              </span>
            )}
            {item.quantityInQuote && item.quantityInQuote > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">
                {item.quantityInQuote} in quote
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600 ml-7">
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
                {effectiveAvailable} / {item.total || 0}
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
          onClick={(e) => {
            e.stopPropagation();
            if (!isReadOnly) {
              onAddClick(item);
            }
          }}
          disabled={isReadOnly}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>
    </div>
  );
}

