import assert from "node:assert/strict";
import { getBriefDayKey } from "@proof/shared";

const perthLate = new Date("2025-01-01T15:59:00Z"); // 23:59 AWST
const perthEarly = new Date("2025-01-01T16:01:00Z"); // 00:01 AWST next day

assert.equal(getBriefDayKey("au", perthLate), "2025-01-01");
assert.equal(getBriefDayKey("au", perthEarly), "2025-01-02");

const chicagoLate = new Date("2025-01-01T05:59:00Z"); // 23:59 CST previous day
const chicagoEarly = new Date("2025-01-01T06:01:00Z"); // 00:01 CST

assert.equal(getBriefDayKey("us-mx-la-lng", chicagoLate), "2024-12-31");
assert.equal(getBriefDayKey("us-mx-la-lng", chicagoEarly), "2025-01-01");

console.log("brief-day.smoke passed");
