import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const tableRegion = process.env.AWS_REGION ?? "us-east-1";
const endpoint = process.env.DDB_ENDPOINT;

const baseClient = new DynamoDBClient(
  endpoint
    ? {
        region: tableRegion,
        endpoint,
        credentials: { accessKeyId: "local", secretAccessKey: "local" }
      }
    : { region: tableRegion }
);

export const documentClient = DynamoDBDocumentClient.from(baseClient, {
  marshallOptions: {
    removeUndefinedValues: true
  }
});

export const tableName = process.env.DDB_TABLE_NAME ?? "CMHub";
