import * as registrationsRepo from '../repositories/registrationsRepo.js';
import * as eventsRepo from '../repositories/eventsRepo.js';
import { CreateRegistrationSchema } from '../domain/registration.js';
import type { Registration } from '../domain/registration.js';
import { NotFoundError, ConflictError } from '../domain/errors.js';

export async function registerForEvent(input: unknown): Promise<Registration> {
  const validated = CreateRegistrationSchema.parse(input);

  const event = await eventsRepo.getEvent(validated.eventId);
  if (!event) throw new NotFoundError(`Event not found: ${validated.eventId}`);
  if (event.status === 'cancelled') throw new ConflictError('Event is cancelled');
  if (event.status === 'full' || event.registered >= event.capacity) {
    throw new ConflictError('Event is at full capacity');
  }

  const duplicate = await registrationsRepo.findDuplicate(validated.email, validated.eventId);
  if (duplicate) throw new ConflictError('This email is already registered for the event');

  const now = new Date().toISOString();
  const ticketSuffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  const registration = await registrationsRepo.createRegistration({
    ...validated,
    id: crypto.randomUUID(),
    ticketCode: `TKT-${ticketSuffix}`,
    status: 'confirmed',
    createdAt: now,
  });

  await eventsRepo.incrementRegistered(validated.eventId);

  return registration;
}

export async function listRegistrations(eventId: string): Promise<Registration[]> {
  const event = await eventsRepo.getEvent(eventId);
  if (!event) throw new NotFoundError(`Event not found: ${eventId}`);
  return registrationsRepo.listRegistrationsByEvent(eventId);
}
