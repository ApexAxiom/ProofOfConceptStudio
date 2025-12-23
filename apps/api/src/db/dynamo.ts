import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

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

const client = DynamoDBDocumentClient.from(dynamoClient);

export default client;
