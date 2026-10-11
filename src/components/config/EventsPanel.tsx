"use client";

import { useMemo } from "react";
import {
  clientId,
  MAX_COMMAND_PARAMS,
  newId,
  type EditorAction,
  type EditorConfig,
  type EditorEventGroup,
  type EditorFilter,
  type EditorHandler,
  type EditorPack,
  type EventPhase,
  type EventType,
} from "../../lib/config-editor";
import { eventTypeLabels } from "../../lib/event-system";
import { ActionList } from "./ActionList";
import { ExtraParamsProvider, paramDraftsFromNames } from "./config-context";
import { MenuSelect, RowMenu, TextInput, moveItem, removeAt } from "./ui";

/** Events that use message text filters (command / contains / …). */
const FILTERED_EVENTS: EventType[] = ["message"];

/** Group-only events (no text filter; always-run action lists). */
const MEMBER_EVENTS: EventType[] = ["user_joined", "user_left"];

export function eventUsesFilters(event: EventType): boolean {
  return FILTERED_EVENTS.includes(event);
}

export function eventIsGroupOnly(event: EventType): boolean {
  return MEMBER_EVENTS.includes(event);
}

function blankHandler(
  event: EventType,
  kind: EditorFilter["kind"] = "command",
): EditorHandler {
  const useFilter = eventUsesFilters(event);
  const filter: EditorFilter = !useFilter
    ? { kind: "catch_all" }
    : kind === "command"
      ? { kind: "command", triggers: ["/"], parameters: [] }
      : kind === "contains"
        ? { kind: "contains", text: "" }
        : kind === "starts_with"
          ? { kind: "starts_with", text: "" }
          : kind === "regex"
            ? { kind: "regex", pattern: "" }
            : { kind: "catch_all" };

  const name = !useFilter
    ? event === "user_joined"
      ? "welcome"
      : event === "user_left"
        ? "goodbye"
        : "handler"
    : kind === "command"
      ? "/"
      : kind === "catch_all"
        ? "pre"
        : kind;

  return {
    clientId: clientId(),
    id: newId("handler"),
    name,
    filter,
    actions: [],
  };
}

function handlerLabel(
  h: EditorHandler,
  event: EventType,
  phase?: EventPhase,
): string {
  if (h.name.trim()) return h.name.trim();
  if (!eventUsesFilters(event) || phase === "pre") {
    return event === "user_joined"
      ? "on join"
      : event === "user_left"
        ? "on leave"
        : "pre-handler";
  }
  const f = h.filter;
  if (f.kind === "command") return f.triggers[0]?.trim() || "command";
  if (f.kind === "catch_all") return "catch-all";
  if (f.kind === "contains") return `contains "${f.text || "…"}"`;
  if (f.kind === "starts_with") return `starts "${f.text || "…"}"`;
  if (f.kind === "regex") return `/${f.pattern || "…"}/`;
  return "handler";
}

export function handlersOf(
  pack: EditorPack,
  event: EventType,
  phase: EventPhase,
): EditorHandler[] {
  const effectivePhase = eventUsesFilters(event) ? phase : "handlers";
  const group = pack.eventGroups.find(
    (g) => g.event === event && g.phase === effectivePhase,
  );
  return group?.handlers ?? [];
}

export function setEventHandlers(
  pack: EditorPack,
  event: EventType,
  phase: EventPhase,
  handlers: EditorHandler[],
): EditorPack {
  return setHandlers(pack, event, phase, handlers);
}
export function messageHandlersOf(
  pack: EditorPack,
  phase: EventPhase,
): EditorHandler[] {
  return handlersOf(pack, "message", phase);
}

function setHandlers(
  pack: EditorPack,
  event: EventType,
  phase: EventPhase,
  handlers: EditorHandler[],
): EditorPack {
  const effectivePhase = eventUsesFilters(event) ? phase : "handlers";
  const rest = pack.eventGroups.filter(
    (g) => !(g.event === event && g.phase === effectivePhase),
  );
  const prev = pack.eventGroups.find(
    (g) => g.event === event && g.phase === effectivePhase,
  );
  const group: EditorEventGroup = {
    clientId: prev?.clientId ?? clientId(),
    event,
    phase: effectivePhase,
    defaultPriority: prev?.defaultPriority ?? pack.priority,
    handlers,
  };
  return {
    ...pack,
    eventGroups: [...rest, group],
  };
}

