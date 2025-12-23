import { FastifyPluginAsync } from "fastify";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import client from "../db/dynamo.js";
import { BriefPost } from "@proof/shared";
import { OpenAI } from "openai";

const tableName = process.env.DDB_TABLE_NAME ?? "CMHub";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_MODEL || "gpt-5.2";

const chatRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/", async (request) => {
    const { question, region, portfolio } = request.body as any;
    const params: any = {
      TableName: tableName,
      IndexName: "GSI2",
      KeyConditionExpression: "GSI2PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `REGION#${region}`
      },
      ScanIndexForward: false,
      Limit: 30
    };
    const data = await client.send(new QueryCommand(params));
    const posts = (data.Items ?? []) as BriefPost[];
    const filtered = posts.filter((p) => p.portfolio === portfolio);
    const context = filtered
      .map((p) => `${p.title}\n${p.bodyMarkdown}\nSources: ${p.sources?.join(",")}`)
      .join("\n\n---\n\n");

    const prompt = `You are a procurement assistant. Use the following briefs to answer with citations. Every factual statement must reference a URL from the briefs.\n\nBriefs:\n${context}\n\nQuestion: ${question}`;
    const response = await openai.responses.create({ model, input: prompt });
    return { answer: response.output_text };
  });
};

export default chatRoutes;
