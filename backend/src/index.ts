import { z } from 'zod';

export const eventSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),
  capacity: z.number().int().positive(),
  registered: z.number().int().nonnegative().default(0),
});

export type Event = z.infer<typeof eventSchema>;

export function createHealthResponse() {
  return {
    status: 'ok',
    service: 'event-ticketing-api',
    timestamp: new Date().toISOString(),
  };
}
