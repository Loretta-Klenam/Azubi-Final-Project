import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ZodError } from 'zod';
import * as eventsService from '../services/eventsService.js';
import { ok, errorResponse } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export async function handleEvents(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { httpMethod, pathParameters, body } = event;
  const id = pathParameters?.id;

  try {
    if (httpMethod === 'GET' && !id) {
      return ok(await eventsService.listEvents());
    }
    if (httpMethod === 'GET' && id) {
      return ok(await eventsService.getEvent(id));
    }
    if (httpMethod === 'POST') {
      const created = await eventsService.createEvent(JSON.parse(body ?? '{}'));
      return ok(created, 201);
    }
    if (httpMethod === 'PUT' && id) {
      return ok(await eventsService.updateEvent(id, JSON.parse(body ?? '{}')));
    }
    if (httpMethod === 'DELETE' && id) {
      await eventsService.deleteEvent(id);
      return ok({ message: 'Event deleted' });
    }
    return errorResponse(405, 'Method not allowed');
  } catch (err) {
    if (err instanceof ZodError) return errorResponse(400, err.errors.map((e) => e.message).join('; '));
    const e = err as { status?: number; message?: string };
    if (e.status === 404) return errorResponse(404, e.message ?? 'Not found');
    if (e.status === 409) return errorResponse(409, e.message ?? 'Conflict');
    logger.error('events handler error', err);
    return errorResponse(500, 'Internal server error');
  }
}
