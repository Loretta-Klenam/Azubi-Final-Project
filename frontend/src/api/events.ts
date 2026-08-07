import { apiRequest } from "./client";
import type { EventItem, Paginated } from "../types";

export function listPublicEvents() {
  return apiRequest<Paginated<EventItem>>("/events");
}

export function getPublicEvent(eventId: string) {
  return apiRequest<EventItem>(`/events/${eventId}`);
}

export function listAdminEvents(token: string, status?: string) {
  return apiRequest<Paginated<EventItem>>("/admin/events", { token, query: { status } });
}

export function getAdminEvent(token: string, eventId: string) {
  return apiRequest<EventItem>(`/admin/events/${eventId}`, { token });
}

export interface EventFormInput {
  title: string;
  description: string;
  venue: string;
  startDateTime: string;
  endDateTime: string;
  capacity: number;
  status: string;
}

export function createEvent(token: string, input: EventFormInput) {
  return apiRequest<EventItem>("/admin/events", { method: "POST", token, body: input });
}

export function updateEvent(token: string, eventId: string, input: Partial<EventFormInput>) {
  return apiRequest<EventItem>(`/admin/events/${eventId}`, { method: "PUT", token, body: input });
}

export function deleteEvent(token: string, eventId: string) {
  return apiRequest<{ eventId: string; deleted: boolean }>(`/admin/events/${eventId}`, {
    method: "DELETE",
    token,
  });
}
