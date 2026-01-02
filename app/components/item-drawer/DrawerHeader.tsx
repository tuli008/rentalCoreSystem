"use client";

import type { InventoryItem } from "@/lib/inventory";

interface DrawerHeaderProps {
  item: InventoryItem;
  groupName: string;
  editingField: "name" | "price" | null;
  editValue: string;
  isSaving: boolean;
  onStartEdit: (field: "name" | "price") => void;
  onSave: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onEditValueChange: (value: string) => void;
  onDeleteClick: () => void;
  onClose: () => void;
}

export default function DrawerHeader({
  item,
  groupName,
  editingField,
  editValue,
  isSaving,
  onStartEdit,
  onSave,
  onKeyDown,
  onEditValueChange,
  onDeleteClick,
  onClose,
}: DrawerHeaderProps) {
  return (
    <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-xs sm:text-sm text-gray-500 mb-1">{groupName}</div>
        {editingField === "name" ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={onSave}
            autoFocus
            disabled={isSaving}
            className="w-full text-lg sm:text-xl font-bold text-gray-900 bg-white border-b-2 border-blue-500 focus:outline-none"
          />
        ) : (
          <h3
            onClick={() => onStartEdit("name")}
            className="text-lg sm:text-xl font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors line-clamp-2"
            title={item.name}
          >
            {item.name}
            {isSaving && (
              <span className="ml-2 text-xs sm:text-sm text-gray-500">
                Saving...
              </span>
            )}
          </h3>
        )}
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <button
          onClick={onDeleteClick}
          disabled={editingField !== null}
          className="px-3 py-2 sm:py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Delete
        </button>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          disabled={editingField !== null}
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
  );
}