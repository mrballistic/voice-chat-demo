import { google } from "googleapis";
import { DEFAULT_CALENDAR_ID } from "./constants";

export function getCalendarClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth });
}

export async function findFreeTimes(accessToken: string, calendarId = "primary") {
  const calendar = getCalendarClient(accessToken);
  const now = new Date();
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: now.toISOString(),
      timeMax: end.toISOString(),
      timeZone: "UTC",
      items: [{ id: calendarId }],
    },
  });

  return res.data.calendars?.[calendarId]?.busy ?? [];
}

export async function createMeeting(accessToken: string, summary: string, start: Date, end: Date) {
  const calendar = getCalendarClient(accessToken);
  const event = {
    summary,
    start: { dateTime: start.toISOString(), timeZone: "UTC" },
    end: { dateTime: end.toISOString(), timeZone: "UTC" },
  };
  return await calendar.events.insert({
    calendarId: "primary",
    requestBody: event,
  });
}
export async function getCalendarEvents(accessToken: string, calendarId = "primary", timeMin?: Date, timeMax?: Date) {
  const calendar = getCalendarClient(accessToken);
  const params: import("googleapis").calendar_v3.Params$Resource$Events$List = {
    calendarId,
    timeZone: "UTC",
    singleEvents: true,
    orderBy: "startTime",
  };
  if (timeMin) params.timeMin = timeMin.toISOString();
  if (timeMax) params.timeMax = timeMax.toISOString();

  const res = await calendar.events.list(params);
  return res.data.items || [];
}
export async function deleteEvent(accessToken: string, eventId: string, calendarId = "primary") {
  const calendar = getCalendarClient(accessToken);
  try {
    await calendar.events.delete({
      calendarId,
      eventId,
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to delete event:", error);
    return { success: false, error: String(error) };
  }
}
export async function updateEvent(
  accessToken: string,
  eventId: string,
  updates: import("googleapis").calendar_v3.Schema$Event,
  calendarId = "primary"
) {
  const calendar = getCalendarClient(accessToken);
  try {
    const res = await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: updates,
    });
    return res.data;
  } catch (error) {
    console.error("Failed to update event:", error);
    return { success: false, error: String(error) };
  }
}
export async function getCalendarList(accessToken: string) {
  const calendar = getCalendarClient(accessToken);
  try {
    const res = await calendar.calendarList.list();
    return res.data.items || [];
  } catch (error) {
    console.error("Failed to fetch calendar list:", error);
    return [];
  }
}
export async function getCalendarDetails(accessToken: string, calendarId = "primary") {
  const calendar = getCalendarClient(accessToken);
  try {
    const res = await calendar.calendars.get({ calendarId });
    return res.data;
  } catch (error) {
    console.error("Failed to fetch calendar details:", error);
    return null;
  }
}
export async function createCalendar(accessToken: string, summary: string, description?: string) {
  const calendar = getCalendarClient(accessToken);
  const newCalendar = {
    summary,
    description,
    timeZone: "UTC",
  };
  try {
    const res = await calendar.calendars.insert({
      requestBody: newCalendar,
    });
    return res.data;
  } catch (error) {
    console.error("Failed to create calendar:", error);
    return null;
  }
}
export async function deleteCalendar(accessToken: string, calendarId: string) {
  const calendar = getCalendarClient(accessToken);
  try {
    await calendar.calendars.delete({ calendarId });
    return { success: true };
  } catch (error) {
    console.error("Failed to delete calendar:", error);
    return { success: false, error: String(error) };
  }
}
export async function updateCalendar(
  accessToken: string,
  calendarId: string,
  updates: import("googleapis").calendar_v3.Schema$Calendar
) {
  const calendar = getCalendarClient(accessToken);
  try {
    const res = await calendar.calendars.patch({
      calendarId,
      requestBody: updates,
    });
    return res.data;
  } catch (error) {
    console.error("Failed to update calendar:", error);
    return { success: false, error: String(error) };
  }
}
export async function getCalendarColors(accessToken: string) {
  const calendar = getCalendarClient(accessToken);
  try {
    const res = await calendar.colors.get();
    return res.data.calendar;
  } catch (error) {
    console.error("Failed to fetch calendar colors:", error);
    return null;
  }
}
export async function getEventColors(accessToken: string) {
  const calendar = getCalendarClient(accessToken);
  try {
    const res = await calendar.colors.get();
    return res.data.event;
  } catch (error) {
    console.error("Failed to fetch event colors:", error);
    return null;
  }
}
export async function getCalendarSettings(accessToken: string) {
  const calendar = getCalendarClient(accessToken);
  try {
    const res = await calendar.settings.list();
    return res.data.items || [];
  } catch (error) {
    console.error("Failed to fetch calendar settings:", error);
    return null;
  }
}

export async function getCalendarEventsByQuery(accessToken: string, query: string, calendarId = "primary") {
  const calendar = getCalendarClient(accessToken);
  try {
    const res = await calendar.events.list({
      calendarId,
      q: query,
      timeZone: "UTC",
      singleEvents: true,
      orderBy: "startTime",
    });
    return res.data.items || [];
  } catch (error) {
    console.error("Failed to fetch calendar events by query:", error);
    return [];
  }
}
export async function getCalendarEvent(accessToken: string, eventId: string, calendarId = "primary") {
  const calendar = getCalendarClient(accessToken);
  try {
    const res = await calendar.events.get({
      calendarId,
      eventId,
      timeZone: "UTC",
    });
    return res.data;
  } catch (error) {
    console.error("Failed to fetch calendar event:", error);
    return null;
  }
}
export async function getCalendarEventAttendees(accessToken: string, eventId: string, calendarId = "primary") {
  const calendar = getCalendarClient(accessToken);
  try {
    const event = await calendar.events.get({
      calendarId,
      eventId,
      timeZone: "UTC",
    });
    return event.data.attendees || [];
  } catch (error) {
    console.error("Failed to fetch calendar event attendees:", error);
    return [];
  }
}

// Set the default calendar ID for all calendar operations going forward
export { DEFAULT_CALENDAR_ID };
