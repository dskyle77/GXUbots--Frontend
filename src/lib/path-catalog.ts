import type {
  EditorAction,
  EditorAsset,
  EditorCommand,
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
    path: "message.replyId",
    group: "builtin",
    hint: "id of replied-to message, or null",
  },
  {
    path: "message.replySender",
    group: "builtin",
    hint: "author of reply; bot.id if reply to bot; null if no reply",
  },
  {
    path: "message.replyText",
    group: "builtin",
    hint: "text of replied-to message when available",
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
  {
    path: "bot.isAdmin",
    group: "builtin",
    hint: "true when the bot is a group admin; only set in groups",
  },
  { path: "local.replyId", group: "local", hint: "same as message.replyId" },
  {
    path: "local.replySender",
    group: "local",
    hint: "same as message.replySender",
  },
  {
    path: "local.replyText",
    group: "local",
    hint: "same as message.replyText",
  },
  { path: "local._index", group: "local", hint: "repeat index" },
  { path: "local._return", group: "local", hint: "last function return" },
  { path: "local.lastAsset", group: "local", hint: "last get_asset result" },
  { path: "local.getUser", group: "local", hint: "last get_user result" },
  { path: "local.getType", group: "local", hint: "last get_type result" },
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
  const walk = (list: EditorAction[]) => {
    for (const action of list) {
      if (action.type === "set_variable") {
        const t = action.target.trim();
        if (t.startsWith("local.")) names.add(t.slice(6));
      }
      if (action.type === "if") {
        walk(action.actions);
        walk(action.elseActions);
      }
      if (action.type === "repeat") walk(action.actions);
    }
  };
  walk(actions);
  return [...names];
}

export function paramDraftsFromCommand(command: EditorCommand): ParamDraft[] {
  const source = command.triggers[0]?.trim() || command.name.trim() || undefined;
  return command.parameters
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
