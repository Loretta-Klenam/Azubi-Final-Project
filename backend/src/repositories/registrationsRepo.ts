import { PutCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoDBClient } from './dynamodb.js';
import type { Registration, CreateRegistrationInput } from '../domain/registration.js';

const TABLE = () => process.env.REGISTRATIONS_TABLE ?? 'registrations';

export async function createRegistration(
  input: CreateRegistrationInput & { id: string; ticketCode: string; status: 'confirmed' | 'cancelled'; createdAt: string },
): Promise<Registration> {
  await getDynamoDBClient().send(new PutCommand({ TableName: TABLE(), Item: input }));
  return input as Registration;
}

export async function listRegistrationsByEvent(eventId: string): Promise<Registration[]> {
  const result = await getDynamoDBClient().send(
    new QueryCommand({
      TableName: TABLE(),
      IndexName: 'eventId-index',
      KeyConditionExpression: 'eventId = :eid',
      ExpressionAttributeValues: { ':eid': eventId },
    }),
  );
  return (result.Items ?? []) as Registration[];
}

export async function findDuplicate(email: string, eventId: string): Promise<Registration | null> {
  const result = await getDynamoDBClient().send(
    new QueryCommand({
      TableName: TABLE(),
      IndexName: 'eventId-index',
      KeyConditionExpression: 'eventId = :eid',
      FilterExpression: 'email = :email',
      ExpressionAttributeValues: { ':eid': eventId, ':email': email },
    }),
  );
  const items = result.Items ?? [];
  return items.length > 0 ? (items[0] as Registration) : null;
}

export async function getRegistration(id: string): Promise<Registration | null> {
  const result = await getDynamoDBClient().send(
    new GetCommand({ TableName: TABLE(), Key: { id } }),
  );
  return result.Item ? (result.Item as Registration) : null;
}
