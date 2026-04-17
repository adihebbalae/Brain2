import { Router } from 'express';
import crypto from 'node:crypto';
import {
  getAuthUrl,
  exchangeCodeForTokens,
  saveTokens,
  loadTokens,
  getCalendarEvents,
  hasCredentials,
} from '../lib/calendar-client.js';

const router = Router();

// Store state tokens temporarily (in production, use Redis or similar)
const stateTokens = new Set<string>();

/**
 * GET /api/calendar/auth
 * Initiates OAuth2 flow by redirecting to Google consent screen
 */
router.get('/auth', (_req, res) => {
  if (!hasCredentials()) {
    return res.status(500).json({ error: 'Google Calendar credentials not configured' });
  }

  // Generate CSRF protection state token
  const state = crypto.randomBytes(16).toString('hex');
  stateTokens.add(state);

  // Clean up old state tokens after 10 minutes
  setTimeout(() => {
    stateTokens.delete(state);
  }, 10 * 60 * 1000);

  const authUrl = getAuthUrl(state);
  res.redirect(authUrl);
});

/**
 * GET /api/calendar/callback
 * OAuth2 callback - exchanges code for tokens and saves them
 */
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || typeof code !== 'string') {
    return res.status(400).send('Missing authorization code');
  }

  if (!state || typeof state !== 'string') {
    return res.status(400).send('Missing state parameter');
  }

  // Validate state token (CSRF protection)
  if (!stateTokens.has(state)) {
    return res.status(403).send('Invalid state token');
  }

  stateTokens.delete(state);

  try {
    const tokens = await exchangeCodeForTokens(code);
    await saveTokens(tokens);

    // Redirect to frontend with success
    res.redirect('http://localhost:5173?calendar=connected');
  } catch (err) {
    console.error('Failed to exchange code for tokens:', err);
    res.status(500).send('Failed to authenticate with Google Calendar');
  }
});

/**
 * GET /api/calendar
 * Get calendar events for today + next 7 days
 */
router.get('/', async (_req, res) => {
  try {
    const tokens = await loadTokens();

    if (!tokens) {
      return res.json({
        events: [],
        status: 'not_connected',
        authUrl: '/api/calendar/auth',
      });
    }

    const events = await getCalendarEvents();

    return res.json({
      events,
      status: 'connected',
    });
  } catch (err) {
    console.error('Failed to fetch calendar events:', err);

    // If authentication failed, return not_connected
    if (err instanceof Error && err.message === 'Not authenticated') {
      return res.json({
        events: [],
        status: 'not_connected',
        authUrl: '/api/calendar/auth',
      });
    }

    return res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

export { router as calendarRouter };
