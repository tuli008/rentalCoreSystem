"use client";

import { useState } from "react";
import type { InventoryGroup } from "@/lib/inventory";
import SortableGroupsList from "./SortableGroupsList";
import InventorySidebar from "./InventorySidebar";

export type SortOrder = "a-z" | "availability";

interface InventoryPageContentProps {
  groups: InventoryGroup[];
  createGroup: (formData: FormData) => Promise<void>;
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
  reorderGroups: (formData: FormData) => Promise<void>;
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
  isAdmin?: boolean;
}

export default function InventoryPageContent({
  groups,
  createGroup,
  createItem,
  updateItem,
  updateStock,
  addMaintenanceLog,
  updateUnitStatus,
  reorderGroups,
  reorderItems,
  deleteItem,
  deleteGroup,
  updateGroup,
  isAdmin = false,
}: InventoryPageContentProps) {
  const [itemIdToOpen, setItemIdToOpen] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("a-z");
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [pageSize, setPageSize] = useState<number>(2);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  // Calculate total items across all groups
  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);

  const handleItemSelect = (itemId: string, groupId: string) => {
    setItemIdToOpen(itemId);
  };

  const handleItemOpened = () => {
    setItemIdToOpen(null);
  };

  // Extract groups for sidebar
  const groupsForSidebar = groups.map((group) => ({
    id: group.id,
    name: group.name,
  }));

  return (
    <div className="min-h-screen bg-gray-50 w-full overflow-x-hidden">
      {/* Main Content Area - with right margin on desktop for sidebar */}
      <div className="w-full lg:mr-96">
        <div className="w-full max-w-7xl mx-auto p-4 sm:p-8">
          {/* Header with Toolbar */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Inventory Items
              </h1>
            </div>
            
            {/* Toolbar */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
              {/* Mobile: Filters button */}
              <div className="flex items-center justify-end lg:hidden">
                <button
                  type="button"
                  onClick={() => setIsMobileFiltersOpen(true)}
                  className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                >
                  Filters
                </button>
              </div>
              {/* Add Group Form */}
              <form action={createGroup}>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
                  <input
                    name="name"
                    placeholder="New group name"
                    required
                    className="flex-1 w-full px-4 py-2.5 sm:py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium">
                    Add Group
                  </button>
                </div>
              </form>

              {/* Summary - Will be updated per group, showing total for now */}
              <div className="pt-3 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Total: <span className="font-medium text-gray-900">{totalItems}</span> items
                </p>
              </div>

              {/* Controls: Sort, Page Size & Collapse/Expand */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-gray-200">
                {/* Left side: Sort & Collapse/Expand */}
                <div className="flex items-center gap-3">
                  {/* Sort Toggle */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                      Sort:
                    </label>
                    <div className="flex rounded-md border border-gray-300 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setSortOrder("a-z")}
                        className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                          sortOrder === "a-z"
                            ? "bg-blue-600 text-white"
                            : "bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        A–Z
                      </button>
                      <button
                        type="button"
                        onClick={() => setSortOrder("availability")}
                        className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-300 ${
                          sortOrder === "availability"
                            ? "bg-blue-600 text-white"
                            : "bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        Availability
                      </button>
                    </div>
                  </div>

                  {/* Collapse/Expand All */}
                  <button
                    type="button"
                    onClick={() => setAllCollapsed(!allCollapsed)}
                    className="px-4 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors whitespace-nowrap"
                  >
                    {allCollapsed ? "Expand All" : "Collapse All"}
                  </button>
                </div>

                {/* Right side: Page Size */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                    Page size:
                  </label>
                  <div className="flex rounded-md border border-gray-300 overflow-hidden">
                    {[20, 50, 100].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setPageSize(size)}
                        className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                          size === 20 ? "" : "border-l border-gray-300"
                        } ${
                          pageSize === size
                            ? "bg-blue-600 text-white"
                            : "bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Groups List */}
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
            updateGroup={updateGroup}
            itemIdToOpen={itemIdToOpen}
            onItemOpened={handleItemOpened}
            sortOrder={sortOrder}
            allCollapsed={allCollapsed}
            pageSize={pageSize}
          />
        </div>
      </div>

      {/* Right Sidebar (Desktop) */}
      <div className="fixed right-0 top-12 bottom-0 w-96 z-40 hidden lg:block border-l border-gray-200 bg-white overflow-y-auto">
        <InventorySidebar
          onItemSelect={handleItemSelect}
          groups={groupsForSidebar}
          variant="desktop"
        />
      </div>

      {/* Filters Drawer (Mobile) */}
      {isMobileFiltersOpen && (
        <div 
          className="fixed inset-0 z-[9999] lg:hidden"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsMobileFiltersOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer Panel */}
          <div 
            className="absolute left-0 right-0 bottom-0 bg-white rounded-t-2xl shadow-2xl max-h-[85vh] overflow-hidden"
            style={{ maxHeight: '85vh' }}
          >
            {/* Drag handle */}
            <div className="flex justify-center py-3 border-b border-gray-100">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            {/* Scrollable content */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 48px)' }}>
              <InventorySidebar
                onItemSelect={(itemId, groupId) => {
                  handleItemSelect(itemId, groupId);
                  setIsMobileFiltersOpen(false);
                }}
                groups={groupsForSidebar}
                variant="mobile"
                onClose={() => setIsMobileFiltersOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
