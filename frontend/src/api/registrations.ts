import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from './client';

export interface Registration {
  id: string;
  eventId: string;
  name: string;
  email: string;
  phone?: string;
  ticketCode: string;
  status: 'confirmed' | 'cancelled';
  createdAt: string;
}

export interface CreateRegistrationInput {
  name: string;
  email: string;
  phone?: string;
}

export const useRegistrations = (eventId: string) =>
  useQuery({
    queryKey: ['registrations', eventId],
    queryFn: () => apiGet<Registration[]>(`/events/${eventId}/registrations`),
  });

export const useRegisterForEvent = (eventId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRegistrationInput) =>
      apiPost<Registration>(`/events/${eventId}/registrations`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registrations', eventId] });
      qc.invalidateQueries({ queryKey: ['events', eventId] });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });
};
