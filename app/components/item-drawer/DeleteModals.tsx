"use client";

interface DeleteModalsProps {
  showDeleteItemModal: boolean;
  showDeleteGroupModal: boolean;
  itemName: string | null;
  deleteError: string | null;
  isDeleting: boolean;
  onCloseItemModal: () => void;
  onCloseGroupModal: () => void;
  onConfirmDeleteItem: () => void;
  onConfirmDeleteGroup: () => void;
}

export default function DeleteModals({
  showDeleteItemModal,
  showDeleteGroupModal,
  itemName,
  deleteError,
  isDeleting,
  onCloseItemModal,
  onCloseGroupModal,
  onConfirmDeleteItem,
  onConfirmDeleteGroup,
}: DeleteModalsProps) {
  return (
    <>
      {/* Delete Item Confirmation Modal */}
      {showDeleteItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Remove Item
            </h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to remove "{itemName}" from inventory?
              <br />
              <span className="text-sm text-gray-500">
                This action cannot be undone.
              </span>
            </p>
            {deleteError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{deleteError}</p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={onCloseItemModal}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onConfirmDeleteItem}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-md transition-colors disabled:opacity-50"
              >
                {isDeleting ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Confirmation Modal */}
      {showDeleteGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete Group
            </h3>
            <p className="text-gray-600 mb-4">
              This will remove the group. All items will be moved to
              'Uncategorized'.
            </p>
            {deleteError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{deleteError}</p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={onCloseGroupModal}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onConfirmDeleteGroup}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-md transition-colors disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
