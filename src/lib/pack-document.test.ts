/**
 * Run with: npx tsx src/lib/pack-document.test.ts
 */
import assert from "node:assert/strict";
import {
  blankAction,
  commit,
  current,
  historyFrom,
  insertTree,
  loadDocument,
  redo,
  saveDocument,
  undo,
  validateDocument,
  type PackDocument,
} from "./pack-document";

const sample: PackDocument = {
  dependencies: [{ packId: "c", version: "1.0.0" }],
  events: [
    {
      event: "message",
      phase: "handlers",
      handlers: [
        {
          id: "h1",
          name: "go",
          filter: { kind: "command", triggers: ["/go"], parameters: ["topic"] },
          actions: [blankAction("send_message"), blankAction("call_function")],
        },
      ],
    },
  ],
  functions: [{ id: "f1", name: "score", kind: "value", actions: [] }],
  assets: [],
  variables: [],
};

assert.equal(loadDocument(saveDocument(sample)).events[0]?.handlers[0]?.name, "go");
const h = historyFrom(sample);
const h2 = commit(h, { ...sample, functions: [...sample.functions, { id: "f2", name: "x", actions: [] }] });
assert.ok(h2.past.length === 1);
assert.equal(current(undo(h2)).functions.length, 1);
assert.equal(current(redo(undo(h2))).functions.length, 2);
assert.ok(insertTree(sample, []).length > 0);
const issues = validateDocument(sample, []);
assert.ok(Array.isArray(issues));
console.log("pack-document tests passed");
