import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listMyRegistrations } from "../api/registrations";
import { useUserAuth } from "../context/UserAuthContext";
import type { RegistrationSummary } from "../types";

export default function MyTicketsPage() {
  const { token, name, email } = useUserAuth();
  const [registrations, setRegistrations] = useState<RegistrationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    listMyRegistrations(token)
      .then((res) => setRegistrations(res.items))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load your tickets."))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div>
      <h1>My tickets</h1>
      <p className="muted">Signed in as {name ?? email}</p>
      {error && <p className="error">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : registrations.length === 0 ? (
        <p>
          You haven't registered for any events yet -- <Link to="/events">browse what's on</Link>.
        </p>
      ) : (
        <ul className="event-list">
          {registrations.map((registration) => (
            <li key={registration.registrationId} className="event-card">
              <Link
                to={`/tickets/${registration.registrationId}?code=${registration.confirmationCode}`}
              >
                <h2>{registration.attendeeName}</h2>
              </Link>
              <p className="muted">
                {registration.status} &middot;{" "}
                {new Date(registration.registeredAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
