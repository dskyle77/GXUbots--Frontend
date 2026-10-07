"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  blankPack,
  clientId,
  MAX_COMMAND_PARAMS,
  newId,
  parameterTypes,
  parseConfig,
  serializeConfig,
  variableScopes,
  type EditorAsset,
  type EditorCommand,
  type EditorConfig,
  type EditorEvent,
  type EditorFunction,
  type EditorPack,
  type EditorVariable,
  type ParameterType,
} from "../../lib/config-editor";
import { saveDraft } from "../../lib/packs";
import { issuesByTab, validateConfig } from "../../lib/validate-config";
import { ActionList } from "./ActionList";
import {
  EditorConfigProvider,
  ExtraParamsProvider,
  paramDraftsFromCommand,
  paramDraftsFromFunction,
} from "./config-context";
import {
  ErrorNote,
  Eyebrow,
  Field,
  WarnList,
  IconButton,
  ItemCard,
  MenuSelect,
  SecondaryButton,
  SortableList,
  TextArea,
  TextInput,
  moveItem,
  patchAt,
  removeAt,
} from "./ui";

const sections = [
  "simple",
  "commands",
  "functions",
  "assets",
  "variables",
] as const;
type Section = (typeof sections)[number];

export function ConfigEditor({
  packId,
  initial,
  dependencies = [],
}: {
  packId: string;
  initial: EditorConfig;
  dependencies?: { packId: string; version: string }[];
}) {
  const [config, setConfig] = useState(initial);
  const [saved, setSaved] = useState(() =>
    JSON.stringify(serializeConfig(initial)),
  );
  const [section, setSection] = useState<Section>("simple");
  const [mode, setMode] = useState<"form" | "json">("form");
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const formSnapshot = useMemo(
    () => JSON.stringify(serializeConfig(config)),
    [config],
  );
  const dirty = useMemo(() => {
    if (mode !== "json") return formSnapshot !== saved;
    try {
      return jsonText !== JSON.stringify(JSON.parse(saved), null, 2);
    } catch {
      return true;
    }
  }, [mode, formSnapshot, saved, jsonText]);
  const issues = useMemo(() => validateConfig(config), [config]);
  const tabIssueCounts = useMemo(() => issuesByTab(issues), [issues]);

  useEffect(() => {
    function onLeave(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  async function onSave() {
    setError("");
    setSaving(true);
    try {
      const next =
        mode === "json"
          ? readJson(jsonText, config.name)
          : serializeConfig(config);
      if (mode === "json")
        setConfig(parseConfig(JSON.stringify(next), config.name));
      await saveDraft(packId, {
        dependencies,
        commands: next.packs[0]?.commands ?? [],
        functions: next.packs[0]?.functions ?? [],
        assets: next.packs[0]?.assets ?? [],
        variables: next.packs[0]?.variables ?? [],
      });
      const stored = JSON.stringify(next);
      setSaved(stored);
      if (mode === "json") setJsonText(JSON.stringify(next, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save config");
    } finally {
      setSaving(false);
    }
  }

  function showJson() {
    setJsonText(JSON.stringify(serializeConfig(config), null, 2));
    setMode("json");
    setError("");
  }

  function showForm() {
    try {
      const next = readJson(jsonText, config.name);
      setConfig(parseConfig(JSON.stringify(next), config.name));
      setMode("form");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "JSON could not be read");
    }
  }

  return (
    <EditorConfigProvider config={config}>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1 overflow-x-auto pb-0.5">
            {mode === "form" ? (
              sections.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setSection(item)}
                  className={`h-8 shrink-0 rounded-md px-2.5 text-xs capitalize ${
                    section === item
                      ? "bg-primary text-white"
                      : "border border-white/10 text-muted-foreground hover:bg-white/5"
                  }`}
                >
                  {item}
                  {tabIssueCounts[item] ? (
                    <span
                      className={`ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                        section === item ? "bg-white/20" : "bg-amber-500/25 text-amber-200"
                      }`}
                    >
                      {tabIssueCounts[item]}
                    </span>
                  ) : null}
                </button>
              ))
            ) : (
              <p className="text-xs text-muted-foreground self-center">JSON mode</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-white/10 p-0.5">
              <button
                type="button"
                onClick={() => (mode === "json" ? showForm() : undefined)}
                className={`h-7 rounded px-2.5 text-xs ${mode === "form" ? "bg-white/10 text-white" : "text-muted-foreground"}`}
              >
                Form
              </button>
              <button
                type="button"
                onClick={() => (mode === "form" ? showJson() : undefined)}
                className={`h-7 rounded px-2.5 text-xs ${mode === "json" ? "bg-white/10 text-white" : "text-muted-foreground"}`}
              >
                JSON
              </button>
            </div>
            <span className="text-sm text-muted-foreground">
              {dirty ? "Unsaved changes" : "Saved"}
            </span>
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={!dirty || saving}
              className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-3">
            <ErrorNote>{error}</ErrorNote>
          </div>
        ) : null}
        {mode === "form" ? (
          <div className="mt-3">
            <WarnList
              items={issues.filter((i) => i.tabId === section).map((i) => i.message)}
            />
          </div>
        ) : null}

        {mode === "json" ? (
          <div className="mt-4">
            <textarea
              value={jsonText}
              spellCheck={false}
              onChange={(event) => setJsonText(event.target.value)}
              className="min-h-[28rem] w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-xs text-white outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
          </div>
        ) : (
          <>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Field label="Config name">
                <TextInput
                  value={config.name}
                  onChange={(event) =>
                    setConfig({ ...config, name: event.target.value })
                  }
                />
              </Field>
              <Field label="Description">
                <TextInput
                  value={config.description}
                  onChange={(event) =>
                    setConfig({ ...config, description: event.target.value })
                  }
                />
              </Field>
            </div>

            <div className="mt-4">
              {section === "simple" ? (
                <SimpleConfig config={config} onChange={setConfig} />
              ) : null}
              {section === "commands" ? (
                <Commands config={config} onChange={setConfig} />
              ) : null}
              {section === "functions" ? (
                <Functions config={config} onChange={setConfig} />
              ) : null}
              {section === "assets" ? (
                <Assets config={config} onChange={setConfig} />
              ) : null}
              {section === "variables" ? (
                <Variables config={config} onChange={setConfig} />
              ) : null}
            </div>
          </>
        )}
      </div>
    </EditorConfigProvider>
  );
}

function readJson(text: string, fallbackName: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("JSON could not be read");
  }
  return serializeConfig(parseConfig(JSON.stringify(parsed), fallbackName));
}

