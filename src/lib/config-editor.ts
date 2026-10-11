import type { EditorEventGroup, EditorFilter, EditorHandler, EventPhase, EventType } from "./event-system";
import { eventTypes } from "./event-system";

export type ParameterType = "string" | "number" | "boolean" | "array" | "object";
export type VariableScope = "chat" | "user" | "global" | "session";
export type AssetType = "json" | "text" | "image" | "file";

export type { EditorEventGroup, EditorFilter, EditorHandler, EventPhase, EventType } from "./event-system";

/** Mirrors backend Expression; clientId is editor-only and stripped on serialize. */
export type UnaryOperator = "not" | "negative";

export type EditorExpression =
  | { clientId: string; type: "literal"; value: string | number | boolean | null }
  | { clientId: string; type: "variable"; path: string }
  | {
      clientId: string;
      type: "binary";
      operator: BinaryOperator;
      left: EditorExpression;
      right: EditorExpression;
    }
  | {
      clientId: string;
      type: "unary";
      operator: UnaryOperator;
      operand: EditorExpression;
    }
  | { clientId: string; type: "call"; callee: string; args: EditorExpression[] }
  | { clientId: string; type: "member"; object: EditorExpression; property: string };

export type BinaryOperator =
  | "=="
  | "!="
  | ">"
  | "<"
  | ">="
  | "<="
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "and"
  | "or";

export const compareOperators: BinaryOperator[] = ["==", "!=", ">", "<", ">=", "<="];
export const arithmeticOperators: BinaryOperator[] = ["+", "-", "*", "/", "%"];
export const logicOperators: BinaryOperator[] = ["and", "or"];
export const allBinaryOperators: BinaryOperator[] = [
  ...compareOperators,
  ...arithmeticOperators,
  ...logicOperators,
];

export type EditorAction =
  | { clientId: string; type: "send_message"; text: string }
  | { clientId: string; type: "send_media"; text: string; image: string; file: string }
  | {
      clientId: string;
      type: "set_variable";
      target: string;
      value: EditorExpression;
      valueType: ParameterType | "";
    }
  | { clientId: string; type: "get_asset"; asset: string }
  | {
      clientId: string;
      type: "get_user";
      userId: EditorExpression;
      target: string;
    }
  | {
      clientId: string;
      type: "get_user_from_mention";
      mention: EditorExpression;
      target: string;
    }
  | {
      clientId: string;
      type: "get_type";
      value: EditorExpression;
      target: string;
    }
  | { clientId: string; type: "wait"; duration: EditorExpression }
  | { clientId: string; type: "if"; condition: EditorExpression; actions: EditorAction[]; elseActions: EditorAction[] }
  | {
      clientId: string;
      type: "switch";
      value: EditorExpression;
      cases: { clientId: string; match: EditorExpression; actions: EditorAction[] }[];
      defaultActions: EditorAction[];
    }
  | { clientId: string; type: "repeat"; count: number; actions: EditorAction[] }
  | { clientId: string; type: "break" }
  | { clientId: string; type: "continue" }
  | { clientId: string; type: "stop_event" }
  | { clientId: string; type: "reply_message"; text: string; messageId: string }
  | { clientId: string; type: "react_message"; emoji: string; messageId: string }
  | { clientId: string; type: "delete_message"; messageId: string }
  | { clientId: string; type: "kick"; users: EditorExpression }
  | { clientId: string; type: "add_member"; users: EditorExpression }
  | { clientId: string; type: "promote"; users: EditorExpression }
  | { clientId: string; type: "demote"; users: EditorExpression }
  /** Only admins can edit group info */
  | { clientId: string; type: "lock_group" }
  /** Everyone can edit group info */
  | { clientId: string; type: "unlock_group" }
  /** Fetch group invite into local.getLink { code, url } */
  | { clientId: string; type: "get_link"; target: string }
  /** Revoke invite; store new link in local.getLink { code, url } */
  | { clientId: string; type: "reset_link"; target: string }
  | { clientId: string; type: "call_function"; functionName: string; args: { clientId: string; name: string; value: EditorExpression }[] }
  | { clientId: string; type: "return"; value: EditorExpression | null }
  | { clientId: string; type: "get_key"; source: string; key: EditorExpression; target: string }
  | { clientId: string; type: "set_key"; source: string; key: EditorExpression; value: EditorExpression }
  | { clientId: string; type: "delete_key"; source: string; key: EditorExpression }
  | { clientId: string; type: "array_append"; target: string; value: EditorExpression }
  | { clientId: string; type: "array_prepend"; target: string; value: EditorExpression }
  | { clientId: string; type: "array_insert"; target: string; index: EditorExpression; value: EditorExpression }
  | { clientId: string; type: "array_remove"; target: string; index: EditorExpression | null; value: EditorExpression | null; store: string }
  | { clientId: string; type: "array_set"; target: string; index: EditorExpression; value: EditorExpression }
  | { clientId: string; type: "array_clear"; target: string }
  | { clientId: string; type: "for_each"; list: EditorExpression; as: string; actions: EditorAction[] }
  | { clientId: string; type: "log"; level: "info" | "warn" | "error"; text: string };

export const MAX_COMMAND_PARAMS = 5;

