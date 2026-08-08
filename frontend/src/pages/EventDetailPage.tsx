import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { getPublicEvent } from "../api/events";
import { registerForEventAsUser } from "../api/registrations";
import { useUserAuth } from "../context/UserAuthContext";
import type { EventItem } from "../types";

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, token, name: accountName, email: accountEmail } = useUserAuth();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    getPublicEvent(eventId)
      .then(setEvent)
      .catch((err) => setError(err instanceof Error ? err.message : "Event not found."))
      .finally(() => setLoading(false));
  }, [eventId]);

  async function handleRegister() {
    if (!eventId || !token) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const registration = await registerForEventAsUser(
        token,
        eventId,
        accountName ?? "",
        accountEmail ?? "",
      );
      navigate(`/tickets/${registration.registrationId}?code=${registration.confirmationCode}`);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p>Loading...</p>;
  if (error || !event) return <p className="error">{error ?? "Event not found."}</p>;

  const soldOut = event.registeredCount >= event.capacity;

  return (
    <div className="event-card">
      <h1>{event.title}</h1>
      <p>{event.description}</p>
      <p>
        <strong>Venue:</strong> {event.venue}
      </p>
      <p>
        <strong>When:</strong> {new Date(event.startDateTime).toLocaleString()} &ndash;{" "}
        {new Date(event.endDateTime).toLocaleString()}
      </p>
      <p className="muted">
        {event.registeredCount} / {event.capacity} registered
      </p>

      {soldOut ? (
        <p className="error">This event is sold out.</p>
      ) : isAuthenticated ? (
        <div className="card-form">
          <h2>Register</h2>
          <p className="muted">Registering as {accountName ?? accountEmail}.</p>
          {formError && <p className="error">{formError}</p>}
          <button type="button" onClick={handleRegister} disabled={submitting}>
            {submitting ? "Registering..." : "Register"}
          </button>
        </div>
      ) : (
        <div className="card-form">
          <h2>Register</h2>
          <p className="muted">Sign in to register for this event.</p>
          <Link to={`/login?redirect=/events/${eventId}`} className="button">
            Log in to register
          </Link>
          <p className="muted">
            New here? <Link to={`/signup?redirect=/events/${eventId}`}>Create an account</Link>
          </p>
        </div>
      )}
    </div>
  );
}
