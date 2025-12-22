"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { InventoryGroup } from "@/lib/inventory";
import SortableGroup from "./SortableGroup";

interface SortableGroupsListProps {
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
  itemIdToOpen: string | null;
  onItemOpened: () => void;
}

export default function SortableGroupsList({
  groups: initialGroups,
  createItem,
  updateItem,
  updateStock,
  addMaintenanceLog,
  updateUnitStatus,
  reorderGroups,
  reorderItems,
  deleteItem,
  deleteGroup,
  itemIdToOpen,
  onItemOpened,
}: SortableGroupsListProps) {
  // Use initialGroups as source of truth, only override during drag
  const [draggingGroups, setDraggingGroups] = useState<InventoryGroup[] | null>(
    null,
  );
  const [mounted, setMounted] = useState(false);

  // Only render DndContext on client to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      setDraggingGroups(null);
      return;
    }

    // Use current groups (either dragging state or initialGroups)
    const currentGroups = draggingGroups || initialGroups;
    const oldIndex = currentGroups.findIndex((g) => g.id === active.id);
    const newIndex = currentGroups.findIndex((g) => g.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      setDraggingGroups(null);
      return;
    }

    // Optimistic update during drag
    const newGroups = arrayMove(currentGroups, oldIndex, newIndex);
    setDraggingGroups(newGroups);

    // Update display_order values
    const groupOrders: Record<string, number> = {};
    newGroups.forEach((group, index) => {
      groupOrders[group.id] = index;
    });

    const formData = new FormData();
    formData.append("group_orders", JSON.stringify(groupOrders));

    try {
      await reorderGroups(formData);
      // Clear dragging state - server will revalidate and update initialGroups
      setDraggingGroups(null);
    } catch (error) {
      console.error("Error reordering groups:", error);
      // Revert on error
      setDraggingGroups(null);
    }
  };

  // Use draggingGroups if set (during drag), otherwise use initialGroups (source of truth)
  const groupsToRender = draggingGroups || initialGroups;

  // Render without DndContext during SSR to avoid hydration mismatch
  if (!mounted) {
    return (
      <>
        {groupsToRender.map((group) => (
          <SortableGroup
            key={group.id}
            group={group}
            createItem={createItem}
            updateItem={updateItem}
            updateStock={updateStock}
            addMaintenanceLog={addMaintenanceLog}
            updateUnitStatus={updateUnitStatus}
            reorderItems={reorderItems}
            deleteItem={deleteItem}
            deleteGroup={deleteGroup}
            itemIdToOpen={itemIdToOpen}
            onItemOpened={onItemOpened}
          />
        ))}
      </>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={groupsToRender.map((g) => g.id)}
        strategy={verticalListSortingStrategy}
      >
        {groupsToRender.map((group) => (
          <SortableGroup
            key={group.id}
            group={group}
            createItem={createItem}
            updateItem={updateItem}
            updateStock={updateStock}
            addMaintenanceLog={addMaintenanceLog}
            updateUnitStatus={updateUnitStatus}
            reorderItems={reorderItems}
            deleteItem={deleteItem}
            deleteGroup={deleteGroup}
            itemIdToOpen={itemIdToOpen}
            onItemOpened={onItemOpened}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}
