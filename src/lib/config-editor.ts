export type ParameterType = "string" | "number" | "boolean" | "array" | "object";
export type VariableScope = "chat" | "user" | "global" | "session";
export type AssetType = "json" | "text" | "image" | "file";

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
  | { clientId: string; type: "call"; callee: string; args: EditorExpression[] };

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
      type: "get_type";
      value: EditorExpression;
      target: string;
    }
  | { clientId: string; type: "wait"; duration: EditorExpression }
  | { clientId: string; type: "if"; condition: EditorExpression; actions: EditorAction[]; elseActions: EditorAction[] }
  | { clientId: string; type: "repeat"; count: number; actions: EditorAction[] }
  | { clientId: string; type: "break" }
  | { clientId: string; type: "continue" }
  | { clientId: string; type: "stop_event" }
  | { clientId: string; type: "reply_message"; text: string }
  | { clientId: string; type: "react_message"; emoji: string }
  | { clientId: string; type: "delete_message" }
  | { clientId: string; type: "kick"; users: string }
  | { clientId: string; type: "add_member"; users: string }
  | { clientId: string; type: "promote"; users: string }
  | { clientId: string; type: "demote"; users: string }
  | { clientId: string; type: "call_function"; functionName: string; args: { clientId: string; name: string; value: EditorExpression }[] }
  | { clientId: string; type: "return"; value: EditorExpression | null };

export type EditorCommand = {
  clientId: string;
  name: string;
  /** One or more triggers. Empty / "*" alone = catch-all. */
  triggers: string[];
  /** Parameter names only (max 5). Values auto-coerce string|number. */
  parameters: string[];
  /** Events run in order when this command matches. */
  events: EditorEvent[];
};

export type EditorEvent = {
  clientId: string;
  id: string;
  name: string;
  actions: EditorAction[];
};

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
};

export type EditorPack = {
  clientId: string;
  id: string;
  name: string;
  /** Higher priority runs first when triggers collide across packs. */
  priority: number;
  commands: EditorCommand[];
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
  "set_variable",
  "get_asset",
  "get_user",
  "get_type",
  "wait",
  "if",
  "repeat",
  "break",
  "continue",
  "stop_event",
  "call_function",
  "return",
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
  set_variable: "Set variable",
  get_asset: "Get asset",
  get_user: "Get user",
  get_type: "Get type",
  wait: "Wait",
  if: "If",
  repeat: "Repeat",
  break: "Break",
  continue: "Continue",
  stop_event: "Stop event",
  call_function: "Call function",
  return: "Return",
};

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
      return { clientId: id, type, text: "" };
    case "react_message":
      return { clientId: id, type, emoji: "" };
    case "delete_message":
      return { clientId: id, type };
    case "kick":
    case "add_member":
    case "promote":
    case "demote":
      return { clientId: id, type, users: "" };
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
    commands: [],
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
  return {
    clientId: clientId(),
    id: asString(item.id) || newId("pack"),
    name: asString(item.name) || "Pack",
    priority: Number.isFinite(Number(item.priority)) ? Number(item.priority) : 0,
    commands: asArray(item.commands).map(parseCommand),
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
    commands: pack.commands.map(serializeCommand),
    functions: pack.functions.map(serializeFunction),
    assets: pack.assets.map(serializeAsset),
    variables: pack.variables.map(serializeVariable),
    ...(pack.publicApi.filter((x) => x.trim()).length
      ? { publicApi: pack.publicApi.map((x) => x.trim()).filter(Boolean) }
      : {}),
  };
}

function parseCommand(value: unknown): EditorCommand {
  const item = asRecord(value);
  const triggers = asArray(item.triggers)
    .map((t) => String(t).trim())
    .filter((t, i, arr) => arr.indexOf(t) === i);

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
    clientId: clientId(),
    name: asString(item.name),
    triggers,
    parameters,
    events: asArray(item.events).map(parseEvent),
  };
}

