"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  blankPack,
  clientId,
  newId,
  parameterTypes,
  parseConfig,
  serializeConfig,
  variableScopes,
  type EditorAsset,
  type EditorConfig,
  type EditorFunction,
  type EditorPack,
  type EditorVariable,
  type ParameterType,
  type EventPhase,
  type EventType,
} from "../../lib/config-editor";
import {
  addPackDependency,
  deletePackVersion,
  dependencyVersion,
  listOwnPacks,
  listPackVersions,
  listPublicPacks,
  publishPack,
  removePackDependency,
  saveDraft,
  updatePack,
  type PackSummary,
  type PackVersionInfo,
} from "../../lib/packs";
import { issuesByTab, validateConfig } from "../../lib/validate-config";
import { ActionList } from "./ActionList";
import {
  EventsPanel,
  addEventHandler,
  eventUsesFilters,
  handlersOf,
  listHandlerLabels,
} from "./EventsPanel";
import {
  EditorConfigProvider,
  ExtraParamsProvider,
  paramDraftsFromFunction,
} from "./config-context";
import { Switch } from "../ui/switch";
import { cn } from "../../lib/cn";
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
  "events",
  "functions",
  "assets",
  "variables",
  "dependencies",
] as const;
type Section = (typeof sections)[number];

function bumpVersion(version: string) {
  const parts = version.split(".").map((p) => Number(p));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n)))
    return "1.0.0";
  parts[2] = (parts[2] ?? 0) + 1;
  return parts.join(".");
}

