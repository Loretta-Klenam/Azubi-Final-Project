import {
  PutCommand,
  GetCommand,
  DeleteCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { getDynamoDBClient } from './dynamodb.js';
import type { Event, CreateEventInput, UpdateEventInput } from '../domain/event.js';

const TABLE = () => process.env.EVENTS_TABLE ?? 'events';

export async function createEvent(input: CreateEventInput & { id: string; registered: number; status: 'active' | 'cancelled' | 'full'; createdAt: string; updatedAt: string }): Promise<Event> {
  await getDynamoDBClient().send(new PutCommand({ TableName: TABLE(), Item: input }));
  return input as Event;
}

export async function listEvents(): Promise<Event[]> {
  const result = await getDynamoDBClient().send(new ScanCommand({ TableName: TABLE() }));
  return (result.Items ?? []) as Event[];
}

export async function getEvent(id: string): Promise<Event | null> {
  const result = await getDynamoDBClient().send(
    new GetCommand({ TableName: TABLE(), Key: { id } }),
  );
  return result.Item ? (result.Item as Event) : null;
}

export async function putEvent(event: Event): Promise<Event> {
  await getDynamoDBClient().send(new PutCommand({ TableName: TABLE(), Item: event }));
  return event;
}

export async function deleteEvent(id: string): Promise<void> {
  await getDynamoDBClient().send(new DeleteCommand({ TableName: TABLE(), Key: { id } }));
}

export async function incrementRegistered(id: string): Promise<void> {
  await getDynamoDBClient().send(
    new UpdateCommand({
      TableName: TABLE(),
      Key: { id },
      UpdateExpression: 'SET registered = registered + :inc, updatedAt = :ts',
      ExpressionAttributeValues: { ':inc': 1, ':ts': new Date().toISOString() },
    }),
  );
}
