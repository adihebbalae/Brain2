import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { calendarRouter } from './calendar';
import * as calendarClient from '../lib/calendar-client';

// Mock the calendar client
vi.mock('../lib/calendar-client');

const app = express();
app.use(express.json());
app.use('/api/calendar', calendarRouter);

describe('Calendar Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/calendar', () => {
    it('should return not_connected when no tokens exist', async () => {
      vi.mocked(calendarClient.loadTokens).mockResolvedValue(null);

      const response = await request(app).get('/api/calendar');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        events: [],
        status: 'not_connected',
        authUrl: '/api/calendar/auth',
      });
    });

    it('should return events when connected', async () => {
      const mockTokens = {
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        expiry_date: Date.now() + 3600000,
      };

      const mockEvents = [
        {
          id: 'event1',
          title: 'Team Meeting',
          start: '2026-04-16T10:00:00Z',
          end: '2026-04-16T11:00:00Z',
          allDay: false,
          calendarId: 'primary',
        },
      ];

      vi.mocked(calendarClient.loadTokens).mockResolvedValue(mockTokens);
      vi.mocked(calendarClient.getCalendarEvents).mockResolvedValue(mockEvents);

      const response = await request(app).get('/api/calendar');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        events: mockEvents,
        status: 'connected',
      });
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(calendarClient.loadTokens).mockRejectedValue(new Error('File read error'));

      const response = await request(app).get('/api/calendar');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/calendar/auth', () => {
    it('should redirect to Google auth URL', async () => {
      vi.mocked(calendarClient.hasCredentials).mockReturnValue(true);
      vi.mocked(calendarClient.getAuthUrl).mockReturnValue(
        'https://accounts.google.com/o/oauth2/v2/auth?state=test'
      );

      const response = await request(app).get('/api/calendar/auth');

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    });

    it('should return error when credentials not configured', async () => {
      vi.mocked(calendarClient.hasCredentials).mockReturnValue(false);

      const response = await request(app).get('/api/calendar/auth');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Google Calendar credentials not configured' });
    });
  });

  describe('GET /api/calendar/callback', () => {
    it('should return 400 when code is missing', async () => {
      const response = await request(app).get('/api/calendar/callback?state=test');

      expect(response.status).toBe(400);
      expect(response.text).toContain('Missing authorization code');
    });

    it('should return 400 when state is missing', async () => {
      const response = await request(app).get('/api/calendar/callback?code=test');

      expect(response.status).toBe(400);
      expect(response.text).toContain('Missing state parameter');
    });
  });
});
