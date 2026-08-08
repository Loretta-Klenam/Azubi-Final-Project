import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listPublicEvents } from "../api/events";
import { useUserAuth } from "../context/UserAuthContext";
import { ProductCard } from "@/components/ui/cards-1";
import type { EventItem } from "../types";

// Fallback stock photos for events that don't have an imageUrl of their own.
const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=900&auto=format&fit=crop&q=60",
  "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=900&auto=format&fit=crop&q=60",
  "https://images.unsplash.com/photo-1511578314322-379afb476865?w=900&auto=format&fit=crop&q=60",
  "https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=900&auto=format&fit=crop&q=60",
  "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=900&auto=format&fit=crop&q=60",
  "https://images.unsplash.com/photo-1531058020387-3be344556be6?w=900&auto=format&fit=crop&q=60",
];

function eventImage(event: EventItem, index: number): string {
  return event.imageUrl || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];
}

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
          <Link to="/login">Log in</Link> or <Link to="/signup">create an account</Link> to register
          for an event.
        </p>
      )}
      {events.length === 0 && <p>No published events yet -- check back soon.</p>}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {events.map((event, index) => {
          const soldOut = event.registeredCount >= event.capacity;
          return (
            <ProductCard
              key={event.eventId}
              title={event.title}
              category={soldOut ? `${event.venue} -- Sold out` : event.venue}
              imageUrl={eventImage(event, index)}
              href={`/events/${event.eventId}`}
            />
          );
        })}
      </div>
    </div>
  );
}
