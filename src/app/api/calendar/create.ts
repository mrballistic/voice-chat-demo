// pages/api/calendar/create.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getToken } from "next-auth/jwt";
import { getCalendarClient } from "../../../lib/google";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const token = await getToken({ req });
  if (!token?.accessToken) return res.status(401).json({ error: "Unauthorized" });

  const { summary, start, end } = req.body;
  if (!summary || !start || !end) {
    return res.status(400).json({ error: "Missing summary, start, or end" });
  }

  const calendar = getCalendarClient(token.accessToken as string);

  try {
    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary,
        start: { dateTime: new Date(start).toISOString(), timeZone: "UTC" },
        end: { dateTime: new Date(end).toISOString(), timeZone: "UTC" },
      },
    });

    res.status(200).json({ event: response.data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Calendar event creation failed" });
  }
}