export function addEventHandler(
  pack: EditorPack,
  event: EventType,
  phase: EventPhase,
  kind: EditorFilter["kind"] = "command",
): EditorPack {
  const list = handlersOf(pack, event, phase);
  return setHandlers(pack, event, phase, [...list, blankHandler(event, kind)]);
}

/** @deprecated use addEventHandler */
export function addMessageHandler(
  pack: EditorPack,
  phase: EventPhase,
  kind: EditorFilter["kind"] = "command",
): EditorPack {
  return addEventHandler(pack, "message", phase, kind);
}

export function listHandlerLabels(
  pack: EditorPack,
  event: EventType,
  phase: EventPhase,
): string[] {
  return handlersOf(pack, event, phase).map((h) =>
    handlerLabel(h, event, phase),
  );
}

const EVENT_TABS: { id: EventType; label: string }[] = [
  { id: "message", label: eventTypeLabels.message },
  { id: "user_joined", label: eventTypeLabels.user_joined },
  { id: "user_left", label: eventTypeLabels.user_left },
];

export function EventsPanel({
  config,
  onChange,
  selectedIndex,
  onSelect,
  eventType,
  onEventTypeChange,
  phase,
  onPhaseChange,
}: {
  config: EditorConfig;
  onChange: (config: EditorConfig) => void;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  eventType: EventType;
  onEventTypeChange: (event: EventType) => void;
  phase: EventPhase;
  onPhaseChange: (phase: EventPhase) => void;
}) {
  const pack = config.packs[0];
  const handlers = useMemo(
    () => (pack ? handlersOf(pack, eventType, phase) : []),
    [pack, eventType, phase],
  );
  const showFilters = eventUsesFilters(eventType);

  function updatePack(next: EditorPack) {
    if (!pack) return;
    onChange({
      ...config,
      packs: config.packs.map((p) => (p.clientId === pack.clientId ? next : p)),
    });
  }

  function patchHandlers(nextHandlers: EditorHandler[]) {
    if (!pack) return;
    updatePack(setHandlers(pack, eventType, phase, nextHandlers));
  }

  if (!pack) {
    return <p className="text-sm text-muted-foreground">No pack loaded.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <TextInput
          value={pack.name}
          placeholder="Pack name"
          className="min-w-[10rem] flex-1 font-medium"
          onChange={(e) => updatePack({ ...pack, name: e.target.value })}
        />
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Priority
          <TextInput
            type="number"
            value={String(pack.priority)}
            className="w-16 font-mono"
            onChange={(e) =>
              updatePack({ ...pack, priority: Number(e.target.value) || 0 })
            }
          />
        </label>
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {EVENT_TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              onEventTypeChange(id);
              onSelect(null);
              if (!eventUsesFilters(id)) onPhaseChange("handlers");
            }}
            className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
              eventType === id
                ? "bg-[var(--color-hover)] text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
            <span className="ml-1.5 text-muted-foreground">
              {
                handlersOf(pack, id, id === "message" ? phase : "handlers")
                  .length
              }
            </span>
          </button>
        ))}
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        {eventType === "message" ? (
          phase === "pre" ? (
            <>
              Pre-handlers always run (no filter) before matching;{" "}
              <span className="font-mono">stop event</span> aborts the pipeline.
            </>
          ) : (
            <>
              First matching handler wins. Pre-handlers run before matching;{" "}
              <span className="font-mono">stop event</span> aborts the pipeline.
            </>
          )
        ) : eventType === "user_joined" ? (
          <>
            Runs in <span className="text-foreground/80">groups only</span> when
            a member is added. Every handler runs in order (no command filter).
          </>
        ) : (
          <>
            Runs in <span className="text-foreground/80">groups only</span> when
            a member leaves or is removed. Every handler runs in order (no
            command filter).
          </>
        )}
      </p>

      {showFilters ? (
        <div className="mb-4 flex gap-1">
          {(
            [
              ["handlers", "Handlers"],
              ["pre", "Pre-handlers"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                onPhaseChange(id);
                onSelect(null);
              }}
              className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
                phase === id
                  ? "bg-[var(--color-hover)] text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              <span className="ml-1.5 text-muted-foreground">
                {handlersOf(pack, "message", id).length}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {handlers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No{" "}
          {eventType === "message"
            ? phase === "pre"
              ? "pre-handlers"
              : "handlers"
            : "handlers"}{" "}
          yet. Add one from the rail.
        </p>
      ) : selectedIndex == null || !handlers[selectedIndex] ? (
        <p className="text-sm text-muted-foreground">
          Select a handler in the rail.
        </p>
      ) : (
        <HandlerCard
          key={handlers[selectedIndex]!.clientId}
          handler={handlers[selectedIndex]!}
          eventType={eventType}
          phase={phase}
          disableUp={selectedIndex === 0}
          disableDown={selectedIndex === handlers.length - 1}
          onChange={(patch) => {
            const next = [...handlers];
            next[selectedIndex] = { ...next[selectedIndex]!, ...patch };
            patchHandlers(next);
          }}
          onUp={() => {
            patchHandlers(moveItem(handlers, selectedIndex, -1));
            onSelect(Math.max(0, selectedIndex - 1));
          }}
          onDown={() => {
            patchHandlers(moveItem(handlers, selectedIndex, 1));
            onSelect(Math.min(handlers.length - 1, selectedIndex + 1));
          }}
          onRemove={() => {
            patchHandlers(removeAt(handlers, selectedIndex));
            const len = handlers.length - 1;
            onSelect(len <= 0 ? null : Math.min(selectedIndex, len - 1));
          }}
        />
      )}
    </div>
  );
}

function HandlerCard({
  handler,
  eventType,
  phase,
  onChange,
  onUp,
  onDown,
  onRemove,
  disableUp,
  disableDown,
}: {
  handler: EditorHandler;
  eventType: EventType;
  phase: EventPhase;
  onChange: (patch: Partial<EditorHandler>) => void;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  disableUp: boolean;
  disableDown: boolean;
}) {
  const filter = handler.filter;
  const showFilters = eventUsesFilters(eventType) && phase !== "pre";
  const isAlwaysRun = !showFilters;

  function setFilter(next: EditorFilter) {
    onChange({ filter: next });
  }

  const paramNames =
    showFilters && filter.kind === "command" ? filter.parameters : [];

  return (
    <article className="space-y-3 border border-border bg-secondary/40 px-2 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {isAlwaysRun ? (
          <span className="rounded-sm bg-secondary px-2 py-1 text-xs text-muted-foreground">
            Always runs
          </span>
        ) : (
          <MenuSelect
            size="sm"
            ariaLabel="Filter kind"
            value={filter.kind}
            onChange={(kind) => {
              const k = kind as EditorFilter["kind"];
              if (k === filter.kind) return;
              setFilter(
                k === "command"
                  ? { kind: "command", triggers: ["/"], parameters: [] }
                  : k === "contains"
                    ? { kind: "contains", text: "" }
                    : k === "starts_with"
                      ? { kind: "starts_with", text: "" }
                      : k === "regex"
                        ? { kind: "regex", pattern: "" }
                        : { kind: "catch_all" },
              );
            }}
            options={[
              { value: "command", label: "Command" },
              { value: "contains", label: "Contains" },
              { value: "starts_with", label: "Starts with" },
              { value: "regex", label: "Regex" },
              { value: "catch_all", label: "Catch-all" },
            ]}
          />
        )}
        <TextInput
          value={handler.name}
          placeholder="name"
          className="w-28 shrink-0 sm:w-36"
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <div className="ml-auto">
          <RowMenu
            label="Handler menu"
            disableUp={disableUp}
            disableDown={disableDown}
            onUp={onUp}
            onDown={onDown}
            onRemove={onRemove}
          />
        </div>
      </div>

      {isAlwaysRun ? (
        <p className="text-xs text-muted-foreground">
          {eventType === "message" ? (
            <>
              Pre-handlers are action lists only — no command/filter. They run
              on every message before handlers; use{" "}
              <span className="font-mono">stop event</span> to abort the rest of
              the pipeline.
            </>
          ) : eventType === "user_joined" ? (
            <>
              Fires when someone joins this group.{" "}
              <span className="font-mono">user</span> is the member who joined.
            </>
          ) : (
            <>
              Fires when someone leaves or is removed.{" "}
              <span className="font-mono">user</span> is the member who left.
            </>
          )}
        </p>
      ) : null}

      {showFilters && filter.kind === "command" ? (
        <CommandFilterFields
          triggers={filter.triggers}
          parameters={filter.parameters}
          onTriggers={(triggers) => setFilter({ ...filter, triggers })}
          onParameters={(parameters) => setFilter({ ...filter, parameters })}
        />
      ) : null}

      {showFilters &&
      (filter.kind === "contains" || filter.kind === "starts_with") ? (
        <TextInput
          value={filter.text}
          placeholder={filter.kind === "contains" ? "text to find" : "prefix"}
          className="font-mono"
          onChange={(e) => setFilter({ ...filter, text: e.target.value })}
        />
      ) : null}

      {showFilters && filter.kind === "regex" ? (
        <TextInput
          value={filter.pattern}
          placeholder="^pattern$"
          className="font-mono"
          onChange={(e) => setFilter({ ...filter, pattern: e.target.value })}
        />
      ) : null}

      {showFilters && filter.kind === "catch_all" ? (
        <p className="text-xs text-muted-foreground">
          Runs when no other handler matched (bot-level fallback comes after).
        </p>
      ) : null}

      <div className="border-t border-border pt-2">
        <ExtraParamsProvider extraParams={paramDraftsFromNames(paramNames)}>
          <ActionList
            actions={handler.actions as EditorAction[]}
            onChange={(actions) => onChange({ actions })}
          />
        </ExtraParamsProvider>
      </div>
    </article>
  );
}

