/**
 * Google Calendar OAuth2 client
 * Read-only access to user's calendar events
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'node:fs/promises';
import path from 'node:path';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/calendar/callback';

// Read-only calendar scope
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

// Token file location
const TOKEN_PATH = path.join(process.cwd(), 'data', 'calendar-tokens.json');

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  calendarId: string;
}

export interface CalendarTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

/**
 * Create OAuth2 client
 */
function getOAuth2Client(): OAuth2Client {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

/**
 * Generate OAuth2 authorization URL with state parameter for CSRF protection
 */
export function getAuthUrl(state: string): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state,
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<CalendarTokens> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
    throw new Error('Missing required tokens');
  }

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  };
}

/**
 * Save tokens to file
 */
export async function saveTokens(tokens: CalendarTokens): Promise<void> {
  const dir = path.dirname(TOKEN_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2), 'utf-8');
}

/**
 * Load tokens from file
 */
export async function loadTokens(): Promise<CalendarTokens | null> {
  try {
    const data = await fs.readFile(TOKEN_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return null;
  }
}

/**
 * Refresh access token if expired
 */
async function refreshTokenIfNeeded(tokens: CalendarTokens): Promise<CalendarTokens> {
  const now = Date.now();

  // If token expires in less than 5 minutes, refresh it
  if (tokens.expiry_date > now + 5 * 60 * 1000) {
    return tokens;
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: tokens.refresh_token,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();

  if (!credentials.access_token || !credentials.expiry_date) {
    throw new Error('Failed to refresh token');
  }

  const newTokens: CalendarTokens = {
    access_token: credentials.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: credentials.expiry_date,
  };

  await saveTokens(newTokens);
  return newTokens;
}

/**
 * Get calendar events for today + next 7 days
 */
export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  const tokens = await loadTokens();
  if (!tokens) {
    throw new Error('Not authenticated');
  }

  // Refresh token if needed
  const validTokens = await refreshTokenIfNeeded(tokens);

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: validTokens.access_token,
    refresh_token: validTokens.refresh_token,
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // Get events from today to 7 days from now
  const timeMin = new Date();
  timeMin.setHours(0, 0, 0, 0);

  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + 7);
  timeMax.setHours(23, 59, 59, 999);

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  const items = response.data.items || [];

  return items.map(event => {
    const start = event.start?.dateTime || event.start?.date || '';
    const end = event.end?.dateTime || event.end?.date || '';
    const allDay = !event.start?.dateTime; // If no dateTime, it's an all-day event

    return {
      id: event.id || '',
      title: event.summary || '(No title)',
      start,
      end,
      allDay,
      calendarId: event.organizer?.email || 'primary',
    };
  });
}

/**
 * Check if credentials are configured
 */
export function hasCredentials(): boolean {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}
