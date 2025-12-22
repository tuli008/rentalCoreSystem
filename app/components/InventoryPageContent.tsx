"use client";

import { useState } from "react";
import type { InventoryGroup } from "@/lib/inventory";
import InventorySearch from "./InventorySearch";
import SortableGroupsList from "./SortableGroupsList";

interface InventoryPageContentProps {
  groups: InventoryGroup[];
  createItem: (formData: FormData) => Promise<
    | { ok: true }
    | {
        ok: false;
        error: "DUPLICATE_NAME" | "VALIDATION_ERROR" | "SERVER_ERROR";
      }
  >;
  updateItem: (formData: FormData) => Promise<void>;
  updateStock: (formData: FormData) => Promise<void>;
  addMaintenanceLog: (formData: FormData) => Promise<void>;
  updateUnitStatus: (formData: FormData) => Promise<void>;
  reorderGroups: (formData: FormData) => Promise<void>;
  reorderItems: (formData: FormData) => Promise<void>;
  deleteItem: (
    formData: FormData,
  ) => Promise<{ error?: string; success?: boolean }>;
  deleteGroup: (
    formData: FormData,
  ) => Promise<{ error?: string; success?: boolean }>;
}

export default function InventoryPageContent({
  groups,
  createItem,
  updateItem,
  updateStock,
  addMaintenanceLog,
  updateUnitStatus,
  reorderGroups,
  reorderItems,
  deleteItem,
  deleteGroup,
}: InventoryPageContentProps) {
  const [itemIdToOpen, setItemIdToOpen] = useState<string | null>(null);

  const handleItemSelect = (itemId: string, groupId: string) => {
    setItemIdToOpen(itemId);
  };

  const handleItemOpened = () => {
    setItemIdToOpen(null);
  };

  return (
    <>
      <InventorySearch onItemSelect={handleItemSelect} />
      <SortableGroupsList
        groups={groups}
        createItem={createItem}
        updateItem={updateItem}
        updateStock={updateStock}
        addMaintenanceLog={addMaintenanceLog}
        updateUnitStatus={updateUnitStatus}
        reorderGroups={reorderGroups}
        reorderItems={reorderItems}
        deleteItem={deleteItem}
        deleteGroup={deleteGroup}
        itemIdToOpen={itemIdToOpen}
        onItemOpened={handleItemOpened}
      />
    </>
  );
}
