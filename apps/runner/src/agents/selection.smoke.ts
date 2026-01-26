import assert from "node:assert/strict";
import { selectAgentIdsForRun } from "./selection.js";

const agentIds = ["delta", "alpha", "charlie", "bravo", "echo"];

const allResult = selectAgentIdsForRun({ allAgentIds: agentIds });
assert.deepEqual(allResult.agentIds, ["alpha", "bravo", "charlie", "delta", "echo"]);

const batch0 = selectAgentIdsForRun({ allAgentIds: agentIds, batchIndex: 0, batchCount: 2 });
const batch1 = selectAgentIdsForRun({ allAgentIds: agentIds, batchIndex: 1, batchCount: 2 });
const union = new Set([...batch0.agentIds, ...batch1.agentIds]);
assert.equal(union.size, agentIds.length);
assert.deepEqual([...union].sort(), ["alpha", "bravo", "charlie", "delta", "echo"]);

const triBatches = [0, 1, 2].map((batchIndex) =>
  selectAgentIdsForRun({ allAgentIds: agentIds, batchIndex, batchCount: 3 }).agentIds
);
const triUnion = new Set(triBatches.flat());
assert.equal(triUnion.size, agentIds.length);
assert.deepEqual([...triUnion].sort(), ["alpha", "bravo", "charlie", "delta", "echo"]);

const stableBatch = selectAgentIdsForRun({ allAgentIds: agentIds, batchIndex: 0, batchCount: 3 });
const stableBatchRepeat = selectAgentIdsForRun({ allAgentIds: agentIds, batchIndex: 0, batchCount: 3 });
assert.deepEqual(stableBatch.agentIds, stableBatchRepeat.agentIds);

const batchCountChange = selectAgentIdsForRun({ allAgentIds: agentIds, batchIndex: 0, batchCount: 4 });
assert.notDeepEqual(stableBatch.agentIds, batchCountChange.agentIds);

console.log("selection.smoke passed");
