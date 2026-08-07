import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { adminCancelRegistration, listRegistrationsForEvent } from "../../api/registrations";
import { useAuth } from "../../context/AuthContext";
import type { RegistrationSummary } from "../../types";

export default function AdminRegistrationsPage() {
  const { token } = useAuth();
  const { eventId } = useParams<{ eventId: string }>();

  const [registrations, setRegistrations] = useState<RegistrationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    if (!token || !eventId) return;
    setLoading(true);
    listRegistrationsForEvent(token, eventId)
      .then((res) => setRegistrations(res.items))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load registrations."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [token, eventId]);

  async function handleCancel(registrationId: string) {
    if (!token) return;
    if (!window.confirm("Cancel this attendee's registration?")) return;
    try {
      await adminCancelRegistration(token, registrationId);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel this registration.");
    }
  }

  return (
    <div>
      <h1>Registrations</h1>
      {error && <p className="error">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Registered</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((registration) => (
              <tr key={registration.registrationId}>
                <td>{registration.attendeeName}</td>
                <td>{registration.attendeeEmail}</td>
                <td>{registration.status}</td>
                <td>{new Date(registration.registeredAt).toLocaleString()}</td>
                <td>
                  {registration.status === "CONFIRMED" && (
                    <button type="button" onClick={() => handleCancel(registration.registrationId)}>
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
