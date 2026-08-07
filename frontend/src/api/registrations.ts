import { apiRequest } from "./client";
import type { Paginated, RegistrationSummary, RegistrationWithEvent } from "../types";

export function registerForEvent(eventId: string, attendeeName: string, attendeeEmail: string) {
  return apiRequest<RegistrationSummary>(`/events/${eventId}/registrations`, {
    method: "POST",
    body: { attendeeName, attendeeEmail },
  });
}

export function getRegistration(registrationId: string, code: string) {
  return apiRequest<RegistrationWithEvent>(`/registrations/${registrationId}`, {
    query: { code },
  });
}

export function cancelRegistration(registrationId: string, code: string) {
  return apiRequest<{ registrationId: string; status: string }>(`/registrations/${registrationId}`, {
    method: "DELETE",
    query: { code },
  });
}

export function listRegistrationsForEvent(token: string, eventId: string) {
  return apiRequest<Paginated<RegistrationSummary>>(`/admin/events/${eventId}/registrations`, {
    token,
  });
}

export function adminCancelRegistration(token: string, registrationId: string) {
  return apiRequest<{ registrationId: string; status: string }>(
    `/admin/registrations/${registrationId}`,
    { method: "DELETE", token },
  );
}