export type EditorFunction = {
  clientId: string;
  id: string;
  name: string;
  kind: "action" | "value";
  exposed: boolean;
  parameters: { clientId: string; name: string; type: ParameterType }[];
  actions: EditorAction[];
};

export type EditorAsset = {
  clientId: string;
  id: string;
  name: string;
  type: AssetType;
  data: string;
  url: string;
};

export type EditorVariable = {
  clientId: string;
  name: string;
  scope: VariableScope;
  type: ParameterType;
  defaultValue: string;
  group: string;
  expose: boolean;
  /** Human label on bot settings (falls back to name). */
  label: string;
  /** Help text under the setting on bot settings. */
  description: string;
  /** When set, bot settings render a select instead of a free text field. */
  options: string[];
};

export type EditorPack = {
  clientId: string;
  id: string;
  name: string;
  /** Higher priority runs first when pack groups collide across packs. */
  priority: number;
  eventGroups: EditorEventGroup[];
  functions: EditorFunction[];
  assets: EditorAsset[];
  variables: EditorVariable[];
  publicApi: string[];
};

export type EditorConfig = {
  name: string;
  description: string;
  packs: EditorPack[];
};

export const actionTypes = [
  "send_message",
  "reply_message",
  "react_message",
  "delete_message",
  "send_media",
  "kick",
  "add_member",
  "promote",
  "demote",
  "lock_group",
  "unlock_group",
  "get_link",
  "reset_link",
  "set_variable",
  "get_asset",
  "get_user",
  "get_user_from_mention",
  "get_type",
  "wait",
  "if",
  "switch",
  "repeat",
  "break",
  "continue",
  "stop_event",
  "call_function",
  "return",
  "get_key",
  "set_key",
  "delete_key",
  "array_append",
  "array_prepend",
  "array_insert",
  "array_remove",
  "array_set",
  "array_clear",
  "for_each",
  "log",
] as const;

