/**
 * Run with: npx tsx src/lib/pack-settings.test.ts
 */
import assert from "node:assert/strict";
import { groupExposed, updateAvailable } from "./pack-settings";

const groups = groupExposed([
  { name: "score", scope: "chat", type: "number", group: "Game", default: 0 },
  { name: "title", scope: "chat", type: "string", group: "", default: "" },
  { name: "lives", scope: "chat", type: "number", group: "Game", default: 3 },
]);
assert.equal(groups[0]?.label, "Game");
assert.deepEqual(groups[0]?.fields.map((field) => field.name), ["score", "lives"]);
assert.equal(groups[1]?.label, "Settings");
assert.equal(updateAvailable("1.0.0", "1.1.0"), true);
assert.equal(updateAvailable("1.1.0", "1.1.0"), false);
assert.equal(updateAvailable("draft", "1.0.0"), true);
assert.equal(updateAvailable("draft", null), true);
console.log("pack settings tests passed");
