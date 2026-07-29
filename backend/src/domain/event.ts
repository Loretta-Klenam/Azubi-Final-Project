import { z } from 'zod';

export const CreateEventSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM'),
  location: z.string().min(3, 'Location is required'),
  capacity: z.number().int().positive('Capacity must be a positive integer'),
  organizerName: z.string().min(2, 'Organizer name is required'),
  organizerEmail: z.string().email('Valid organizer email required'),
});

export const UpdateEventSchema = CreateEventSchema.partial();

export const EventSchema = CreateEventSchema.extend({
  id: z.string(),
  registered: z.number().int().nonnegative().default(0),
  status: z.enum(['active', 'cancelled', 'full']).default('active'),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CreateEventInput = z.infer<typeof CreateEventSchema>;
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;
export type Event = z.infer<typeof EventSchema>;
