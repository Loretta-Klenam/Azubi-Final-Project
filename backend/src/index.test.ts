import { describe, expect, it } from 'vitest';
import { CreateEventSchema } from './domain/event.js';
import { CreateRegistrationSchema } from './domain/registration.js';

describe('CreateEventSchema', () => {
  const valid = {
    title: 'Tech Summit 2026',
    description: 'Annual tech conference in Accra',
    date: '2026-10-15',
    time: '09:00',
    location: 'Accra, Ghana',
    capacity: 200,
    organizerName: 'Azubi Africa',
    organizerEmail: 'hello@azubi.com',
  };

  it('accepts a valid event', () => {
    expect(CreateEventSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a short title', () => {
    expect(CreateEventSchema.safeParse({ ...valid, title: 'AB' }).success).toBe(false);
  });

  it('rejects a bad date format', () => {
    expect(CreateEventSchema.safeParse({ ...valid, date: '15-10-2026' }).success).toBe(false);
  });

  it('rejects zero capacity', () => {
    expect(CreateEventSchema.safeParse({ ...valid, capacity: 0 }).success).toBe(false);
  });

  it('rejects a bad organizer email', () => {
    expect(
      CreateEventSchema.safeParse({ ...valid, organizerEmail: 'not-an-email' }).success,
    ).toBe(false);
  });
});

describe('CreateRegistrationSchema', () => {
  const valid = { eventId: 'evt-1', name: 'Kofi Mensah', email: 'kofi@example.com' };

  it('accepts a valid registration', () => {
    expect(CreateRegistrationSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts an optional phone number', () => {
    expect(
      CreateRegistrationSchema.safeParse({ ...valid, phone: '+233200000000' }).success,
    ).toBe(true);
  });

  it('rejects an invalid email', () => {
    expect(
      CreateRegistrationSchema.safeParse({ ...valid, email: 'not-an-email' }).success,
    ).toBe(false);
  });

  it('rejects a missing event ID', () => {
    expect(
      CreateRegistrationSchema.safeParse({ name: 'Kofi', email: 'kofi@example.com' }).success,
    ).toBe(false);
  });
});
