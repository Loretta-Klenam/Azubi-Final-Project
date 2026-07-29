import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handleEvents } from './handlers/events.js';
import { handleRegistrations } from './handlers/registrations.js';
import { handleHealth } from './handlers/health.js';
import { corsPreflightResponse, errorResponse } from './utils/response.js';
import { logger } from './utils/logger.js';

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  logger.info('Request', {
    method: event.httpMethod,
    resource: event.resource,
    path: event.path,
  });

  if (event.httpMethod === 'OPTIONS') return corsPreflightResponse();

  const { resource } = event;

  try {
    if (resource === '/health') return handleHealth(event);
    if (
      resource === '/events' ||
      resource === '/events/{id}'
    ) {
      return handleEvents(event);
    }
    if (resource === '/events/{id}/registrations') return handleRegistrations(event);
    return errorResponse(404, 'Route not found');
  } catch (err) {
    logger.error('Unhandled error', err);
    return errorResponse(500, 'Internal server error');
  }
};
