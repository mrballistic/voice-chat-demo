import { NextApiRequest, NextApiResponse } from "next";
import { getToken } from "next-auth/jwt";
import { getCalendarClient } from "../../../src/lib/google";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const token = await getToken({ req });
  if (!token?.accessToken) return res.status(401).json({ error: "Unauthorized" });

  const calendar = getCalendarClient(token.accessToken as string);

  try {
    const result = await calendar.calendarList.list();
    const calendars = result.data.items?.map((cal) => ({
      id: cal.id,
      summary: cal.summary,
      primary: cal.primary || false,
    })) || [];
    res.status(200).json({ calendars });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch calendar list" });
  }
}
