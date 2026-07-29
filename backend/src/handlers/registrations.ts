import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ZodError } from 'zod';
import * as registrationsService from '../services/registrationsService.js';
import { ok, errorResponse } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export async function handleRegistrations(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const { httpMethod, pathParameters, body } = event;
  const eventId = pathParameters?.eventId ?? pathParameters?.id;

  try {
    if (httpMethod === 'POST' && eventId) {
      const input = { ...JSON.parse(body ?? '{}'), eventId };
      return ok(await registrationsService.registerForEvent(input), 201);
    }
    if (httpMethod === 'GET' && eventId) {
      return ok(await registrationsService.listRegistrations(eventId));
    }
    return errorResponse(405, 'Method not allowed');
  } catch (err) {
    if (err instanceof ZodError) return errorResponse(400, err.errors.map((e) => e.message).join('; '));
    const e = err as { status?: number; message?: string };
    if (e.status === 404) return errorResponse(404, e.message ?? 'Not found');
    if (e.status === 409) return errorResponse(409, e.message ?? 'Conflict');
    logger.error('registrations handler error', err);
    return errorResponse(500, 'Internal server error');
  }
}
