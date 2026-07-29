import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

let client: DynamoDBDocumentClient | undefined;

export function getDynamoDBClient(): DynamoDBDocumentClient {
  if (client) return client;

  const base = new DynamoDBClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
    ...(process.env.DYNAMODB_ENDPOINT
      ? { endpoint: process.env.DYNAMODB_ENDPOINT }
      : {}),
  });

  client = DynamoDBDocumentClient.from(base, {
    marshallOptions: { removeUndefinedValues: true },
  });

  return client;
}
