import { useState, useEffect } from 'react';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  calendarId: string;
}

export interface CalendarResponse {
  events: CalendarEvent[];
  status: 'connected' | 'not_connected';
  authUrl?: string;
}

export function useCalendar(pollInterval = 60000) {
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCalendar = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/calendar');
      if (!response.ok) {
        throw new Error('Failed to fetch calendar');
      }
      const calendarData = await response.json();
      setData(calendarData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();

    // Poll for updates
    const interval = setInterval(fetchCalendar, pollInterval);

    return () => clearInterval(interval);
  }, [pollInterval]);

  return {
    data,
    loading,
    error,
    refetch: fetchCalendar,
  };
}
