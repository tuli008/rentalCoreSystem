"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Quote } from "@/lib/quotes";
import { createQuote } from "@/app/actions/quotes";

interface QuotesListPageProps {
  initialQuotes: Quote[];
  createQuote: (
    formData: FormData,
  ) => Promise<{ error?: string; success?: boolean }>;
}

export default function QuotesListPage({
  initialQuotes,
  createQuote,
}: QuotesListPageProps) {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>(initialQuotes);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Sync quotes state when initialQuotes prop changes (after router.refresh())
  useEffect(() => {
    setQuotes(initialQuotes);
  }, [initialQuotes.map((q) => q.id).join(",")]);

  const handleCreateQuote = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreating(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const result = await createQuote(formData);

    if (result.success) {
      // Reset form before unmounting
      if (form) {
        form.reset();
      }
      setShowCreateForm(false);
      router.refresh();
    } else if (result.error) {
      alert(result.error);
    }

    setIsCreating(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Quotes
            </h1>
            <p className="text-sm sm:text-base text-gray-600">
              Manage your rental quotes
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            <svg
              className="mr-2 h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Quote
          </button>
        </div>

        {/* Create Quote Form */}
        {showCreateForm && (
          <form
            onSubmit={handleCreateQuote}
            className="mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200"
          >
            <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
              <div className="flex-1 w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quote Name
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g., Summer Event 2024"
                  className="w-full px-3 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="w-full sm:w-auto">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  name="start_date"
                  required
                  className="w-full sm:w-auto px-3 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="w-full sm:w-auto">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  name="end_date"
                  required
                  className="w-full sm:w-auto px-3 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                >
                  {isCreating ? "Creating..." : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="w-full sm:w-auto px-4 py-2.5 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Quotes List */}
        {quotes.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                No quotes yet
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Get started by creating your first quote.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="divide-y divide-gray-200">
              {quotes.map((quote) => {
                const startDate = new Date(quote.start_date);
                const endDate = new Date(quote.end_date);
                const days = Math.ceil(
                  (endDate.getTime() - startDate.getTime()) /
                    (1000 * 60 * 60 * 24),
                );

                return (
                  <Link
                    key={quote.id}
                    href={`/quotes/${quote.id}`}
                    className="block p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                          {quote.name}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600 mt-1">
                          {startDate.toLocaleDateString()} -{" "}
                          {endDate.toLocaleDateString()} ({days} days)
                        </p>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap ${
                            quote.status === "draft"
                              ? "bg-gray-100 text-gray-800"
                              : quote.status === "sent"
                                ? "bg-blue-100 text-blue-800"
                                : quote.status === "accepted"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                          }`}
                        >
                          {quote.status.charAt(0).toUpperCase() +
                            quote.status.slice(1)}
                        </span>
                        <svg
                          className="w-5 h-5 text-gray-400 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}