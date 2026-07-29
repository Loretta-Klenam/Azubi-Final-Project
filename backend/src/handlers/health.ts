import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ok } from '../utils/response.js';

export function handleHealth(_event: APIGatewayProxyEvent): APIGatewayProxyResult {
  return ok({
    status: 'ok',
    service: 'event-ticketing-api',
    timestamp: new Date().toISOString(),
    environment: process.env.ENVIRONMENT ?? 'dev',
  });
}
