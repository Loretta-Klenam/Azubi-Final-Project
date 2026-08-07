import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteEvent, listAdminEvents } from "../../api/events";
import { useAuth } from "../../context/AuthContext";
import type { EventItem } from "../../types";

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    if (!token) return;
    setLoading(true);
    listAdminEvents(token)
      .then((res) => setEvents(res.items))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load events."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [token]);

  async function handleDelete(eventId: string) {
    if (!token) return;
    if (!window.confirm("Delete this event? This cannot be undone.")) return;
    try {
      await deleteEvent(token, eventId);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this event.");
    }
  }

  return (
    <div>
      <div className="admin-header">
        <h1>Manage events</h1>
        <Link to="/admin/events/new" className="button">
          + New event
        </Link>
      </div>
      {error && <p className="error">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Registrations</th>
              <th>Starts</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.eventId}>
                <td>{event.title}</td>
                <td>{event.status}</td>
                <td>
                  <Link to={`/admin/events/${event.eventId}/registrations`}>
                    {event.registeredCount} / {event.capacity}
                  </Link>
                </td>
                <td>{new Date(event.startDateTime).toLocaleString()}</td>
                <td className="row-actions">
                  <Link to={`/admin/events/${event.eventId}/edit`}>Edit</Link>
                  <button type="button" onClick={() => handleDelete(event.eventId)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
