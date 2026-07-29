import * as eventsRepo from '../repositories/eventsRepo.js';
import { CreateEventSchema, UpdateEventSchema } from '../domain/event.js';
import type { CreateEventInput, UpdateEventInput, Event } from '../domain/event.js';
import { NotFoundError } from '../domain/errors.js';

function newId(): string {
  return crypto.randomUUID();
}

export async function createEvent(input: unknown): Promise<Event> {
  const validated = CreateEventSchema.parse(input) as CreateEventInput;
  const now = new Date().toISOString();
  return eventsRepo.createEvent({
    ...validated,
    id: newId(),
    registered: 0,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
}

export async function listEvents(): Promise<Event[]> {
  const events = await eventsRepo.listEvents();
  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export async function getEvent(id: string): Promise<Event> {
  const event = await eventsRepo.getEvent(id);
  if (!event) throw new NotFoundError(`Event not found: ${id}`);
  return event;
}

export async function updateEvent(id: string, input: unknown): Promise<Event> {
  const existing = await eventsRepo.getEvent(id);
  if (!existing) throw new NotFoundError(`Event not found: ${id}`);
  const validated = UpdateEventSchema.parse(input) as UpdateEventInput;
  return eventsRepo.putEvent({ ...existing, ...validated, id, updatedAt: new Date().toISOString() });
}

export async function deleteEvent(id: string): Promise<void> {
  const existing = await eventsRepo.getEvent(id);
  if (!existing) throw new NotFoundError(`Event not found: ${id}`);
  await eventsRepo.deleteEvent(id);
}