export const actionLabels: Record<(typeof actionTypes)[number], string> = {
  send_message: "Send message",
  reply_message: "Reply",
  react_message: "React",
  delete_message: "Delete message",
  send_media: "Send media",
  kick: "Kick",
  add_member: "Add member",
  promote: "Promote",
  demote: "Demote",
  lock_group: "Lock group",
  unlock_group: "Unlock group",
  get_link: "Get invite link",
  reset_link: "Reset invite link",
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
  stop_event: "Stop event",
  call_function: "Call function",
  return: "Return",
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

/** Grouped options for the action-type picker (search + sections). */
export const actionTypeGroups: {
  label: string;
  types: (typeof actionTypes)[number][];
}[] = [
  {
    label: "Messages",
    types: [
      "send_message",
      "reply_message",
      "react_message",
      "delete_message",
      "send_media",
    ],
  },
  {
    label: "Group",
    types: [
      "kick",
      "add_member",
      "promote",
      "demote",
      "lock_group",
      "unlock_group",
      "get_link",
      "reset_link",
    ],
  },
  {
    label: "Data",
    types: [
      "set_variable",
      "get_key",
      "set_key",
      "delete_key",
      "array_append",
      "array_prepend",
      "array_insert",
      "array_remove",
      "array_set",
      "array_clear",
      "get_asset",
      "get_user",
      "get_user_from_mention",
      "get_type",
    ],
  },
  {
    label: "Flow",
    types: ["if", "switch", "repeat", "for_each", "wait", "break", "continue", "stop_event", "log"],
  },
  {
    label: "Functions",
    types: ["call_function", "return"],
  },
];

export const parameterTypes: ParameterType[] = ["string", "number", "boolean", "array", "object"];
export const variableScopes: VariableScope[] = ["chat", "user", "global", "session"];

export function clientId() {
  return `c_${Math.random().toString(36).slice(2, 10)}`;
}

export function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export function literal(value: string | number | boolean | null = ""): EditorExpression {
  return { clientId: clientId(), type: "literal", value };
}

export function variableExpr(path = ""): EditorExpression {
  return { clientId: clientId(), type: "variable", path };
}

export function binaryExpr(
  operator: BinaryOperator = "==",
  left?: EditorExpression,
  right?: EditorExpression,
): EditorExpression {
  return {
    clientId: clientId(),
    type: "binary",
    operator,
    left: left ?? variableExpr(""),
    right: right ?? literal(""),
  };
}

export function unaryExpr(operator: UnaryOperator = "not", operand?: EditorExpression): EditorExpression {
  return { clientId: clientId(), type: "unary", operator, operand: operand ?? variableExpr("") };
}


/** Flatten a left-associated chain of the same and/or operator into a list. */
export function flattenLogic(expr: EditorExpression): { operator: "and" | "or"; items: EditorExpression[] } | null {
  if (expr.type !== "binary" || (expr.operator !== "and" && expr.operator !== "or")) return null;
  const op = expr.operator;
  const items: EditorExpression[] = [];
  function walk(node: EditorExpression) {
    if (node.type === "binary" && node.operator === op) {
      walk(node.left);
      walk(node.right);
    } else {
      items.push(node);
    }
  }
  walk(expr);
  return { operator: op, items };
}

/** Left-fold a list into binary and/or nodes. */
export function foldLogic(operator: "and" | "or", items: EditorExpression[]): EditorExpression {
  if (items.length === 0) return variableExpr("");
  if (items.length === 1) return items[0]!;
  return items.slice(1).reduce<EditorExpression>(
    (left, right) => binaryExpr(operator, left, right),
    items[0]!,
  );
}

export function blankAction(type: EditorAction["type"] = "send_message"): EditorAction {
  const id = clientId();
  switch (type) {
    case "send_message":
      return { clientId: id, type, text: "" };
    case "reply_message":
      return { clientId: id, type, text: "", messageId: "message.id" };
    case "react_message":
      return { clientId: id, type, emoji: "", messageId: "message.id" };
    case "delete_message":
      return { clientId: id, type, messageId: "message.id" };
    case "kick":
    case "add_member":
    case "promote":
    case "demote":
      return { clientId: id, type, users: variableExpr("") };
    case "lock_group":
    case "unlock_group":
      return { clientId: id, type };
    case "get_link":
    case "reset_link":
      return { clientId: id, type, target: "" };
    case "send_media":
      return { clientId: id, type, text: "", image: "", file: "" };
    case "set_variable":
      return { clientId: id, type, target: "", value: literal(""), valueType: "" };
    case "get_asset":
      return { clientId: id, type, asset: "" };
    case "get_user":
      return {
        clientId: id,
        type,
        userId: variableExpr("message.quotedUserId"),
        target: "",
      };
    case "get_user_from_mention":
      return {
        clientId: id,
        type,
        mention: variableExpr("params.userId"),
        target: "",
      };
    case "get_type":
      return {
        clientId: id,
        type,
        value: variableExpr("params."),
        target: "",
      };
    case "wait":
      return { clientId: id, type, duration: literal(1000) };
    case "if":
      return { clientId: id, type, condition: variableExpr(""), actions: [], elseActions: [] };
    case "switch":
      return {
        clientId: id,
        type,
        value: variableExpr(""),
        cases: [{ clientId: clientId(), match: literal(""), actions: [] }],
        defaultActions: [],
      };
    case "repeat":
      return { clientId: id, type, count: 1, actions: [] };
    case "break":
      return { clientId: id, type };
    case "continue":
      return { clientId: id, type };
    case "stop_event":
      return { clientId: id, type };
    case "call_function":
      return { clientId: id, type, functionName: "", args: [] };
    case "return":
      return { clientId: id, type, value: null };
    case "get_key":
      return {
        clientId: id,
        type,
        source: "chat.Map",
        key: variableExpr("local.target"),
        target: "local.value",
      };
    case "set_key":
      return {
        clientId: id,
        type,
        source: "chat.Map",
        key: variableExpr("local.target"),
        value: literal(true),
      };
    case "delete_key":
      return { clientId: id, type, source: "chat.Map", key: variableExpr("local.target") };
    case "array_append":
      return { clientId: id, type, target: "local.list", value: literal("") };
    case "array_prepend":
      return { clientId: id, type, target: "local.list", value: literal("") };
    case "array_insert":
      return { clientId: id, type, target: "local.list", index: literal(0), value: literal("") };
    case "array_remove":
      return { clientId: id, type, target: "local.list", index: null, value: literal(""), store: "" };
    case "array_set":
      return { clientId: id, type, target: "local.list", index: literal(0), value: literal("") };
    case "array_clear":
      return { clientId: id, type, target: "local.list" };
    case "for_each":
      return {
        clientId: id,
        type,
        list: variableExpr("local.list"),
        as: "local.item",
        actions: [],
      };
    case "log":
      return { clientId: id, type, level: "info", text: "" };
  }
}

export function emptyEditorConfig(name: string): EditorConfig {
  return { name, description: "", packs: [] };
}

export function blankPack(name = "Pack"): EditorPack {
  return {
    clientId: clientId(),
    id: newId("pack"),
    name,
    priority: 0,
    eventGroups: [],
    functions: [],
    assets: [],
    variables: [],
    publicApi: [],
  };
}

export function parseConfig(raw: string, fallbackName: string): EditorConfig {
  let parsed: unknown = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    return emptyEditorConfig(fallbackName);
  }
  const config = asRecord(parsed);
  return {
    name: asString(config.name) || fallbackName,
    description: asString(config.description),
    packs: asArray(config.packs).map(parsePack),
  };
}

function parsePack(value: unknown): EditorPack {
  const item = asRecord(value);
  const priority = Number.isFinite(Number(item.priority)) ? Number(item.priority) : 0;
  return {
    clientId: clientId(),
    id: asString(item.id) || newId("pack"),
    name: asString(item.name) || "Pack",
    priority,
    eventGroups: asArray(item.events).map((g) => parseEventGroup(g, priority)),
    functions: asArray(item.functions).map(parseFunction),
    assets: asArray(item.assets).map(parseAsset),
    variables: asArray(item.variables).map(parseVariable),
    publicApi: asArray(item.publicApi).map((x) => String(x).trim()).filter(Boolean),
  };
}

export function serializeConfig(config: EditorConfig) {
  return {
    name: config.name.trim(),
    ...(config.description.trim() ? { description: config.description.trim() } : {}),
    packs: config.packs.map(serializePack),
  };
}

