import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { cancelRegistration, getRegistration } from "../api/registrations";
import type { RegistrationWithEvent } from "../types";

export default function TicketPage() {
  const { registrationId } = useParams<{ registrationId: string }>();
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code") ?? "";

  const [registration, setRegistration] = useState<RegistrationWithEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  function load() {
    if (!registrationId || !code) {
      setError("Missing confirmation code.");
      setLoading(false);
      return;
    }
    setLoading(true);
    getRegistration(registrationId, code)
      .then(setRegistration)
      .catch((err) => setError(err instanceof Error ? err.message : "Ticket not found."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [registrationId, code]);

  async function handleCancel() {
    if (!registrationId || !code) return;
    if (!window.confirm("Cancel this registration?")) return;
    setCancelling(true);
    try {
      await cancelRegistration(registrationId, code);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel this registration.");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <p>Loading ticket...</p>;
  if (error || !registration) return <p className="error">{error ?? "Ticket not found."}</p>;

  return (
    <div className="ticket-card">
      <h1>{registration.event.title}</h1>
      <p>{registration.event.venue}</p>
      <p>{registration.event.startDateTime && new Date(registration.event.startDateTime).toLocaleString()}</p>
      <p>
        <strong>Attendee:</strong> {registration.attendeeName}
      </p>
      <p>
        <strong>Status:</strong> {registration.status}
      </p>
      {registration.ticketQrUrl && registration.status === "CONFIRMED" && (
        <img src={registration.ticketQrUrl} alt="Ticket QR code" className="qr-code" />
      )}
      {registration.status === "CONFIRMED" && (
        <button type="button" onClick={handleCancel} disabled={cancelling}>
          {cancelling ? "Cancelling..." : "Cancel registration"}
        </button>
      )}
    </div>
  );
}
