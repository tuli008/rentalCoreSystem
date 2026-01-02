"use client";

import { useDroppable } from "@dnd-kit/core";

interface QuoteDropZoneProps {
  isEmpty: boolean;
  isReadOnly?: boolean;
}

export default function QuoteDropZone({ isEmpty, isReadOnly = false }: QuoteDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: "quote-drop-zone",
    disabled: isReadOnly,
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-2 border-dashed transition-all duration-200 ${
        isOver
          ? "border-blue-500 bg-blue-50 scale-[1.02]"
          : isEmpty
            ? "border-gray-300 bg-gray-50 min-h-[200px]"
            : "border-transparent min-h-[100px]"
      }`}
    >
      {isEmpty && (
        <div className="flex flex-col items-center justify-center h-full py-12 px-4">
          <svg
            className={`w-12 h-12 mb-4 transition-colors ${
              isOver ? "text-blue-500" : "text-gray-400"
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p
            className={`text-sm text-center transition-colors ${
              isOver ? "text-blue-700 font-medium" : "text-gray-600"
            }`}
          >
            {isReadOnly
              ? "This quote is accepted and cannot be modified"
              : isOver
                ? "Drop item here to add to quote"
                : "Drag items here or click '+ Add Item' to get started"}
          </p>
        </div>
      )}
      {!isEmpty && isOver && (
        <div className="flex items-center justify-center py-4">
          <p className="text-sm text-blue-700 font-medium">
            Drop here to add item to quote
          </p>
        </div>
      )}
    </div>
  );
}

