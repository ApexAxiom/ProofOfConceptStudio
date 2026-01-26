export interface BatchSelectionInput {
  agentIds?: string[];
  batchIndex?: number;
  batchCount?: number;
  allAgentIds: string[];
}

export interface BatchSelectionResult {
  agentIds: string[];
  mode: "explicit" | "batch" | "all";
  batchIndex?: number;
  batchCount?: number;
}

/**
 * Selects a deterministic agent subset based on explicit IDs or batch parameters.
 */
export function selectAgentIdsForRun(input: BatchSelectionInput): BatchSelectionResult {
  const explicit = (input.agentIds ?? []).filter((id) => typeof id === "string" && id.length > 0);
  if (explicit.length > 0) {
    const deduped = Array.from(new Set(explicit));
    return { agentIds: deduped, mode: "explicit" };
  }

  const sorted = [...new Set(input.allAgentIds)].sort((a, b) => a.localeCompare(b));
  const hasBatch =
    Number.isInteger(input.batchIndex) &&
    Number.isInteger(input.batchCount) &&
    typeof input.batchIndex === "number" &&
    typeof input.batchCount === "number";

  if (!hasBatch) {
    return { agentIds: sorted, mode: "all" };
  }

  const batchCount = Math.max(1, input.batchCount ?? 1);
  const batchIndex = Math.max(0, input.batchIndex ?? 0);

  if (batchIndex >= batchCount) {
    return { agentIds: sorted, mode: "all" };
  }

  const selected = sorted.filter((_, index) => index % batchCount === batchIndex);
  return { agentIds: selected, mode: "batch", batchIndex, batchCount };
}
