import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CalendarPanel } from './CalendarPanel';
import * as useCalendarModule from '../hooks/useCalendar';
import * as useProjectsModule from '../hooks/useProjects';

// Mock the hooks
vi.mock('../hooks/useCalendar');
vi.mock('../hooks/useProjects');

describe('CalendarPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for projects hook
    vi.mocked(useProjectsModule.useProjects).mockReturnValue({
      projects: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('should show loading state', () => {
    vi.mocked(useCalendarModule.useCalendar).mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<CalendarPanel />);
    expect(document.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('should show error state', () => {
    vi.mocked(useCalendarModule.useCalendar).mockReturnValue({
      data: null,
      loading: false,
      error: 'Failed to fetch',
      refetch: vi.fn(),
    });

    render(<CalendarPanel />);
    expect(screen.getByText(/Error loading calendar/i)).toBeDefined();
  });

  it('should show connect button when not connected', () => {
    vi.mocked(useCalendarModule.useCalendar).mockReturnValue({
      data: {
        events: [],
        status: 'not_connected',
        authUrl: '/api/calendar/auth',
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CalendarPanel />);
    expect(screen.getByText('Connect Google Calendar')).toBeDefined();
  });

  it('should show events when connected', () => {
    const today = new Date();
    const todayISO = today.toISOString();

    vi.mocked(useCalendarModule.useCalendar).mockReturnValue({
      data: {
        events: [
          {
            id: 'event1',
            title: 'Team Meeting',
            start: todayISO,
            end: new Date(today.getTime() + 3600000).toISOString(),
            allDay: false,
            calendarId: 'primary',
          },
        ],
        status: 'connected',
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CalendarPanel />);
    expect(screen.getByText('Team Meeting')).toBeDefined();
    expect(screen.getByText('● Connected')).toBeDefined();
  });

  it('should show free gaps when detected', () => {
    const today = new Date();
    today.setHours(14, 0, 0, 0); // 2 PM

    const eventEnd = new Date(today);
    eventEnd.setHours(15, 0, 0, 0); // 3 PM

    vi.mocked(useCalendarModule.useCalendar).mockReturnValue({
      data: {
        events: [
          {
            id: 'event1',
            title: 'Morning Meeting',
            start: today.toISOString(),
            end: eventEnd.toISOString(),
            allDay: false,
            calendarId: 'primary',
          },
        ],
        status: 'connected',
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CalendarPanel />);
    expect(screen.getByText('Free Time Today')).toBeDefined();
  });

  it('should show suggestion when stale projects exist and free gaps found', () => {
    const today = new Date();
    today.setHours(14, 0, 0, 0); // 2 PM

    const eventEnd = new Date(today);
    eventEnd.setHours(15, 0, 0, 0); // 3 PM

    vi.mocked(useCalendarModule.useCalendar).mockReturnValue({
      data: {
        events: [
          {
            id: 'event1',
            title: 'Meeting',
            start: today.toISOString(),
            end: eventEnd.toISOString(),
            allDay: false,
            calendarId: 'primary',
          },
        ],
        status: 'connected',
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    vi.mocked(useProjectsModule.useProjects).mockReturnValue({
      projects: [
        {
          name: 'Stale Project',
          status: 'stale',
          staleDays: 45,
          path: '/test',
          vscodeUrl: 'vscode://test',
          lastModified: '2026-01-01',
          summary: 'Test',
          nextSteps: [],
          todos: 0,
          openTodos: 0,
          hasDeadlines: false,
        },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CalendarPanel />);
    expect(screen.getByText(/Suggestion:/i)).toBeDefined();
    expect(screen.getByText(/Stale Project/i)).toBeDefined();
  });

  it('should show no events message when calendar is empty', () => {
    vi.mocked(useCalendarModule.useCalendar).mockReturnValue({
      data: {
        events: [],
        status: 'connected',
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CalendarPanel />);
    expect(screen.getByText('No events in the next 7 days')).toBeDefined();
  });
});
