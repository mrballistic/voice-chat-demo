import { NextApiRequest, NextApiResponse } from "next";
import { getToken } from "next-auth/jwt";
import { getCalendarClient } from "../../../src/lib/google";
import { DEFAULT_CALENDAR_ID } from "../../../src/lib/constants";

// Helper: find first open slot of given duration (minutes) between timeMin and timeMax
function findFirstOpenSlot(busy: { start: string; end: string }[], timeMin: Date, timeMax: Date, durationMin = 30): { start: string; end: string } | null {
  const slots: { start: Date; end: Date }[] = [];
  let cursor = new Date(timeMin);
  const busyIntervals = busy
    .map(b => ({ start: new Date(b.start), end: new Date(b.end) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  for (const b of busyIntervals) {
    if (cursor < b.start && (b.start.getTime() - cursor.getTime()) >= durationMin * 60 * 1000) {
      slots.push({ start: new Date(cursor), end: new Date(cursor.getTime() + durationMin * 60 * 1000) });
      break;
    }
    if (cursor < b.end) cursor = new Date(b.end);
  }
  // After last busy
  if (cursor < timeMax && (timeMax.getTime() - cursor.getTime()) >= durationMin * 60 * 1000 && slots.length === 0) {
    slots.push({ start: new Date(cursor), end: new Date(cursor.getTime() + durationMin * 60 * 1000) });
  }
  if (slots.length > 0) {
    return { start: slots[0].start.toISOString(), end: slots[0].end.toISOString() };
  }
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const token = await getToken({ req });
  console.log('Google access token:', token?.accessToken);
  if (!token?.accessToken) {
    // Instead of redirect, return JSON with signinUrl for API clients
    return res.status(401).json({ error: 'Authentication required. Please sign in again.', signinUrl: '/api/auth/signin' });
  }
  const calendar = getCalendarClient(token.accessToken as string);
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() + 1);
  start.setHours(8, 0, 0, 0); // Start at 8am tomorrow
  const end = new Date(start);
  end.setDate(start.getDate() + 14); // Look up to 2 weeks out
  end.setHours(18, 0, 0, 0); // End at 6pm
  try {
    const result = await calendar.freebusy.query({
      requestBody: {
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        timeZone: "UTC",
        items: [{ id: DEFAULT_CALENDAR_ID }],
      },
    });
    // Defensive: check for HTML response (e.g., auth redirect)
    if (result && typeof result.data === 'string') {
      const dataStr = result.data as string;
      if (dataStr.trim().startsWith('<!DOCTYPE')) {
        return res.status(401).json({ error: 'Authentication required. Please sign in again.', signinUrl: '/api/auth/signin' });
      }
    }
    const busyPeriods = result.data.calendars?.[DEFAULT_CALENDAR_ID]?.busy ?? [];
    const busy = busyPeriods
      .filter((b: { start?: string | null; end?: string | null }) => !!b.start && !!b.end)
      .map((b: { start?: string | null; end?: string | null }) => ({
        start: b.start as string,
        end: b.end as string,
      }));
    const slot = findFirstOpenSlot(busy, start, end, 30);
    if (slot) {
      res.status(200).json({ slot });
    } else {
      res.status(404).json({ error: "No open slots found" });
    }
  } catch (error) {
    // Try to detect 401/invalid credentials and force sign-in
    const errObj = error as { code?: number; response?: { status?: number }; message?: string };
    if (errObj?.code === 401 || errObj?.response?.status === 401) {
      return res.status(401).json({ error: 'Invalid credentials. Please sign in again.', signinUrl: '/api/auth/signin' });
    }
    console.error('Google Calendar API error:', error);
    res.status(500).json({ error: "Failed to fetch calendar availability", details: String(error) });
  }
}