function SimpleConfig({
  config,
  onChange,
}: {
  config: EditorConfig;
  onChange: (config: EditorConfig) => void;
}) {
  type Exposed = {
    packId: string;
    packName: string;
    varIndex: number;
    variable: EditorVariable;
  };
  const exposed: Exposed[] = [];
  for (const pack of config.packs) {
    pack.variables.forEach((variable, varIndex) => {
      if (variable.expose) {
        exposed.push({
          packId: pack.id,
          packName: pack.name,
          varIndex,
          variable,
        });
      }
    });
  }

  const byGroup = new Map<string, Exposed[]>();
  for (const row of exposed) {
    const label = row.variable.group.trim() || row.packName || "General";
    const list = byGroup.get(label) ?? [];
    list.push(row);
    byGroup.set(label, list);
  }

  function updateDefault(packId: string, varIndex: number, defaultValue: string) {
    onChange({
      ...config,
      packs: config.packs.map((pack) => {
        if (pack.id !== packId) return pack;
        return {
          ...pack,
          variables: patchAt(pack.variables, varIndex, { defaultValue }),
        };
      }),
    });
  }

  return (
    <SectionCard>
      <p className="text-sm text-muted-foreground">
        Settings marked exposed, grouped by pack / label.
      </p>
      {exposed.length === 0 ? (
        <p className="mt-4 text-sm text-white">
          Nothing is exposed yet. Open Variables and turn on Expose.
        </p>
      ) : (
        <div className="mt-5 space-y-6">
          {[...byGroup.entries()].map(([label, items]) => (
            <section key={label}>
              <h3 className="text-sm font-medium text-white">{label}</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {items.map((row) => (
                  <label key={row.variable.clientId} className="block">
                    <Eyebrow>
                      {row.variable.name || "Untitled"}
                      <span className="ml-1 font-normal text-white/40">
                        · {row.packName}
                      </span>
                    </Eyebrow>
                    <SimpleValue
                      variable={row.variable}
                      onChange={(defaultValue) =>
                        updateDefault(row.packId, row.varIndex, defaultValue)
                      }
                    />
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function SimpleValue({
  variable,
  onChange,
}: {
  variable: EditorVariable;
  onChange: (value: string) => void;
}) {
  if (variable.type === "boolean") {
    const on = variable.defaultValue === "true";
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={() => onChange(on ? "false" : "true")}
        className={`h-11 w-full rounded-lg border px-3 text-left text-sm ${
          on
            ? "border-primary/40 bg-primary/15 text-white"
            : "border-white/10 bg-black/20 text-muted-foreground"
        }`}
      >
        {on ? "On" : "Off"}
      </button>
    );
  }
  if (variable.type === "array" || variable.type === "object") {
    return (
      <TextArea
        value={variable.defaultValue}
        placeholder={variable.type === "array" ? "[]" : "{}"}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  return (
    <TextInput
      type={variable.type === "number" ? "number" : "text"}
      value={variable.defaultValue}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function Commands({
  config,
  onChange,
}: {
  config: EditorConfig;
  onChange: (config: EditorConfig) => void;
}) {
  const packs = [...config.packs].sort((a, b) => b.priority - a.priority);

  function updatePack(packClientId: string, patch: Partial<EditorPack>) {
    onChange({
      ...config,
      packs: config.packs.map((p) =>
        p.clientId === packClientId ? { ...p, ...patch } : p,
      ),
    });
  }

  function updateCommand(
    packClientId: string,
    cmdIndex: number,
    patch: Partial<EditorCommand>,
  ) {
    onChange({
      ...config,
      packs: config.packs.map((p) => {
        if (p.clientId !== packClientId) return p;
        return { ...p, commands: patchAt(p.commands, cmdIndex, patch) };
      }),
    });
  }

  return (
    <SectionCard>
      <p className="mb-3 text-[12px] text-muted-foreground">
        Commands are grouped by pack.{" "}
        <span className="text-white/70">Priority</span> decides which pack runs
        first when triggers are identical (higher first).{" "}
        Primary trigger plus up to {MAX_COMMAND_PARAMS} named params on one row;
        values are number if they parse, else string.
        Multiple events on one command all run; <span className="font-mono">return</span> only ends that event.
      </p>

      {packs.length === 0 ? (
        <p className="mb-3 text-sm text-muted-foreground">No packs yet.</p>
      ) : null}

      <div className="space-y-6">
        {packs.map((pack) => (
          <section
            key={pack.clientId}
            className="rounded-xl border border-white/10 bg-black/20 p-3"
          >
            <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-white/8 pb-3">
              <span className="rounded-md bg-primary/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                Pack
              </span>
              <TextInput
                value={pack.name}
                placeholder="Pack name"
                className="min-w-[10rem] flex-1 font-medium"
                onChange={(e) => updatePack(pack.clientId, { name: e.target.value })}
              />
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                Priority
                <TextInput
                  type="number"
                  value={String(pack.priority)}
                  className="w-16 font-mono"
                  onChange={(e) =>
                    updatePack(pack.clientId, {
                      priority: Number(e.target.value) || 0,
                    })
                  }
                />
              </label>
              <span className="font-mono text-[10px] text-white/30">{pack.id}</span>
              <button
                type="button"
                className="ml-auto text-xs text-white/45 hover:text-white"
                onClick={() =>
                  onChange({
                    ...config,
                    packs: config.packs.filter((p) => p.clientId !== pack.clientId),
                  })
                }
              >
                Remove pack
              </button>
            </div>

            <p className="mb-2 text-[11px] text-white/40">
              Commands in this pack
            </p>
            <div className="space-y-3">
              {pack.commands.map((command, index) => (
                <CommandCard
                  key={command.clientId}
                  command={command}
                  handle={<span className="text-white/25">⋮⋮</span>}
                  disableUp={index === 0}
                  disableDown={index === pack.commands.length - 1}
                  onChange={(patch) => updateCommand(pack.clientId, index, patch)}
                  onUp={() =>
                    updatePack(pack.clientId, {
                      commands: moveItem(pack.commands, index, -1),
                    })
                  }
                  onDown={() =>
                    updatePack(pack.clientId, {
                      commands: moveItem(pack.commands, index, 1),
                    })
                  }
                  onRemove={() =>
                    updatePack(pack.clientId, {
                      commands: removeAt(pack.commands, index),
                    })
                  }
                />
              ))}
            </div>
            <SecondaryButton
              className="mt-3"
              type="button"
              onClick={() =>
                updatePack(pack.clientId, {
                  commands: [
                    ...pack.commands,
                    {
                      clientId: clientId(),
                      name: "",
                      triggers: ["/"],
                      parameters: [],
                      events: [
                        {
                          clientId: clientId(),
                          id: newId("event"),
                          name: "main",
                          actions: [],
                        },
                      ],
                    },
                  ],
                })
              }
            >
              Add command
            </SecondaryButton>
          </section>
        ))}
      </div>

      <SecondaryButton
        className="mt-4"
        type="button"
        onClick={() =>
          onChange({
            ...config,
            packs: [
              ...config.packs,
              {
                ...blankPack(`Pack ${config.packs.length + 1}`),
                priority: config.packs.length,
              },
            ],
          })
        }
      >
        Add pack
      </SecondaryButton>
    </SectionCard>
  );
}

function CommandCard({
  command,
  handle,
  onChange,
  onUp,
  onDown,
  onRemove,
  disableUp,
  disableDown,
}: {
  command: EditorCommand;
  handle: ReactNode;
  onChange: (patch: Partial<EditorCommand>) => void;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  disableUp: boolean;
  disableDown: boolean;
}) {
  const isCatchAll =
    command.triggers.length === 0 ||
    command.triggers.every((t) => !t.trim() || t.trim() === "*");

  function updateEvent(ei: number, patch: Partial<EditorEvent>) {
    onChange({ events: patchAt(command.events, ei, patch) });
  }

  return (
    <article className="rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="flex items-start gap-2">
        {handle}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <TextInput
              value={command.triggers[0] ?? ""}
              placeholder="/trigger"
              spellCheck={false}
              className="w-[7.5rem] shrink-0 font-mono text-sm"
              aria-label="Primary trigger"
              onChange={(event) => {
                const primary = event.target.value;
                const rest = command.triggers.slice(1);
                onChange({
                  triggers: primary.trim() ? [primary, ...rest] : rest,
                });
              }}
            />
            {Array.from({ length: MAX_COMMAND_PARAMS }, (_, i) => (
              <TextInput
                key={i}
                value={command.parameters[i] ?? ""}
                placeholder={`param${i + 1}`}
                spellCheck={false}
                className="w-[5.5rem] shrink-0 font-mono text-sm"
                aria-label={`Parameter ${i + 1}`}
                onChange={(event) => {
                  const next = [...command.parameters];
                  while (next.length < MAX_COMMAND_PARAMS) next.push("");
                  next[i] = event.target.value;
                  // Keep trailing empties trimmed so stored list stays compact
                  while (next.length > 0 && !next[next.length - 1]!.trim()) {
                    next.pop();
                  }
                  onChange({ parameters: next.slice(0, MAX_COMMAND_PARAMS) });
                }}
              />
            ))}
            <TextInput
              value={command.name}
              placeholder="name"
              className="w-28 sm:w-36"
              onChange={(event) => onChange({ name: event.target.value })}
            />
            <div className="ml-auto flex items-center gap-1">
              <IconButton type="button" label="Move up" disabled={disableUp} onClick={onUp}>
                ↑
              </IconButton>
              <IconButton type="button" label="Move down" disabled={disableDown} onClick={onDown}>
                ↓
              </IconButton>
              <IconButton type="button" label="Remove" onClick={onRemove}>
                ×
              </IconButton>
            </div>
          </div>
          {isCatchAll ? (
            <p className="text-[11px] text-white/45">
              Catch-all: runs only when no other command matched.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Aliases</span>
            {command.triggers.slice(1).map((t, ti) => (
              <span
                key={`${t}-${ti}`}
                className="inline-flex items-center gap-1 rounded-md bg-white/8 px-1.5 py-0.5 font-mono text-[11px]"
              >
                {t}
                <button
                  type="button"
                  className="text-white/50 hover:text-white"
                  onClick={() => {
                    const triggers = command.triggers.filter((_, i) => i !== ti + 1);
                    onChange({ triggers });
                  }}
                >
                  ×
                </button>
              </span>
            ))}
            <button
              type="button"
              className="text-[11px] font-medium text-primary hover:text-primary/80"
              onClick={() => {
                const next = window.prompt("Extra trigger (alias)", "/");
                if (next == null) return;
                const t = next.trim();
                if (!t) return;
                if (command.triggers.includes(t)) return;
                onChange({ triggers: [...command.triggers, t] });
              }}
            >
              + trigger
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2 border-t border-white/6 pt-3">
        <div className="flex items-center justify-between">
          <Eyebrow>Events ({command.events.length})</Eyebrow>
          <button
            type="button"
            className="text-[11px] font-medium text-primary hover:text-primary/80"
            onClick={() =>
              onChange({
                events: [
                  ...command.events,
                  {
                    clientId: clientId(),
                    id: newId("event"),
                    name: `event ${command.events.length + 1}`,
                    actions: [],
                  },
                ],
              })
            }
          >
            Add event
          </button>
        </div>
        {command.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events yet.</p>
        ) : (
          command.events.map((event, ei) => (
            <details
              key={event.clientId}
              className="group rounded-lg border border-white/8 bg-black/20 open:bg-black/30"
              open={ei === 0}
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2">
                <span className="text-white/40 transition-transform group-open:rotate-90">▸</span>
                <TextInput
                  value={event.name}
                  placeholder="Event name"
                  className="min-w-0 flex-1"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateEvent(ei, { name: e.target.value })}
                />
                <span className="hidden font-mono text-[10px] text-white/35 sm:inline">
                  {event.id}
                </span>
                <button
                  type="button"
                  className="text-xs text-white/45 hover:text-white"
                  onClick={(e) => {
                    e.preventDefault();
                    onChange({ events: removeAt(command.events, ei) });
                  }}
                >
                  Remove
                </button>
              </summary>
              <div className="border-t border-white/6 px-2.5 pb-2.5 pt-2">
                <ExtraParamsProvider extraParams={paramDraftsFromCommand(command)}>
                  <ActionList
                    actions={event.actions}
                    onChange={(actions) => updateEvent(ei, { actions })}
                  />
                </ExtraParamsProvider>
              </div>
            </details>
          ))
        )}
      </div>
    </article>
  );
}

function Functions({
  config,
  onChange,
}: {
  config: EditorConfig;
  onChange: (config: EditorConfig) => void;
}) {
  function updatePack(packClientId: string, patch: Partial<EditorPack>) {
    onChange({
      ...config,
      packs: config.packs.map((p) =>
        p.clientId === packClientId ? { ...p, ...patch } : p,
      ),
    });
  }

  if (config.packs.length === 0) {
    return (
      <SectionCard>
        <p className="text-sm text-muted-foreground">Add a pack first (Commands tab).</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <p className="mb-3 text-[12px] text-muted-foreground">
        Functions are grouped by pack. Cross-pack call_function works at runtime.
      </p>
      <div className="space-y-6">
        {config.packs.map((pack) => (
          <section key={pack.clientId} className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-md bg-primary/20 px-2 py-0.5 text-[11px] font-semibold uppercase text-primary">
                Pack
              </span>
              <span className="font-medium text-white">{pack.name || pack.id}</span>
            </div>
            <SortableList
              items={pack.functions}
              onChange={(functions) => updatePack(pack.clientId, { functions })}
              renderItem={(fn, index, handle) => (
                <ItemCard
                  handle={handle}
                  title={fn.name}
                  titlePlaceholder="Function name"
                  onTitleChange={(name) =>
                    updatePack(pack.clientId, {
                      functions: patchAt(pack.functions, index, { name }),
                    })
                  }
                  onUp={() =>
                    updatePack(pack.clientId, {
                      functions: moveItem(pack.functions, index, -1),
                    })
                  }
                  onDown={() =>
                    updatePack(pack.clientId, {
                      functions: moveItem(pack.functions, index, 1),
                    })
                  }
                  onRemove={() =>
                    updatePack(pack.clientId, {
                      functions: removeAt(pack.functions, index),
                    })
                  }
                  disableUp={index === 0}
                  disableDown={index === pack.functions.length - 1}
                >
                  <Field label="Kind">
                    <MenuSelect
                      size="sm"
                      ariaLabel="Function kind"
                      value={fn.kind}
                      onChange={(kind) =>
                        updatePack(pack.clientId, {
                          functions: patchAt(pack.functions, index, { kind: kind as "action" | "value" }),
                        })
                      }
                      options={[{ value: "action", label: "Action" }, { value: "value", label: "Value" }]}
                    />
                  </Field>
                  <label className="mt-2 flex items-center gap-2 text-xs text-white">
                    <input
                      type="checkbox"
                      checked={fn.exposed}
                      onChange={(event) =>
                        updatePack(pack.clientId, {
                          functions: patchAt(pack.functions, index, { exposed: event.target.checked }),
                        })
                      }
                    />
                    Exposed to other packs
                  </label>
                  <ExtraParamsProvider extraParams={paramDraftsFromFunction(fn)}>
                    <ActionList
                      actions={fn.actions}
                      onChange={(actions) =>
                        updatePack(pack.clientId, {
                          functions: patchAt(pack.functions, index, { actions }),
                        })
                      }
                    />
                  </ExtraParamsProvider>
                </ItemCard>
              )}
            />
            <SecondaryButton
              className="mt-3"
              type="button"
              onClick={() =>
                updatePack(pack.clientId, {
                  functions: [
                    ...pack.functions,
                    {
                      clientId: clientId(),
                      id: newId("fn"),
                      name: "",
                      kind: "action",
                      exposed: false,
                      parameters: [],
                      actions: [],
                    },
                  ],
                })
              }
            >
              Add function
            </SecondaryButton>
          </section>
        ))}
      </div>
    </SectionCard>
  );
}

function Assets({
  config,
  onChange,
}: {
  config: EditorConfig;
  onChange: (config: EditorConfig) => void;
}) {
  function updatePack(packClientId: string, patch: Partial<EditorPack>) {
    onChange({
      ...config,
      packs: config.packs.map((p) =>
        p.clientId === packClientId ? { ...p, ...patch } : p,
      ),
    });
  }

  if (config.packs.length === 0) {
    return (
      <SectionCard>
        <p className="text-sm text-muted-foreground">Add a pack first (Commands tab).</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <div className="space-y-6">
        {config.packs.map((pack) => (
          <section key={pack.clientId} className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-md bg-primary/20 px-2 py-0.5 text-[11px] font-semibold uppercase text-primary">
                Pack
              </span>
              <span className="font-medium text-white">{pack.name || pack.id}</span>
            </div>
            <SortableList
              items={pack.assets}
              onChange={(assets) => updatePack(pack.clientId, { assets })}
              renderItem={(asset, index, handle) => (
                <ItemCard
                  handle={handle}
                  title={asset.name}
                  titlePlaceholder="Asset name"
                  onTitleChange={(name) =>
                    updatePack(pack.clientId, {
                      assets: patchAt(pack.assets, index, { name }),
                    })
                  }
                  onUp={() =>
                    updatePack(pack.clientId, {
                      assets: moveItem(pack.assets, index, -1),
                    })
                  }
                  onDown={() =>
                    updatePack(pack.clientId, {
                      assets: moveItem(pack.assets, index, 1),
                    })
                  }
                  onRemove={() =>
                    updatePack(pack.clientId, {
                      assets: removeAt(pack.assets, index),
                    })
                  }
                  disableUp={index === 0}
                  disableDown={index === pack.assets.length - 1}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <Eyebrow>Type</Eyebrow>
                      <MenuSelect
                        ariaLabel="Asset type"
                        value={asset.type}
                        onChange={(type) =>
                          updatePack(pack.clientId, {
                            assets: patchAt(pack.assets, index, {
                              type: type as EditorAsset["type"],
                            }),
                          })
                        }
                        options={[
                          { value: "json", label: "json" },
                          { value: "text", label: "text" },
                          { value: "image", label: "image" },
                          { value: "file", label: "file" },
                        ]}
                      />
                    </label>
                    <label className="block">
                      <Eyebrow>Id</Eyebrow>
                      <span className="font-mono text-sm text-muted-foreground">
                        {asset.id || "—"}
                      </span>
                    </label>
                  </div>
                  {asset.type === "json" || asset.type === "text" ? (
                    <TextArea
                      className="mt-2 font-mono text-sm"
                      value={asset.data}
                      onChange={(e) =>
                        updatePack(pack.clientId, {
                          assets: patchAt(pack.assets, index, {
                            data: e.target.value,
                          }),
                        })
                      }
                    />
                  ) : (
                    <TextInput
                      className="mt-2"
                      value={asset.url}
                      placeholder="https://…"
                      onChange={(e) =>
                        updatePack(pack.clientId, {
                          assets: patchAt(pack.assets, index, {
                            url: e.target.value,
                          }),
                        })
                      }
                    />
                  )}
                </ItemCard>
              )}
            />
            <SecondaryButton
              className="mt-3"
              type="button"
              onClick={() =>
                updatePack(pack.clientId, {
                  assets: [
                    ...pack.assets,
                    {
                      clientId: clientId(),
                      id: newId("asset"),
                      name: "",
                      type: "text",
                      data: "",
                      url: "",
                    },
                  ],
                })
              }
            >
              Add asset
            </SecondaryButton>
          </section>
        ))}
      </div>
    </SectionCard>
  );
}

function Variables({
  config,
  onChange,
}: {
  config: EditorConfig;
  onChange: (config: EditorConfig) => void;
}) {
  function updatePack(packClientId: string, patch: Partial<EditorPack>) {
    onChange({
      ...config,
      packs: config.packs.map((p) =>
        p.clientId === packClientId ? { ...p, ...patch } : p,
      ),
    });
  }

  if (config.packs.length === 0) {
    return (
      <SectionCard>
        <p className="text-sm text-muted-foreground">Add a pack first (Commands tab).</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <div className="space-y-6">
        {config.packs.map((pack) => (
          <section key={pack.clientId} className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-md bg-primary/20 px-2 py-0.5 text-[11px] font-semibold uppercase text-primary">
                Pack
              </span>
              <span className="font-medium text-white">{pack.name || pack.id}</span>
            </div>
            <SortableList
              items={pack.variables}
              onChange={(variables) => updatePack(pack.clientId, { variables })}
              renderItem={(variable, index, handle) => (
                <div className="space-y-2 rounded-lg border border-white/8 bg-black/25 p-2">
                  <div className="flex items-center gap-2">
                    {handle}
                    <TextInput
                      value={variable.name}
                      placeholder="name"
                      className="flex-1 font-mono"
                      onChange={(e) =>
                        updatePack(pack.clientId, {
                          variables: patchAt(pack.variables, index, {
                            name: e.target.value,
                          }),
                        })
                      }
                    />
                    <MenuSelect
                      ariaLabel="Scope"
                      value={variable.scope}
                      onChange={(scope) =>
                        updatePack(pack.clientId, {
                          variables: patchAt(pack.variables, index, {
                            scope: scope as EditorVariable["scope"],
                          }),
                        })
                      }
                      options={variableScopes.map((s) => ({ value: s, label: s }))}
                    />
                    <MenuSelect
                      ariaLabel="Type"
                      value={variable.type}
                      onChange={(type) =>
                        updatePack(pack.clientId, {
                          variables: patchAt(pack.variables, index, {
                            type: type as ParameterType,
                          }),
                        })
                      }
                      options={parameterTypes.map((s) => ({ value: s, label: s }))}
                    />
                    <IconButton
                      label="Remove"
                      onClick={() =>
                        updatePack(pack.clientId, {
                          variables: removeAt(pack.variables, index),
                        })
                      }
                    >
                      ×
                    </IconButton>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <TextInput
                      value={variable.defaultValue}
                      placeholder="default"
                      className="flex-1"
                      onChange={(e) =>
                        updatePack(pack.clientId, {
                          variables: patchAt(pack.variables, index, {
                            defaultValue: e.target.value,
                          }),
                        })
                      }
                    />
                    <TextInput
                      value={variable.group}
                      placeholder="group label"
                      className="w-36"
                      onChange={(e) =>
                        updatePack(pack.clientId, {
                          variables: patchAt(pack.variables, index, {
                            group: e.target.value,
                          }),
                        })
                      }
                    />
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={variable.expose}
                        onChange={(e) =>
                          updatePack(pack.clientId, {
                            variables: patchAt(pack.variables, index, {
                              expose: e.target.checked,
                            }),
                          })
                        }
                      />
                      Expose
                    </label>
                  </div>
                </div>
              )}
            />
            <SecondaryButton
              className="mt-3"
              type="button"
              onClick={() =>
                updatePack(pack.clientId, {
                  variables: [
                    ...pack.variables,
                    {
                      clientId: clientId(),
                      name: "",
                      scope: "chat",
                      type: "string",
                      defaultValue: "",
                      group: "",
                      expose: false,
                    },
                  ],
                })
              }
            >
              Add variable
            </SecondaryButton>
          </section>
        ))}
      </div>
    </SectionCard>
  );
}

function SectionCard({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-card p-5">
      {children}
    </section>
  );
}
