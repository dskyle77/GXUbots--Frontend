import { type EditorAction, type EditorConfig } from "./config-editor";

export type IssueSeverity = "warning" | "error";

export type ConfigIssue = {
  severity: IssueSeverity;
  tabId: "events" | "functions" | "assets" | "variables";
  itemClientId?: string;
  field?: string;
  message: string;
};

export function validateConfig(config: EditorConfig): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const fnKeys = new Set(
    config.packs.flatMap((p) =>
      p.functions.flatMap((f) => [f.id.trim(), f.name.trim()].filter(Boolean)),
    ),
  );
  const assetKeys = new Set(
    config.packs.flatMap((p) =>
      p.assets.flatMap((a) => [a.id.trim(), a.name.trim()].filter(Boolean)),
    ),
  );

  for (const pack of config.packs) {
    for (const group of pack.eventGroups ?? []) {
      for (const handler of group.handlers) {
        if (!handler.actions?.length) {
          issues.push({
            severity: "warning",
            tabId: "events",
            itemClientId: handler.clientId,
            field: "actions",
            message: `Handler "${handler.name || handler.id}" in pack "${pack.name}" has no actions`,
          });
        }
        walkActions(handler.actions ?? [], {
          issues,
          tabId: "events",
          itemClientId: handler.clientId,
          fnKeys,
          assetKeys,
        });
      }
    }

    for (const fn of pack.functions) {
      walkActions(fn.actions, {
        issues,
        tabId: "functions",
        itemClientId: fn.clientId,
        fnKeys,
        assetKeys,
      });
    }
  }

  return issues;
}

function walkActions(
  actions: EditorAction[],
  ctx: {
    issues: ConfigIssue[];
    tabId: ConfigIssue["tabId"];
    itemClientId: string;
    fnKeys: Set<string>;
    assetKeys: Set<string>;
  },
) {
  for (const action of actions) {
    if (action.type === "call_function") {
      const name = action.functionName.trim();
      if (name && !ctx.fnKeys.has(name)) {
        ctx.issues.push({
          severity: "error",
          tabId: ctx.tabId,
          itemClientId: ctx.itemClientId,
          message: `Unknown function "${name}"`,
        });
      }
    }
    if (action.type === "get_asset") {
      const a = action.asset.trim();
      if (a && !a.startsWith("http") && !ctx.assetKeys.has(a)) {
        ctx.issues.push({
          severity: "warning",
          tabId: ctx.tabId,
          itemClientId: ctx.itemClientId,
          message: `Asset "${a}" not found`,
        });
      }
    }
    if (action.type === "if") {
      walkActions(action.actions, ctx);
      walkActions(action.elseActions, ctx);
    }
    if (action.type === "repeat") {
      walkActions(action.actions, ctx);
    }
  }
}

export function issuesByTab(issues: ConfigIssue[]) {
  const counts: Record<string, number> = {};
  for (const issue of issues) {
    counts[issue.tabId] = (counts[issue.tabId] ?? 0) + 1;
  }
  return counts;
}
