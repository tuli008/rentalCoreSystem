"use client";

interface MaintenanceLog {
  id: string;
  note: string;
  created_at: string;
}

interface MaintenanceLogProps {
  logs: MaintenanceLog[];
  isLoadingLogs: boolean;
  newLogNote: string;
  isAddingLog: boolean;
  isItemTemp: boolean;
  onNewLogNoteChange: (value: string) => void;
  onAddLog: (e: React.FormEvent) => void;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MaintenanceLogSection({
  logs,
  isLoadingLogs,
  newLogNote,
  isAddingLog,
  isItemTemp,
  onNewLogNoteChange,
  onAddLog,
}: MaintenanceLogProps) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-3">
        Maintenance Log
      </h4>
      {isLoadingLogs ? (
        <div className="text-sm text-gray-500 py-2">Loading logs...</div>
      ) : (
        <>
          {logs.length === 0 ? (
            <div className="text-sm text-gray-500 py-2 mb-3">
              No maintenance logs
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md mb-3">
              <div className="divide-y divide-gray-200">
                {logs.map((log) => (
                  <div key={log.id} className="px-3 py-2 hover:bg-gray-50">
                    <div className="text-xs text-gray-500 mb-1">
                      {formatTimestamp(log.created_at)}
                    </div>
                    <div className="text-sm text-gray-900">{log.note}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <form onSubmit={onAddLog}>
            <div className="flex gap-2">
              <input
                type="text"
                value={newLogNote}
                onChange={(e) => onNewLogNoteChange(e.target.value)}
                placeholder={
                  isItemTemp
                    ? "Save item first to add logs..."
                    : "Add maintenance note..."
                }
                disabled={isAddingLog || isItemTemp}
                className="flex-1 px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={!newLogNote.trim() || isAddingLog || isItemTemp}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAddingLog ? "Adding..." : "Add"}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
