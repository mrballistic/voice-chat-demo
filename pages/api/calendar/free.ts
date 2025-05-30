import { NextApiRequest, NextApiResponse } from "next";
import { getToken } from "next-auth/jwt";
import { getCalendarClient, DEFAULT_CALENDAR_ID } from "../../../src/lib/google";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const token = await getToken({ req });
  if (!token?.accessToken) return res.status(401).json({ error: "Unauthorized" });

  const calendar = getCalendarClient(token.accessToken as string);
  const { timeMin, timeMax } = req.query;

  if (!timeMin || !timeMax) {
    return res.status(400).json({ error: "Missing timeMin or timeMax query params" });
  }

  try {
    // Always use the default calendar going forward
    const calendarToQuery = DEFAULT_CALENDAR_ID;
    const result = await calendar.freebusy.query({
      requestBody: {
        timeMin: new Date(timeMin as string).toISOString(),
        timeMax: new Date(timeMax as string).toISOString(),
        timeZone: "UTC",
        items: [{ id: calendarToQuery }],
      },
    });

    const busyTimes = result.data.calendars?.[calendarToQuery]?.busy ?? [];
    res.status(200).json({ busyTimes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch free/busy times" });
  }
}
