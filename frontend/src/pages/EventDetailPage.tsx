import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { getPublicEvent } from "../api/events";
import { registerForEvent, registerForEventAsUser } from "../api/registrations";
import { useUserAuth } from "../context/UserAuthContext";
import type { EventItem } from "../types";

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, token, name: accountName, email: accountEmail } = useUserAuth();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    getPublicEvent(eventId)
      .then(setEvent)
      .catch((err) => setError(err instanceof Error ? err.message : "Event not found."))
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    if (isAuthenticated) {
      setName(accountName ?? "");
      setEmail(accountEmail ?? "");
    }
  }, [isAuthenticated, accountName, accountEmail]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!eventId) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const registration =
        isAuthenticated && token
          ? await registerForEventAsUser(token, eventId, name, email)
          : await registerForEvent(eventId, name, email);
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
      ) : (
        <form onSubmit={handleSubmit} className="card-form">
          <h2>Register</h2>
          {isAuthenticated && <p className="muted">Registering as {accountName ?? accountEmail}.</p>}
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
          </label>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={320}
            />
          </label>
          {formError && <p className="error">{formError}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? "Registering..." : "Register"}
          </button>
        </form>
      )}
    </div>
  );
}