function serializePack(pack: EditorPack) {
  return {
    id: pack.id.trim() || newId("pack"),
    name: pack.name.trim() || "Pack",
    priority: Number.isFinite(pack.priority) ? Math.trunc(pack.priority) : 0,
    events: pack.eventGroups.map(serializeEventGroup),
    functions: pack.functions.map(serializeFunction),
    assets: pack.assets.map(serializeAsset),
    variables: pack.variables.map(serializeVariable),
    ...(pack.publicApi.filter((x) => x.trim()).length
      ? { publicApi: pack.publicApi.map((x) => x.trim()).filter(Boolean) }
      : {}),
  };
}

// ── Event system parse / serialize ─────────────────

function parseEventGroup(value: unknown, fallbackPriority: number): EditorEventGroup {
  const item = asRecord(value);
  const eventRaw = asString(item.event) || "message";
  const event: EventType = (eventTypes as readonly string[]).includes(eventRaw)
    ? (eventRaw as EventType)
    : "message";
  const phase: EventPhase = item.phase === "pre" ? "pre" : "handlers";
  return {
    clientId: clientId(),
    event,
    phase,
    defaultPriority: Number.isFinite(Number(item.defaultPriority))
      ? Number(item.defaultPriority)
      : fallbackPriority,
    handlers: asArray(item.handlers).map(parseHandler),
  };
}

function serializeEventGroup(group: EditorEventGroup) {
  // Pre-handlers and non-message events are action lists only — no command filter.
  const filterless =
    group.phase === "pre" ||
    group.event === "user_joined" ||
    group.event === "user_left";
  return {
    event: group.event,
    phase: group.phase,
    defaultPriority: group.defaultPriority,
    handlers: group.handlers.map((h) => ({
      id: h.id.trim() || newId("handler"),
      name: h.name.trim() || h.id,
      filter: filterless
        ? { kind: "catch_all" as const }
        : serializeFilter(h.filter),
      actions: h.actions.map(serializeAction),
    })),
  };
}

function parseHandler(value: unknown): EditorHandler {
  const item = asRecord(value);
  return {
    clientId: clientId(),
    id: asString(item.id) || newId("handler"),
    name: asString(item.name),
    filter: parseFilter(item.filter),
    actions: asArray(item.actions).map(parseAction).filter(Boolean) as EditorAction[],
  };
}

function parseFilter(value: unknown): EditorFilter {
  const item = asRecord(value);
  const kind = asString(item.kind) || "command";
  if (kind === "contains") {
    return {
      kind: "contains",
      text: asString(item.text),
      ...(item.caseSensitive === true ? { caseSensitive: true } : {}),
    };
  }
  if (kind === "starts_with") {
    return {
      kind: "starts_with",
      text: asString(item.text),
      ...(item.caseSensitive === true ? { caseSensitive: true } : {}),
    };
  }
  if (kind === "regex") {
    return { kind: "regex", pattern: asString(item.pattern) };
  }
  if (kind === "catch_all") {
    return { kind: "catch_all" };
  }
  const triggers = asArray(item.triggers)
    .map((t) => String(t).trim())
    .filter(Boolean);
  const parameters = asArray(item.parameters)
    .map((p) => {
      if (typeof p === "string") return p.trim();
      if (p && typeof p === "object" && "name" in (p as object)) {
        return String((p as { name: unknown }).name).trim();
      }
      return "";
    })
    .filter(Boolean)
    .slice(0, MAX_COMMAND_PARAMS);
  return {
    kind: "command",
    triggers: triggers.length ? triggers : ["/"],
    parameters,
  };
}

function serializeFilter(filter: EditorFilter): Record<string, unknown> {
  switch (filter.kind) {
    case "command":
      return {
        kind: "command",
        triggers: filter.triggers.map((t) => t.trim()).filter(Boolean),
        ...(filter.parameters.length
          ? { parameters: filter.parameters.map((p) => p.trim()).filter(Boolean).slice(0, MAX_COMMAND_PARAMS) }
          : {}),
      };
    case "contains":
      return {
        kind: "contains",
        text: filter.text,
        ...(filter.caseSensitive ? { caseSensitive: true } : {}),
      };
    case "starts_with":
      return {
        kind: "starts_with",
        text: filter.text,
        ...(filter.caseSensitive ? { caseSensitive: true } : {}),
      };
    case "regex":
      return { kind: "regex", pattern: filter.pattern };
    case "catch_all":
      return { kind: "catch_all" };
  }
}

function parseFunction(value: unknown): EditorFunction {
  const item = asRecord(value);
  return {
    clientId: clientId(),
    id: asString(item.id) || newId("fn"),
    name: asString(item.name),
    kind: item.kind === "value" ? "value" : "action",
    exposed: item.exposed === true,
    parameters: asArray(item.parameters).map((value) => {
      const parameter = asRecord(value);
      return { clientId: clientId(), name: asString(parameter.name), type: asParameterType(parameter.type) };
    }),
    actions: asArray(item.actions).map(parseAction).filter(Boolean) as EditorAction[],
  };
}

function parseAsset(value: unknown): EditorAsset {
  const item = asRecord(value);
  const type = asAssetType(item.type);
  return {
    clientId: clientId(),
    id: asString(item.id) || newId("asset"),
    name: asString(item.name),
    type,
    data: type === "json" ? stringifyValue(item.data ?? {}) : asString(item.data),
    url: asString(item.url),
  };
}

