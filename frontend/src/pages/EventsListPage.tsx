import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listPublicEvents } from "../api/events";
import type { EventItem } from "../types";

export default function EventsListPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listPublicEvents()
      .then((res) => setEvents(res.items))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load events."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading events...</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <h1>Upcoming events</h1>
      {events.length === 0 && <p>No published events yet -- check back soon.</p>}
      <ul className="event-list">
        {events.map((event) => (
          <li key={event.eventId} className="event-card">
            <Link to={`/events/${event.eventId}`}>
              <h2>{event.title}</h2>
            </Link>
            <p>{event.venue}</p>
            <p>{new Date(event.startDateTime).toLocaleString()}</p>
            <p className="muted">
              {event.registeredCount} / {event.capacity} registered
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
