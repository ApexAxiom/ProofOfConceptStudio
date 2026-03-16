import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { initializeSecrets } from "../secrets";

let cachedClient: DynamoDBDocumentClient | null = null;

function createClient() {
  const region = process.env.AWS_REGION ?? "us-east-1";
  const endpoint = process.env.DDB_ENDPOINT;
  const dynamoClient = new DynamoDBClient(
    endpoint
      ? {
          region,
          endpoint,
          credentials: {
            accessKeyId: "local",
            secretAccessKey: "local"
          }
        }
      : { region }
  );

  return DynamoDBDocumentClient.from(dynamoClient);
}

export async function getDynamoDocumentClient(): Promise<DynamoDBDocumentClient> {
  await initializeSecrets();
  if (!cachedClient) {
    cachedClient = createClient();
  }
  return cachedClient;
}

export async function getDynamoTableName(): Promise<string> {
  await initializeSecrets();
  return process.env.DDB_TABLE_NAME ?? "CMHub";
}