function parseVariable(value: unknown): EditorVariable {
  const item = asRecord(value);
  return {
    clientId: clientId(),
    name: asString(item.name),
    scope: asScope(item.scope),
    type: asParameterType(item.type),
    defaultValue: item.default === undefined ? "" : stringifyValue(item.default),
    group: asString(item.group),
    expose: item.expose === true,
    label: asString(item.label),
    description: asString(item.description),
    options: asArray(item.options).map((option) => asString(option)).filter(Boolean),
  };
}

export function parseAction(value: unknown): EditorAction | null {
  const item = asRecord(value);
  const type = asString(item.type);
  const id = clientId();
  switch (type) {
    case "send_message":
      return { clientId: id, type, text: asString(item.text) };
    case "reply_message":
      return { clientId: id, type, text: asString(item.text), messageId: messageIdOf(item.messageId) };
    case "react_message":
      return { clientId: id, type, emoji: asString(item.emoji), messageId: messageIdOf(item.messageId) };
    case "delete_message":
      return { clientId: id, type, messageId: messageIdOf(item.messageId) };
    case "kick":
    case "add_member":
    case "promote":
    case "demote":
      return { clientId: id, type, users: parseUsersField(item.users) };
    case "group_participants": {
      const groupAction = asString(item.action);
      const type = groupAction === "add" ? "add_member" : groupAction === "promote" ? "promote" : groupAction === "demote" ? "demote" : "kick";
      return { clientId: id, type, users: parseUsersField(item.users) };
    }
    case "group_setting": {
      const setting = asString(item.setting);
      if (setting === "locked") return { clientId: id, type: "lock_group" };
      if (setting === "unlocked") return { clientId: id, type: "unlock_group" };
      // announcement settings not exposed in the form editor yet
      return null;
    }
    case "lock_group":
    case "unlock_group":
      return { clientId: id, type };
    case "get_link":
    case "reset_link":
      return { clientId: id, type, target: asString(item.target) };
    case "get_key":
      return {
        clientId: id,
        type,
        source: asString(item.source) || "chat.Map",
        key: typeof item.key === "string" ? variableExpr(item.key) : parseExpression(item.key),
        target: asString(item.target) || "local.getKey",
      };
    case "set_key":
      return {
        clientId: id,
        type,
        source: asString(item.source) || "chat.Map",
        key: typeof item.key === "string" ? variableExpr(item.key) : parseExpression(item.key),
        value: parseExpression(item.value),
      };
    case "delete_key":
      return {
        clientId: id,
        type,
        source: asString(item.source) || "chat.Map",
        key: typeof item.key === "string" ? variableExpr(item.key) : parseExpression(item.key),
      };
    case "array_append":
      return {
        clientId: id,
        type,
        target: asString(item.target) || "local.list",
        value: parseExpression(item.value),
      };
    case "array_prepend":
      return {
        clientId: id,
        type,
        target: asString(item.target) || "local.list",
        value: parseExpression(item.value),
      };
    case "array_insert":
      return {
        clientId: id,
        type,
        target: asString(item.target) || "local.list",
        index: parseExpression(item.index),
        value: parseExpression(item.value),
      };
    case "array_remove":
      return {
        clientId: id,
        type,
        target: asString(item.target) || "local.list",
        index: item.index === undefined || item.index === null ? null : parseExpression(item.index),
        value: item.value === undefined ? null : parseExpression(item.value),
        store: asString(item.store),
      };
    case "array_set":
      return {
        clientId: id,
        type,
        target: asString(item.target) || "local.list",
        index: parseExpression(item.index),
        value: parseExpression(item.value),
      };
    case "array_clear":
      return {
        clientId: id,
        type,
        target: asString(item.target) || "local.list",
      };
    case "for_each":
      return {
        clientId: id,
        type,
        list: typeof item.list === "string" ? variableExpr(item.list) : parseExpression(item.list),
        as: asString(item.as) || "local.item",
        actions: Array.isArray(item.actions)
          ? item.actions.map((a: unknown) => parseAction(a as Record<string, unknown>)).filter(Boolean) as EditorAction[]
          : [],
      };
    case "log":
      return {
        clientId: id,
        type,
        level: (["info", "warn", "error"].includes(asString(item.level))
          ? asString(item.level)
          : "info") as "info" | "warn" | "error",
        text: asString(item.text),
      };
    case "send_media":
      return { clientId: id, type, text: asString(item.text), image: asString(item.image), file: asString(item.file) };
    case "set_variable": {
      const { value, valueType } = parseSetVariableValue(item.value, item.valueType);
      return {
        clientId: id,
        type,
        target: asString(item.target),
        value,
        valueType,
      };
    }
    case "get_asset":
      return { clientId: id, type, asset: asString(item.asset) };
    case "get_user": {
      const userIdRaw = item.userId;
      const userId =
        typeof userIdRaw === "string"
          ? variableExpr(userIdRaw)
          : parseExpression(userIdRaw);
      return {
        clientId: id,
        type,
        userId,
        target: asString(item.target),
      };
    }
    case "get_user_from_mention": {
      const mentionRaw = item.mention;
      const mention =
        typeof mentionRaw === "string"
          ? variableExpr(mentionRaw)
          : parseExpression(mentionRaw);
      return {
        clientId: id,
        type,
        mention,
        target: asString(item.target),
      };
    }
    case "get_type": {
      const valueRaw = item.value;
      const value =
        typeof valueRaw === "string"
          ? variableExpr(valueRaw)
          : parseExpression(valueRaw);
      return {
        clientId: id,
        type,
        value,
        target: asString(item.target),
      };
    }
    case "wait":
      return { clientId: id, type, duration: parseExpression(item.duration) };
    case "if":
      return {
        clientId: id,
        type,
        condition: parseExpression(item.condition),
        actions: asArray(item.actions).map(parseAction).filter(Boolean) as EditorAction[],
        elseActions: asArray(item.elseActions).map(parseAction).filter(Boolean) as EditorAction[],
      };
    case "switch":
      return {
        clientId: id,
        type,
        value: parseExpression(item.value),
        cases: asArray(item.cases).map((entry) => {
          const row = asRecord(entry);
          return {
            clientId: clientId(),
            match: parseExpression(row.match),
            actions: asArray(row.actions).map(parseAction).filter(Boolean) as EditorAction[],
          };
        }),
        defaultActions: asArray(item.defaultActions).map(parseAction).filter(Boolean) as EditorAction[],
      };
    case "repeat":
      return {
        clientId: id,
        type,
        count: Number.isFinite(Number(item.count)) ? Number(item.count) : 1,
        actions: asArray(item.actions).map(parseAction).filter(Boolean) as EditorAction[],
      };
    case "break":
    case "continue":
    case "stop_event":
      return { clientId: id, type };
    case "call_function":
      return {
        clientId: id,
        type,
        functionName: asString(item.function),
        args: Object.entries(asRecord(item.arguments)).map(([name, expr]) => ({
          clientId: clientId(),
          name,
          value: parseExpression(expr),
        })),
      };
    case "return":
      return { clientId: id, type, value: item.value === undefined ? null : parseExpression(item.value) };
    default:
      return null;
  }
}

