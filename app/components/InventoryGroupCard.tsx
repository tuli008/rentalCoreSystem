"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { flushSync } from "react-dom";
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { InventoryGroup, InventoryItem } from "@/lib/inventory";
import { supabase } from "@/lib/supabase";
import SortableItemRow from "./SortableItemRow";
import ItemDetailDrawer from "./item-drawer/ItemDetailDrawer";
import DeleteModals from "./item-drawer/DeleteModals";

interface Unit {
  id: string;
  serial_number: string;
  barcode: string;
  status: "available" | "out" | "maintenance";
  location_name: string;
}

interface MaintenanceLog {
  id: string;
  note: string;
  created_at: string;
}

interface Stock {
  total_quantity: number;
  out_of_service_quantity: number;
}

interface InventoryGroupCardProps {
  group: InventoryGroup;
  createItem: (formData: FormData) => Promise<
    | { ok: true }
    | {
        ok: false;
        error: "DUPLICATE_NAME" | "VALIDATION_ERROR" | "SERVER_ERROR";
      }
  >;
  moveItem: (formData: FormData) => Promise<void>;
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
  itemIdToOpen: string | null;
  onItemOpened: () => void;
}

export default function InventoryGroupCard({
  group: initialGroup,
  createItem,
  moveItem,
  updateItem,
  updateStock,
  addMaintenanceLog,
  updateUnitStatus,
  reorderItems,
  deleteItem,
  deleteGroup,
  itemIdToOpen,
  onItemOpened,
}: InventoryGroupCardProps) {
  // Use initialGroup directly as source of truth
  const group = initialGroup;
  // Temporary local state ONLY for items (optimistic updates)
  const [localItems, setLocalItems] = useState<InventoryItem[] | null>(null);
  // Items to render: use localItems if set (during optimistic updates), otherwise use server data
  const items = localItems ?? group.items;

  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [localItem, setLocalItem] = useState<InventoryItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingField, setEditingField] = useState<"name" | "price" | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [editValue, setEditValue] = useState<string>("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [stock, setStock] = useState<Stock | null>(null);
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [isSavingStock, setIsSavingStock] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [newLogNote, setNewLogNote] = useState<string>("");
  const [isAddingLog, setIsAddingLog] = useState(false);
  const [updatingUnitId, setUpdatingUnitId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [lastFetchedItemId, setLastFetchedItemId] = useState<string | null>(
    null,
  );
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const [showDeleteItemModal, setShowDeleteItemModal] = useState(false);
  const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [createItemError, setCreateItemError] = useState<string | null>(null);

  // Only render DndContext on client to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Clear localItems when initialGroup.items changes (server revalidation wins)
  useEffect(() => {
    setLocalItems(null);
  }, [initialGroup.items.map((i) => i.id).join(",")]);

  // Open item drawer when itemIdToOpen matches an item in this group
  useEffect(() => {
    if (itemIdToOpen) {
      const itemToOpen = items.find((item) => item.id === itemIdToOpen);
      if (itemToOpen) {
        setSelectedItem(itemToOpen);
        onItemOpened(); // Clear the itemIdToOpen in parent
        // The selectedItem effect will handle setting localItem, opening drawer, and fetching data
      }
    }
  }, [itemIdToOpen, items, onItemOpened]);

  // Update selectedItem when temp item in items is replaced with real item
  useEffect(() => {
    if (selectedItem && selectedItem.id.startsWith("temp-")) {
      const realItem = items.find(
        (item) =>
          item.name === selectedItem.name && !item.id.startsWith("temp-"),
      );
      if (realItem) {
        setSelectedItem(realItem);
        setLocalItem(realItem);
        setLastFetchedItemId(null); // Reset to trigger refetch
      }
    }
  }, [items, selectedItem?.id]);

  const handleItemDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistic update - use localItems temporarily
    const newItems = arrayMove(items, oldIndex, newIndex);
    setLocalItems(newItems);

    // Update display_order values
    const itemOrders: Record<string, number> = {};
    newItems.forEach((item: InventoryItem, index: number) => {
      itemOrders[item.id] = index;
    });

    const formData = new FormData();
    formData.append("group_id", group.id);
    formData.append("item_orders", JSON.stringify(itemOrders));

    try {
      await reorderItems(formData);
      // Clear localItems after success - server revalidation will update initialGroup
      setLocalItems(null);
    } catch (error) {
      console.error("Error reordering items:", error);
      // Revert on error - clear localItems to use server data
      setLocalItems(null);
    }
  };

  useEffect(() => {
    if (selectedItem) {
      // If selectedItem has temp ID, check if it was replaced in items
      if (selectedItem.id.startsWith("temp-")) {
        const realItem = items.find(
          (item) =>
            item.name === selectedItem.name && !item.id.startsWith("temp-"),
        );
        if (realItem) {
          setSelectedItem(realItem);
          setLocalItem(realItem);
          setLastFetchedItemId(null); // Reset to trigger refetch
          return; // Exit early, will re-run with real item
        }
      }

      const itemId = selectedItem.id;
      const wasOpen = isDrawerOpen;

      setLocalItem(selectedItem);

      // Only trigger animation if drawer wasn't already open
      if (!wasOpen) {
        setTimeout(() => setIsDrawerOpen(true), 10);
      }

      // Only fetch data if this is a new item (different ID)
      // This prevents refetching when selectedItem is updated optimistically
      if (itemId !== lastFetchedItemId) {
        setLastFetchedItemId(itemId);

        // Fetch units if item is serialized
        if (selectedItem.is_serialized) {
          fetchUnits(selectedItem.id);
          setStock(null);
        } else {
          setUnits([]);
          fetchStock(selectedItem.id);
        }

        // Always fetch maintenance logs
        fetchMaintenanceLogs(selectedItem.id);
      }
    } else {
      setIsDrawerOpen(false);
      setLocalItem(null);
      setEditingField(null);
      setUnits([]);
      setStock(null);
      setStockError(null);
      setMaintenanceLogs([]);
      setNewLogNote("");
      setLastFetchedItemId(null);
    }
  }, [selectedItem?.id, items]); // Also depend on items to detect when temp items are replaced

  const fetchUnits = async (itemId: string) => {
    setIsLoadingUnits(true);
    try {
      const { data: unitsData, error } = await supabase
        .from("inventory_units")
        .select(
          `
          id,
          serial_number,
          barcode,
          status,
          locations:location_id (
            name
          )
        `,
        )
        .eq("item_id", itemId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching units:", error);
        setUnits([]);
        return;
      }

      const formattedUnits: Unit[] =
        unitsData?.map((unit: any) => ({
          id: unit.id,
          serial_number: unit.serial_number,
          barcode: unit.barcode,
          status: unit.status,
          location_name: unit.locations?.name || "Unknown",
        })) || [];

      setUnits(formattedUnits);

      // Only update availability on initial load, not during updates
      // This prevents glitches when revalidation happens
      if (localItem && localItem.is_serialized && !updatingUnitId) {
        const availableCount = formattedUnits.filter(
          (u) => u.status === "available",
        ).length;
        const totalCount = formattedUnits.length;

        // Only update if values actually changed to prevent unnecessary re-renders
        if (
          localItem.available !== availableCount ||
          localItem.total !== totalCount
        ) {
          setLocalItem({
            ...localItem,
            available: availableCount,
            total: totalCount,
          });
          setSelectedItem({
            ...localItem,
            available: availableCount,
            total: totalCount,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching units:", error);
      setUnits([]);
    } finally {
      setIsLoadingUnits(false);
    }
  };

  const fetchStock = async (itemId: string) => {
    // Skip fetching if this is a temporary ID
    if (itemId.startsWith("temp-")) {
      setStock({ total_quantity: 0, out_of_service_quantity: 0 });
      setIsLoadingStock(false);
      setStockError(null);
      return;
    }

    setIsLoadingStock(true);
    setStockError(null);
    try {
      const { data: stockData, error } = await supabase
        .from("inventory_stock")
        .select("total_quantity, out_of_service_quantity")
        .eq("item_id", itemId)
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 is "not found" error, which is OK
        console.error("Error fetching stock:", error);
        setStockError("Failed to load stock data");
        setStock(null);
        return;
      }

      setStock(
        stockData
          ? {
              total_quantity: stockData.total_quantity,
              out_of_service_quantity: stockData.out_of_service_quantity || 0,
            }
          : { total_quantity: 0, out_of_service_quantity: 0 },
      );
    } catch (error) {
      console.error("Error fetching stock:", error);
      setStockError("Failed to load stock data");
      setStock(null);
    } finally {
      setIsLoadingStock(false);
    }
  };

  const handleStockChange = (
    field: "total_quantity" | "out_of_service_quantity",
    value: string,
  ) => {
    if (!stock) return;

    const numValue = value === "" ? 0 : Number(value);
    if (Number.isNaN(numValue) || numValue < 0) return;

    setStock({
      ...stock,
      [field]: numValue,
    });
    setStockError(null);
  };

  const handleStockSave = async () => {
    if (!stock || !localItem) return;

    // Validation
    if (
      stock.total_quantity < 0 ||
      stock.out_of_service_quantity < 0 ||
      stock.out_of_service_quantity > stock.total_quantity
    ) {
      setStockError("Invalid values");
      return;
    }

    setIsSavingStock(true);
    setStockError(null);

    const formData = new FormData();
    formData.append("item_id", localItem.id);
    formData.append("total_quantity", stock.total_quantity.toString());
    formData.append(
      "out_of_service_quantity",
      stock.out_of_service_quantity.toString(),
    );

    try {
      await updateStock(formData);
      // Update local item availability
      const available = stock.total_quantity - stock.out_of_service_quantity;
      setLocalItem({
        ...localItem,
        total: stock.total_quantity,
        available,
      });
      setSelectedItem({
        ...localItem,
        total: stock.total_quantity,
        available,
      });
    } catch (error) {
      setStockError("Failed to save stock");
    } finally {
      setIsSavingStock(false);
    }
  };

  const fetchMaintenanceLogs = async (itemId: string) => {
    // Don't fetch if item is temp
    if (itemId.startsWith("temp-")) {
      setMaintenanceLogs([]);
      setIsLoadingLogs(false);
      return;
    }

    setIsLoadingLogs(true);
    try {
      const { data: logsData, error } = await supabase
        .from("inventory_maintenance_logs")
        .select("id, note, created_at")
        .eq("item_id", itemId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching maintenance logs:", error);
        setMaintenanceLogs([]);
        return;
      }

      setMaintenanceLogs(logsData || []);
    } catch (error) {
      console.error("Error fetching maintenance logs:", error);
      setMaintenanceLogs([]);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleAddMaintenanceLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogNote.trim() || !localItem || isAddingLog) return;

    // Prevent adding logs for temp items
    if (localItem.id.startsWith("temp-")) {
      return;
    }

    setIsAddingLog(true);
    const noteToAdd = newLogNote.trim();

    const formData = new FormData();
    formData.append("item_id", localItem.id);
    formData.append("note", noteToAdd);

    try {
      await addMaintenanceLog(formData);
      setNewLogNote("");
      // Refresh logs
      await fetchMaintenanceLogs(localItem.id);
    } catch (error) {
      console.error("Error adding maintenance log:", error);
    } finally {
      setIsAddingLog(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!localItem) return;

    setIsDeleting(true);
    setDeleteError(null);

    const itemToDelete = localItem;

    // If this is a temporary item (not yet saved to DB), just remove it locally
    if (itemToDelete.id.startsWith("temp-")) {
      setLocalItems(items.filter((item) => item.id !== itemToDelete.id));
      setShowDeleteItemModal(false);
      setSelectedItem(null);
      setIsDeleting(false);
      return;
    }

    // Optimistically remove item from list immediately
    setLocalItems(items.filter((item) => item.id !== itemToDelete.id));

    // Close drawer
    setShowDeleteItemModal(false);
    setSelectedItem(null);

    const formData = new FormData();
    formData.append("item_id", itemToDelete.id);

    try {
      const result = await deleteItem(formData);
      if (result.error) {
        setDeleteError(result.error);
        // Revert optimistic update on error - clear localItems to use server data
        setLocalItems(null);
        setShowDeleteItemModal(true);
      } else {
        // Clear localItems after success - server revalidation will update initialGroup
        setLocalItems(null);
      }
      // Revalidation will refresh the data and confirm the deletion
    } catch (error) {
      setDeleteError("Failed to delete item");
      // Revert optimistic update on error - clear localItems to use server data
      setLocalItems(null);
      setShowDeleteItemModal(true);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteGroup = async () => {
    setIsDeleting(true);
    setDeleteError(null);

    const formData = new FormData();
    formData.append("group_id", group.id);

    try {
      const result = await deleteGroup(formData);
      if (result.error) {
        setDeleteError(result.error);
        setIsDeleting(false);
      } else {
        setShowDeleteGroupModal(false);
        setIsDeleting(false);
        // Force refresh to show items in Uncategorized after revalidation
        // router.refresh() triggers a server component re-render with fresh data
        router.refresh();
      }
    } catch (error) {
      setDeleteError("Failed to delete group");
      setIsDeleting(false);
    }
  };

  const handleUnitStatusChange = async (
    unitId: string,
    currentStatus: string,
  ) => {
    if (updatingUnitId === unitId) return;

    let newStatus: string;
    if (currentStatus === "available") {
      newStatus = "out";
    } else if (currentStatus === "out") {
      newStatus = "available";
    } else {
      return; // maintenance status - no action
    }

    setUpdatingUnitId(unitId);

    // Optimistic update
    const updatedUnits = units.map((unit) =>
      unit.id === unitId
        ? { ...unit, status: newStatus as Unit["status"] }
        : unit,
    );
    setUnits(updatedUnits);

    // Update local item availability based on updated units
    if (localItem) {
      const availableCount = updatedUnits.filter(
        (u) => u.status === "available",
      ).length;
      const totalCount = updatedUnits.length;

      setLocalItem({
        ...localItem,
        available: availableCount,
        total: totalCount,
      });
      setSelectedItem({
        ...localItem,
        available: availableCount,
        total: totalCount,
      });
    }

    const formData = new FormData();
    formData.append("unit_id", unitId);
    formData.append("status", newStatus);

    // Use startTransition to make the update non-blocking and prevent UI glitches
    startTransition(async () => {
      try {
        await updateUnitStatus(formData);
        // Optimistic update is sufficient - revalidation will sync data in background
        // Don't refresh units here to prevent glitch
      } catch (error) {
        console.error("Error updating unit status:", error);
        // Revert optimistic update on error
        setUnits(units);
        if (localItem) {
          const availableCount = units.filter(
            (u) => u.status === "available",
          ).length;
          const totalCount = units.length;
          setLocalItem({
            ...localItem,
            available: availableCount,
            total: totalCount,
          });
          setSelectedItem({
            ...localItem,
            available: availableCount,
            total: totalCount,
          });
        }
      } finally {
        setUpdatingUnitId(null);
      }
    });
  };

  const handleStartEdit = (field: "name" | "price") => {
    if (!localItem) return;
    setEditingField(field);
    setEditValue(
      field === "name" ? localItem.name : localItem.price.toString(),
    );
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  const handleSave = async () => {
    if (!localItem || !editingField) return;

    const field = editingField;

    // Validation
    if (field === "name" && !editValue.trim()) return;
    if (field === "price") {
      const numValue = Number(editValue);
      if (Number.isNaN(numValue) || numValue < 0) {
        handleCancelEdit();
        return;
      }
    }

    setIsSaving(true);

    // Optimistic update
    const updatedItem = {
      ...localItem,
      [field]: field === "name" ? editValue.trim() : Number(editValue),
    };
    setLocalItem(updatedItem);

    // Save to server
    const formData = new FormData();
    formData.append("item_id", localItem.id);
    formData.append("name", updatedItem.name);
    formData.append("price", updatedItem.price.toString());

    try {
      await updateItem(formData);
      setSelectedItem(updatedItem); // Update selectedItem so it persists
      setEditingField(null);
      setEditValue("");
    } catch (error) {
      // Revert on error
      setLocalItem(selectedItem);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !editingField) {
        setSelectedItem(null);
      }
    };

    if (selectedItem) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [selectedItem, editingField]);

  const isUncategorized = group.name === "Uncategorized";

  return (
    <div className="mb-10 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">{group.name}</h2>
        {!isUncategorized && (
          <button
            onClick={() => {
              setDeleteError(null);
              setShowDeleteGroupModal(true);
            }}
            className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
          >
            Delete Group
          </button>
        )}
      </div>

      {/* Error message for item creation */}
      {createItemError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-800">{createItemError}</p>
            <button
              onClick={() => setCreateItemError(null)}
              className="text-red-600 hover:text-red-800"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const name = String(formData.get("name") || "").trim();
          const isSerialized = formData.get("is_serialized") === "on";

          if (!name) return;

          // Clear any previous error
          setCreateItemError(null);

          // Reset form
          e.currentTarget.reset();

          // Call server action FIRST - don't add optimistically
          try {
            const result = await createItem(formData);
            if (!result.ok) {
              // Show error immediately - no temp item to remove
              if (result.error === "DUPLICATE_NAME") {
                setCreateItemError(
                  `An item with the name "${name}" already exists`,
                );
              } else if (result.error === "VALIDATION_ERROR") {
                setCreateItemError("Name and Group ID are required");
              } else {
                setCreateItemError("Failed to create item. Please try again.");
              }

              // Auto-hide error after 5 seconds
              setTimeout(() => {
                setCreateItemError(null);
              }, 5000);
              return;
            }
            // Success - add optimistically AFTER server confirms
            const tempId = `temp-${Date.now()}`;
            const newItem: InventoryItem = {
              id: tempId,
              name,
              group_id: group.id,
              is_serialized: isSerialized,
              price: 0,
              available: 0,
              total: 0,
            };

            setLocalItems([...items, newItem]);
            // Revalidation will replace temp item with real one
          } catch (error) {
            setCreateItemError("Failed to create item. Please try again.");
            setTimeout(() => {
              setCreateItemError(null);
            }, 5000);
          }
        }}
        className="mb-4 p-3 bg-gray-50 rounded-md"
      >
        <div className="flex gap-2 items-center flex-wrap">
          <input type="hidden" name="group_id" value={group.id} />
          <input
            name="name"
            placeholder="New item name"
            required
            className="flex-1 min-w-[200px] px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              name="is_serialized"
              className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
            />{" "}
            Serialized
          </label>
          <button
            type="submit"
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
          >
            Add Item
          </button>
        </div>
      </form>

      {mounted ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleItemDragEnd}
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Item
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">
                    Available / Total
                  </th>
                </tr>
              </thead>
              <SortableContext
                items={items.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <tbody>
                  {items.map((item) => (
                    <SortableItemRow
                      key={item.id}
                      item={item}
                      onItemClick={setSelectedItem}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </div>
        </DndContext>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">
                  Item
                </th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">
                  Available / Total
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="py-3 px-4 text-gray-900 font-medium flex items-center gap-2">
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer */}
      {selectedItem && localItem && (
        <ItemDetailDrawer
          item={selectedItem}
          localItem={localItem}
          groupName={group.name}
          isDrawerOpen={isDrawerOpen}
          editingField={editingField}
          editValue={editValue}
          isSaving={isSaving}
          units={units}
          isLoadingUnits={isLoadingUnits}
          stock={stock}
          isLoadingStock={isLoadingStock}
          isSavingStock={isSavingStock}
          stockError={stockError}
          maintenanceLogs={maintenanceLogs}
          isLoadingLogs={isLoadingLogs}
          newLogNote={newLogNote}
          isAddingLog={isAddingLog}
          isItemTemp={(() => {
            const realItem = items.find(
              (item) =>
                item.name === selectedItem.name && !item.id.startsWith("temp-"),
            );
            return realItem ? false : selectedItem.id.startsWith("temp-");
          })()}
          updatingUnitId={updatingUnitId}
          showDeleteItemModal={showDeleteItemModal}
          deleteError={deleteError}
          isDeleting={isDeleting}
          onStartEdit={handleStartEdit}
          onCancelEdit={handleCancelEdit}
          onSave={handleSave}
          onKeyDown={handleKeyDown}
          onEditValueChange={setEditValue}
          onStockChange={handleStockChange}
          onStockSave={handleStockSave}
          onAddMaintenanceLog={handleAddMaintenanceLog}
          onNewLogNoteChange={setNewLogNote}
          onUnitStatusChange={handleUnitStatusChange}
          onDeleteItemClick={() => {
            setDeleteError(null);
            setShowDeleteItemModal(true);
          }}
          onClose={() => {
            if (!editingField) {
              setSelectedItem(null);
            }
          }}
          onCloseDeleteItemModal={() => {
            setShowDeleteItemModal(false);
            setDeleteError(null);
          }}
          onConfirmDeleteItem={handleDeleteItem}
        />
      )}

      {/* Delete Modals */}
      <DeleteModals
        showDeleteItemModal={showDeleteItemModal}
        showDeleteGroupModal={showDeleteGroupModal}
        itemName={localItem?.name || null}
        deleteError={deleteError}
        isDeleting={isDeleting}
        onCloseItemModal={() => {
          setShowDeleteItemModal(false);
          setDeleteError(null);
        }}
        onCloseGroupModal={() => {
          setShowDeleteGroupModal(false);
          setDeleteError(null);
        }}
        onConfirmDeleteItem={handleDeleteItem}
        onConfirmDeleteGroup={handleDeleteGroup}
      />
    </div>
  );
}
