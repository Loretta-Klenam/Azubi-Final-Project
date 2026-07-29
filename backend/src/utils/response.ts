import type { APIGatewayProxyResult } from 'aws-lambda';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

export function ok<T>(data: T, statusCode = 200): APIGatewayProxyResult {
  return { statusCode, headers: CORS, body: JSON.stringify(data) };
}

export function errorResponse(statusCode: number, message: string): APIGatewayProxyResult {
  return { statusCode, headers: CORS, body: JSON.stringify({ error: message }) };
}

export function corsPreflightResponse(): APIGatewayProxyResult {
  return { statusCode: 204, headers: CORS, body: '' };
}
