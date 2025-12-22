"use client";

import { useState, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { InventoryItem } from "@/lib/inventory";

interface SortableItemRowProps {
  item: InventoryItem;
  onItemClick: (item: InventoryItem) => void;
}

export default function SortableItemRow({
  item,
  onItemClick,
}: SortableItemRowProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !mounted });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      onClick={() => onItemClick(item)}
      className="border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer group"
    >
      <td className="py-3 px-4 text-gray-900 font-medium flex items-center gap-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <svg
            className="w-4 h-4 text-gray-400"
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
        {item.name}
        {item.total === 0 && (
          <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded">
            Needs stock
          </span>
        )}
      </td>
      <td className="py-3 px-4 text-right text-gray-700 font-mono">
        {item.available} / {item.total}
      </td>
    </tr>
  );
}
