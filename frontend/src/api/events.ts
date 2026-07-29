import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from './client';

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  capacity: number;
  registered: number;
  status: 'active' | 'cancelled' | 'full';
  organizerName: string;
  organizerEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventInput {
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  capacity: number;
  organizerName: string;
  organizerEmail: string;
}

export const useEvents = () =>
  useQuery({ queryKey: ['events'], queryFn: () => apiGet<Event[]>('/events') });

export const useEvent = (id: string) =>
  useQuery({ queryKey: ['events', id], queryFn: () => apiGet<Event>(`/events/${id}`) });

export const useCreateEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEventInput) => apiPost<Event>('/events', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
};

export const useUpdateEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<CreateEventInput> & { id: string }) =>
      apiPut<Event>(`/events/${id}`, input),
    onSuccess: (_data, { id }) =>
      qc.invalidateQueries({ queryKey: ['events', id] }).then(() =>
        qc.invalidateQueries({ queryKey: ['events'] }),
      ),
  });
};

export const useDeleteEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ message: string }>(`/events/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
};
