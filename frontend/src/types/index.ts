export type EventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED";
export type RegistrationStatus = "CONFIRMED" | "CANCELLED";

export interface EventItem {
  eventId: string;
  title: string;
  description: string;
  venue: string;
  startDateTime: string;
  endDateTime: string;
  capacity: number;
  registeredCount: number;
  status: EventStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface RegistrationSummary {
  registrationId: string;
  eventId: string;
  attendeeName: string;
  attendeeEmail: string;
  confirmationCode?: string;
  status: RegistrationStatus;
  registeredAt: string;
  cancelledAt?: string | null;
  ticketQrUrl?: string | null;
}

export interface RegistrationWithEvent extends RegistrationSummary {
  event: {
    title?: string;
    venue?: string;
    startDateTime?: string;
    endDateTime?: string;
  };
}

export interface ApiErrorDetail {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  errorCode: string;
  message: string;
  details?: ApiErrorDetail[];
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}
