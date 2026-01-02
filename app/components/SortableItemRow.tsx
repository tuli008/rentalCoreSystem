"use client";

import { useState, useEffect, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
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
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu]);

  const handleAddToQuote = () => {
    setShowMenu(false);
    // Navigate to quotes page - user can create a new quote or select existing
    router.push("/quotes");
  };

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
      <td className="py-3 px-3 sm:px-4 text-gray-900 font-medium flex items-center gap-2 text-sm sm:text-base">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
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
        <span className="truncate flex-1 min-w-0">{item.name}</span>
        {item.total === 0 && (
          <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded whitespace-nowrap flex-shrink-0">
            Needs stock
          </span>
        )}
      </td>
      <td className="py-3 px-3 sm:px-4 text-right text-gray-700 font-mono text-sm sm:text-base whitespace-nowrap">
        {item.available} / {item.total}
      </td>
      <td className="py-3 px-3 sm:px-4 w-10 relative">
        <div ref={menuRef} className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 rounded-md hover:bg-gray-200 transition-colors opacity-0 group-hover:opacity-100"
            aria-label="More options"
          >
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
              />
            </svg>
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddToQuote();
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Add to quote...
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}