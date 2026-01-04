import { getEventWithDetails, updateEvent, deleteEvent } from "@/app/actions/events";
import EventDetailPage from "@/app/components/events/EventDetailPage";
import { notFound } from "next/navigation";

export default async function EventDetailPageRoute({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const eventId = resolvedParams.id;

    if (!eventId) {
      notFound();
    }

    const { event, inventory, crew, tasks } = await getEventWithDetails(eventId);

    if (!event) {
      notFound();
    }

    return (
      <EventDetailPage
        event={event}
        inventory={inventory}
        crew={crew}
        tasks={tasks}
        updateEvent={updateEvent}
        deleteEvent={deleteEvent}
      />
    );
  } catch (error) {
    console.error("[EventDetailPageRoute] Error:", error);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Event</h1>
          <p className="text-gray-600 mb-4">
            {error instanceof Error ? error.message : "An unexpected error occurred"}
          </p>
          <a
            href="/events"
            className="text-blue-600 hover:text-blue-700 underline"
          >
            ← Back to Events
          </a>
        </div>
      </div>
    );
  }
}
