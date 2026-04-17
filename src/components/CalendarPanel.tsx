import { useCalendar, type CalendarEvent } from '../hooks/useCalendar';
import { useProjects } from '../hooks/useProjects';

interface FreeGap {
  start: Date;
  end: Date;
  minutes: number;
}

/**
 * Parse ISO date string to Date object
 */
function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

/**
 * Format time as "9:00 AM"
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Get date string for grouping events by day
 */
function getDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format date as "Today", "Tomorrow", or "Mon, Jan 1"
 */
function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateKey = getDateKey(date);
  const todayKey = getDateKey(today);
  const tomorrowKey = getDateKey(tomorrow);

  if (dateKey === todayKey) return 'Today';
  if (dateKey === tomorrowKey) return 'Tomorrow';

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Group events by date
 */
function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const groups = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const start = parseDate(event.start);
    const dateKey = getDateKey(start);

    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }

    groups.get(dateKey)!.push(event);
  }

  return groups;
}

/**
 * Find free gaps in today's schedule (>45min gaps between 9am-6pm)
 */
function findFreeGaps(todayEvents: CalendarEvent[]): FreeGap[] {
  const gaps: FreeGap[] = [];

  // Filter to only timed events (not all-day)
  const timedEvents = todayEvents
    .filter(e => !e.allDay)
    .map(e => ({
      start: parseDate(e.start),
      end: parseDate(e.end),
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  if (timedEvents.length === 0) {
    // No events today - the whole workday is free
    const today = new Date();
    const start = new Date(today);
    start.setHours(9, 0, 0, 0);
    const end = new Date(today);
    end.setHours(18, 0, 0, 0);

    const minutes = (end.getTime() - start.getTime()) / (1000 * 60);
    if (minutes > 45) {
      gaps.push({ start, end, minutes });
    }
    return gaps;
  }

  // Define workday bounds
  const today = new Date();
  const workdayStart = new Date(today);
  workdayStart.setHours(9, 0, 0, 0);
  const workdayEnd = new Date(today);
  workdayEnd.setHours(18, 0, 0, 0);

  // Check gap before first event
  if (timedEvents[0].start > workdayStart) {
    const gapEnd = timedEvents[0].start;
    const minutes = (gapEnd.getTime() - workdayStart.getTime()) / (1000 * 60);
    if (minutes > 45) {
      gaps.push({ start: workdayStart, end: gapEnd, minutes });
    }
  }

  // Check gaps between events
  for (let i = 0; i < timedEvents.length - 1; i++) {
    const current = timedEvents[i];
    const next = timedEvents[i + 1];

    const gapStart = current.end;
    const gapEnd = next.start;

    // Only count gaps within workday hours
    if (gapStart >= workdayStart && gapEnd <= workdayEnd) {
      const minutes = (gapEnd.getTime() - gapStart.getTime()) / (1000 * 60);
      if (minutes > 45) {
        gaps.push({ start: gapStart, end: gapEnd, minutes });
      }
    }
  }

  // Check gap after last event
  const lastEvent = timedEvents[timedEvents.length - 1];
  if (lastEvent.end < workdayEnd) {
    const gapStart = lastEvent.end;
    const minutes = (workdayEnd.getTime() - gapStart.getTime()) / (1000 * 60);
    if (minutes > 45) {
      gaps.push({ start: gapStart, end: workdayEnd, minutes });
    }
  }

  return gaps;
}

export function CalendarPanel() {
  const { data, loading, error } = useCalendar();
  const { projects } = useProjects();

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
        <div className="h-6 w-32 bg-gray-200 rounded mb-4"></div>
        <div className="space-y-2">
          <div className="h-4 w-full bg-gray-200 rounded"></div>
          <div className="h-4 w-3/4 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">📅 Calendar</h2>
        <div className="text-sm text-red-600">Error loading calendar: {error}</div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // Not connected state
  if (data.status === 'not_connected') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">📅 Calendar</h2>
        <p className="text-sm text-gray-600 mb-4">
          Connect your Google Calendar to see upcoming events and find time for focused work.
        </p>
        <a
          href={data.authUrl}
          className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          Connect Google Calendar
        </a>
      </div>
    );
  }

  // Connected state - group events by date
  const eventsByDate = groupEventsByDate(data.events);
  const today = getDateKey(new Date());
  const todayEvents = eventsByDate.get(today) || [];
  const freeGaps = findFreeGaps(todayEvents);

  // Find stalest project (for suggestions)
  const staleProjects = projects
    .filter(p => p.status === 'stale')
    .sort((a, b) => b.staleDays - a.staleDays);
  const stalestProject = staleProjects[0];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">📅 Calendar</h2>
        <span className="text-xs text-green-600 font-medium">● Connected</span>
      </div>

      {/* Free gaps section */}
      {freeGaps.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Free Time Today</h3>
          <div className="flex flex-wrap gap-2">
            {freeGaps.map((gap, idx) => (
              <div
                key={idx}
                className="inline-flex items-center px-3 py-1 bg-green-50 border border-green-200 text-green-700 rounded-full text-sm"
              >
                {formatTime(gap.start)} - {formatTime(gap.end)}
              </div>
            ))}
          </div>

          {/* Suggestion chip when stale projects exist */}
          {stalestProject && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                💡 <strong>Suggestion:</strong> Use free time to work on{' '}
                <span className="font-semibold">{stalestProject.name}</span>?
              </p>
            </div>
          )}
        </div>
      )}

      {/* Today's events */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Today</h3>
        {todayEvents.length === 0 ? (
          <p className="text-sm text-gray-500">No events today</p>
        ) : (
          <div className="space-y-2">
            {todayEvents.map(event => (
              <div
                key={event.id}
                className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex-shrink-0 w-16 text-xs text-gray-600">
                  {event.allDay ? (
                    <span className="text-xs font-medium text-gray-500">All day</span>
                  ) : (
                    formatTime(parseDate(event.start))
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{event.title}</div>
                  {!event.allDay && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {formatTime(parseDate(event.start))} - {formatTime(parseDate(event.end))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Next 7 days (compact list) */}
      {eventsByDate.size > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Next 7 Days</h3>
          <div className="space-y-3">
            {Array.from(eventsByDate.entries())
              .filter(([dateKey]) => dateKey !== today)
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([dateKey, events]) => (
                <div key={dateKey} className="border-l-2 border-gray-300 pl-3">
                  <div className="text-xs font-medium text-gray-600 mb-1">
                    {formatDateLabel(dateKey)}
                  </div>
                  <div className="space-y-1">
                    {events.map(event => (
                      <div key={event.id} className="text-sm text-gray-700">
                        {event.allDay ? (
                          <span className="text-gray-500">All day:</span>
                        ) : (
                          <span className="text-gray-500">
                            {formatTime(parseDate(event.start))}
                          </span>
                        )}{' '}
                        {event.title}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>

          {eventsByDate.size === 1 && today === Array.from(eventsByDate.keys())[0] && (
            <p className="text-sm text-gray-500 mt-2">No upcoming events in the next 7 days</p>
          )}
        </div>
      )}

      {data.events.length === 0 && (
        <p className="text-sm text-gray-500">No events in the next 7 days</p>
      )}
    </div>
  );
}