function CommandFilterFields({
  triggers,
  parameters,
  onTriggers,
  onParameters,
}: {
  triggers: string[];
  parameters: string[];
  onTriggers: (t: string[]) => void;
  onParameters: (p: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <TextInput
          value={triggers[0] ?? ""}
          placeholder="/trigger"
          spellCheck={false}
          className="w-[7.5rem] shrink-0 font-mono text-sm"
          aria-label="Primary trigger"
          onChange={(e) => {
            const primary = e.target.value;
            const rest = triggers.slice(1);
            onTriggers(primary.trim() ? [primary, ...rest] : rest);
          }}
        />
        {parameters.map((param, i) => (
          <div key={i} className="relative inline-flex shrink-0">
            <TextInput
              value={param}
              placeholder={`param${i + 1}`}
              spellCheck={false}
              className="w-[5.5rem] shrink-0 pr-6 font-mono text-sm"
              onChange={(e) => {
                const next = [...parameters];
                next[i] = e.target.value;
                onParameters(next.slice(0, MAX_COMMAND_PARAMS));
              }}
            />
            <button
              type="button"
              className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onParameters(parameters.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        ))}
        {parameters.length < MAX_COMMAND_PARAMS ? (
          <button
            type="button"
            className="inline-flex h-9 shrink-0 items-center rounded-sm border border-dashed border-border px-2 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground"
            onClick={() =>
              onParameters([...parameters, `param${parameters.length + 1}`])
            }
          >
            + param
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Aliases</span>
        {triggers.slice(1).map((t, ti) => (
          <span
            key={`${t}-${ti}`}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 font-mono text-xs"
          >
            {t}
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() =>
                onTriggers(triggers.filter((_, i) => i !== ti + 1))
              }
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
            onTriggers([...triggers, t]);
          }}
        >
          + alias
        </button>
      </div>
    </div>
  );
}