function parseEvent(value: unknown): EditorEvent {
  const item = asRecord(value);
  return {
    clientId: clientId(),
    id: asString(item.id) || newId("event"),
    name: asString(item.name),
    actions: asArray(item.actions).map(parseAction).filter(Boolean) as EditorAction[],
  };
}

/** One-liner signature: `/trigger param1 param2` (first token = primary trigger). */
export function commandSignature(command: EditorCommand): string {
  const primary = command.triggers[0]?.trim() ?? "";
  const params = command.parameters.map((p) => p.trim()).filter(Boolean).slice(0, MAX_COMMAND_PARAMS);
  return [primary, ...params].filter(Boolean).join(" ");
}

/** Parse one-liner into primary trigger + param names (max 5). Keeps extra triggers. */
export function applyCommandSignature(
  command: EditorCommand,
  line: string,
): Pick<EditorCommand, "triggers" | "parameters"> {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  const primary = tokens[0] ?? "";
  const parameters = tokens.slice(1, 1 + MAX_COMMAND_PARAMS);
  const rest = command.triggers.slice(1).filter((t) => t.trim() && t.trim() !== primary);
  const triggers = primary ? [primary, ...rest] : rest.length ? rest : [];
  return { triggers, parameters };
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
  };
}

function parseAction(value: unknown): EditorAction | null {
  const item = asRecord(value);
  const type = asString(item.type);
  const id = clientId();
  switch (type) {
    case "send_message":
      return { clientId: id, type, text: asString(item.text) };
    case "reply_message":
      return { clientId: id, type, text: asString(item.text) };
    case "react_message":
      return { clientId: id, type, emoji: asString(item.emoji) };
    case "delete_message":
      return { clientId: id, type };
    case "kick":
    case "add_member":
    case "promote":
    case "demote":
      return { clientId: id, type, users: asString(item.users) };
    case "group_participants": {
      const groupAction = asString(item.action);
      const type = groupAction === "add" ? "add_member" : groupAction === "promote" ? "promote" : groupAction === "demote" ? "demote" : "kick";
      return { clientId: id, type, users: asString(item.users) };
    }
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
  if (item.type === "variable") {
    return { clientId: clientId(), type: "variable", path: asString(item.path) };
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

function serializeCommand(command: EditorCommand) {
  const triggers = command.triggers.map((t) => t.trim()).filter(Boolean);
  const parameters = command.parameters
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, MAX_COMMAND_PARAMS);
  return {
    name: command.name.trim() || triggers[0] || "command",
    triggers,
    ...(parameters.length ? { parameters } : {}),
    events: command.events.map(serializeEvent),
  };
}

function serializeEvent(event: EditorEvent) {
  return {
    id: event.id.trim() || newId("event"),
    name: event.name.trim() || "event",
    actions: event.actions.map(serializeAction),
  };
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
  return {
    name: variable.name.trim(),
    scope: variable.scope,
    type: variable.type,
    ...(variable.defaultValue.trim()
      ? { default: coerceValue(variable.defaultValue, variable.type) }
      : {}),
    ...(group ? { group } : {}),
    ...(variable.expose ? { expose: true } : {}),
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

function serializeAction(action: EditorAction): Record<string, unknown> {
  switch (action.type) {
    case "send_message":
      return { type: action.type, text: action.text };
    case "reply_message":
      return { type: action.type, text: action.text };
    case "react_message":
      return { type: action.type, emoji: action.emoji };
    case "delete_message":
      return { type: action.type };
    case "kick":
      return { type: "group_participants", action: "remove", users: action.users };
    case "add_member":
      return { type: "group_participants", action: "add", users: action.users };
    case "promote":
      return { type: "group_participants", action: "promote", users: action.users };
    case "demote":
      return { type: "group_participants", action: "demote", users: action.users };
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
    case "repeat":
      return { type: action.type, count: action.count, actions: action.actions.map(serializeAction) };
    case "break":
    case "continue":
    case "stop_event":
      return { type: action.type };
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
