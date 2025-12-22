"use client";

interface Unit {
  id: string;
  serial_number: string;
  barcode: string;
  status: "available" | "out" | "maintenance";
  location_name: string;
}

interface UnitsTableProps {
  units: Unit[];
  isLoadingUnits: boolean;
  updatingUnitId: string | null;
  onUnitStatusChange: (unitId: string, currentStatus: string) => void;
}

export default function UnitsTable({
  units,
  isLoadingUnits,
  updatingUnitId,
  onUnitStatusChange,
}: UnitsTableProps) {
  if (isLoadingUnits) {
    return (
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Units</h4>
        <div className="text-sm text-gray-500 py-4">Loading units...</div>
      </div>
    );
  }

  if (units.length === 0) {
    return (
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Units</h4>
        <div className="text-sm text-gray-500 py-4">No units found</div>
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Units</h4>
      <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-md">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-gray-300">
              <th className="text-left py-2 px-3 font-semibold text-gray-700">
                Serial Number
              </th>
              <th className="text-left py-2 px-3 font-semibold text-gray-700">
                Barcode
              </th>
              <th className="text-left py-2 px-3 font-semibold text-gray-700">
                Status
              </th>
              <th className="text-left py-2 px-3 font-semibold text-gray-700">
                Location
              </th>
              <th className="text-left py-2 px-3 font-semibold text-gray-700">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => (
              <tr
                key={unit.id}
                className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <td
                  className="py-2 px-3 text-gray-900 truncate max-w-[120px]"
                  title={unit.serial_number}
                >
                  {unit.serial_number}
                </td>
                <td
                  className="py-2 px-3 text-gray-900 font-mono truncate max-w-[120px]"
                  title={unit.barcode}
                >
                  {unit.barcode}
                </td>
                <td className="py-2 px-3">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      unit.status === "available"
                        ? "bg-green-100 text-green-800"
                        : unit.status === "out"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {unit.status}
                  </span>
                </td>
                <td
                  className="py-2 px-3 text-gray-700 truncate max-w-[120px]"
                  title={unit.location_name}
                >
                  {unit.location_name}
                </td>
                <td className="py-2 px-3">
                  {unit.status === "available" && (
                    <button
                      onClick={() => onUnitStatusChange(unit.id, unit.status)}
                      disabled={updatingUnitId === unit.id}
                      className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {updatingUnitId === unit.id ? "Updating..." : "Check Out"}
                    </button>
                  )}
                  {unit.status === "out" && (
                    <button
                      onClick={() => onUnitStatusChange(unit.id, unit.status)}
                      disabled={updatingUnitId === unit.id}
                      className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {updatingUnitId === unit.id ? "Updating..." : "Check In"}
                    </button>
                  )}
                  {unit.status === "maintenance" && (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
