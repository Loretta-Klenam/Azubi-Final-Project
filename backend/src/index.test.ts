import { describe, expect, it } from 'vitest';
import { createHealthResponse, eventSchema } from './index.js';

describe('health endpoint', () => {
  it('returns a healthy response', () => {
    const response = createHealthResponse();
    expect(response.status).toBe('ok');
    expect(response.service).toBe('event-ticketing-api');
  });
});

describe('event schema', () => {
  it('validates a valid event', () => {
    const event = eventSchema.parse({
      id: 'evt-1',
      title: 'Launch Event',
      date: '2026-10-10',
      capacity: 100,
      registered: 10,
    });

    expect(event.capacity).toBe(100);
  });
});
