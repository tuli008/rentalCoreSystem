"use client";

import { useState, useEffect, useRef } from "react";
import {
  searchInventory,
  type SearchResult,
  getItemDateRangeAvailability,
} from "@/app/actions/search";

interface InventorySidebarProps {
  onItemSelect: (itemId: string, groupId: string) => void;
  groups: Array<{ id: string; name: string }>;
}

export default function InventorySidebar({
  onItemSelect,
  groups,
}: InventorySidebarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [showAvailability, setShowAvailability] = useState(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [itemAvailabilities, setItemAvailabilities] = useState<
    Map<string, { effectiveAvailable?: number; total: number }>
  >(new Map());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce search
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (query.trim().length === 0) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const searchResults = await searchInventory(query);
        // Filter by selected group if any
        let filteredResults = searchResults;
        if (selectedGroup) {
          filteredResults = searchResults.filter(
            (r) => r.group_id === selectedGroup,
          );
        }
        setResults(filteredResults);
      } catch (error) {
        console.error("Error searching inventory:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 400);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, selectedGroup]);

  const handleResultClick = (result: SearchResult) => {
    onItemSelect(result.id, result.group_id);
    setQuery("");
    setResults([]);
  };

  // Calculate date-range based availability when dates are provided
  useEffect(() => {
    if (!showAvailability || !startDate || !endDate || results.length === 0) {
      setItemAvailabilities(new Map());
      return;
    }

    const calculateAvailabilities = async () => {
      const availabilities = new Map<
        string,
        { effectiveAvailable?: number; total: number }
      >();

      await Promise.all(
        results.map(async (result) => {
          try {
            const availability = await getItemDateRangeAvailability(
              result.id,
              startDate,
              endDate,
            );
            availabilities.set(result.id, availability);
          } catch (error) {
            console.error(
              `Error calculating availability for ${result.id}:`,
              error,
            );
            availabilities.set(result.id, {
              total: result.total,
            });
          }
        }),
      );

      setItemAvailabilities(availabilities);
    };

    calculateAvailabilities();
  }, [showAvailability, startDate, endDate, results]);


  return (
    <div className="w-80 lg:w-96 bg-white border-l border-gray-200 flex flex-col h-screen flex-shrink-0 overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Panel Title */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Filters
          </h2>
        </div>

        {/* Search Bar - Live Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Search
          </label>
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Type to search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-3 py-2 pl-9 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <svg
              className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {isLoading && (
              <div className="absolute right-2.5 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>
        </div>

        {/* Filters - Compact UI */}
        <div className="space-y-3 pt-2 border-t border-gray-200">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Group
            </label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">All groups</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Show Date-Based Availability */}
          <div className="pt-1 space-y-2">
            <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showAvailability}
                onChange={(e) => setShowAvailability(e.target.checked)}
                className="w-4 h-4 mt-0.5 text-blue-600 rounded focus:ring-blue-500 flex-shrink-0"
              />
              <div className="flex-1">
                <span className="block font-medium">Show Date-Based Availability</span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  Uses selected rental dates
                </span>
              </div>
            </label>
            {showAvailability && (
              <div className="ml-6 space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || undefined}
                    className="w-full px-2 py-1.5 text-sm bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search Results */}
        {results.length > 0 && (
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-2">
              Results ({results.length})
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {results.map((result) => (
                <div
                  key={result.id}
                  onClick={() => handleResultClick(result)}
                  className="p-3 bg-gray-50 rounded-md hover:bg-gray-100 cursor-pointer transition-colors border border-gray-200"
                >
                  <div className="font-medium text-sm text-gray-900">
                    {result.name}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {result.group_name}
                  </div>
                  {showAvailability && (
                    <div className="text-xs text-gray-500 mt-1 font-mono">
                      {(() => {
                        const availability = itemAvailabilities.get(result.id);
                        if (availability?.effectiveAvailable !== undefined) {
                          return (
                            <span>
                              {availability.effectiveAvailable} / {availability.total}
                              <span className="text-blue-600 ml-1">(date-aware)</span>
                            </span>
                          );
                        }
                        return (
                          <span>
                            {result.available} / {result.total}
                          </span>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

