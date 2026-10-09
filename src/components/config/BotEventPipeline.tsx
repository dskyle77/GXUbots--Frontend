"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getBot } from "../../lib/bots";
import { api } from "../../lib/api";
import {
  parseAction,
  serializeExpression,
  type EditorAction,
} from "../../lib/config-editor";
import type { InstalledPack } from "../../lib/packs";
import { ActionList } from "./ActionList";
import { EditorConfigProvider } from "./config-context";
import { IconButton } from "./ui";
import { toast } from "../ui/toast";
import { Button } from "../ui/button";

type MessageGroupSummary = {
  phase: string;
  handlerNames: string[];
};

type InstalledWithGroups = InstalledPack & {
  messageGroups?: MessageGroupSummary[];
};

type BotEventConfig = {
  message?: {
    preOrder?: string[];
    handlersOrder?: string[];
    fallback?: unknown[];
  };
};

function packColor(packId: string): string {
  let h = 0;
  for (let i = 0; i < packId.length; i++) h = (h * 31 + packId.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 40% 45% / 0.25)`;
}

function orderPacks(
  packs: InstalledWithGroups[],
  phase: "pre" | "handlers",
  order: string[] | undefined,
): InstalledWithGroups[] {
  const relevant = packs.filter((p) =>
    (p.messageGroups ?? []).some(
      (g) =>
        (g.phase === phase || (phase === "handlers" && g.phase !== "pre")) &&
        g.handlerNames.length > 0,
    ),
  );
  if (!order?.length) {
    return [...relevant].sort((a, b) => b.priority - a.priority);
  }
  const map = new Map(relevant.map((p) => [p.packId, p]));
  const ordered: InstalledWithGroups[] = [];
  for (const id of order) {
    const p = map.get(id);
    if (p) {
      ordered.push(p);
      map.delete(id);
    }
  }
  for (const p of map.values()) ordered.push(p);
  return ordered;
}

function namesForPhase(pack: InstalledWithGroups, phase: "pre" | "handlers"): string[] {
  return (pack.messageGroups ?? [])
    .filter((g) =>
      phase === "pre" ? g.phase === "pre" : g.phase === "handlers" || g.phase !== "pre",
    )
    .flatMap((g) => g.handlerNames);
}

function wireToEditorActions(wire: unknown[]): EditorAction[] {
  return wire
    .map((a) => parseAction(a))
    .filter((a): a is EditorAction => a != null);
}

function editorActionsToWire(actions: EditorAction[]): unknown[] {
  // Use serialize via config-editor's internal path: re-serialize through pack helper
  // Minimal wire: rely on JSON from ActionList state by calling serializeConfig pattern
  // Import serializeAction isn't exported — approximate with a local map of common fields
  return actions.map(serializeActionLocal);
}

function serializeActionLocal(action: EditorAction): Record<string, unknown> {
  const base: Record<string, unknown> = { type: action.type };
  switch (action.type) {
    case "send_message":
      return { ...base, text: action.text };
    case "reply_message":
      return { ...base, text: action.text };
    case "react_message":
      return { ...base, emoji: action.emoji };
    case "wait":
      return { ...base, duration: serializeExpression(action.duration) };
    case "call_function":
      return {
        ...base,
        function: action.functionName,
        ...(action.args.length
          ? {
              arguments: Object.fromEntries(
                action.args
                  .filter((a) => a.name.trim())
                  .map((a) => [a.name.trim(), serializeExpression(a.value)]),
              ),
            }
          : {}),
      };
    case "stop_event":
    case "break":
    case "continue":
    case "delete_message":
      return base;
    case "if":
      return {
        ...base,
        condition: serializeExpression(action.condition),
        actions: action.actions.map(serializeActionLocal),
        ...(action.elseActions.length
          ? { elseActions: action.elseActions.map(serializeActionLocal) }
          : {}),
      };
    case "set_variable":
      return {
        ...base,
        target: action.target,
        value: serializeExpression(action.value),
      };
    default:
      return { ...action, clientId: undefined } as Record<string, unknown>;
  }
}

export function BotEventPipeline({
  botId,
  installed,
}: {
  botId: string;
  installed: InstalledWithGroups[];
}) {
  const [config, setConfig] = useState<BotEventConfig>({});
  const [fallback, setFallback] = useState<EditorAction[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getBot(botId)
      .then((bot) => {
        const raw = (bot as { eventConfig?: string | BotEventConfig }).eventConfig;
        let parsed: BotEventConfig = {};
        if (typeof raw === "string") {
          try {
            parsed = JSON.parse(raw) as BotEventConfig;
          } catch {
            parsed = {};
          }
        } else if (raw && typeof raw === "object") {
          parsed = raw;
        }
        setConfig(parsed);
        setFallback(wireToEditorActions(parsed.message?.fallback ?? []));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [botId]);

  const prePacks = useMemo(
    () => orderPacks(installed, "pre", config.message?.preOrder),
    [installed, config.message?.preOrder],
  );
  const handlerPacks = useMemo(
    () => orderPacks(installed, "handlers", config.message?.handlersOrder),
    [installed, config.message?.handlersOrder],
  );

  const move = useCallback(
    (phase: "pre" | "handlers", index: number, dir: -1 | 1) => {
      const list = phase === "pre" ? prePacks : handlerPacks;
      const j = index + dir;
      if (j < 0 || j >= list.length) return;
      const ids = list.map((p) => p.packId);
      const tmp = ids[index]!;
      ids[index] = ids[j]!;
      ids[j] = tmp;
      setConfig((c) => ({
        ...c,
        message: {
          ...c.message,
          ...(phase === "pre" ? { preOrder: ids } : { handlersOrder: ids }),
          fallback: c.message?.fallback,
        },
      }));
    },
    [prePacks, handlerPacks],
  );

  async function onSave() {
    setSaving(true);
    try {
      const eventConfig: BotEventConfig = {
        message: {
          preOrder: prePacks.map((p) => p.packId),
          handlersOrder: handlerPacks.map((p) => p.packId),
          fallback: editorActionsToWire(fallback),
        },
      };
      await api(`/api/bots/${botId}`, {
        method: "PATCH",
        body: JSON.stringify({ eventConfig }),
      });
      setConfig(eventConfig);
      toast.success("Event pipeline saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save pipeline");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return <p className="text-sm text-muted-foreground">Loading pipeline…</p>;
  }

  return (
    <div className="space-y-6 border-t border-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-foreground">On Message pipeline</h3>
          <p className="text-xs text-muted-foreground">
            Reorder pack groups. Internals stay locked. Fallback runs when nothing matches.
          </p>
        </div>
        <Button size="sm" loading={saving} onClick={() => void onSave()}>
          Save pipeline
        </Button>
      </div>

      <PipelineSection
        title="Pre-handlers"
        empty="No packs contribute pre-handlers."
        packs={prePacks}
        phase="pre"
        onMove={move}
      />

      <PipelineSection
        title="Handlers"
        empty="No packs contribute message handlers."
        packs={handlerPacks}
        phase="handlers"
        onMove={move}
      />

      <div>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Fallback
        </h4>
        <p className="mb-2 text-xs text-muted-foreground">
          Runs when no handler matched (bot-owned, one for the whole bot).
        </p>
        <div className="border border-border bg-secondary/30 px-2 py-2">
          <EditorConfigProvider
            config={{ name: "bot", description: "", packs: [] }}
          >
            <ActionList actions={fallback} onChange={setFallback} />
          </EditorConfigProvider>
        </div>
      </div>
    </div>
  );
}

function PipelineSection({
  title,
  empty,
  packs,
  phase,
  onMove,
}: {
  title: string;
  empty: string;
  packs: InstalledWithGroups[];
  phase: "pre" | "handlers";
  onMove: (phase: "pre" | "handlers", index: number, dir: -1 | 1) => void;
}) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      {packs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {packs.map((pack, index) => (
            <li
              key={pack.packId}
              className="flex items-start gap-2 border border-border px-2 py-2"
              style={{ background: packColor(pack.packId) }}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">{pack.name}</div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {namesForPhase(pack, phase).join(" · ") || "—"}
                </div>
              </div>
              <div className="flex shrink-0 gap-0.5">
                <IconButton
                  type="button"
                  label="Move up"
                  disabled={index === 0}
                  onClick={() => onMove(phase, index, -1)}
                >
                  ↑
                </IconButton>
                <IconButton
                  type="button"
                  label="Move down"
                  disabled={index === packs.length - 1}
                  onClick={() => onMove(phase, index, 1)}
                >
                  ↓
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
