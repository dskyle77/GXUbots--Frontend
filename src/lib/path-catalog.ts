import type {
  EditorAction,
  EditorAsset,
  EditorFunction,
  EditorVariable,
  ParameterType,
} from "./config-editor";

export type PathGroup = "params" | "local" | "chat" | "user" | "global" | "session" | "builtin";

export type PathOption = {
  path: string;
  group: PathGroup;
  hint?: string;
};

export type ParamDraft = {
  name: string;
  type: ParameterType | string;
  source?: string;
  partial?: boolean;
};

export type PathCatalogCtx = {
  variables: EditorVariable[];
  functions: EditorFunction[];
  assets: EditorAsset[];
  extraParams: ParamDraft[];
};

const BUILTINS: PathOption[] = [
  { path: "message.text", group: "builtin", hint: "incoming text" },
  { path: "message.id", group: "builtin" },
  { path: "message.sender", group: "builtin" },
  {
    path: "message.quotedMessageId",
    group: "builtin",
    hint: "id of replied-to message, or null",
  },
  {
    path: "message.quotedUserId",
    group: "builtin",
    hint: "author of the quote; bot.id if reply to bot; WhatsApp user id otherwise; null if no reply",
  },
  {
    path: "message.quotedText",
    group: "builtin",
    hint: "text of replied-to message when available",
  },
  {
    path: "message.mentions",
    group: "builtin",
    hint: "JIDs of @mentions in this message",
  },
  { path: "user.name", group: "builtin" },
  { path: "user.id", group: "builtin" },
  { path: "user.phone", group: "builtin" },
  {
    path: "user.isAdmin",
    group: "builtin",
    hint: "true when the sender is a group admin; only set in groups",
  },
  { path: "chat.id", group: "builtin" },
  { path: "chat.name", group: "builtin" },
  { path: "chat.type", group: "builtin" },
  { path: "bot.name", group: "builtin" },
  { path: "bot.id", group: "builtin" },
  { path: "time.now", group: "builtin", hint: "Current time as epoch milliseconds (UTC)" },
  {
    path: "bot.isAdmin",
    group: "builtin",
    hint: "true when the bot is a group admin; only set in groups",
  },
  { path: "local._index", group: "local", hint: "loop index" },
  { path: "local._return", group: "local", hint: "last function return" },
  { path: "local.lastError", group: "local", hint: "last action error, or none" },
  { path: "local.lastAsset", group: "local", hint: "last get_asset result" },
  { path: "local.getUser", group: "local", hint: "last get_user result" },
  { path: "local.getType", group: "local", hint: "last get_type result" },
  { path: "local.getLink", group: "local", hint: "last get_link / reset_link { code, url }" },
  { path: "local.getLink.url", group: "local", hint: "invite URL" },
  { path: "local.getLink.code", group: "local", hint: "invite code" },
];

const GROUP_ORDER: PathGroup[] = [
  "params",
  "local",
  "chat",
  "user",
  "global",
  "session",
  "builtin",
];

export function buildPathOptions(
  ctx: PathCatalogCtx,
  localNames: string[] = [],
): PathOption[] {
  const options: PathOption[] = [];

  const paramMap = new Map<string, ParamDraft & { sources: string[] }>();
  for (const p of ctx.extraParams) {
    const name = p.name.trim();
    if (!name) continue;
    const existing = paramMap.get(name);
    if (!existing) {
      paramMap.set(name, { ...p, name, sources: p.source ? [p.source] : [] });
    } else {
      if (p.source && !existing.sources.includes(p.source)) {
        existing.sources.push(p.source);
      }
      if (p.partial) existing.partial = true;
    }
  }
  for (const p of paramMap.values()) {
    const parts: string[] = [String(p.type)];
    if (p.sources.length) parts.push(`set when triggered by ${p.sources.join(", ")}`);
    if (p.partial) parts.push("not on every command");
    options.push({ path: `params.${p.name}`, group: "params", hint: parts.join(" · ") });
  }

  for (const n of localNames) {
    const name = n.trim();
    if (!name) continue;
    options.push({ path: `local.${name}`, group: "local" });
  }

  for (const v of ctx.variables) {
    const name = v.name.trim();
    if (!name) continue;
    options.push({
      path: `${v.scope}.${name}`,
      group: v.scope as PathGroup,
      hint: v.type,
    });
  }

  options.push(...BUILTINS);

  const seen = new Set<string>();
  const unique: PathOption[] = [];
  for (const opt of options) {
    if (seen.has(opt.path)) continue;
    seen.add(opt.path);
    unique.push(opt);
  }

  unique.sort((a, b) => {
    const ga = GROUP_ORDER.indexOf(a.group);
    const gb = GROUP_ORDER.indexOf(b.group);
    if (ga !== gb) return ga - gb;
    return a.path.localeCompare(b.path);
  });

  return unique;
}

export function groupLabel(group: PathGroup): string {
  return group;
}

export function collectLocalNames(actions: EditorAction[]): string[] {
  const names = new Set<string>();

  function addPath(path: string | undefined | null) {
    const t = String(path ?? "").trim();
    if (t.startsWith("local.") && t.length > 6) names.add(t.slice(6));
  }

  const walk = (list: EditorAction[]) => {
    for (const action of list) {
      if ("target" in action) addPath(action.target);
      if (action.type === "array_remove") addPath(action.store);
      if (action.type === "for_each") {
        addPath(action.as);
        walk(action.actions);
      }
      if (action.type === "if") {
        walk(action.actions);
        walk(action.elseActions);
      }
      if (action.type === "switch") {
        for (const item of action.cases) walk(item.actions);
        walk(action.defaultActions);
      }
      if (action.type === "repeat") walk(action.actions);
    }
  };
  walk(actions);
  return [...names];
}

export function paramDraftsFromNames(names: string[], source?: string): ParamDraft[] {
  return names
    .map((p) => p.trim())
    .filter(Boolean)
    .map((name) => ({
      name,
      type: "string|number",
      ...(source ? { source } : {}),
    }));
}

export function paramDraftsFromFunction(fn: EditorFunction): ParamDraft[] {
  return fn.parameters
    .filter((p) => p.name.trim())
    .map((p) => ({ name: p.name.trim(), type: p.type }));
}
