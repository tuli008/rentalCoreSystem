"use client";

import { useState, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { InventoryGroup } from "@/lib/inventory";
import type { SortOrder } from "./InventoryPageContent";
import InventoryGroupCard from "./InventoryGroupCard";

interface SortableGroupProps {
  group: InventoryGroup;
  createItem: (formData: FormData) => Promise<
    | { ok: true }
    | {
        ok: false;
        error: "DUPLICATE_NAME" | "VALIDATION_ERROR" | "SERVER_ERROR" | "UNAUTHORIZED";
      }
  >;
  updateItem: (formData: FormData) => Promise<void>;
  updateStock: (formData: FormData) => Promise<void>;
  addMaintenanceLog: (formData: FormData) => Promise<void>;
  updateUnitStatus: (formData: FormData) => Promise<void>;
  reorderItems: (formData: FormData) => Promise<void>;
  deleteItem: (
    formData: FormData,
  ) => Promise<{ error?: string; success?: boolean }>;
  deleteGroup: (
    formData: FormData,
  ) => Promise<{ error?: string; success?: boolean }>;
  updateGroup?: (
    formData: FormData,
  ) => Promise<{ error?: string; success?: boolean }>;
  itemIdToOpen: string | null;
  onItemOpened: () => void;
  sortOrder: SortOrder;
  isCollapsed: boolean;
  pageSize: number;
}

export default function SortableGroup({
  group,
  createItem,
  updateItem,
  updateStock,
  addMaintenanceLog,
  updateUnitStatus,
  reorderItems,
  deleteItem,
  deleteGroup,
  updateGroup,
  itemIdToOpen,
  onItemOpened,
  sortOrder,
  isCollapsed,
  pageSize,
}: SortableGroupProps) {
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
  } = useSortable({ id: group.id, disabled: !mounted });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="block sm:flex sm:items-start sm:gap-2 group">
        {mounted && (
          <div
            {...attributes}
            {...listeners}
            className="hidden sm:block mt-6 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          >
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
        )}
        <div className="sm:flex-1">
          <InventoryGroupCard
            group={group}
            createItem={createItem}
            moveItem={async () => {}} // Not used anymore
            updateItem={updateItem}
            updateStock={updateStock}
            addMaintenanceLog={addMaintenanceLog}
            updateUnitStatus={updateUnitStatus}
            reorderItems={reorderItems}
            deleteItem={deleteItem}
            deleteGroup={deleteGroup}
            updateGroup={updateGroup}
            itemIdToOpen={itemIdToOpen}
            onItemOpened={onItemOpened}
            sortOrder={sortOrder}
            initialCollapsed={isCollapsed}
            pageSize={pageSize}
          />
        </div>
      </div>
    </div>
  );
}