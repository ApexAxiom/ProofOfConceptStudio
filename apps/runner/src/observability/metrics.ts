type MetricUnit =
  | "Seconds"
  | "Microseconds"
  | "Milliseconds"
  | "Bytes"
  | "Kilobytes"
  | "Megabytes"
  | "Gigabytes"
  | "Terabytes"
  | "Bits"
  | "Kilobits"
  | "Megabits"
  | "Gigabits"
  | "Terabits"
  | "Percent"
  | "Count"
  | "Bytes/Second"
  | "Kilobytes/Second"
  | "Megabytes/Second"
  | "Gigabytes/Second"
  | "Terabytes/Second"
  | "Bits/Second"
  | "Kilobits/Second"
  | "Megabits/Second"
  | "Gigabits/Second"
  | "Terabits/Second"
  | "Count/Second"
  | "None";

interface MetricDatum {
  name: string;
  value: number;
  unit?: MetricUnit;
}

interface EmitRunnerMetricsParams {
  dimensions: Record<string, string>;
  metrics: MetricDatum[];
  properties?: Record<string, unknown>;
}

const DEFAULT_NAMESPACE = "POCStudio/Runner";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function emitRunnerMetrics(params: EmitRunnerMetricsParams): void {
  const metricDefs = params.metrics
    .filter((metric) => isFiniteNumber(metric.value))
    .map((metric) => ({
      Name: metric.name,
      Unit: metric.unit ?? "Count"
    }));

  if (metricDefs.length === 0) return;

  const dimensionKeys = Object.keys(params.dimensions);
  if (dimensionKeys.length === 0) return;

  const payload: Record<string, unknown> = {
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [
        {
          Namespace: process.env.RUNNER_METRIC_NAMESPACE ?? DEFAULT_NAMESPACE,
          Dimensions: [dimensionKeys],
          Metrics: metricDefs
        }
      ]
    },
    ...params.dimensions,
    ...(params.properties ?? {})
  };

  for (const metric of params.metrics) {
    if (!isFiniteNumber(metric.value)) continue;
    payload[metric.name] = metric.value;
  }

  console.log(JSON.stringify(payload));
}
