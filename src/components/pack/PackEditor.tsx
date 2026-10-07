"use client";

import { useMemo, useState } from "react";
import { ErrorNote } from "../config/ui";
import { ActionRows, InsertSheet } from "./EventSheet";
import {
  blankAction,
  commit,
  conditionTemplate,
  current,
  historyFrom,
  redo,
  saveDocument,
  undo,
  validateDocument,
  type History,
  type InsertItem,
  type PackDocument,
} from "../../lib/pack-document";
import { publishPack, saveDraft, updatePack, type PackSummary } from "../../lib/packs";

export function PackEditor({
  pack,
  dependencies,
}: {
  pack: PackSummary;
  dependencies: { slug: string; functions: { name: string; kind?: string; exposed?: boolean }[] }[];
}) {
  const initial = (pack.definition ?? { dependencies: [], commands: [], functions: [], assets: [], variables: [] }) as PackDocument;
  const [history, setHistory] = useState<History>(() => historyFrom(initial));
  const [tab, setTab] = useState<"commands" | "functions" | "variables" | "assets">("commands");
  const [insertAt, setInsertAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [visibility, setVisibility] = useState(pack.visibility);
  const doc = current(history);
  const issues = useMemo(() => validateDocument(doc, dependencies), [history, dependencies]);

  function update(next: PackDocument) {
    setHistory(commit(history, next));
  }

  function onPick(item: InsertItem) {
    if (!insertAt) return;
    const next = structuredClone(doc);
    if (item.type === "trigger") {
      const command = next.commands[Number(insertAt)];
      if (command) command.triggers.push("/");
    } else if (item.type === "call") {
      const target = targetList(next, insertAt);
      target?.push({ type: "call_function", function: item.callee ?? "" });
    } else if (item.id === "is-admin") {
      const template = conditionTemplate("is-admin");
      if (!("trigger" in template)) targetList(next, insertAt)?.push(template);
    } else {
      targetList(next, insertAt)?.push(blankAction(item.type));
    }
    update(next);
    setInsertAt(null);
  }

  async function onSave() {
    setError("");
    try {
      await saveDraft(pack.id, doc);
      setSaved("Saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  async function onPublish() {
    setError("");
    try {
      await saveDraft(pack.id, doc);
      await publishPack(pack.id, version);
      setSaved(`Published ${version}`);
      setVersion(bump(version));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish");
    }
  }

  return (
    <div className="space-y-3">
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {issues.length ? <ErrorNote>{issues[0]}</ErrorNote> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="min-h-11 rounded-lg border border-white/10 px-3 text-sm text-white" onClick={() => setHistory(undo(history))}>Undo</button>
        <button type="button" className="min-h-11 rounded-lg border border-white/10 px-3 text-sm text-white" onClick={() => setHistory(redo(history))}>Redo</button>
        <button type="button" className="min-h-11 rounded-lg bg-primary px-3 text-sm font-semibold text-white" onClick={() => void onSave()}>Save draft</button>
        <input value={version} onChange={(event) => setVersion(event.target.value)} className="min-h-11 w-28 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white" />
        <button type="button" className="min-h-11 rounded-lg border border-white/10 px-3 text-sm text-white" onClick={() => setVersion(bump(version))}>Bump</button>
        <select value={visibility} onChange={(event) => { setVisibility(event.target.value); void updatePack(pack.id, { visibility: event.target.value }); }} className="min-h-11 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white">
          <option value="private">Private</option>
          <option value="unlisted">Unlisted</option>
          <option value="public">Public</option>
        </select>
        <button type="button" className="min-h-11 rounded-lg border border-white/10 px-3 text-sm text-white" onClick={() => void onPublish()}>Publish</button>
        {saved ? <span className="self-center text-xs text-muted-foreground">{saved}</span> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {(["commands", "functions", "variables", "assets"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} className={`min-h-11 rounded-lg px-3 text-sm ${tab === item ? "bg-white/10 text-white" : "text-muted-foreground"}`}>{item}</button>
        ))}
      </div>
      {tab === "commands" ? (
        <>
          <button type="button" className="min-h-11 rounded-lg border border-white/10 px-3 text-sm text-white" onClick={() => { const next = structuredClone(doc); next.commands.push({ name: "command", triggers: ["/"], parameters: [], events: [{ id: `e${next.commands.length + 1}`, name: "command", actions: [] }] }); update(next); }}>Add command</button>
          {doc.commands.length === 0 ? <p className="text-sm text-muted-foreground">No commands yet.</p> : null}
          {doc.commands.map((command, index) => (
        <section key={`${command.name}-${index}`} className="rounded-2xl border border-white/10 p-3">
          <input value={command.name} onChange={(event) => { const next = structuredClone(doc); next.commands[index]!.name = event.target.value; update(next); }} className="min-h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white" />
          <input value={command.triggers.join(", ")} onChange={(event) => { const next = structuredClone(doc); next.commands[index]!.triggers = event.target.value.split(",").map((item) => item.trim()); update(next); }} placeholder="Triggers, comma separated" className="mt-2 min-h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white" />
          <input value={(command.parameters ?? []).join(", ")} onChange={(event) => { const next = structuredClone(doc); next.commands[index]!.parameters = event.target.value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 5); update(next); }} placeholder="Parameter names, max 5" className="mt-2 min-h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white" />
          {command.events.map((event, eventIndex) => (
            <div key={event.id} className="mt-3">
              <ActionRows actions={event.actions} onChange={(actions) => { const next = structuredClone(doc); next.commands[index]!.events[eventIndex]!.actions = actions; update(next); }} />
            </div>
          ))}
          <button type="button" className="mt-2 min-h-11 rounded-lg border border-white/10 px-3 text-sm text-white" onClick={() => setInsertAt(String(index))}>Insert</button>
        </section>
          ))}
        </>
      ) : null}
      {tab === "functions" ? (
        <>
          <button type="button" className="min-h-11 rounded-lg border border-white/10 px-3 text-sm text-white" onClick={() => { const next = structuredClone(doc); next.functions.push({ id: `fn${next.functions.length + 1}`, name: "function", kind: "action", exposed: false, parameters: [], actions: [] }); update(next); }}>Add function</button>
          {doc.functions.length === 0 ? <p className="text-sm text-muted-foreground">No functions yet.</p> : null}
          {doc.functions.map((fn, index) => (
        <section key={fn.id} className="rounded-2xl border border-white/10 p-3">
          <input value={fn.name} onChange={(event) => { const next = structuredClone(doc); next.functions[index]!.name = event.target.value; update(next); }} className="min-h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white" />
          <select value={fn.kind ?? "action"} onChange={(event) => { const next = structuredClone(doc); next.functions[index]!.kind = event.target.value as "action" | "value"; update(next); }} className="mt-2 min-h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white">
            <option value="action">Action</option>
            <option value="value">Value</option>
          </select>
          <label className="mt-2 flex min-h-11 items-center gap-2 text-sm text-white">
            <input type="checkbox" checked={Boolean(fn.exposed)} onChange={(event) => { const next = structuredClone(doc); next.functions[index]!.exposed = event.target.checked; update(next); }} />
            Exposed
          </label>
          {(fn.parameters ?? []).map((parameter, parameterIndex) => (
            <div key={`${parameter.name}-${parameterIndex}`} className="mt-2 grid gap-2 sm:grid-cols-2">
              <input value={parameter.name} onChange={(event) => { const next = structuredClone(doc); next.functions[index]!.parameters![parameterIndex]!.name = event.target.value; update(next); }} className="min-h-11 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white" />
              <input value={parameter.type} onChange={(event) => { const next = structuredClone(doc); next.functions[index]!.parameters![parameterIndex]!.type = event.target.value; update(next); }} className="min-h-11 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white" />
            </div>
          ))}
          <button type="button" className="mt-2 min-h-11 rounded-lg border border-white/10 px-3 text-sm text-white" onClick={() => { const next = structuredClone(doc); next.functions[index]!.parameters = [...(fn.parameters ?? []), { name: "value", type: "string" }]; update(next); }}>Add parameter</button>
          <div className="mt-3"><ActionRows actions={fn.actions} onChange={(actions) => { const next = structuredClone(doc); next.functions[index]!.actions = actions; update(next); }} /></div>
          <button type="button" className="mt-2 min-h-11 rounded-lg border border-white/10 px-3 text-sm text-white" onClick={() => setInsertAt(`fn:${index}`)}>Insert</button>
        </section>
          ))}
        </>
      ) : null}
      {tab === "variables" ? (
        <>
          <button type="button" className="min-h-11 rounded-lg border border-white/10 px-3 text-sm text-white" onClick={() => { const next = structuredClone(doc); next.variables.push({ name: "score", scope: "chat", type: "number", group: "", default: 0, expose: false }); update(next); }}>Add variable</button>
          {doc.variables.length === 0 ? <p className="text-sm text-muted-foreground">No variables yet.</p> : null}
          {doc.variables.map((variable, index) => (
            <section key={`${variable.name}-${index}`} className="grid gap-2 rounded-2xl border border-white/10 p-3 sm:grid-cols-2">
              <input value={variable.name} onChange={(event) => { const next = structuredClone(doc); next.variables[index]!.name = event.target.value; update(next); }} className="min-h-11 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white" />
              <input value={variable.group ?? ""} onChange={(event) => { const next = structuredClone(doc); next.variables[index]!.group = event.target.value; update(next); }} placeholder="Group" className="min-h-11 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white" />
              <select value={variable.scope} onChange={(event) => { const next = structuredClone(doc); next.variables[index]!.scope = event.target.value; update(next); }} className="min-h-11 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white">
                {["chat", "user", "global", "session"].map((scope) => <option key={scope}>{scope}</option>)}
              </select>
              <select value={variable.type} onChange={(event) => { const next = structuredClone(doc); next.variables[index]!.type = event.target.value; update(next); }} className="min-h-11 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white">
                {["string", "number", "boolean", "array", "object"].map((type) => <option key={type}>{type}</option>)}
              </select>
            </section>
          ))}
        </>
      ) : null}
      {tab === "assets" ? (
        <>
          <button type="button" className="min-h-11 rounded-lg border border-white/10 px-3 text-sm text-white" onClick={() => { const next = structuredClone(doc); next.assets.push({ id: `asset${next.assets.length + 1}`, name: "asset", type: "text", data: "" }); update(next); }}>Add asset</button>
          {doc.assets.length === 0 ? <p className="text-sm text-muted-foreground">No assets yet.</p> : null}
          {doc.assets.map((asset, index) => (
            <section key={asset.id} className="grid gap-2 rounded-2xl border border-white/10 p-3">
              <input value={asset.name} onChange={(event) => { const next = structuredClone(doc); next.assets[index]!.name = event.target.value; update(next); }} className="min-h-11 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white" />
              <select value={asset.type} onChange={(event) => { const next = structuredClone(doc); next.assets[index]!.type = event.target.value; update(next); }} className="min-h-11 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white">
                {["text", "json", "image", "file"].map((type) => <option key={type}>{type}</option>)}
              </select>
              <input value={String(asset.data ?? asset.url ?? "")} onChange={(event) => { const next = structuredClone(doc); if (asset.type === "image" || asset.type === "file") next.assets[index]!.url = event.target.value; else next.assets[index]!.data = event.target.value; update(next); }} placeholder={asset.type === "image" || asset.type === "file" ? "https://..." : "Asset body"} className="min-h-11 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white" />
            </section>
          ))}
        </>
      ) : null}
      <p className="text-xs text-muted-foreground">Quoted paths: message.quotedMessageId, message.quotedUserId, message.quotedText</p>
      {insertAt ? <InsertSheet doc={doc} dependencies={dependencies} onClose={() => setInsertAt(null)} onPick={onPick} /> : null}
      <pre className="hidden">{saveDocument(doc)}</pre>
    </div>
  );
}

function bump(version: string) {
  const [major, minor, patch] = version.split(".").map(Number);
  if (![major, minor, patch].every(Number.isFinite)) return "1.0.0";
  return `${major}.${minor}.${patch + 1}`;
}

function targetList(doc: PackDocument, at: string) {
  if (at.startsWith("fn:")) return doc.functions[Number(at.slice(3))]?.actions;
  const command = doc.commands[Number(at)];
  if (!command.events[0]) command.events.push({ id: "e1", name: command.name, actions: [] });
  return command.events[0]?.actions;
}
