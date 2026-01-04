import { getEvents } from "@/app/actions/events";
import EventsListPage from "@/app/components/events/EventsListPage";

export default async function EventsPage() {
  const events = await getEvents();

  return <EventsListPage initialEvents={events} />;
}