const QUOTED_PATH_ALIASES: Record<string, string> = {
  "message.replyId": "message.quotedMessageId",
  "message.replySender": "message.quotedUserId",
  "message.replyText": "message.quotedText",
  "local.replyId": "message.quotedMessageId",
  "local.replySender": "message.quotedUserId",
  "local.replyText": "message.quotedText",
};

/** Old picker names. Backend only exposes message.quotedMessageId / quotedUserId / quotedText. */
export function rewriteQuotedPath(value: string): string {
  return QUOTED_PATH_ALIASES[value] ?? value;
}

/** Legacy packs store users as a plain path/phone string; new packs use full expressions. */
export function parseUsersField(value: unknown): EditorExpression {
  if (typeof value === "string") {
    const s = rewriteQuotedPath(value.trim());
    if (!s) return variableExpr("");
    // Path-like → variable; otherwise treat as literal (phone / raw id)
    if (/^[a-zA-Z_][\w.]*$/.test(s)) return variableExpr(s);
    return literal(s);
  }
  if (Array.isArray(value)) {
    return parseUsersField(value[0] ?? "");
  }
  return parseExpression(value);
}

/** Emit expression JSON; plain variable paths stay readable as strings for older tooling. */
export function serializeUsersField(expr: EditorExpression): unknown {
  if (expr.type === "variable" && expr.path.trim()) return expr.path.trim();
  if (expr.type === "literal" && (typeof expr.value === "string" || typeof expr.value === "number")) {
    return String(expr.value);
  }
  return serializeExpression(expr);
}

export function parseExpression(value: unknown): EditorExpression {
  const item = asRecord(value);
  if (item.type === "call") {
    return {
      clientId: clientId(),
      type: "call",
      callee: asString(item.callee),
      args: asArray(item.args).map(parseExpression),
    };
  }
  if (item.type === "member") {
    return {
      clientId: clientId(),
      type: "member",
      object: parseExpression(item.object),
      property: asString(item.property),
    };
  }
  if (item.type === "variable") {
    return { clientId: clientId(), type: "variable", path: rewriteQuotedPath(asString(item.path)) };
  }
  if (item.type === "binary") {
    const op = asString(item.operator) as BinaryOperator;
    return {
      clientId: clientId(),
      type: "binary",
      operator: allBinaryOperators.includes(op) ? op : "==",
      left: parseExpression(item.left),
      right: parseExpression(item.right),
    };
  }
  if (item.type === "unary") {
    const op: UnaryOperator = item.operator === "negative" ? "negative" : "not";
    return {
      clientId: clientId(),
      type: "unary",
      operator: op,
      operand: parseExpression(item.operand),
    };
  }
  if (item.type === "literal") {
    return { clientId: clientId(), type: "literal", value: asLiteral(item.value) };
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
    return { clientId: clientId(), type: "literal", value };
  }
  return literal("");
}

/** Strip clientIds; emit backend Expression JSON. */
export function serializeExpression(expr: EditorExpression): Record<string, unknown> {
  switch (expr.type) {
    case "literal":
      return { type: "literal", value: expr.value };
    case "variable":
      return { type: "variable", path: expr.path };
    case "call":
      return { type: "call", callee: expr.callee, args: expr.args.map(serializeExpression) };
    case "member":
      return { type: "member", object: serializeExpression(expr.object), property: expr.property };
    case "binary":
      return {
        type: "binary",
        operator: expr.operator,
        left: serializeExpression(expr.left),
        right: serializeExpression(expr.right),
      };
    case "unary":
      return {
        type: "unary",
        operator: expr.operator,
        operand: serializeExpression(expr.operand),
      };
  }
}