export function ConfigEditor({
  packId,
  initial,
  dependencies: initialDependencies = [],
  initialVisibility = "private",
  initialPriceKobo = 0,
  initialColor = "#8b5cf6",
  initialPublishedVersion = null,
}: {
  packId: string;
  initial: EditorConfig;
  dependencies?: { packId: string; version: string }[];
  initialVisibility?: string;
  initialPriceKobo?: number;
  initialColor?: string;
  /** Latest published version of this pack, if any (not "draft"). */
  initialPublishedVersion?: string | null;
}) {
  const [config, setConfig] = useState(initial);
  const [saved, setSaved] = useState(() =>
    JSON.stringify(serializeConfig(initial)),
  );
  const [section, setSection] = useState<Section>("simple");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [eventPhase, setEventPhase] = useState<EventPhase>("handlers");
  const [eventType, setEventType] = useState<EventType>("message");
  const [mode, setMode] = useState<"form" | "json">("form");
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [latestPublished, setLatestPublished] = useState<string | null>(
    initialPublishedVersion && initialPublishedVersion !== "draft"
      ? initialPublishedVersion
      : null,
  );
  const [publishVersion, setPublishVersion] = useState(() =>
    latestPublished ? bumpVersion(latestPublished) : "1.0.0",
  );
  const [visibility, setVisibility] = useState(initialVisibility);
  const [priceKobo, setPriceKobo] = useState(initialPriceKobo);
  const [marketColor, setMarketColor] = useState(initialColor || "#8b5cf6");
  const [depList, setDepList] = useState(initialDependencies);
  const [depCatalog, setDepCatalog] = useState<PackSummary[]>([]);
  const [depBusy, setDepBusy] = useState(false);

  const [publishing, setPublishing] = useState(false);
  const [versionList, setVersionList] = useState<PackVersionInfo[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [deletingVersion, setDeletingVersion] = useState<string | null>(null);

  async function refreshVersions() {
    setVersionsLoading(true);
    try {
      const rows = await listPackVersions(packId);
      setVersionList(rows);
      const latest = rows.find((r) => r.latest)?.version ?? rows[0]?.version ?? null;
      if (latest) {
        setLatestPublished(latest);
        setPublishVersion((prev) =>
          prev === "1.0.0" || rows.some((r) => r.version === prev)
            ? bumpVersion(latest)
            : prev,
        );
      } else {
        setLatestPublished(null);
      }
    } catch {
      setVersionList([]);
    } finally {
      setVersionsLoading(false);
    }
  }

  async function onDeleteVersion(version: string) {
    setError("");
    setDeletingVersion(version);
    try {
      const rows = await deletePackVersion(packId, version);
      setVersionList(rows);
      const latest = rows.find((r) => r.latest)?.version ?? rows[0]?.version ?? null;
      setLatestPublished(latest);
      if (latest) setPublishVersion(bumpVersion(latest));
      else setPublishVersion("1.0.0");
      toast.success(`Deleted version ${version}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete version");
    } finally {
      setDeletingVersion(null);
    }
  }
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
  useEffect(() => {
    Promise.all([listPublicPacks(), listOwnPacks()])
      .then(([pub, own]) => {
        const byId = new Map<string, PackSummary>();
        // Prefer published payloads; merge own metadata without overwriting a real version with "draft".
        for (const p of pub) byId.set(p.id, p);
        for (const p of own) {
          const existing = byId.get(p.id);
          if (!existing) {
            byId.set(p.id, p);
            continue;
          }
          byId.set(p.id, {
            ...existing,
            name: p.name || existing.name,
            description: p.description || existing.description,
            publishedVersion:
              p.publishedVersion ??
              (existing.version !== "draft" ? existing.version : null),
            exposedFunctions: p.exposedFunctions?.length
              ? p.exposedFunctions
              : existing.exposedFunctions,
          });
        }
        setDepCatalog([...byId.values()]);
      })
      .catch(() => setDepCatalog([]));
  }, []);

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
      const packDef = next.packs?.[0] as Record<string, unknown> | undefined;
      await saveDraft(packId, {
        dependencies: depList,
        events: packDef?.events ?? [],
        functions: packDef?.functions ?? [],
        assets: packDef?.assets ?? [],
        variables: packDef?.variables ?? [],
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
      const packDef = next.packs?.[0] as Record<string, unknown> | undefined;
      await saveDraft(packId, {
        dependencies: depList,
        events: packDef?.events ?? [],
        functions: packDef?.functions ?? [],
        assets: packDef?.assets ?? [],
        variables: packDef?.variables ?? [],
      });
      await updatePack(packId, {
        visibility,
        name: config.name,
        price_kobo: Math.max(0, Math.floor(priceKobo)),
        color: marketColor.trim(),
      });
      const ver = publishVersion.trim();
      await publishPack(packId, ver);
      const stored = JSON.stringify(next);
      setSaved(stored);
      setLatestPublished(ver);
      setPublishVersion(bumpVersion(ver));
      await refreshVersions();
      toast.success(`Published ${ver}`);
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
      next === "events"
        ? pack
          ? handlersOf(pack, eventType, eventPhase).length
          : 0
        : next === "functions"
          ? (pack?.functions.length ?? 0)
          : next === "assets"
            ? (pack?.assets.length ?? 0)
            : (pack?.variables.length ?? 0);
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

  /** Exposed functions from dependency packs — shown in Functions rail + call_function picker. */
  const importFunctions = useMemo(() => {
    const out: EditorFunction[] = [];
    for (const dep of depList) {
      const meta = depCatalog.find((p) => p.id === dep.packId);
      if (!meta) continue;
      const slug = meta.slug || dep.packId;
      const exposed = meta.exposedFunctions ?? [];
      for (const fn of exposed) {
        out.push({
          clientId: `dep:${dep.packId}:${fn.name}`,
          id: `dep_${dep.packId}_${fn.name}`,
          name: `${slug}.${fn.name}`,
          kind: fn.kind === "value" ? "value" : "action",
          exposed: true,
          parameters: (fn.parameters ?? []).map((p) => ({
            clientId: clientId(),
            name: p.name,
            type: (p.type as ParameterType) || "string",
          })),
          actions: [],
        });
      }
    }
    return out;
  }, [depList, depCatalog]);

  const issues = useMemo(
    () =>
      validateConfig(
        config,
        importFunctions.map((f) => f.name),
      ),
    [config, importFunctions],
  );
  const tabIssueCounts = useMemo(() => issuesByTab(issues), [issues]);

  const sectionCounts: Record<Section, number> = {
    simple: 0,
    events: pack0 ? handlersOf(pack0, eventType, eventPhase).length : 0,
    functions: (pack0?.functions.length ?? 0) + importFunctions.length,
    assets: pack0?.assets.length ?? 0,
    variables: pack0?.variables.length ?? 0,
    dependencies: depList.length,
  };

  return (
    <EditorConfigProvider config={config} importFunctions={importFunctions}>
      <div className="flex h-full min-h-0 min-w-0 flex-col">
        {/* Toolbar */}
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-background px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <input
              value={config.name}
              onChange={(event) =>
                setConfig({ ...config, name: event.target.value })
              }
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
              onClick={() => {
                setPublishOpen(true);
                void refreshVersions();
              }}
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
          <div className="shrink-0 px-4 pt-3 sm:px-6">
            <ErrorNote>{error}</ErrorNote>
          </div>
        ) : null}

        {mode === "json" ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            <textarea
              value={jsonText}
              spellCheck={false}
              onChange={(event) => setJsonText(event.target.value)}
              className="min-h-full w-full rounded-sm border border-border bg-[var(--color-inset)] px-3 py-2.5 font-mono text-xs text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
          </div>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col md:flex-row">
            {/* Left rail — fixed width; item list scrolls if long */}
            <aside className="flex min-h-0 w-full shrink-0 flex-col border-b border-border md:w-56 md:border-b-0 md:border-r">
              <nav className="flex shrink-0 gap-1 overflow-x-auto p-2 md:flex-col md:overflow-y-visible md:p-3">
                {sections.map((item) => {
                  const active = section === item;
                  const count = sectionCounts[item];
                  const warnings = tabIssueCounts[item] ?? 0;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => goToSection(item)}
                      className={`flex w-full shrink-0 items-center justify-between gap-2 rounded-sm px-3 py-2 text-left text-sm capitalize transition-colors duration-150 ${
                        active
                          ? "bg-[var(--color-hover)] text-foreground"
                          : "text-muted-foreground hover:bg-[var(--color-hover)] hover:text-foreground"
                      }`}
                    >
                      <span className="truncate">
                        {item === "simple"
                          ? "Overview"
                          : item === "events"
                            ? "Events"
                            : item === "dependencies"
                              ? "Dependencies"
                              : item}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {item !== "simple" && count > 0 ? (
                          <span className="text-xs text-muted-foreground">
                            {count}
                          </span>
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

              {section !== "simple" &&
              section !== "dependencies" &&
              mode === "form" ? (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <RailItemList
                    section={section}
                    pack={pack0}
                    selectedIndex={selectedIndex}
                    onSelect={setSelectedIndex}
                    eventPhase={eventPhase}
                    eventType={eventType}
                    importFunctions={importFunctions}
                    onAdd={() => {
                      if (!pack0) return;
                      const next = structuredClone(config);
                      const pack = next.packs[0];
                      if (!pack) return;
                      if (section === "events") {
                        // Pre / member events are always-run action lists (no command filter).
                        const kind =
                          eventPhase === "pre" || !eventUsesFilters(eventType)
                            ? "catch_all"
                            : "command";
                        const updated = addEventHandler(
                          pack,
                          eventType,
                          eventPhase,
                          kind,
                        );
                        next.packs[0] = updated;
                        setSelectedIndex(
                          handlersOf(updated, eventType, eventPhase).length - 1,
                        );
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
                          label: "",
                          description: "",
                        });
                        setSelectedIndex(pack.variables.length - 1);
                      }
                      setConfig(next);
                    }}
                  />
                </div>
              ) : null}
            </aside>

            {/* Main pane — only this area scrolls */}
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              {mode === "form" ? (
                <WarnList
                  items={issues
                    .filter((i) => i.tabId === section)
                    .map((i) => i.message)}
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
                        setConfig({
                          ...config,
                          description: event.target.value,
                        })
                      }
                    />
                  </Field>
                </div>
              ) : null}

              {section === "simple" ? (
                <SimpleConfig config={config} onChange={setConfig} />
              ) : null}
              {section === "events" ? (
                <EventsPanel
                  config={config}
                  onChange={setConfig}
                  selectedIndex={selectedIndex}
                  onSelect={setSelectedIndex}
                  eventType={eventType}
                  onEventTypeChange={(e) => {
                    setEventType(e);
                    setSelectedIndex(null);
                    if (!eventUsesFilters(e)) setEventPhase("handlers");
                  }}
                  phase={eventPhase}
                  onPhaseChange={(p) => {
                    setEventPhase(p);
                    setSelectedIndex(null);
                  }}
                />
              ) : null}
              {section === "functions" ? (
                <Functions
                  config={config}
                  onChange={setConfig}
                  selectedIndex={selectedIndex}
                  onSelect={setSelectedIndex}
                  importFunctions={importFunctions}
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
              {section === "dependencies" ? (
                <DependenciesPanel
                  packId={packId}
                  depList={depList}
                  catalog={depCatalog}
                  busy={depBusy}
                  onChange={setDepList}
                  setBusy={setDepBusy}
                  setError={setError}
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
                Saves the current draft, then freezes a version bots can
                install. Dependencies always pin a published version — never
                draft. {latestPublished
                  ? `Latest published: ${latestPublished}.`
                  : "This pack has not been published yet."}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-3">
              <Field
                label="Version"
                hint="Semver (e.g. 1.0.0). Must be new — cannot overwrite an existing publish."
              >
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
              <Field
                label="Price (NGN)"
                hint="0 = free. Stored as kobo on the server."
              >
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={
                    priceKobo === 0 ? "" : String(Math.round(priceKobo / 100))
                  }
                  placeholder="0"
                  onChange={(event) => {
                    const naira = Number(event.target.value);
                    setPriceKobo(
                      Number.isFinite(naira) && naira > 0
                        ? Math.round(naira * 100)
                        : 0,
                    );
                  }}
                />
              </Field>
              <Field label="Market color">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={marketColor || "#8b5cf6"}
                    onChange={(event) => setMarketColor(event.target.value)}
                    className="h-9 w-12 cursor-pointer rounded-sm border border-border bg-transparent"
                  />
                  <Input
                    value={marketColor}
                    onChange={(event) => setMarketColor(event.target.value)}
                    placeholder="#8b5cf6"
                    className="font-mono"
                  />
                </div>
              </Field>
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-foreground">
                    Published versions
                  </p>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => void refreshVersions()}
                    disabled={versionsLoading}
                  >
                    {versionsLoading ? "Loading…" : "Refresh"}
                  </button>
                </div>
                {versionList.length === 0 && !versionsLoading ? (
                  <p className="text-xs text-muted-foreground">
                    No published versions yet.
                  </p>
                ) : null}
                <ul className="max-h-48 space-y-1.5 overflow-y-auto">
                  {versionList.map((row) => (
                    <li
                      key={row.version}
                      className="flex items-center gap-2 rounded-sm border border-border bg-[var(--color-inset)] px-2.5 py-1.5 text-xs"
                    >
                      <span className="min-w-0 flex-1 font-mono text-foreground">
                        {row.version}
                        {row.latest ? (
                          <span className="ml-1.5 text-[10px] font-sans text-muted-foreground">
                            latest
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {row.installs} install{row.installs === 1 ? "" : "s"}
                        {row.dependentCount > 0
                          ? ` · ${row.dependentCount} dep${row.dependentCount === 1 ? "" : "s"}`
                          : ""}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-7 shrink-0 px-2 text-xs"
                        disabled={!row.canDelete || deletingVersion === row.version}
                        title={
                          row.canDelete
                            ? `Delete ${row.version}`
                            : row.installs > 0
                              ? "Bots still installed on this version"
                              : "Other packs still depend on this version"
                        }
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Delete published version ${row.version}? This cannot be undone.`,
                            )
                          )
                            return;
                          void onDeleteVersion(row.version);
                        }}
                      >
                        {deletingVersion === row.version ? "…" : "Delete"}
                      </Button>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted-foreground">
                  Delete is blocked while any bot is installed on that version
                  or another pack depends on it. Upgrade or remove those first.
                </p>
              </div>
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
  eventPhase = "handlers",
  eventType = "message",
  importFunctions = [],
}: {
  section: Section;
  pack: EditorPack | undefined;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onAdd: () => void;
  eventPhase?: EventPhase;
  eventType?: EventType;
  importFunctions?: EditorFunction[];
}) {
  if (!pack) return null;

  const ownLabels: string[] =
    section === "events"
      ? listHandlerLabels(pack, eventType, eventPhase)
      : section === "functions"
        ? pack.functions.map((f) => f.name.trim() || "Untitled function")
        : section === "assets"
          ? pack.assets.map((a) => a.name.trim() || "Untitled asset")
          : section === "variables"
            ? pack.variables.map((v) => v.name.trim() || "Untitled variable")
            : [];

  const depLabels =
    section === "functions"
      ? importFunctions.map((f) => f.name.trim() || "Imported function")
      : [];

  return (
    <div className="hidden border-t border-border px-2 py-2 md:block">
      <ul className="space-y-0.5">
        {ownLabels.map((label, index) => (
          <li key={`own-${label}-${index}`}>
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
        {depLabels.length > 0 ? (
          <>
            <li className="px-3 pt-2 pb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
              From dependencies
            </li>
            {depLabels.map((label, i) => {
              const index = ownLabels.length + i;
              return (
                <li key={`dep-${label}-${i}`}>
                  <button
                    type="button"
                    onClick={() => onSelect(index)}
                    className={`w-full truncate rounded-sm px-3 py-1.5 text-left text-xs font-mono transition-colors ${
                      selectedIndex === index
                        ? "bg-primary/15 text-foreground"
                        : "text-muted-foreground hover:bg-[var(--color-hover)] hover:text-foreground"
                    }`}
                    title="Imported — call via call_function; not editable here"
                  >
                    {label}
                  </button>
                </li>
              );
            })}
          </>
        ) : null}
      </ul>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 w-full rounded-sm px-3 py-1.5 text-left text-xs font-medium text-primary hover:bg-[var(--color-hover)]"
      >
        + Add {section === "events" ? "event" : section.slice(0, -1)}
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

  function updateDefault(
    packId: string,
    varIndex: number,
    defaultValue: string,
  ) {
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
                      {row.variable.label.trim() ||
                        row.variable.name ||
                        "Untitled"}
                      <span className="ml-1 font-normal text-white/40">
                        · {row.packName}
                      </span>
                    </Eyebrow>
                    {row.variable.description.trim() ? (
                      <p className="mb-1 text-xs text-muted-foreground">
                        {row.variable.description.trim()}
                      </p>
                    ) : null}
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

export function VariableDefaultInput({
  type,
  value,
  onChange,
  className = "flex-1",
}: {
  type: ParameterType;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  if (type === "boolean") {
    const isTrue = value === "true";
    return (
      <div
        onClick={() => onChange(isTrue ? "false" : "true")}
        className={cn(
          "flex h-9 cursor-pointer items-center justify-between gap-3 rounded-md border border-white/10 bg-black/25 px-2.5 py-1.5 text-xs select-none hover:border-white/20 transition-colors",
          className,
        )}
      >
        <span className="font-mono text-xs font-medium text-white/90">
          {isTrue ? "true" : "false"}
        </span>
        <Switch
          checked={isTrue}
          onCheckedChange={(checked) => onChange(checked ? "true" : "false")}
        />
      </div>
    );
  }

  if (type === "number") {
    return (
      <TextInput
        type="number"
        value={value}
        placeholder="0"
        className={cn("font-mono", className)}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (type === "array") {
    return (
      <TextInput
        type="text"
        value={value}
        placeholder='["item1", "item2"]'
        className={cn("font-mono text-xs", className)}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (type === "object") {
    return (
      <TextInput
        type="text"
        value={value}
        placeholder='{"key": "value"}'
        className={cn("font-mono text-xs", className)}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <TextInput
      type="text"
      value={value}
      placeholder="default value"
      className={className}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function SimpleValue({
  variable,
  onChange,
}: {
  variable: EditorVariable;
  onChange: (value: string) => void;
}) {
  return (
    <VariableDefaultInput
      type={variable.type}
      value={variable.defaultValue}
      onChange={onChange}
      className="w-full"
    />
  );
}

function Functions({
  config,
  onChange,
  selectedIndex,
  onSelect,
  importFunctions = [],
}: {
  config: EditorConfig;
  onChange: (config: EditorConfig) => void;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  importFunctions?: EditorFunction[];
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
        <p className="text-sm text-muted-foreground">Add a pack first.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <p className="mb-3 text-xs text-muted-foreground">
        Own functions are editable. Dependency functions appear below the rail
        divider — call them with{" "}
        <code className="text-xs">slug.Name</code> via call_function.
      </p>
      <div className="space-y-6">
        {config.packs.map((pack) => {
          const ownCount = pack.functions.length;
          const isImport =
            selectedIndex != null && selectedIndex >= ownCount;
          const importFn = isImport
            ? importFunctions[selectedIndex! - ownCount]
            : null;

          if (importFn) {
            return (
              <section key={pack.clientId} className="space-y-3">
                <div className="rounded-sm border border-border bg-[var(--color-inset)] px-3 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Imported from dependency
                  </p>
                  <p className="mt-1 font-mono text-sm text-foreground">
                    {importFn.name}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Kind: {importFn.kind}
                    {importFn.parameters.length > 0
                      ? ` · params: ${importFn.parameters.map((p) => p.name).join(", ")}`
                      : " · no parameters"}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Not editable here. Use{" "}
                    <code className="text-xs">
                      call_function → {importFn.name}
                    </code>{" "}
                    in a handler or function. Manage the dependency under
                    Dependencies.
                  </p>
                </div>
              </section>
            );
          }

          if (selectedIndex == null || !pack.functions[selectedIndex]) {
            return (
              <p key={pack.clientId} className="text-sm text-muted-foreground">
                {pack.functions.length === 0 && importFunctions.length === 0
                  ? "No functions yet. Add one from the rail, or add a dependency to import exposed functions."
                  : pack.functions.length === 0
                    ? "No local functions yet. Select an imported function or add one from the rail."
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
                      onSelect(
                        nextLen <= 0 ? null : Math.min(index, nextLen - 1),
                      );
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

                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-foreground">
                          Parameters
                        </p>
                        <button
                          type="button"
                          className="text-xs font-medium text-primary hover:underline"
                          onClick={() =>
                            updatePack(pack.clientId, {
                              functions: patchAt(pack.functions, index, {
                                parameters: [
                                  ...fn.parameters,
                                  {
                                    clientId: clientId(),
                                    name: "",
                                    type: "string" as ParameterType,
                                  },
                                ],
                              }),
                            })
                          }
                        >
                          + Add parameter
                        </button>
                      </div>
                      {fn.parameters.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Optional. Callers pass these via call_function
                          arguments; inside the function read{" "}
                          <code className="text-[11px]">params.name</code>.
                        </p>
                      ) : (
                        <ul className="space-y-1.5">
                          {fn.parameters.map((param, paramIndex) => (
                            <li
                              key={param.clientId}
                              className="grid grid-cols-[1fr_7rem_auto] items-center gap-1.5"
                            >
                              <TextInput
                                value={param.name}
                                placeholder="name"
                                spellCheck={false}
                                className="font-mono"
                                onChange={(event) =>
                                  updatePack(pack.clientId, {
                                    functions: patchAt(pack.functions, index, {
                                      parameters: patchAt(
                                        fn.parameters,
                                        paramIndex,
                                        { name: event.target.value },
                                      ),
                                    }),
                                  })
                                }
                              />
                              <MenuSelect
                                size="sm"
                                ariaLabel="Parameter type"
                                value={param.type}
                                onChange={(type) =>
                                  updatePack(pack.clientId, {
                                    functions: patchAt(pack.functions, index, {
                                      parameters: patchAt(
                                        fn.parameters,
                                        paramIndex,
                                        { type: type as ParameterType },
                                      ),
                                    }),
                                  })
                                }
                                options={parameterTypes.map((t) => ({
                                  value: t,
                                  label: t,
                                }))}
                              />
                              <IconButton
                                label="Remove parameter"
                                onClick={() =>
                                  updatePack(pack.clientId, {
                                    functions: patchAt(pack.functions, index, {
                                      parameters: removeAt(
                                        fn.parameters,
                                        paramIndex,
                                      ),
                                    }),
                                  })
                                }
                              >
                                ×
                              </IconButton>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <ExtraParamsProvider
                      extraParams={paramDraftsFromFunction(fn)}
                    >
                      <ActionList
                        actions={fn.actions}
                        onChange={(actions) =>
                          updatePack(pack.clientId, {
                            functions: patchAt(pack.functions, index, {
                              actions,
                            }),
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
        <p className="text-sm text-muted-foreground">Add a pack first.</p>
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
                      onSelect(
                        nextLen <= 0 ? null : Math.min(index, nextLen - 1),
                      );
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
        <p className="text-sm text-muted-foreground">Add a pack first.</p>
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
                    options={variableScopes.map((s) => ({
                      value: s,
                      label: s,
                    }))}
                  />
                  <MenuSelect
                    ariaLabel="Type"
                    value={variable.type}
                    onChange={(type) => {
                      const nextType = type as ParameterType;
                      let nextDefault = variable.defaultValue;
                      if (
                        nextType === "boolean" &&
                        nextDefault !== "true" &&
                        nextDefault !== "false"
                      ) {
                        nextDefault = "false";
                      }
                      updatePack(pack.clientId, {
                        variables: patchAt(pack.variables, index, {
                          type: nextType,
                          defaultValue: nextDefault,
                        }),
                      });
                    }}
                    options={parameterTypes.map((s) => ({
                      value: s,
                      label: s,
                    }))}
                  />
                  <IconButton
                    label="Remove"
                    onClick={() => {
                      updatePack(pack.clientId, {
                        variables: removeAt(pack.variables, index),
                      });
                      const nextLen = pack.variables.length - 1;
                      onSelect(
                        nextLen <= 0 ? null : Math.min(index, nextLen - 1),
                      );
                    }}
                  >
                    ×
                  </IconButton>
                </div>
                <div className="flex flex-wrap gap-2">
                  <VariableDefaultInput
                    type={variable.type}
                    value={variable.defaultValue}
                    onChange={(defaultValue) =>
                      updatePack(pack.clientId, {
                        variables: patchAt(pack.variables, index, {
                          defaultValue,
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
                {variable.expose ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <TextInput
                      value={variable.label}
                      placeholder="Label (shown on bot settings)"
                      onChange={(e) =>
                        updatePack(pack.clientId, {
                          variables: patchAt(pack.variables, index, {
                            label: e.target.value,
                          }),
                        })
                      }
                    />
                    <TextInput
                      value={variable.description}
                      placeholder="Description / help text"
                      onChange={(e) =>
                        updatePack(pack.clientId, {
                          variables: patchAt(pack.variables, index, {
                            description: e.target.value,
                          }),
                        })
                      }
                    />
                  </div>
                ) : null}
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

function DependenciesPanel({
  packId,
  depList,
  catalog,
  busy,
  onChange,
  setBusy,
  setError,
}: {
  packId: string;
  depList: { packId: string; version: string }[];
  catalog: PackSummary[];
  busy: boolean;
  onChange: (next: { packId: string; version: string }[]) => void;
  setBusy: (v: boolean) => void;
  setError: (v: string) => void;
}) {
  const installedIds = new Set(depList.map((d) => d.packId));
  const available = catalog.filter(
    (p) => p.id !== packId && !installedIds.has(p.id),
  );

  async function add(dep: PackSummary) {
    setBusy(true);
    setError("");
    try {
      const version = dependencyVersion(dep);
      if (!version) {
        setError("Only published packs can be dependencies — publish this pack first");
        return;
      }
      await addPackDependency(packId, { packId: dep.id, version });
      onChange([
        ...depList.filter((d) => d.packId !== dep.id),
        { packId: dep.id, version },
      ]);
      toast.success(`Depends on ${dep.slug}@${version}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add dependency");
    } finally {
      setBusy(false);
    }
  }

  async function remove(depPackId: string) {
    setBusy(true);
    setError("");
    try {
      await removePackDependency(packId, depPackId);
      onChange(depList.filter((d) => d.packId !== depPackId));
      toast.success("Dependency removed");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not remove dependency",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Eyebrow>Dependencies</Eyebrow>
        <p className="mt-1 text-sm text-muted-foreground">
          Other packs this one needs. Install pulls them automatically. Call
          their exposed functions as{" "}
          <code className="text-xs">slug.FunctionName</code>.
        </p>
      </div>

      {depList.length === 0 ? (
        <p className="text-sm text-muted-foreground">No dependencies yet.</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {depList.map((dep) => {
            const meta = catalog.find((p) => p.id === dep.packId);
            const slug = meta?.slug ?? dep.packId;
            const exposed = meta?.exposedFunctions ?? [];
            return (
              <li key={dep.packId} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {meta?.name ?? dep.packId}{" "}
                      <span className="font-mono text-xs text-muted-foreground">
                        {slug}@{dep.version}
                      </span>
                    </p>
                    {exposed.length > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Call:{" "}
                        {exposed.map((fn) => (
                          <code key={fn.name} className="mr-2">
                            {slug}.{fn.name}
                          </code>
                        ))}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">
                        No exposed functions listed (publish the dependency
                        pack).
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => void remove(dep.packId)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <Eyebrow>Add published pack</Eyebrow>
        {available.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No other published packs available.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border border-y border-border">
            {available.map((pack) => {
              const pin = dependencyVersion(pack);
              return (
                <li
                  key={pack.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">
                      {pack.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {pack.slug} · {pin ?? "not published"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={busy || !pin}
                    title={
                      pin
                        ? `Add ${pack.slug}@${pin}`
                        : "Publish this pack before adding it as a dependency"
                    }
                    onClick={() => void add(pack)}
                  >
                    Add
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-sm border border-border bg-[var(--color-inset)] p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">How to call</p>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono">
          {`{
  "type": "call_function",
  "function": "admin_utils.RequireAdmin"
}`}
        </pre>
        <p className="mt-2">
          Errors on <code>local.lastError</code>:{" "}
          <code>dependency_not_declared</code>,{" "}
          <code>dependency_not_installed</code>,{" "}
          <code>function_not_exposed</code>, <code>function_not_found</code>
        </p>
      </div>
    </div>
  );
}
