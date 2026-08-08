import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listPublicEvents } from "../api/events";
import { useUserAuth } from "../context/UserAuthContext";
import type { EventItem } from "../types";

export default function EventsListPage() {
  const { isAuthenticated, name, email } = useUserAuth();
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
      {isAuthenticated ? (
        <p className="muted">
          Signed in as {name ?? email} -- registering below will save this ticket to{" "}
          <Link to="/my-tickets">My tickets</Link>.
        </p>
      ) : (
        <p className="muted">
          <Link to="/login">Log in</Link> or <Link to="/signup">create an account</Link> to keep all
          your tickets in one place, or register as a guest below.
        </p>
      )}
      {events.length === 0 && <p>No published events yet -- check back soon.</p>}
      <ul className="event-list">
        {events.map((event) => {
          const soldOut = event.registeredCount >= event.capacity;
          return (
            <li key={event.eventId} className="event-card">
              <Link to={`/events/${event.eventId}`}>
                <h2>{event.title}</h2>
              </Link>
              <p>{event.venue}</p>
              <p>{new Date(event.startDateTime).toLocaleString()}</p>
              <p className="muted">
                {event.registeredCount} / {event.capacity} registered
              </p>
              <Link to={`/events/${event.eventId}`} className="button">
                {soldOut ? "View details" : "View details & register"}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
