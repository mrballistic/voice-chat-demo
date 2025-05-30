import { useEffect, useState } from "react";
import { signIn, signOut, useSession, SessionProvider } from "next-auth/react";
import { DEFAULT_CALENDAR_ID } from "../src/lib/constants";

type Calendar = {
  id: string;
  summary: string;
  primary?: boolean;
};

export default function CalendarListPage() {
  return (
    <SessionProvider>
      <CalendarListContent />
    </SessionProvider>
  );
}

function CalendarListContent() {
  const { data: session, status } = useSession();
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freeTimes, setFreeTimes] = useState<{ start: string; end: string }[]>([]);

  useEffect(() => {
    if (status === "authenticated") {
      setLoading(true);
      // Fetch calendars (for display)
      fetch("/api/calendar/list")
        .then((res) => res.json())
        .then((data) => {
          setCalendars(data.calendars || []);
        })
        .catch(() => {
          setError("Failed to load calendars");
        });
      // Fetch free times for the default calendar
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const sunday = new Date(tomorrow);
      sunday.setDate(tomorrow.getDate() + (7 - tomorrow.getDay())); // Sunday this week
      sunday.setHours(23, 59, 59, 999);
      fetch(`/api/calendar/free?timeMin=${encodeURIComponent(tomorrow.toISOString())}&timeMax=${encodeURIComponent(sunday.toISOString())}`)
        .then((res) => res.json())
        .then((data) => {
          setFreeTimes(data.busyTimes || []);
        })
        .catch(() => {
          setError("Failed to load free times");
        })
        .finally(() => setLoading(false));
    }
  }, [status]);

  if (status === "loading") return <div>Loading session...</div>;

  if (status !== "authenticated") {
    return (
      <div style={{ padding: 32 }}>
        <h2>Google Calendar List</h2>
        <button onClick={() => signIn("google")}>Sign in with Google</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 32 }}>
      <h2>Google Calendars for {session.user?.email}</h2>
      <button onClick={() => signOut()}>Sign out</button>
      {loading && <div>Loading calendars and free times...</div>}
      {error && <div style={{ color: "red" }}>{error}</div>}
      <ul>
        {calendars.map((cal) => (
          <li key={cal.id}>
            <strong>{cal.summary}</strong> <br />
            <code>{cal.id}</code>
            {cal.primary && <span style={{ color: "green", marginLeft: 8 }}>(Primary)</span>}
            {cal.id === DEFAULT_CALENDAR_ID && (
              <span style={{ color: "blue", marginLeft: 8 }}>(Default Group Calendar)</span>
            )}
          </li>
        ))}
      </ul>
      <h3>Busy Times in Group Calendar (Tomorrow through Sunday)</h3>
      <ul>
        {freeTimes.length === 0 && !loading && <li>No busy times found.</li>}
        {freeTimes.map((range, i) => (
          <li key={i}>
            {new Date(range.start).toLocaleString()} &ndash; {new Date(range.end).toLocaleString()}
          </li>
        ))}
      </ul>
      {calendars.length === 0 && !loading && <div>No calendars found.</div>}
    </div>
  );
}
