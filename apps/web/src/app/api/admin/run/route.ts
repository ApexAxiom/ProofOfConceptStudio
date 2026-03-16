import { NextResponse } from "next/server";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { RegionSlug, getAdminToken, runWindowForRegion } from "@proof/shared";
import { initializeSecrets } from "../../../../lib/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let cachedLambdaClient: LambdaClient | null = null;

function getLambdaClient() {
  if (!cachedLambdaClient) {
    cachedLambdaClient = new LambdaClient({
      region: process.env.AWS_LAMBDA_REGION ?? process.env.AWS_REGION ?? "us-east-1"
    });
  }
  return cachedLambdaClient;
}

function normalizeRegion(value: unknown): RegionSlug | undefined {
  return value === "au" || value === "us-mx-la-lng" ? value : undefined;
}

function buildBatchInvocations(params: {
  regions: RegionSlug[];
  body: Record<string, unknown>;
  defaultBatchCount: number;
}) {
  const explicitAgentIds = Array.isArray(params.body.agentIds)
    ? params.body.agentIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  const batchIndex = Number.isInteger(params.body.batchIndex) ? Number(params.body.batchIndex) : undefined;
  const batchCount = Number.isInteger(params.body.batchCount) ? Number(params.body.batchCount) : undefined;

  if (explicitAgentIds.length > 0 || (batchIndex !== undefined && batchCount !== undefined)) {
    return params.regions.map((region) => ({
      action: "cron",
      region,
      runWindow: params.body.runWindow ?? runWindowForRegion(region),
      agentIds: explicitAgentIds.length > 0 ? explicitAgentIds : undefined,
      batchIndex,
      batchCount,
      dryRun: params.body.dryRun === true,
      force: params.body.force === true,
      scheduled: params.body.scheduled === true,
      runDate: typeof params.body.runDate === "string" ? params.body.runDate : undefined
    }));
  }

  const batchTotal = Math.max(1, params.defaultBatchCount);
  return params.regions.flatMap((region) =>
    Array.from({ length: batchTotal }, (_, index) => ({
      action: "cron",
      region,
      runWindow: params.body.runWindow ?? runWindowForRegion(region),
      batchIndex: index,
      batchCount: batchTotal,
      dryRun: params.body.dryRun === true,
      force: params.body.force === true,
      scheduled: params.body.scheduled === true,
      runDate: typeof params.body.runDate === "string" ? params.body.runDate : undefined
    }))
  );
}

export async function POST(request: Request) {
  await initializeSecrets();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const adminToken = typeof body.adminToken === "string" ? body.adminToken.trim() : "";
  if (!adminToken || adminToken !== getAdminToken()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const functionName = process.env.RUNNER_LAMBDA_FUNCTION_NAME?.trim();
  if (!functionName) {
    return NextResponse.json(
      { error: "runner lambda is not configured", expectedEnv: "RUNNER_LAMBDA_FUNCTION_NAME" },
      { status: 503 }
    );
  }

  const lambda = getLambdaClient();
  const region = normalizeRegion(body.region);
  const regions =
    (Array.isArray(body.regions) ? body.regions.map(normalizeRegion).filter((value): value is RegionSlug => Boolean(value)) : []) ||
    [];
  const targetRegions = regions.length > 0 ? regions : [region ?? "us-mx-la-lng"];

  if (typeof body.agentId === "string" && body.agentId.trim()) {
    const targetRegion = region ?? targetRegions[0] ?? "us-mx-la-lng";
    const payload = {
      action: "run-agent",
      agentId: body.agentId.trim(),
      region: targetRegion,
      runWindow: body.runWindow ?? runWindowForRegion(targetRegion),
      dryRun: body.dryRun === true,
      runDate: typeof body.runDate === "string" ? body.runDate : undefined
    };
    await lambda.send(
      new InvokeCommand({
        FunctionName: functionName,
        InvocationType: "Event",
        Payload: new TextEncoder().encode(JSON.stringify(payload))
      })
    );
    return NextResponse.json({
      ok: true,
      accepted: true,
      mode: "run-agent",
      functionName,
      payload
    });
  }

  const defaultBatchCountRaw = Number(process.env.RUNNER_DEFAULT_BATCH_COUNT ?? 5);
  const defaultBatchCount =
    Number.isFinite(defaultBatchCountRaw) && defaultBatchCountRaw > 0 ? Math.floor(defaultBatchCountRaw) : 5;
  const invocations = buildBatchInvocations({
    regions: targetRegions,
    body,
    defaultBatchCount
  });

  await Promise.all(
    invocations.map((payload) =>
      lambda.send(
        new InvokeCommand({
          FunctionName: functionName,
          InvocationType: "Event",
          Payload: new TextEncoder().encode(JSON.stringify(payload))
        })
      )
    )
  );

  return NextResponse.json({
    ok: true,
    accepted: true,
    mode: "cron",
    functionName,
    invocationCount: invocations.length,
    invocations
  });
}