function serializeFunction(fn: EditorFunction) {
  return {
    id: fn.id.trim(),
    name: fn.name.trim(),
    kind: fn.kind,
    exposed: fn.exposed,
    ...(fn.parameters.length
      ? { parameters: fn.parameters.map((parameter) => ({ name: parameter.name.trim(), type: parameter.type })) }
      : {}),
    actions: fn.actions.map(serializeAction),
  };
}

function serializeAsset(asset: EditorAsset) {
  if (asset.type === "json") {
    return { id: asset.id.trim(), name: asset.name.trim(), type: asset.type, data: parseJson(asset.data, {}) };
  }
  if (asset.type === "text") {
    return { id: asset.id.trim(), name: asset.name.trim(), type: asset.type, data: asset.data };
  }
  return { id: asset.id.trim(), name: asset.name.trim(), type: asset.type, url: asset.url.trim() };
}

function serializeVariable(variable: EditorVariable) {
  const group = variable.group.trim();
  const label = variable.label.trim();
  const description = variable.description.trim();
  const options = variable.options.map((option) => option.trim()).filter(Boolean);
  return {
    name: variable.name.trim(),
    scope: variable.scope,
    type: variable.type,
    ...(variable.defaultValue.trim()
      ? { default: coerceValue(variable.defaultValue, variable.type) }
      : {}),
    ...(group ? { group } : {}),
    ...(variable.expose ? { expose: true } : {}),
    ...(label ? { label } : {}),
    ...(description ? { description } : {}),
    ...(options.length ? { options } : {}),
  };
}

export function variableGroups(variables: EditorVariable[]) {
  const groups: { label: string; items: { variable: EditorVariable; index: number }[] }[] = [];
  const seen = new Map<string, number>();
  variables.forEach((variable, index) => {
    const label = variable.group.trim();
    let slot = seen.get(label);
    if (slot === undefined) {
      slot = groups.length;
      seen.set(label, slot);
      groups.push({ label, items: [] });
    }
    groups[slot]!.items.push({ variable, index });
  });
  return groups;
}

function messageIdOf(value: unknown): string {
  if (typeof value === "string") return value;
  const item = asRecord(value);
  if (item.type === "variable") return asString(item.path);
  return "message.id";
}

function messageIdField(messageId: string): { messageId?: string } {
  const id = messageId.trim();
  return id ? { messageId: id } : {};
}

function serializeAction(action: EditorAction): Record<string, unknown> {
  switch (action.type) {
    case "send_message":
      return { type: action.type, text: action.text };
    case "reply_message":
      return { type: action.type, text: action.text, ...messageIdField(action.messageId) };
    case "react_message":
      return { type: action.type, emoji: action.emoji, ...messageIdField(action.messageId) };
    case "delete_message":
      return { type: action.type, ...messageIdField(action.messageId) };
    case "kick":
      return { type: "group_participants", action: "remove", users: serializeUsersField(action.users) };
    case "add_member":
      return { type: "group_participants", action: "add", users: serializeUsersField(action.users) };
    case "promote":
      return { type: "group_participants", action: "promote", users: serializeUsersField(action.users) };
    case "demote":
      return { type: "group_participants", action: "demote", users: serializeUsersField(action.users) };
    case "lock_group":
      return { type: "group_setting", setting: "locked" };
    case "unlock_group":
      return { type: "group_setting", setting: "unlocked" };
    case "get_link":
    case "reset_link":
      return {
        type: action.type,
        ...(action.target.trim() ? { target: action.target.trim() } : {}),
      };
    case "send_media":
      return {
        type: action.type,
        ...(action.text ? { text: action.text } : {}),
        ...(action.image.trim() ? { image: action.image.trim() } : {}),
        ...(action.file.trim() ? { file: action.file.trim() } : {}),
      };
    case "set_variable":
      return {
        type: action.type,
        target: action.target.trim(),
        value: serializeSetVariableValue(action.value, action.valueType),
        ...(action.valueType ? { valueType: action.valueType } : {}),
      };
    case "get_asset":
      return { type: action.type, asset: action.asset.trim() };
    case "get_user":
      return {
        type: action.type,
        userId: serializeExpression(action.userId),
        ...(action.target.trim() ? { target: action.target.trim() } : {}),
      };
    case "get_user_from_mention":
      return {
        type: action.type,
        mention: serializeExpression(action.mention),
        ...(action.target.trim() ? { target: action.target.trim() } : {}),
      };
    case "get_type":
      return {
        type: action.type,
        value: serializeExpression(action.value),
        ...(action.target.trim() ? { target: action.target.trim() } : {}),
      };
    case "wait":
      return { type: action.type, duration: serializeExpression(action.duration) };
    case "if":
      return {
        type: action.type,
        condition: serializeExpression(action.condition),
        actions: action.actions.map(serializeAction),
        ...(action.elseActions.length ? { elseActions: action.elseActions.map(serializeAction) } : {}),
      };
    case "switch":
      return {
        type: action.type,
        value: serializeExpression(action.value),
        cases: action.cases.map((item) => ({
          match: serializeExpression(item.match),
          actions: item.actions.map(serializeAction),
        })),
        ...(action.defaultActions.length ? { defaultActions: action.defaultActions.map(serializeAction) } : {}),
      };
    case "repeat":
      return { type: action.type, count: action.count, actions: action.actions.map(serializeAction) };
    case "break":
    case "continue":
    case "stop_event":
      return { type: action.type };
    case "get_key":
      return {
        type: action.type,
        source: action.source.trim(),
        key: serializeExpression(action.key),
        ...(action.target.trim() ? { target: action.target.trim() } : {}),
      };
    case "set_key":
      return {
        type: action.type,
        source: action.source.trim(),
        key: serializeExpression(action.key),
        value: serializeExpression(action.value),
      };
    case "delete_key":
      return {
        type: action.type,
        source: action.source.trim(),
        key: serializeExpression(action.key),
      };
    case "array_append":
      return {
        type: action.type,
        target: action.target.trim(),
        value: serializeExpression(action.value),
      };
    case "array_prepend":
      return {
        type: action.type,
        target: action.target.trim(),
        value: serializeExpression(action.value),
      };
    case "array_insert":
      return {
        type: action.type,
        target: action.target.trim(),
        index: serializeExpression(action.index),
        value: serializeExpression(action.value),
      };
    case "array_remove":
      return {
        type: action.type,
        target: action.target.trim(),
        ...(action.index ? { index: serializeExpression(action.index) } : {}),
        ...(action.value ? { value: serializeExpression(action.value) } : {}),
        ...(action.store.trim() ? { store: action.store.trim() } : {}),
      };
    case "array_set":
      return {
        type: action.type,
        target: action.target.trim(),
        index: serializeExpression(action.index),
        value: serializeExpression(action.value),
      };
    case "array_clear":
      return {
        type: action.type,
        target: action.target.trim(),
      };
    case "for_each":
      return {
        type: action.type,
        list: serializeExpression(action.list),
        as: action.as.trim() || "local.item",
        actions: action.actions.map(serializeAction),
      };
    case "log":
      return {
        type: action.type,
        level: action.level,
        text: action.text,
      };
    case "call_function":
      return {
        type: action.type,
        function: action.functionName.trim(),
        ...(action.args.length
          ? {
              arguments: Object.fromEntries(
                action.args
                  .filter((arg) => arg.name.trim())
                  .map((arg) => [arg.name.trim(), serializeExpression(arg.value)]),
              ),
            }
          : {}),
      };
    case "return":
      return action.value
        ? { type: action.type, value: serializeExpression(action.value) }
        : { type: action.type };
  }
}


