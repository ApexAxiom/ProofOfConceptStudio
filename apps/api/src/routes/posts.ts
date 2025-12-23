import { FastifyPluginAsync } from "fastify";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import client from "../db/dynamo.js";
import { BriefPost, REGION_LIST } from "@proof/shared";

const tableName = process.env.DDB_TABLE_NAME ?? "CMHub";

const postsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (request, reply) => {
    const { region, portfolio, runWindow, limit } = request.query as Record<string, string>;
    const validRegions = new Set(REGION_LIST.map((r) => r.slug));
    if (!region || !validRegions.has(region)) {
      reply.code(400).send({ error: "region is required and must be a valid RegionSlug" });
      return;
    }
    const params: any = {
      TableName: tableName,
      IndexName: "GSI2", // region-date
      KeyConditionExpression: "GSI2PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `REGION#${region}`
      },
      ScanIndexForward: false,
      Limit: limit ? Number(limit) : 20
    };
    const data = await client.send(new QueryCommand(params));
    const items = (data.Items ?? []) as BriefPost[];
    return items.filter(
      (i) =>
        i.status === "published" &&
        (!portfolio || i.portfolio === portfolio) &&
        (!runWindow || i.runWindow === runWindow)
    );
  });

  fastify.get("/latest", async (request, reply) => {
    const { region } = request.query as Record<string, string>;
    const validRegions = new Set(REGION_LIST.map((r) => r.slug));
    if (!region || !validRegions.has(region)) {
      reply.code(400).send({ error: "region is required and must be a valid RegionSlug" });
      return;
    }
    const params: any = {
      TableName: tableName,
      IndexName: "GSI2", // region-date
      KeyConditionExpression: "GSI2PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `REGION#${region}`
      },
      ScanIndexForward: false,
      Limit: 30
    };
    const data = await client.send(new QueryCommand(params));
    return ((data.Items ?? []) as BriefPost[]).filter((i) => i.status === "published");
  });

  fastify.get<{ Params: { postId: string } }>("/:postId", async (request) => {
    const { postId } = request.params;
    const params: any = {
      TableName: tableName,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `POST#${postId}`
      },
      ScanIndexForward: false,
      Limit: 1
    };
    const data = await client.send(new QueryCommand(params));
    return (data.Items?.[0] as BriefPost) || null;
  });
};

export default postsRoutes;
