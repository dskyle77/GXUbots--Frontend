import type { EditorAction } from "./config-editor";

export type ActionListId = string;

export function listIdFor(
  action: EditorAction,
  branch: "then" | "else" | "repeat" | "foreach" | "default" | "case",
  caseId?: string,
): ActionListId {
  if (branch === "case") return `${caseId}:case`;
  return `${action.clientId}:${branch}`;
}

export function relocateAction(actions: EditorAction[], activeId: string, overId: string): EditorAction[] | null {
  const from = findAction(actions, activeId);
  if (!from) return null;

  let toList = from.listId;
  let toIndex = from.index;
  if (overId.startsWith("list:")) {
    toList = overId.slice(5);
    toIndex = listLength(actions, toList);
  } else {
    const to = findAction(actions, overId);
    if (!to) return null;
    toList = to.listId;
    toIndex = to.index;
  }

  if (toList === from.listId && toIndex === from.index) return null;
  if (listIsInside(from.action, toList)) return null;

  const removed = removeFromList(actions, from.listId, from.index);
  if (from.listId === toList && from.index < toIndex) toIndex -= 1;
  return insertIntoList(removed, toList, toIndex, from.action);
}

export function moveOut(actions: EditorAction[], activeId: string, parentActionId: string, place: "before" | "after"): EditorAction[] | null {
  const parent = findAction(actions, parentActionId);
  const from = findAction(actions, activeId);
  if (!parent || !from) return null;
  const removed = removeFromList(actions, from.listId, from.index);
  const index = place === "before" ? parent.index : parent.index + 1;
  return insertIntoList(removed, parent.listId, index, from.action);
}

function findAction(actions: EditorAction[], id: string, listId: ActionListId = "root"): { listId: ActionListId; index: number; action: EditorAction } | null {
  const index = actions.findIndex((item) => item.clientId === id);
  if (index >= 0) return { listId, index, action: actions[index]! };
  for (const action of actions) {
    const nested = findInAction(action, id);
    if (nested) return nested;
  }
  return null;
}

function findInAction(action: EditorAction, id: string): { listId: ActionListId; index: number; action: EditorAction } | null {
  if (action.type === "if") {
    return findAction(action.actions, id, listIdFor(action, "then")) ?? findAction(action.elseActions, id, listIdFor(action, "else"));
  }
  if (action.type === "repeat") return findAction(action.actions, id, listIdFor(action, "repeat"));
  if (action.type === "for_each") return findAction(action.actions, id, listIdFor(action, "foreach"));
  if (action.type === "switch") {
    for (const item of action.cases) {
      const found = findAction(item.actions, id, `${item.clientId}:case`);
      if (found) return found;
    }
    return findAction(action.defaultActions, id, listIdFor(action, "default"));
  }
  return null;
}

function listIsInside(action: EditorAction, listId: ActionListId): boolean {
  if (action.type === "if") {
    return listId === listIdFor(action, "then") || listId === listIdFor(action, "else") || listIsInsideAny(action.actions, listId) || listIsInsideAny(action.elseActions, listId);
  }
  if (action.type === "repeat") return listId === listIdFor(action, "repeat") || listIsInsideAny(action.actions, listId);
  if (action.type === "for_each") return listId === listIdFor(action, "foreach") || listIsInsideAny(action.actions, listId);
  if (action.type === "switch") {
    if (listId === listIdFor(action, "default") || action.cases.some((item) => listId === `${item.clientId}:case`)) return true;
    return action.cases.some((item) => listIsInsideAny(item.actions, listId)) || listIsInsideAny(action.defaultActions, listId);
  }
  return false;
}

function listIsInsideAny(actions: EditorAction[], listId: ActionListId): boolean {
  return actions.some((action) => listIsInside(action, listId));
}

function listLength(actions: EditorAction[], listId: ActionListId): number {
  if (listId === "root") return actions.length;
  return readList(actions, listId)?.length ?? 0;
}

function readList(actions: EditorAction[], listId: ActionListId): EditorAction[] | null {
  if (listId === "root") return actions;
  for (const action of actions) {
    const found = readInAction(action, listId);
    if (found) return found;
  }
  return null;
}

function readInAction(action: EditorAction, listId: ActionListId): EditorAction[] | null {
  if (action.type === "if") {
    if (listId === listIdFor(action, "then")) return action.actions;
    if (listId === listIdFor(action, "else")) return action.elseActions;
    return readList(action.actions, listId) ?? readList(action.elseActions, listId);
  }
  if (action.type === "repeat") {
    if (listId === listIdFor(action, "repeat")) return action.actions;
    return readList(action.actions, listId);
  }
  if (action.type === "for_each") {
    if (listId === listIdFor(action, "foreach")) return action.actions;
    return readList(action.actions, listId);
  }
  if (action.type === "switch") {
    if (listId === listIdFor(action, "default")) return action.defaultActions;
    for (const item of action.cases) {
      if (listId === `${item.clientId}:case`) return item.actions;
      const found = readList(item.actions, listId);
      if (found) return found;
    }
    return readList(action.defaultActions, listId);
  }
  return null;
}

function removeFromList(actions: EditorAction[], listId: ActionListId, index: number): EditorAction[] {
  return updateList(actions, listId, (list) => list.filter((_, i) => i !== index));
}

function insertIntoList(actions: EditorAction[], listId: ActionListId, index: number, action: EditorAction): EditorAction[] {
  return updateList(actions, listId, (list) => {
    const next = [...list];
    next.splice(Math.max(0, Math.min(index, next.length)), 0, action);
    return next;
  });
}

function updateList(actions: EditorAction[], listId: ActionListId, update: (list: EditorAction[]) => EditorAction[]): EditorAction[] {
  if (listId === "root") return update(actions);
  return actions.map((action) => updateAction(action, listId, update));
}

function updateAction(action: EditorAction, listId: ActionListId, update: (list: EditorAction[]) => EditorAction[]): EditorAction {
  if (action.type === "if") {
    return {
      ...action,
      actions: listId === listIdFor(action, "then") ? update(action.actions) : updateList(action.actions, listId, update),
      elseActions: listId === listIdFor(action, "else") ? update(action.elseActions) : updateList(action.elseActions, listId, update),
    };
  }
  if (action.type === "repeat") {
    return {
      ...action,
      actions: listId === listIdFor(action, "repeat") ? update(action.actions) : updateList(action.actions, listId, update),
    };
  }
  if (action.type === "for_each") {
    return {
      ...action,
      actions: listId === listIdFor(action, "foreach") ? update(action.actions) : updateList(action.actions, listId, update),
    };
  }
  if (action.type === "switch") {
    return {
      ...action,
      cases: action.cases.map((item) => ({
        ...item,
        actions: listId === `${item.clientId}:case` ? update(item.actions) : updateList(item.actions, listId, update),
      })),
      defaultActions: listId === listIdFor(action, "default") ? update(action.defaultActions) : updateList(action.defaultActions, listId, update),
    };
  }
  return action;
}
