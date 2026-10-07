/**
 * Run with: npx tsx src/lib/pack-document.test.ts
 */
import assert from "node:assert/strict";
import { blankAction, commit, current, historyFrom, insertTree, loadDocument, redo, saveDocument, undo, validateDocument, type PackDocument } from "./pack-document";

const sample: PackDocument = {
  dependencies: [{ packId: "c", version: "1.0.0" }],
  commands: [{ name: "go", triggers: ["/go"], parameters: ["topic"], events: [{ id: "e1", name: "go", actions: [
    blankAction("send_message"),
    blankAction("send_media"),
    blankAction("reply_message"),
    blankAction("react_message"),
    blankAction("delete_message"),
    blankAction("group_participants"),
    blankAction("group_setting"),
    blankAction("group_update"),
    blankAction("get_group"),
    blankAction("set_variable"),
    blankAction("get_asset"),
    blankAction("get_user"),
    blankAction("get_type"),
    blankAction("wait"),
    blankAction("if"),
    blankAction("repeat"),
    blankAction("break"),
    blankAction("continue"),
    blankAction("call_function"),
    blankAction("return"),
    { type: "future_action", note: "keep" },
  ] }] }],
  functions: [{ id: "fn", name: "ping", kind: "action", exposed: false, parameters: [{ name: "n", type: "number" }], actions: [] }],
  assets: [{ id: "a1", name: "logo", type: "image", url: "https://example.com/a.png" }],
  variables: [{ name: "score", scope: "chat", type: "number", group: "Game", default: 0, expose: true }],
};
sample.commands[0]!.events[0]!.actions[0]!.text = "hi";
const raw = saveDocument(sample);
assert.equal(saveDocument(loadDocument(raw)), raw);
assert.equal(raw.includes("future_action"), true);
assert.equal(raw.includes("quoted") || raw.includes("user.id"), true);

let history = historyFrom(sample);
const added = loadDocument(history.present);
added.commands[0]!.events[0]!.actions.push({ type: "send_message", text: "added" });
history = commit(history, added);
const edited = current(history);
edited.commands[0]!.events[0]!.actions[0]!.text = "edited";
history = commit(history, edited);
const moved = current(history);
const actions = moved.commands[0]!.events[0]!.actions;
const first = actions.shift()!;
actions.push(first);
history = commit(history, moved);
const deleted = current(history);
deleted.commands[0]!.events[0]!.actions.pop();
history = commit(history, deleted);
history = undo(history);
assert.equal(current(history).commands[0]!.events[0]!.actions.at(-1)?.text, "edited");
history = undo(history);
history = undo(history);
history = undo(history);
assert.equal(saveDocument(current(history)), raw);
history = redo(history);
assert.notEqual(saveDocument(current(history)), raw);

const tree = insertTree(sample, [
  { slug: "quiz", functions: [{ name: "double", kind: "value", exposed: true }, { name: "hidden", kind: "value", exposed: false }, { name: "go", kind: "action", exposed: true }] },
]);
assert.equal(tree.some((item) => item.callee === "quiz.double"), true);
assert.equal(tree.some((item) => item.callee === "quiz.hidden"), false);
assert.equal(tree.some((item) => item.label === "quiz.go"), false);

const issues = validateDocument({
  ...sample,
  commands: [{ name: "bad", triggers: [""], events: [{ id: "e", name: "bad", actions: [{ type: "call_function", function: "missing.fn" }] }] }],
  functions: [{ id: "v", name: "pure", kind: "value", actions: [{ type: "send_message", text: "no" }] }],
}, []);
assert.equal(issues.some((item) => item.includes("empty trigger")), true);
assert.equal(issues.some((item) => item.includes("no dependency")), true);
assert.equal(issues.some((item) => item.includes("cannot use send_message")), true);
console.log("pack document tests passed");
