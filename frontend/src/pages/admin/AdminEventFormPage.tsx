import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createEvent, getAdminEvent, updateEvent } from "../../api/events";
import { useAuth } from "../../context/AuthContext";

interface Props {
  mode: "create" | "edit";
}

interface FormState {
  title: string;
  description: string;
  venue: string;
  startDateTime: string;
  endDateTime: string;
  capacity: number;
  status: string;
}

const emptyForm: FormState = {
  title: "",
  description: "",
  venue: "",
  startDateTime: "",
  endDateTime: "",
  capacity: 50,
  status: "DRAFT",
};

export default function AdminEventFormPage({ mode }: Props) {
  const { token } = useAuth();
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(mode === "edit");

  useEffect(() => {
    if (mode !== "edit" || !token || !eventId) return;
    getAdminEvent(token, eventId)
      .then((event) =>
        setForm({
          title: event.title,
          description: event.description,
          venue: event.venue,
          // datetime-local inputs want "YYYY-MM-DDTHH:mm", not a full ISO string.
          startDateTime: event.startDateTime.slice(0, 16),
          endDateTime: event.endDateTime.slice(0, 16),
          capacity: event.capacity,
          status: event.status,
        }),
      )
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load event."))
      .finally(() => setLoading(false));
  }, [mode, token, eventId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        ...form,
        startDateTime: new Date(form.startDateTime).toISOString(),
        endDateTime: new Date(form.endDateTime).toISOString(),
        capacity: Number(form.capacity),
      };
      if (mode === "create") {
        await createEvent(token, payload);
      } else if (eventId) {
        await updateEvent(token, eventId, payload);
      }
      navigate("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this event.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p>Loading...</p>;

  return (
    <form onSubmit={handleSubmit} className="card-form">
      <h1>{mode === "create" ? "New event" : "Edit event"}</h1>
      <label>
        Title
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
          maxLength={200}
        />
      </label>
      <label>
        Description
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          maxLength={2000}
          rows={4}
        />
      </label>
      <label>
        Venue
        <input
          value={form.venue}
          onChange={(e) => setForm({ ...form, venue: e.target.value })}
          required
          maxLength={200}
        />
      </label>
      <label>
        Start
        <input
          type="datetime-local"
          value={form.startDateTime}
          onChange={(e) => setForm({ ...form, startDateTime: e.target.value })}
          required
        />
      </label>
      <label>
        End
        <input
          type="datetime-local"
          value={form.endDateTime}
          onChange={(e) => setForm({ ...form, endDateTime: e.target.value })}
          required
        />
      </label>
      <label>
        Capacity
        <input
          type="number"
          min={1}
          value={form.capacity}
          onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
          required
        />
      </label>
      <label>
        Status
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
