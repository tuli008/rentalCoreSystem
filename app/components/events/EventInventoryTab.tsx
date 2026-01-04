"use client";

import type { Event, EventInventory } from "@/app/actions/events";

interface EventInventoryTabProps {
  event: Event;
  inventory: EventInventory[];
}

export default function EventInventoryTab({
  event,
  inventory,
}: EventInventoryTabProps) {
  const totalValue = inventory.reduce(
    (sum, item) => sum + item.quantity * item.unit_price_snapshot,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Inventory Items
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {event.quote_id
              ? "Inventory is read-only and copied from the approved quote."
              : "Items assigned to this event."}
          </p>
        </div>

        {inventory.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No inventory items
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {event.quote_id
                ? "This event was created from a quote with no items."
                : "No items have been added to this event yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                    Item
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">
                    Quantity
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">
                    Unit Price
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">
                    Total
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 px-4 text-sm text-gray-900">
                      {item.item_name || "Unknown Item"}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 text-right">
                      {item.quantity}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 text-right">
                      ${item.unit_price_snapshot.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900 text-right">
                      ${(item.quantity * item.unit_price_snapshot).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {item.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300">
                  <td
                    colSpan={3}
                    className="py-3 px-4 text-sm font-semibold text-gray-900 text-right"
                  >
                    Total:
                  </td>
                  <td className="py-3 px-4 text-sm font-bold text-gray-900 text-right">
                    ${totalValue.toFixed(2)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

