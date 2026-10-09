/**
 * GXUbots event system — types
 * =================================================================
 *
 * EVENT = something that happened (message, user joined, …)
 * FILTER = event-specific match (command trigger, contains, …)
 * HANDLER = filter + actions
 * EVENT GROUP = pack contribution to one event type + phase (pre | handlers)
 * FALLBACK = bot-owned only; one per event pipeline (not on packs)
 *
 * Match rules:
 * - PRE: always run in order (no filter / not commands); stop_event aborts the whole pipeline
 * - HANDLERS: first match wins, then stop
 * - No match → bot fallback
 *
 * Pack JSON: `events[]` (handler groups per event type × phase).
 */

// ── Event types ──────────────────────────────────────────────

export const eventTypes = ["message", "user_joined", "user_left", "time"] as const;
export type EventType = (typeof eventTypes)[number];

export const eventTypeLabels: Record<EventType, string> = {
  message: "On Message",
  user_joined: "Member joined",
  user_left: "Member left",
  time: "On Time",
};

export type EventPhase = "pre" | "handlers";

// ── Filters (On Message v1) ──────────────────────────────────

export type MessageFilter =
  | {
      kind: "command";
      triggers: string[];
      parameters: string[];
    }
  | { kind: "contains"; text: string; caseSensitive?: boolean }
  | { kind: "starts_with"; text: string; caseSensitive?: boolean }
  | { kind: "regex"; pattern: string }
  | { kind: "catch_all" };

export type EditorFilter = MessageFilter;

// ── Handler / group (actions typed loosely to avoid circular imports) ──

export type EditorHandler = {
  clientId: string;
  id: string;
  name: string;
  filter: EditorFilter;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actions: any[];
};

export type EditorEventGroup = {
  clientId: string;
  event: EventType;
  phase: EventPhase;
  /** Higher runs earlier when bot has no override. */
  defaultPriority: number;
  handlers: EditorHandler[];
};

// ── Bot pipeline (Phase 5 types; not wired to UI yet) ────────

export type BotEventGroupRef = {
  packId: string;
  event: EventType;
  phase: EventPhase;
  order?: number;
};

export type BotEventPipeline = {
  event: EventType;
  groups: BotEventGroupRef[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fallback: { actions: any[] };
};

export function messageHandlers(groups: EditorEventGroup[], phase?: EventPhase): EditorHandler[] {
  return groups
    .filter((g) => g.event === "message" && (phase == null || g.phase === phase))
    .flatMap((g) => g.handlers);
}
