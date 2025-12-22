"use client";

import type { InventoryItem } from "@/lib/inventory";
import DrawerHeader from "./DrawerHeader";
import StockEditor from "./StockEditor";
import UnitsTable from "./UnitsTable";
import MaintenanceLogSection from "./MaintenanceLog";

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

interface ItemDetailDrawerProps {
  item: InventoryItem;
  localItem: InventoryItem;
  groupName: string;
  isDrawerOpen: boolean;
  editingField: "name" | "price" | null;
  editValue: string;
  isSaving: boolean;
  units: Unit[];
  isLoadingUnits: boolean;
  stock: Stock | null;
  isLoadingStock: boolean;
  isSavingStock: boolean;
  stockError: string | null;
  maintenanceLogs: MaintenanceLog[];
  isLoadingLogs: boolean;
  newLogNote: string;
  isAddingLog: boolean;
  isItemTemp: boolean;
  updatingUnitId: string | null;
  showDeleteItemModal: boolean;
  deleteError: string | null;
  isDeleting: boolean;
  onStartEdit: (field: "name" | "price") => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onEditValueChange: (value: string) => void;
  onStockChange: (
    field: "total_quantity" | "out_of_service_quantity",
    value: string,
  ) => void;
  onStockSave: () => void;
  onAddMaintenanceLog: (e: React.FormEvent) => void;
  onNewLogNoteChange: (value: string) => void;
  onUnitStatusChange: (unitId: string, currentStatus: string) => void;
  onDeleteItemClick: () => void;
  onClose: () => void;
  onCloseDeleteItemModal: () => void;
  onConfirmDeleteItem: () => void;
}

export default function ItemDetailDrawer({
  item,
  localItem,
  groupName,
  isDrawerOpen,
  editingField,
  editValue,
  isSaving,
  units,
  isLoadingUnits,
  stock,
  isLoadingStock,
  isSavingStock,
  stockError,
  maintenanceLogs,
  isLoadingLogs,
  newLogNote,
  isAddingLog,
  isItemTemp,
  updatingUnitId,
  showDeleteItemModal,
  deleteError,
  isDeleting,
  onStartEdit,
  onCancelEdit,
  onSave,
  onKeyDown,
  onEditValueChange,
  onStockChange,
  onStockSave,
  onAddMaintenanceLog,
  onNewLogNoteChange,
  onUnitStatusChange,
  onDeleteItemClick,
  onClose,
  onCloseDeleteItemModal,
  onConfirmDeleteItem,
}: ItemDetailDrawerProps) {
  if (!item || !localItem) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity animate-fade-in"
        onClick={() => {
          if (!editingField) {
            onClose();
          }
        }}
      />

      {/* Drawer Panel */}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <DrawerHeader
            item={localItem}
            groupName={groupName}
            editingField={editingField}
            editValue={editValue}
            isSaving={isSaving}
            onStartEdit={onStartEdit}
            onSave={onSave}
            onKeyDown={onKeyDown}
            onEditValueChange={onEditValueChange}
            onDeleteClick={onDeleteItemClick}
            onClose={onClose}
          />

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-6">
              {/* Badge */}
              <div>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    localItem.is_serialized
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {localItem.is_serialized ? "Serialized" : "Non-Serialized"}
                </span>
              </div>

              {/* Available / Total */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  Availability
                </h4>
                <p className="text-lg font-mono text-gray-900">
                  {localItem.available} / {localItem.total}
                </p>
              </div>

              {/* Stock Editor (only if non-serialized) */}
              {!localItem.is_serialized && (
                <StockEditor
                  stock={stock}
                  isLoadingStock={isLoadingStock}
                  isSavingStock={isSavingStock}
                  stockError={stockError}
                  onStockChange={onStockChange}
                  onStockSave={onStockSave}
                />
              )}

              {/* Price */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  Price
                </h4>
                {editingField === "price" ? (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editValue}
                    onChange={(e) => onEditValueChange(e.target.value)}
                    onKeyDown={onKeyDown}
                    onBlur={onSave}
                    autoFocus
                    disabled={isSaving}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p
                    onClick={() => onStartEdit("price")}
                    className="text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                  >
                    ${localItem.price.toFixed(2)}
                  </p>
                )}
              </div>

              {/* Location */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  Location
                </h4>
                <p className="text-gray-600">Placeholder</p>
              </div>

              {/* Maintenance Log */}
              <MaintenanceLogSection
                logs={maintenanceLogs}
                isLoadingLogs={isLoadingLogs}
                newLogNote={newLogNote}
                isAddingLog={isAddingLog}
                isItemTemp={isItemTemp}
                onNewLogNoteChange={onNewLogNoteChange}
                onAddLog={onAddMaintenanceLog}
              />

              {/* Units (only if serialized) */}
              {localItem.is_serialized && (
                <UnitsTable
                  units={units}
                  isLoadingUnits={isLoadingUnits}
                  updatingUnitId={updatingUnitId}
                  onUnitStatusChange={onUnitStatusChange}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
