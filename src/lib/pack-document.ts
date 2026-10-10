export type PackAction = {
  type: string;
  actions?: PackAction[];
  elseActions?: PackAction[];
  defaultActions?: PackAction[];
  cases?: { match?: unknown; actions?: PackAction[] }[];
  target?: string;
  function?: string;
  [key: string]: unknown;
};

export type PackHandler = {
  id: string;
  name: string;
  filter: { kind: string; [key: string]: unknown };
  actions: PackAction[];
};

export type PackEventGroup = {
  event: string;
  phase: "pre" | "handlers";
  defaultPriority?: number;
  handlers: PackHandler[];
};

export type PackFunction = {
  id: string;
  name: string;
  kind?: "action" | "value";
  exposed?: boolean;
  parameters?: { name: string; type: string }[];
  actions: PackAction[];
};

export type PackVariable = {
  name: string;
  scope: string;
  type: string;
  group?: string;
  default?: unknown;
  expose?: boolean;
};

export type PackDocument = {
  dependencies: { packId: string; version: string }[];
  events: PackEventGroup[];
  functions: PackFunction[];
  assets: { id: string; name: string; type: string; [key: string]: unknown }[];
  variables: PackVariable[];
};

export type History = { past: string[]; present: string; future: string[] };

export const ACTION_LABELS: Record<string, string> = {
  send_message: "Send message",
  send_media: "Send media",
  reply_message: "Reply",
  react_message: "React",
  delete_message: "Delete message",
  group_participants: "Change members",
  group_setting: "Group setting",
  group_update: "Update group",
  get_group: "Get group",
  set_variable: "Set variable",
  get_asset: "Get asset",
  get_user: "Get user",
  get_user_from_mention: "Get user from mention",
  get_type: "Get type",
  wait: "Wait",
  if: "If",
  switch: "Switch",
  repeat: "Repeat",
  break: "Break",
  continue: "Continue",
  call_function: "Call function",
  return: "Return",
  stop_event: "Stop event",
  get_key: "Get key",
  set_key: "Set key",
  delete_key: "Delete key",
  array_append: "Append to array",
  array_prepend: "Prepend to array",
  array_insert: "Insert into array",
  array_remove: "Remove from array",
  array_set: "Set array index",
  array_clear: "Clear array",
  for_each: "For each",
  log: "Log",
};

export const QUOTED_PATHS = ["message.quotedMessageId", "message.quotedUserId", "message.quotedText"];

export function emptyDocument(): PackDocument {
  return { dependencies: [], events: [], functions: [], assets: [], variables: [] };
}

export function loadDocument(raw: string): PackDocument {
  return JSON.parse(raw) as PackDocument;
}

export function saveDocument(doc: PackDocument): string {
  return JSON.stringify(doc);
}

export function historyFrom(doc: PackDocument): History {
  return { past: [], present: saveDocument(doc), future: [] };
}

export function commit(history: History, doc: PackDocument): History {
  const present = saveDocument(doc);
  if (present === history.present) return history;
  return { past: [...history.past, history.present], present, future: [] };
}

export function undo(history: History): History {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}

export function redo(history: History): History {
  const next = history.future[0];
  if (!next) return history;
  return { past: [...history.past, history.present], present: next, future: history.future.slice(1) };
}

export function current(history: History): PackDocument {
  return loadDocument(history.present);
}

export function actionLabel(type: string): string {
  return ACTION_LABELS[type] ?? type;
}

export function blankAction(type: string): PackAction {
  if (type === "send_message") return { type, text: "" };
  if (type === "send_media") return { type, text: "", image: "" };
  if (type === "reply_message") return { type, text: "" };
  if (type === "react_message") return { type, emoji: "" };
  if (type === "delete_message") return { type };
  if (type === "group_participants") return { type, action: "remove", users: "" };
  if (type === "group_setting") return { type, setting: "announcement" };
  if (type === "group_update") return { type, subject: "" };
  if (type === "get_group") return { type };
  if (type === "set_variable") return { type, target: "local.value", value: "" };
  if (type === "get_asset") return { type, asset: "" };
  if (type === "get_user") return { type, userId: "user.id" };
  if (type === "get_user_from_mention") return { type, mention: "params.userId" };
  if (type === "get_type") return { type, value: "" };
  if (type === "wait") return { type, duration: { type: "literal", value: 1 } };
  if (type === "if") return { type, condition: { type: "literal", value: true }, actions: [], elseActions: [] };
  if (type === "switch") return { type, value: { type: "literal", value: "" }, cases: [{ match: { type: "literal", value: "" }, actions: [] }], defaultActions: [] };
  if (type === "repeat") return { type, count: 1, actions: [] };
  if (type === "call_function") return { type, function: "" };
  if (type === "return") return { type };
  if (type === "get_link") return { type };
  if (type === "reset_link") return { type };
  if (type === "get_key") return { type, source: "chat.Map", key: "local.target", target: "local.value" };
  if (type === "set_key") return { type, source: "chat.Map", key: "local.target", value: { type: "literal", value: true } };
  if (type === "delete_key") return { type, source: "chat.Map", key: "local.target" };
  if (type === "array_append") return { type, target: "local.list", value: { type: "literal", value: "" } };
  if (type === "array_prepend") return { type, target: "local.list", value: { type: "literal", value: "" } };
  if (type === "array_insert") return { type, target: "local.list", index: { type: "literal", value: 0 }, value: { type: "literal", value: "" } };
  if (type === "array_remove") return { type, target: "local.list", value: { type: "literal", value: "" } };
  if (type === "array_set") return { type, target: "local.list", index: { type: "literal", value: 0 }, value: { type: "literal", value: "" } };
  if (type === "array_clear") return { type, target: "local.list" };
  if (type === "for_each") return { type, list: "local.list", as: "local.item", actions: [] };
  if (type === "log") return { type, level: "info", text: "" };
  return { type };
}

