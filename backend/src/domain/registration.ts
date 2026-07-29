import { z } from 'zod';

export const CreateRegistrationSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
});

export const RegistrationSchema = CreateRegistrationSchema.extend({
  id: z.string(),
  ticketCode: z.string(),
  status: z.enum(['confirmed', 'cancelled']).default('confirmed'),
  createdAt: z.string(),
});

export type CreateRegistrationInput = z.infer<typeof CreateRegistrationSchema>;
export type Registration = z.infer<typeof RegistrationSchema>;
