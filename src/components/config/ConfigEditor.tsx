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
import { publishPack, saveDraft, updatePack } from "../../lib/packs";
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
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { toast } from "../ui/toast";

const sections = [
  "simple",
  "commands",
  "functions",
  "assets",
  "variables",
] as const;
type Section = (typeof sections)[number];

function bumpVersion(version: string) {
  const parts = version.split(".").map((p) => Number(p));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return "1.0.0";
  parts[2] = (parts[2] ?? 0) + 1;
  return parts.join(".");
}

export function ConfigEditor({
  packId,
  initial,
  dependencies = [],
  initialVisibility = "private",
}: {
  packId: string;
  initial: EditorConfig;
  dependencies?: { packId: string; version: string }[];
  initialVisibility?: string;
}) {
  const [config, setConfig] = useState(initial);
  const [saved, setSaved] = useState(() =>
    JSON.stringify(serializeConfig(initial)),
  );
  const [section, setSection] = useState<Section>("simple");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [mode, setMode] = useState<"form" | "json">("form");
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishVersion, setPublishVersion] = useState("1.0.0");
  const [visibility, setVisibility] = useState(initialVisibility);
  const [publishing, setPublishing] = useState(false);
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
      toast.success("Draft saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save config");
    } finally {
      setSaving(false);
    }
  }

  async function onPublish() {
    setError("");
    setPublishing(true);
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
      await updatePack(packId, { visibility, name: config.name });
      await publishPack(packId, publishVersion.trim());
      const stored = JSON.stringify(next);
      setSaved(stored);
      setPublishOpen(false);
      setPublishVersion(bumpVersion(publishVersion.trim()));
      toast.success(`Published ${publishVersion.trim()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish");
    } finally {
      setPublishing(false);
    }
  }

  function goToSection(next: Section) {
    setSection(next);
    if (next === "simple") {
      setSelectedIndex(null);
      return;
    }
    const pack = config.packs[0];
    const len =
      next === "commands"
        ? pack?.commands.length ?? 0
        : next === "functions"
          ? pack?.functions.length ?? 0
          : next === "assets"
            ? pack?.assets.length ?? 0
            : pack?.variables.length ?? 0;
    setSelectedIndex(len > 0 ? 0 : null);
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

  const pack0 = config.packs[0];
  const sectionCounts: Record<Section, number> = {
    simple: 0,
    commands: pack0?.commands.length ?? 0,
    functions: pack0?.functions.length ?? 0,
    assets: pack0?.assets.length ?? 0,
    variables: pack0?.variables.length ?? 0,
  };

  return (
    <EditorConfigProvider config={config}>
      <div className="-mx-4 sm:-mx-8">
        {/* Sticky toolbar */}
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-8">
          <div className="min-w-0 flex-1">
            <input
              value={config.name}
              onChange={(event) => setConfig({ ...config, name: event.target.value })}
              className="w-full max-w-xs truncate border-0 bg-transparent text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground"
              placeholder="Pack name"
              aria-label="Pack name"
            />
            <p className="text-xs text-muted-foreground">
              {dirty ? "Unsaved changes" : "Saved"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-sm border border-border p-0.5">
              <button
                type="button"
                onClick={() => (mode === "json" ? showForm() : undefined)}
                className={`h-8 rounded-sm px-2.5 text-xs transition-colors ${
                  mode === "form"
                    ? "bg-[var(--color-hover)] text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Form
              </button>
              <button
                type="button"
                onClick={() => (mode === "form" ? showJson() : undefined)}
                className={`h-8 rounded-sm px-2.5 text-xs transition-colors ${
                  mode === "json"
                    ? "bg-[var(--color-hover)] text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                JSON
              </button>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPublishOpen(true)}
            >
              Publish
            </Button>
            <Button
              type="button"
              onClick={() => void onSave()}
              disabled={!dirty || saving}
              loading={saving}
            >
              Save
            </Button>
          </div>
        </div>

        {error ? (
          <div className="px-4 pt-3 sm:px-8">
            <ErrorNote>{error}</ErrorNote>
          </div>
        ) : null}

        {mode === "json" ? (
          <div className="px-4 py-4 sm:px-8">
            <textarea
              value={jsonText}
              spellCheck={false}
              onChange={(event) => setJsonText(event.target.value)}
              className="min-h-[28rem] w-full rounded-sm border border-border bg-[var(--color-inset)] px-3 py-2.5 font-mono text-xs text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
          </div>
        ) : (
          <div className="flex flex-col md:min-h-[calc(100vh-8rem)] md:flex-row">
            {/* Left rail */}
            <aside className="shrink-0 border-b border-border md:w-60 md:border-b-0 md:border-r">
              <nav className="flex gap-1 overflow-x-auto p-2 md:flex-col md:overflow-visible md:p-3">
                {sections.map((item) => {
                  const active = section === item;
                  const count = sectionCounts[item];
                  const warnings = tabIssueCounts[item] ?? 0;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => goToSection(item)}
                      className={`flex shrink-0 items-center justify-between gap-2 rounded-sm px-3 py-2 text-left text-sm capitalize transition-colors duration-150 ${
                        active
                          ? "bg-[var(--color-hover)] text-foreground"
                          : "text-muted-foreground hover:bg-[var(--color-hover)] hover:text-foreground"
                      }`}
                    >
                      <span>{item === "simple" ? "Overview" : item}</span>
                      <span className="flex items-center gap-1.5">
                        {item !== "simple" && count > 0 ? (
                          <span className="text-xs text-muted-foreground">{count}</span>
                        ) : null}
                        {warnings > 0 ? (
                          <span className="inline-flex size-4 items-center justify-center rounded-full bg-warning/20 text-xs font-semibold text-warning">
                            {warnings}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </nav>

              {section !== "simple" && mode === "form" ? (
                <RailItemList
                  section={section}
                  pack={pack0}
                  selectedIndex={selectedIndex}
                  onSelect={setSelectedIndex}
                  onAdd={() => {
                    if (!pack0) return;
                    const next = structuredClone(config);
                    const pack = next.packs[0];
                    if (!pack) return;
                    if (section === "commands") {
                      pack.commands.push({
                        clientId: clientId(),
                        name: "command",
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
                      });
                      setSelectedIndex(pack.commands.length - 1);
                    } else if (section === "functions") {
                      pack.functions.push({
                        clientId: clientId(),
                        id: newId("fn"),
                        name: "function",
                        kind: "action",
                        exposed: false,
                        parameters: [],
                        actions: [],
                      });
                      setSelectedIndex(pack.functions.length - 1);
                    } else if (section === "assets") {
                      pack.assets.push({
                        clientId: clientId(),
                        id: newId("asset"),
                        name: "asset",
                        type: "text",
                        data: "",
                        url: "",
                      });
                      setSelectedIndex(pack.assets.length - 1);
                    } else if (section === "variables") {
                      pack.variables.push({
                        clientId: clientId(),
                        name: "variable",
                        scope: "chat",
                        type: "string",
                        defaultValue: "",
                        group: "",
                        expose: false,
                      });
                      setSelectedIndex(pack.variables.length - 1);
                    }
                    setConfig(next);
                  }}
                />
              ) : null}
            </aside>

            {/* Main pane */}
            <div className="min-w-0 flex-1 px-4 py-4 sm:px-6">
              {mode === "form" ? (
                <WarnList
                  items={issues.filter((i) => i.tabId === section).map((i) => i.message)}
                />
              ) : null}

              {section === "simple" ? (
                <div className="mb-6 grid max-w-xl gap-3 sm:grid-cols-2">
                  <Field label="Name">
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
              ) : null}

              {section === "simple" ? (
                <SimpleConfig config={config} onChange={setConfig} />
              ) : null}
              {section === "commands" ? (
                <Commands
                  config={config}
                  onChange={setConfig}
                  selectedIndex={selectedIndex}
                  onSelect={setSelectedIndex}
                />
              ) : null}
              {section === "functions" ? (
                <Functions
                  config={config}
                  onChange={setConfig}
                  selectedIndex={selectedIndex}
                  onSelect={setSelectedIndex}
                />
              ) : null}
              {section === "assets" ? (
                <Assets
                  config={config}
                  onChange={setConfig}
                  selectedIndex={selectedIndex}
                  onSelect={setSelectedIndex}
                />
              ) : null}
              {section === "variables" ? (
                <Variables
                  config={config}
                  onChange={setConfig}
                  selectedIndex={selectedIndex}
                  onSelect={setSelectedIndex}
                />
              ) : null}
            </div>
          </div>
        )}

        <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Publish pack</DialogTitle>
              <DialogDescription>
                Saves the current draft, then publishes a version bots can install.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-3">
              <Field label="Version">
                <Input
                  value={publishVersion}
                  onChange={(event) => setPublishVersion(event.target.value)}
                  placeholder="1.0.0"
                  className="font-mono"
                />
              </Field>
              <Field label="Visibility">
                <select
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value)}
                  className="flex h-11 w-full rounded-sm border border-border bg-[var(--color-inset)] px-3 text-sm text-foreground sm:h-9"
                >
                  <option value="private">Private</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="public">Public</option>
                </select>
              </Field>
            </div>
            <DialogFooter className="mt-6">
              <Button variant="secondary" onClick={() => setPublishOpen(false)}>
                Cancel
              </Button>
              <Button loading={publishing} onClick={() => void onPublish()}>
                Publish
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </EditorConfigProvider>
  );
}

function RailItemList({
  section,
  pack,
  selectedIndex,
  onSelect,
  onAdd,
}: {
  section: Section;
  pack: EditorPack | undefined;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onAdd: () => void;
}) {
  if (!pack) return null;

  const labels: string[] =
    section === "commands"
      ? pack.commands.map(
          (c) => c.name.trim() || c.triggers[0]?.trim() || "Untitled command",
        )
      : section === "functions"
        ? pack.functions.map((f) => f.name.trim() || "Untitled function")
        : section === "assets"
          ? pack.assets.map((a) => a.name.trim() || "Untitled asset")
          : section === "variables"
            ? pack.variables.map((v) => v.name.trim() || "Untitled variable")
            : [];

  return (
    <div className="hidden border-t border-border px-2 py-2 md:block">
      <ul className="max-h-64 space-y-0.5 overflow-y-auto">
        {labels.map((label, index) => (
          <li key={`${label}-${index}`}>
            <button
              type="button"
              onClick={() => onSelect(index)}
              className={`w-full truncate rounded-sm px-3 py-1.5 text-left text-xs transition-colors ${
                selectedIndex === index
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:bg-[var(--color-hover)] hover:text-foreground"
              }`}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 w-full rounded-sm px-3 py-1.5 text-left text-xs font-medium text-primary hover:bg-[var(--color-hover)]"
      >
        + Add {section.slice(0, -1)}
      </button>
    </div>
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
            : "border-border bg-[var(--color-inset)] text-muted-foreground"
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
  selectedIndex,
  onSelect,
}: {
  config: EditorConfig;
  onChange: (config: EditorConfig) => void;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
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
      <p className="mb-3 text-xs text-muted-foreground">
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

      <div className="space-y-8">
        {packs.map((pack) => (
          <section key={pack.clientId}>
            <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border pb-3">
              <TextInput
                value={pack.name}
                placeholder="Pack name"
                className="min-w-[10rem] flex-1 font-medium"
                onChange={(e) => updatePack(pack.clientId, { name: e.target.value })}
              />
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
              {packs.length > 1 ? (
                <button
                  type="button"
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    onChange({
                      ...config,
                      packs: config.packs.filter((p) => p.clientId !== pack.clientId),
                    })
                  }
                >
                  Remove pack
                </button>
              ) : null}
            </div>

            <div>
              {pack.commands.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No commands yet. Add one from the rail.
                </p>
              ) : selectedIndex == null || !pack.commands[selectedIndex] ? (
                <p className="text-sm text-muted-foreground">Select a command in the rail.</p>
              ) : (
                <CommandCard
                  key={pack.commands[selectedIndex]!.clientId}
                  command={pack.commands[selectedIndex]!}
                  handle={<span className="text-muted-foreground/40">⋮⋮</span>}
                  disableUp={selectedIndex === 0}
                  disableDown={selectedIndex === pack.commands.length - 1}
                  onChange={(patch) =>
                    updateCommand(pack.clientId, selectedIndex, patch)
                  }
                  onUp={() => {
                    updatePack(pack.clientId, {
                      commands: moveItem(pack.commands, selectedIndex, -1),
                    });
                    onSelect(Math.max(0, selectedIndex - 1));
                  }}
                  onDown={() => {
                    updatePack(pack.clientId, {
                      commands: moveItem(pack.commands, selectedIndex, 1),
                    });
                    onSelect(
                      Math.min(pack.commands.length - 1, selectedIndex + 1),
                    );
                  }}
                  onRemove={() => {
                    updatePack(pack.clientId, {
                      commands: removeAt(pack.commands, selectedIndex),
                    });
                    const nextLen = pack.commands.length - 1;
                    onSelect(nextLen <= 0 ? null : Math.min(selectedIndex, nextLen - 1));
                  }}
                />
              )}
            </div>
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
    <article className="space-y-4 border-b border-border py-4 last:border-b-0">
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
            {command.parameters.map((param, i) => (
              <div key={i} className="relative inline-flex shrink-0">
                <TextInput
                  value={param}
                  placeholder={`param${i + 1}`}
                  spellCheck={false}
                  className="w-[5.5rem] shrink-0 pr-6 font-mono text-sm"
                  aria-label={`Parameter ${i + 1}`}
                  onChange={(event) => {
                    const next = [...command.parameters];
                    next[i] = event.target.value;
                    onChange({ parameters: next.slice(0, MAX_COMMAND_PARAMS) });
                  }}
                />
                <button
                  type="button"
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  aria-label={`Remove parameter ${i + 1}`}
                  onClick={() => {
                    const next = command.parameters.filter((_, j) => j !== i);
                    onChange({ parameters: next });
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            {command.parameters.length < MAX_COMMAND_PARAMS ? (
              <button
                type="button"
                className="inline-flex h-9 shrink-0 items-center rounded-sm border border-dashed border-border px-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                onClick={() => {
                  if (command.parameters.length >= MAX_COMMAND_PARAMS) return;
                  onChange({
                    parameters: [...command.parameters, `param${command.parameters.length + 1}`],
                  });
                }}
              >
                + param
              </button>
            ) : null}
            <TextInput
              value={command.name}
              placeholder="name"
              className="w-28 shrink-0 sm:w-36"
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
            <p className="text-xs text-muted-foreground">
              Catch-all: runs only when no other command matched.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Aliases</span>
            {command.triggers.slice(1).map((t, ti) => (
              <span
                key={`${t}-${ti}`}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 font-mono text-xs"
              >
                {t}
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
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
              className="text-xs font-medium text-primary hover:text-primary/80"
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

      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <Eyebrow>Events ({command.events.length})</Eyebrow>
          <button
            type="button"
            className="text-xs font-medium text-primary hover:text-primary/80"
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
              className="group rounded-lg border border-border bg-[var(--color-inset)] open:bg-[var(--color-hover)]"
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
                <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
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
              <div className="border-t border-border px-2.5 pb-2.5 pt-2">
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
  selectedIndex,
  onSelect,
}: {
  config: EditorConfig;
  onChange: (config: EditorConfig) => void;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
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
      <p className="mb-3 text-xs text-muted-foreground">
        Cross-pack call_function works at runtime. Edit one function at a time.
      </p>
      <div className="space-y-6">
        {config.packs.map((pack) => {
          if (selectedIndex == null || !pack.functions[selectedIndex]) {
            return (
              <p key={pack.clientId} className="text-sm text-muted-foreground">
                {pack.functions.length === 0
                  ? "No functions yet. Add one from the rail."
                  : "Select a function in the rail."}
              </p>
            );
          }
          const index = selectedIndex;
          const fn = pack.functions[index]!;
          return (
          <section key={pack.clientId}>
            <SortableList
              items={[fn]}
              onChange={() => undefined}
              renderItem={(fn, _i, handle) => (
                <ItemCard
                  handle={handle}
                  title={fn.name}
                  titlePlaceholder="Function name"
                  onTitleChange={(name) =>
                    updatePack(pack.clientId, {
                      functions: patchAt(pack.functions, index, { name }),
                    })
                  }
                  disableUp={index === 0}
                  disableDown={index === pack.functions.length - 1}
                  onUp={() => {
                    updatePack(pack.clientId, {
                      functions: moveItem(pack.functions, index, -1),
                    });
                    onSelect(Math.max(0, index - 1));
                  }}
                  onDown={() => {
                    updatePack(pack.clientId, {
                      functions: moveItem(pack.functions, index, 1),
                    });
                    onSelect(Math.min(pack.functions.length - 1, index + 1));
                  }}
                  onRemove={() => {
                    updatePack(pack.clientId, {
                      functions: removeAt(pack.functions, index),
                    });
                    const nextLen = pack.functions.length - 1;
                    onSelect(nextLen <= 0 ? null : Math.min(index, nextLen - 1));
                  }}
                >
                  <Field label="Kind">
                    <MenuSelect
                      size="sm"
                      ariaLabel="Function kind"
                      value={fn.kind}
                      onChange={(kind) =>
                        updatePack(pack.clientId, {
                          functions: patchAt(pack.functions, index, {
                            kind: kind as "action" | "value",
                          }),
                        })
                      }
                      options={[
                        { value: "action", label: "Action" },
                        { value: "value", label: "Value" },
                      ]}
                    />
                  </Field>
                  <label className="mt-2 flex items-center gap-2 text-xs text-foreground">
                    <input
                      type="checkbox"
                      checked={fn.exposed}
                      onChange={(event) =>
                        updatePack(pack.clientId, {
                          functions: patchAt(pack.functions, index, {
                            exposed: event.target.checked,
                          }),
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
          </section>
          );
        })}
      </div>
    </SectionCard>
  );
}

function Assets({
  config,
  onChange,
  selectedIndex,
  onSelect,
}: {
  config: EditorConfig;
  onChange: (config: EditorConfig) => void;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
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
          <section key={pack.clientId}>
            {selectedIndex == null || !pack.assets[selectedIndex] ? (
              <p className="text-sm text-muted-foreground">
                {pack.assets.length === 0
                  ? "No assets yet. Add one from the rail."
                  : "Select an asset in the rail."}
              </p>
            ) : null}
            <SortableList
              items={
                selectedIndex != null && pack.assets[selectedIndex]
                  ? [pack.assets[selectedIndex]!]
                  : []
              }
              onChange={() => undefined}
              renderItem={(asset, _i, handle) => {
                const index = selectedIndex!;
                return (
                <ItemCard
                  handle={handle}
                  title={asset.name}
                  titlePlaceholder="Asset name"
                  onTitleChange={(name) =>
                    updatePack(pack.clientId, {
                      assets: patchAt(pack.assets, index, { name }),
                    })
                  }
                  onUp={() => {
                    updatePack(pack.clientId, {
                      assets: moveItem(pack.assets, index, -1),
                    });
                    onSelect(Math.max(0, index - 1));
                  }}
                  onDown={() => {
                    updatePack(pack.clientId, {
                      assets: moveItem(pack.assets, index, 1),
                    });
                    onSelect(Math.min(pack.assets.length - 1, index + 1));
                  }}
                  onRemove={() => {
                    updatePack(pack.clientId, {
                      assets: removeAt(pack.assets, index),
                    });
                    const nextLen = pack.assets.length - 1;
                    onSelect(nextLen <= 0 ? null : Math.min(index, nextLen - 1));
                  }}
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
                );
              }}
            />
          </section>
        ))}
      </div>
    </SectionCard>
  );
}

function Variables({
  config,
  onChange,
  selectedIndex,
  onSelect,
}: {
  config: EditorConfig;
  onChange: (config: EditorConfig) => void;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
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
        {config.packs.map((pack) => {
          if (selectedIndex == null || !pack.variables[selectedIndex]) {
            return (
              <p key={pack.clientId} className="text-sm text-muted-foreground">
                {pack.variables.length === 0
                  ? "No variables yet. Add one from the rail."
                  : "Select a variable in the rail."}
              </p>
            );
          }
          const index = selectedIndex;
          const variable = pack.variables[index]!;
          return (
          <section key={pack.clientId}>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
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
                  onClick={() => {
                    updatePack(pack.clientId, {
                      variables: removeAt(pack.variables, index),
                    });
                    const nextLen = pack.variables.length - 1;
                    onSelect(nextLen <= 0 ? null : Math.min(index, nextLen - 1));
                  }}
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
          </section>
          );
        })}
      </div>
    </SectionCard>
  );
}

function SectionCard({ children }: { children: ReactNode }) {
  /* Flat pane — no nested card chrome */
  return <section className="space-y-4">{children}</section>;
}