export function conditionTemplate(kind: "starts-with" | "is-admin"): PackAction | { trigger: string } {
  if (kind === "starts-with") return { trigger: "/" };
  return {
    type: "if",
    condition: { type: "binary", operator: "==", left: { type: "variable", path: "user.isAdmin" }, right: { type: "literal", value: true } },
    actions: [],
    elseActions: [],
  };
}

export type InsertItem = { id: string; label: string; group: string; type: string; callee?: string };

export function insertTree(
  doc: PackDocument,
  dependencies: { slug: string; functions: { name: string; kind?: string; exposed?: boolean }[] }[],
): InsertItem[] {
  const items: InsertItem[] = Object.keys(ACTION_LABELS).map((type) => ({ id: type, label: actionLabel(type), group: "Actions", type }));
  items.push({ id: "starts-with", label: "Message starts with", group: "Conditions", type: "trigger" });
  items.push({ id: "is-admin", label: "User is admin", group: "Conditions", type: "if" });
  for (const fn of doc.functions) {
    if (fn.kind === "value") items.push({ id: `call:${fn.name}`, label: fn.name, group: "Value functions", type: "call", callee: fn.name });
  }
  for (const dep of dependencies) {
    for (const fn of dep.functions) {
      if (fn.kind === "value" && fn.exposed) {
        items.push({ id: `call:${dep.slug}.${fn.name}`, label: `${dep.slug}.${fn.name}`, group: "Dependencies", type: "call", callee: `${dep.slug}.${fn.name}` });
      }
    }
  }
  return items;
}

export function validateDocument(
  doc: PackDocument,
  dependencies: { slug: string; functions: { name: string; kind?: string; exposed?: boolean }[] }[],
): string[] {
  const issues: string[] = [];
  const known = new Set(doc.functions.map((fn) => fn.name));
  const depSlugs = new Set(dependencies.map((dep) => dep.slug));
  for (const group of doc.events) {
    for (const handler of group.handlers) {
      if (handler.filter.kind === "command") {
        const triggers = (handler.filter.triggers as string[] | undefined) ?? [];
        if (!triggers.some((trigger) => String(trigger).trim())) {
          issues.push(`Handler "${handler.name}" has an empty trigger`);
        }
      }
      walk(handler.actions, issues, known, depSlugs, dependencies, false);
    }
  }
  for (const fn of doc.functions) walk(fn.actions, issues, known, depSlugs, dependencies, fn.kind === "value");
  return issues;
}

function walk(
  actions: PackAction[],
  issues: string[],
  known: Set<string>,
  depSlugs: Set<string>,
  dependencies: { slug: string; functions: { name: string; kind?: string; exposed?: boolean }[] }[],
  inValue: boolean,
) {
  for (const action of actions) {
    if (action.type === "send_message" && !action.text) issues.push("Send message needs text");
    if (action.type === "get_user" && !action.userId) issues.push("Get user needs a user id");
    if (action.type === "get_user_from_mention" && !action.mention) issues.push("Get user from mention needs a mention");
    if (action.type === "call_function" && !action.function) issues.push("Call function needs a target");
    if (typeof action.function === "string" && action.function.includes(".")) {
      const [slug, name] = action.function.split(".");
      if (!depSlugs.has(slug!)) issues.push(`Call ${action.function} has no dependency`);
      const dep = dependencies.find((item) => item.slug === slug);
      const fn = dep?.functions.find((item) => item.name === name);
      if (dep && fn && !fn.exposed) issues.push(`Call ${action.function} is not exposed`);
    } else if (typeof action.function === "string" && action.function && !known.has(action.function)) {
      issues.push(`Unknown call target ${action.function}`);
    }
    if (inValue && ["send_message", "wait", "group_participants", "group_setting", "group_update"].includes(action.type)) {
      issues.push(`Value function cannot use ${action.type}`);
    }
    if (inValue && action.type === "set_variable" && /^(chat|user|global|session)\./.test(String(action.target ?? ""))) {
      issues.push("Value function cannot write saved variables");
    }
    if (Array.isArray(action.actions)) walk(action.actions, issues, known, depSlugs, dependencies, inValue);
    if (Array.isArray(action.elseActions)) walk(action.elseActions, issues, known, depSlugs, dependencies, inValue);
    if (Array.isArray(action.defaultActions)) walk(action.defaultActions, issues, known, depSlugs, dependencies, inValue);
    if (Array.isArray(action.cases)) {
      for (const item of action.cases) {
        if (item && typeof item === "object" && Array.isArray((item as { actions?: unknown }).actions)) {
          walk((item as { actions: PackAction[] }).actions, issues, known, depSlugs, dependencies, inValue);
        }
      }
    }
  }
}
