"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Event } from "@/app/actions/events";
import { getEventsForCalendar } from "@/app/actions/events";

interface CalendarEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  status: string;
  location: string | null;
}

interface EventsCalendarViewProps {
  initialEvents: Event[];
}

export default function EventsCalendarView({
  initialEvents,
}: EventsCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Get first and last day of current month
  const getMonthBounds = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return { firstDay, lastDay };
  };

  // Load calendar events
  useEffect(() => {
    const loadEvents = async () => {
      setIsLoading(true);
      const { firstDay, lastDay } = getMonthBounds();
      // Expand date range slightly to catch events that span month boundaries
      const startDate = new Date(firstDay);
      startDate.setDate(startDate.getDate() - 7); // 7 days before month start
      const endDate = new Date(lastDay);
      endDate.setDate(endDate.getDate() + 7); // 7 days after month end
      
      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];

      try {
        const events = await getEventsForCalendar(startDateStr, endDateStr);
        setCalendarEvents(events);
      } catch (error) {
        console.error("Error loading calendar events:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadEvents();
  }, [currentDate]);

  // Filter events
  const filteredEvents = calendarEvents.filter((event) => {
    if (statusFilter !== "all") {
      // Case-insensitive status comparison
      if (event.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
    }
    if (searchQuery && !event.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.

    const days: (Date | null)[] = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days in the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  // Get all events that should be displayed (for spanning blocks)
  const getAllDisplayEvents = (): Array<CalendarEvent & { startDay: number; endDay: number; span: number }> => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();


    return filteredEvents
      .map((event) => {
        // Parse dates as YYYY-MM-DD strings
        const eventStartStr = event.startDate.split("T")[0];
        const eventEndStr = event.endDate.split("T")[0];
        const eventStart = new Date(eventStartStr + "T00:00:00");
        const eventEnd = new Date(eventEndStr + "T23:59:59");
        const monthStart = new Date(year, month, 1);
        monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(year, month, daysInMonth);
        monthEnd.setHours(23, 59, 59, 999);

        // Check if event overlaps with current month
        // Event overlaps if: eventEnd >= monthStart AND eventStart <= monthEnd
        if (eventEnd < monthStart || eventStart > monthEnd) {
          return null;
        }

        // Calculate which days in the month the event spans
        let startDay: number;
        let endDay: number;

        if (eventStart <= monthStart) {
          // Event starts before month
          startDay = 1;
        } else {
          // Event starts within month
          startDay = eventStart.getDate();
        }

        if (eventEnd >= monthEnd) {
          // Event ends after month
          endDay = daysInMonth;
        } else {
          // Event ends within month
          endDay = eventEnd.getDate();
        }

        // Ensure startDay and endDay are valid
        if (startDay < 1) startDay = 1;
        if (endDay > daysInMonth) endDay = daysInMonth;
        if (startDay > endDay) {
          return null;
        }

        const span = endDay - startDay + 1;

        return {
          ...event,
          startDay,
          endDay,
          span,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);
  };

  // Get events for a specific date
  const getEventsForDate = (date: Date | null): CalendarEvent[] => {
    if (!date) return [];

    const dateStr = date.toISOString().split("T")[0];
    const matchingEvents = filteredEvents.filter((event) => {
      // Parse dates as YYYY-MM-DD strings (simpler and more reliable)
      const eventStart = event.startDate.split("T")[0];
      const eventEnd = event.endDate.split("T")[0];
      
      // Check if date is within event range (inclusive)
      const isInRange = dateStr >= eventStart && dateStr <= eventEnd;
      
      return isInRange;
    });
    return matchingEvents;
  };

  // Check if event starts on this date
  const doesEventStartOnDate = (event: CalendarEvent, date: Date): boolean => {
    const eventStartStr = event.startDate.split("T")[0];
    const currentStr = date.toISOString().split("T")[0];
    
    return eventStartStr === currentStr;
  };

  // Calculate how many days an event should span from a given date
  const getEventSpanFromDate = (event: CalendarEvent, date: Date): number => {
    const eventStart = new Date(event.startDate);
    eventStart.setHours(0, 0, 0, 0);
    const eventEnd = new Date(event.endDate);
    eventEnd.setHours(23, 59, 59, 999);
    const current = new Date(date);
    current.setHours(0, 0, 0, 0);

    if (current < eventStart) return 0;

    const daysUntilEnd = Math.ceil(
      (eventEnd.getTime() - current.getTime()) / (1000 * 60 * 60 * 24),
    ) + 1;
    const remainingDaysInWeek = 7 - date.getDay();

    return Math.min(daysUntilEnd, remainingDaysInWeek);
  };

  // Get event color (unique color per event, not status-based)
  const getEventColor = (eventId: string) => {
    // Use a hash of eventId to get consistent colors
    const colors = [
      "bg-blue-500 text-white border-blue-600",
      "bg-green-500 text-white border-green-600",
      "bg-purple-500 text-white border-purple-600",
      "bg-pink-500 text-white border-pink-600",
      "bg-indigo-500 text-white border-indigo-600",
      "bg-teal-500 text-white border-teal-600",
      "bg-orange-500 text-white border-orange-600",
      "bg-cyan-500 text-white border-cyan-600",
      "bg-amber-500 text-white border-amber-600",
      "bg-rose-500 text-white border-rose-600",
    ];
    
    // Simple hash function for consistent color assignment
    let hash = 0;
    for (let i = 0; i < eventId.length; i++) {
      hash = eventId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % colors.length;
    return colors[colorIndex];
  };

  // Format status for display
  const formatStatus = (status: string) => {
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const days = generateCalendarDays();
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ color: '#111827' }}
            >
                  <option value="all">All</option>
                  <option value="prepping">Prepping</option>
                  <option value="planned">Planned</option>
                  <option value="in_transit">In Transit</option>
                  <option value="on_venue">On Venue</option>
                  <option value="closed">Closed</option>
            </select>
          </div>

          {/* Search */}
          <div className="flex-1 flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Search:</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Event name"
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Calendar Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">{monthName}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousMonth}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              ← Prev
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Today
            </button>
            <button
              onClick={goToNextMonth}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading calendar...</div>
        ) : (
          <>
            {/* Week day headers */}
            <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="py-2 px-2 text-center text-xs font-semibold text-gray-700"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days with event blocks */}
            <div className="relative">
              {/* Calendar grid */}
              <div className="grid grid-cols-7">
                {days.map((date, index) => {
                  const isToday =
                    date &&
                    date.toDateString() === new Date().toDateString();

                  return (
                    <div
                      key={index}
                      className={`min-h-[100px] border-r border-b border-gray-200 p-1 relative ${
                        !date ? "bg-gray-50" : "bg-white"
                      } ${isToday ? "bg-blue-50" : ""}`}
                    >
                      {date && (
                        <div
                          className={`text-xs font-medium mb-1 ${
                            isToday
                              ? "text-blue-600 font-semibold"
                              : "text-gray-700"
                          }`}
                        >
                          {date.getDate()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Event blocks spanning across days */}
              {(() => {
                const year = currentDate.getFullYear();
                const month = currentDate.getMonth();
                const firstDay = new Date(year, month, 1);
                const startingDayOfWeek = firstDay.getDay();
                const cellHeight = 100; // min-h-[100px] = 100px
                const eventBarHeight = 24; // Height of each event bar
                const eventBarSpacing = 2; // Spacing between stacked events

                const allEvents = getAllDisplayEvents();
                
                // Calculate positions for all events and detect overlaps
                const eventPositions = allEvents.map((event) => {
                  const startDate = new Date(year, month, event.startDay);
                  const endDate = new Date(year, month, event.endDay);
                  const startDayOfWeek = startDate.getDay();
                  const endDayOfWeek = endDate.getDay();
                  
                  const startRow = Math.floor((startingDayOfWeek + event.startDay - 1) / 7);
                  const endRow = Math.floor((startingDayOfWeek + event.endDay - 1) / 7);
                  const startCol = startDayOfWeek;
                  const endCol = endDayOfWeek;

                  return {
                    event,
                    startRow,
                    endRow,
                    startCol,
                    endCol,
                    startDay: event.startDay,
                    endDay: event.endDay,
                  };
                });

                // Calculate vertical offsets for overlapping events
                // Strategy: For each event, find all events that overlap with it, then assign stack levels
                const eventOffsets = new Map<string, number>(); // key: eventId-row, value: offset
                const eventStackLevels = new Map<string, number>(); // key: eventId, value: stack level (0, 1, 2, ...)
                
                // First, assign a consistent stack level to each event based on overlaps
                eventPositions.forEach((pos) => {
                  const eventId = pos.event.id;
                  
                  // Skip if already assigned
                  if (eventStackLevels.has(eventId)) return;
                  
                  // Find all events that overlap with this one
                  const overlappingEvents = eventPositions.filter((other) => {
                    if (other.event.id === eventId) return false;
                    // Check if date ranges overlap
                    return !(pos.endDay < other.startDay || pos.startDay > other.endDay);
                  });
                  
                  if (overlappingEvents.length === 0) {
                    // No overlaps, stack level 0
                    eventStackLevels.set(eventId, 0);
                    return;
                  }
                  
                  // Find the minimum stack level that doesn't conflict with overlapping events
                  const usedLevels = new Set<number>();
                  overlappingEvents.forEach((other) => {
                    const otherLevel = eventStackLevels.get(other.event.id);
                    if (otherLevel !== undefined) {
                      usedLevels.add(otherLevel);
                    }
                  });
                  
                  // Find first available level
                  let stackLevel = 0;
                  while (usedLevels.has(stackLevel)) {
                    stackLevel++;
                  }
                  
                  eventStackLevels.set(eventId, stackLevel);
                });
                
                // Now assign offsets to each row based on stack level
                eventPositions.forEach((pos) => {
                  const stackLevel = eventStackLevels.get(pos.event.id) || 0;
                  const offset = stackLevel * (eventBarHeight + eventBarSpacing);
                  
                  // Apply same offset to all rows this event spans
                  for (let row = pos.startRow; row <= pos.endRow; row++) {
                    const key = `${pos.event.id}-${row}`;
                    eventOffsets.set(key, offset);
                  }
                });

                // Render all event segments
                return eventPositions.flatMap((pos) => {
                  const { event, startRow, endRow, startCol, endCol } = pos;
                  const eventColor = getEventColor(event.id);
                  const stackLevel = eventStackLevels.get(event.id) || 0;
                  
                  const segments: Array<{
                    leftPercent: number;
                    widthPercent: number;
                    topOffset: number;
                    height: number;
                    row: number;
                    verticalOffset: number;
                  }> = [];

                  if (endRow > startRow) {
                    // Event spans multiple rows
                    // First segment
                    const firstOffset = eventOffsets.get(`${event.id}-${startRow}`) || 0;
                    segments.push({
                      leftPercent: (startCol / 7) * 100,
                      widthPercent: ((7 - startCol) / 7) * 100,
                      topOffset: startRow * cellHeight + 24,
                      height: eventBarHeight,
                      row: startRow,
                      verticalOffset: firstOffset,
                    });
                    
                    // Middle segments
                    for (let row = startRow + 1; row < endRow; row++) {
                      const offset = eventOffsets.get(`${event.id}-${row}`) || 0;
                      segments.push({
                        leftPercent: 0,
                        widthPercent: 100,
                        topOffset: row * cellHeight + 24,
                        height: eventBarHeight,
                        row: row,
                        verticalOffset: offset,
                      });
                    }
                    
                    // Last segment
                    const lastOffset = eventOffsets.get(`${event.id}-${endRow}`) || 0;
                    segments.push({
                      leftPercent: 0,
                      widthPercent: ((endCol + 1) / 7) * 100,
                      topOffset: endRow * cellHeight + 24,
                      height: eventBarHeight,
                      row: endRow,
                      verticalOffset: lastOffset,
                    });
                  } else {
                    // Event is in same row
                    let numCols: number;
                    if (endCol >= startCol) {
                      numCols = endCol - startCol + 1;
                    } else {
                      numCols = (7 - startCol) + (endCol + 1);
                    }
                    
                    const offset = eventOffsets.get(`${event.id}-${startRow}`) || 0;
                    const leftPercent = (startCol / 7) * 100;
                    const widthPercent = (numCols / 7) * 100;
                    const topOffset = startRow * cellHeight + 24;
                    
                    segments.push({
                      leftPercent,
                      widthPercent,
                      topOffset,
                      height: eventBarHeight,
                      row: startRow,
                      verticalOffset: offset,
                    });
                  }

                  const renderedSegments = segments.map((segment, segmentIndex) => {
                    const finalTop = segment.topOffset + segment.verticalOffset;
                    const finalLeft = segment.leftPercent;
                    const finalWidth = segment.widthPercent;
                    
                    return (
                      <Link
                        key={`${event.id}-${segment.row}-${segmentIndex}`}
                        href={`/events/${event.id}`}
                        className={`absolute rounded text-xs border shadow-sm hover:opacity-90 transition-opacity cursor-pointer ${eventColor}`}
                        style={{
                          left: `${finalLeft}%`,
                          width: `calc(${finalWidth}% - 4px)`,
                          top: `${finalTop}px`,
                          height: `${segment.height}px`,
                          margin: "2px",
                          padding: "4px 6px",
                          zIndex: 10 + segment.verticalOffset, // Higher z-index for stacked events
                        }}
                        title={`${event.title}\n${new Date(event.startDate).toLocaleDateString()} - ${new Date(event.endDate).toLocaleDateString()}\n${event.location || "No location"}\n\nClick to view event →`}
                      >
                        {segmentIndex === 0 && (
                          <div className="font-medium truncate text-white text-[10px] leading-tight">
                            {event.title}:{formatStatus(event.status).toLowerCase()}
                          </div>
                        )}
                      </Link>
                    );
                  });
                  
                  return renderedSegments;
                });
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