function isExpressionWire(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const t = (value as { type?: unknown }).type;
  return t === "literal" || t === "variable" || t === "binary" || t === "unary" || t === "call";
}

function parseSetVariableValue(
  value: unknown,
  valueType: unknown,
): { value: EditorExpression; valueType: ParameterType | "" } {
  const vt = valueType ? asParameterType(valueType) : "";
  if (isExpressionWire(value)) {
    return { value: parseExpression(value), valueType: vt };
  }
  // Bare array/object → keep as JSON string literal + valueType so runtime coerces
  if (Array.isArray(value) || (value !== null && typeof value === "object")) {
    return {
      value: literal(JSON.stringify(value)),
      valueType: vt || (Array.isArray(value) ? "array" : "object"),
    };
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
    return { value: literal(value), valueType: vt };
  }
  return { value: literal(""), valueType: vt };
}

/**
 * Scalars stay bare (legacy). Paths and compound expressions become Expression objects.
 * Array/object valueType still coerces from a string literal body.
 */
function serializeSetVariableValue(
  expr: EditorExpression,
  valueType: ParameterType | "",
): unknown {
  if (expr.type === "variable" || expr.type === "binary" || expr.type === "unary" || expr.type === "call") {
    return serializeExpression(expr);
  }
  // literal
  const v = expr.value;
  if (valueType === "array" || valueType === "object") {
    return coerceValue(v == null ? "" : String(v), valueType);
  }
  if (valueType === "number") return typeof v === "number" ? v : Number(v);
  if (valueType === "boolean") return typeof v === "boolean" ? v : v === "true";
  // auto / string: emit bare scalar — never a string that looks like a path lookup
  return v;
}

export function coerceValue(value: string, type: ParameterType) {
  if (type === "number") return Number(value);
  if (type === "boolean") return value === "true";
  if (type === "array") return parseJson(value, []);
  if (type === "object") return parseJson(value, {});
  return value;
}

function parseLoose(value: string) {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  if (trimmed !== "" && !Number.isNaN(Number(trimmed))) return Number(trimmed);
  return value;
}

function parseJson(value: string, fallback: unknown) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asLiteral(value: unknown): string | number | boolean | null {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }
  return value == null ? "" : stringifyValue(value);
}

function asParameterType(value: unknown): ParameterType {
  return parameterTypes.includes(value as ParameterType) ? (value as ParameterType) : "string";
}

function asAssetType(value: unknown): AssetType {
  return value === "json" || value === "text" || value === "image" || value === "file" ? value : "text";
}

function asScope(value: unknown): VariableScope {
  return variableScopes.includes(value as VariableScope) ? (value as VariableScope) : "chat";
}

function stringifyValue(value: unknown) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return JSON.stringify(value);
}
