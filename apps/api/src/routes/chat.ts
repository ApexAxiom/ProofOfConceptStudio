import { FastifyPluginAsync } from "fastify";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import client from "../db/dynamo.js";
import { BriefPost } from "@proof/shared";
import { OpenAI } from "openai";

const tableName = process.env.DDB_TABLE_NAME ?? "CMHub";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_MODEL || "gpt-5.2";

const chatRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/", async (request, reply) => {
    const { question, region, portfolio } = request.body as any;
    if (!region || !portfolio || !question) {
      reply.code(400).send({ error: "question, region, and portfolio are required" });
      return;
    }
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
    const filtered = posts.filter((p) => p.portfolio === portfolio && p.status === "published");
    const recent = filtered.slice(0, 10);
    const allowedSources = new Set(recent.flatMap((p) => p.sources || []));
    const context = recent
      .map((p) => `${p.title}\n${p.bodyMarkdown}\nSources: ${(p.sources || []).join(", ")}`)
      .join("\n\n---\n\n");

    const prompt = `You are a procurement assistant. Use the following briefs to answer in Markdown with bullet points and short paragraphs. Every factual statement must include a citation using only the provided URLs. Do not emit HTML. If you lack a citation, state that the information is unavailable. Do not output any URL that is not in Allowed URLs. If you are unsure, do not cite it.\n\nAllowed URLs:\n${Array.from(allowedSources).join("\n")}\n\nBriefs:\n${context}\n\nQuestion: ${question}`;
    const response = await openai.responses.create({ model, input: prompt });
    const answer = response.output_text || "";
    const urlRegex = /https?:\/\/[^\s)]+/g;
    const found = new Set(answer.match(urlRegex) ?? []);
    const disallowed = [...found].filter((u) => !allowedSources.has(u));
    const hasAllowed = [...found].some((u) => allowedSources.has(u));

    if (!hasAllowed) {
      return { answer: `[Unverified] Unable to include required citations from provided sources.` };
    }
    if (disallowed.length > 0) {
      return {
        answer: `[Unverified] Answer contained non-allowed URLs and was blocked. Please rephrase, or ask for info covered by the available briefs.`
      };
    }

    return { answer };
  });
};

export default chatRoutes;
