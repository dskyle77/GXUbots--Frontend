"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  actionLabels,
  actionTypeGroups,
  actionTypes,
  blankAction,
  clientId,
  literal,
  variableExpr,
  parameterTypes,
  type EditorAction,
  type EditorExpression,
  type ParameterType,
} from "../../lib/config-editor";
import { formatExpressionText } from "../../lib/expression-lang";
import { useEditorCtx } from "./config-context";
import { ExprTextField } from "./ExprTextField";
import { InsertPathButton, PathField } from "./PathField";
import {
  Field,
  Hint,
  RowMenu,
  MenuSelect,
  SecondaryButton,
  TextArea,
  TextInput,
  moveItem,
  patchAt,
  removeAt,
} from "./ui";
import { cn } from "../../lib/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { listIdFor, moveOut, relocateAction } from "../../lib/action-tree";

/** Actions with no editable fields — always stay compact. */
const FIELDLESS = new Set<EditorAction["type"]>([
  "continue",
  "break",
  "stop_event",
  "lock_group",
  "unlock_group",
]);

/** Soft surface tint per action family — readable separation without loud colors. */
function actionSurface(type: EditorAction["type"]): string {
  switch (type) {
    case "if":
    case "switch":
    case "repeat":
      return "bg-primary/[0.06] border-primary/15";
    case "send_message":
    case "reply_message":
    case "react_message":
    case "send_media":
      return "bg-success/[0.05] border-success/15";
    case "set_variable":
    case "get_asset":
    case "get_user":
    case "get_user_from_mention":
    case "get_type":
      return "bg-warning/[0.05] border-warning/15";
    case "call_function":
    case "return":
      return "bg-accent/40 border-primary/10";
    case "stop_event":
    case "kick":
    case "delete_message":
      return "bg-destructive/[0.06] border-destructive/15";
    case "lock_group":
    case "unlock_group":
    case "get_link":
    case "reset_link":
      return "bg-warning/[0.05] border-warning/15";
    case "break":
    case "continue":
    case "wait":
      return "bg-[var(--color-hover)] border-border/80";
    default:
      return "bg-secondary/50 border-border/80";
  }
}

function truncate(s: string, max = 48): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function exprSummary(expr: EditorExpression | null | undefined): string {
  if (!expr) return "…";
  try {
    return truncate(formatExpressionText(expr));
  } catch {
    return "…";
  }
}

/** One-line summary for compact rows. */
export function actionSummary(action: EditorAction): string {
  switch (action.type) {
    case "send_message":
      return action.text.trim()
        ? `send  ${truncate(action.text)}`
        : "send message";
    case "reply_message":
      return action.text.trim() ? `reply  ${truncate(action.text)}` : "reply";
    case "react_message":
      return action.emoji.trim()
        ? `react  ${action.emoji}`
        : `react  ${action.messageId || "message.id"}`;
    case "delete_message":
      return `delete  ${action.messageId || "message.id"}`;
    case "send_media": {
      const bits = [action.image, action.file].filter((x) => x.trim());
      const cap = action.text.trim() ? truncate(action.text, 24) : "";
      return bits.length
        ? `media  ${truncate(bits.join(" · "), 32)}${cap ? ` · ${cap}` : ""}`
        : "send media";
    }
    case "kick":
      return exprSummary(action.users) !== "…"
        ? `kick  ${exprSummary(action.users)}`
        : "kick";
    case "add_member":
      return exprSummary(action.users) !== "…"
        ? `add  ${exprSummary(action.users)}`
        : "add member";
    case "promote":
      return exprSummary(action.users) !== "…"
        ? `promote  ${exprSummary(action.users)}`
        : "promote";
    case "demote":
      return exprSummary(action.users) !== "…"
        ? `demote  ${exprSummary(action.users)}`
        : "demote";
    case "lock_group":
      return "lock group";
    case "unlock_group":
      return "unlock group";
    case "get_link":
      return action.target.trim()
        ? `get link → ${truncate(action.target)}`
        : "get invite link";
    case "reset_link":
      return action.target.trim()
        ? `reset link → ${truncate(action.target)}`
        : "reset invite link";
    case "set_variable":
      return action.target.trim()
        ? `set  ${action.target} = ${exprSummary(action.value)}`
        : "set variable";
    case "get_asset":
      return action.asset.trim()
        ? `asset  ${truncate(action.asset)}`
        : "get asset";
    case "get_user":
      return `get user  ${exprSummary(action.userId)} → ${action.target.trim() || "…"}`;
    case "get_user_from_mention":
      return `get mention  ${exprSummary(action.mention)} → ${action.target.trim() || "…"}`;
    case "get_type":
      return `typeof  ${exprSummary(action.value)} → ${action.target.trim() || "…"}`;
    case "wait":
      return `wait  ${exprSummary(action.duration)}`;
    case "if":
      return `if  ${exprSummary(action.condition)}`;
    case "switch":
      return `switch  ${exprSummary(action.value)}`;
    case "repeat":
      return `repeat  ${action.count}×`;
    case "break":
      return "break";
    case "continue":
      return "continue";
    case "stop_event":
      return "stop event";
    case "call_function": {
      const name = truncate(action.functionName.trim() || "…", 24);
      const args =
        action.args.length === 0
          ? "()"
          : `(${truncate(action.args.map((a) => a.name.trim() || "…").join(", "), 24)})`;
      return `call  ${name}${args}`;
    }
    case "return":
      return action.value ? `return  ${exprSummary(action.value)}` : "return";
    case "get_key":
      return `get  ${truncate(action.source)}[${exprSummary(action.key)}] → ${action.target.trim() || "local.getKey"}`;
    case "set_key":
      return `set  ${truncate(action.source)}[${exprSummary(action.key)}] = ${exprSummary(action.value)}`;
    case "delete_key":
      return `del  ${truncate(action.source)}[${exprSummary(action.key)}]`;
    case "array_append":
      return action.target.trim()
        ? `append  ${exprSummary(action.value)} → ${action.target}`
        : "append to array";
    case "array_prepend":
      return action.target.trim()
        ? `prepend  ${exprSummary(action.value)} → ${action.target}`
        : "prepend to array";
    case "array_insert":
      return action.target.trim()
        ? `insert  ${exprSummary(action.value)} at ${exprSummary(action.index)} in ${action.target}`
        : "insert into array";
    case "array_remove":
      return action.target.trim()
        ? `remove  ${action.index ? `index ${exprSummary(action.index)}` : exprSummary(action.value ?? literal("?"))} from ${action.target}`
        : "remove from array";
    case "array_set":
      return action.target.trim()
        ? `set  ${action.target}[${exprSummary(action.index)}] = ${exprSummary(action.value)}`
        : "set array index";
    case "array_clear":
      return action.target.trim() ? `clear  ${action.target}` : "clear array";
    case "for_each":
      return `for each  ${exprSummary(action.list)} as ${action.as.trim() || "local.item"}`;
    case "log":
      return action.text.trim()
        ? `log  ${action.level}  ${truncate(action.text)}`
        : `log  ${action.level}`;
    default:
      return "action";
  }
}

function isActionComplete(action: EditorAction): boolean {
  switch (action.type) {
    case "continue":
    case "break":
    case "delete_message":
    case "stop_event":
    case "lock_group":
    case "unlock_group":
    case "get_link":
    case "reset_link":
      return true;
    case "send_message":
    case "reply_message":
      return Boolean(action.text.trim());
    case "react_message":
      return Boolean(action.emoji.trim());
    case "send_media":
      return Boolean(action.image.trim() || action.file.trim());
    case "kick":
    case "add_member":
    case "promote":
    case "demote": {
      const u = action.users;
      if (u.type === "variable") return Boolean(u.path.trim());
      if (u.type === "literal") return u.value !== "" && u.value != null;
      if (u.type === "call") return Boolean(u.callee.trim());
      return true;
    }
    case "set_variable":
      return Boolean(action.target.trim());
    case "get_asset":
      return Boolean(action.asset.trim());
    case "get_user":
    case "get_user_from_mention":
      return Boolean(action.target.trim());
    case "get_type":
      return Boolean(action.target.trim());
    case "wait":
      return true;
    case "if": {
      // Treat empty / bare variable as incomplete so new if opens expanded
      if (action.condition.type === "variable" && !action.condition.path.trim())
        return false;
      if (action.condition.type === "literal" && action.condition.value === "")
        return false;
      return true;
    }
    case "switch": {
      if (action.value.type === "variable" && !action.value.path.trim())
        return false;
      if (action.value.type === "literal" && action.value.value === "")
        return false;
      return action.cases.length > 0;
    }
    case "repeat":
      return action.count > 0;
    case "call_function":
      return Boolean(action.functionName.trim());
    case "return":
      return true;
    case "get_key":
      return Boolean(action.source.trim() && action.target.trim());
    case "set_key":
    case "delete_key":
      return Boolean(action.source.trim());
    case "array_append":
    case "array_prepend":
    case "array_insert":
    case "array_remove":
    case "array_set":
    case "array_clear":
      return Boolean(action.target.trim());
    case "for_each":
      return true;
    case "log":
      return Boolean(action.text.trim());
    default:
      return false;
  }
}

function childBadge(action: EditorAction): string | null {
  if (action.type === "if") {
    const t = action.actions.length;
    const e = action.elseActions.length;
    if (t === 0 && e === 0) return null;
    const parts: string[] = [];
    if (t) parts.push(`${t} then`);
    if (e) parts.push(`${e} else`);
    return parts.join(" · ");
  }
  if (action.type === "switch") {
    const parts: string[] = [];
    if (action.cases.length)
      parts.push(
        `${action.cases.length} case${action.cases.length === 1 ? "" : "s"}`,
      );
    if (action.defaultActions.length) parts.push("default");
    return parts.length ? parts.join(" · ") : null;
  }
  if (
    (action.type === "repeat" || action.type === "for_each") &&
    action.actions.length
  ) {
    return `${action.actions.length} action${action.actions.length === 1 ? "" : "s"}`;
  }
  return null;
}

const preferAction: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const action = hits.find((hit) => !String(hit.id).startsWith("list:"));
  if (action) return [action];
  if (hits.length) return hits;
  return closestCenter(args);
};

const ActionDragContext = createContext<{
  relocate: (activeId: string, overId: string) => void;
  moveOut: (
    activeId: string,
    parentActionId: string,
    place: "before" | "after",
  ) => void;
} | null>(null);

export function ActionList({
  actions,
  onChange,
  depth = 0,
  rootActions,
  listId = "root",
  parentActionId,
}: {
  actions: EditorAction[];
  onChange: (actions: EditorAction[]) => void;
  depth?: number;
  rootActions?: EditorAction[];
  listId?: string;
  parentActionId?: string;
}) {
  const drag = useContext(ActionDragContext);
  const tree = rootActions ?? actions;
  const body = (
    <ActionListBody
      actions={actions}
      onChange={onChange}
      depth={depth}
      rootActions={tree}
      listId={listId}
      parentActionId={parentActionId}
    />
  );
  if (drag) return body;
  return (
    <ActionDragRoot actions={actions} onChange={onChange}>
      {body}
    </ActionDragRoot>
  );
}

function ActionDragRoot({
  actions,
  onChange,
  children,
}: {
  actions: EditorAction[];
  onChange: (actions: EditorAction[]) => void;
  children: ReactNode;
}) {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function relocate(activeId: string, overId: string) {
    const next = relocateAction(actionsRef.current, activeId, overId);
    if (next) onChange(next);
  }

  function onDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : "";
    if (!overId || activeId === overId) return;
    relocate(activeId, overId);
  }

  return (
    <ActionDragContext.Provider
      value={{
        relocate,
        moveOut: (activeId, parentActionId, place) => {
          const next = moveOut(
            actionsRef.current,
            activeId,
            parentActionId,
            place,
          );
          if (next) onChange(next);
        },
      }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={preferAction}
        onDragEnd={onDragEnd}
      >
        {children}
      </DndContext>
    </ActionDragContext.Provider>
  );
}

function ActionListBody({
  actions,
  onChange,
  depth,
  rootActions,
  listId,
  parentActionId,
}: {
  actions: EditorAction[];
  onChange: (actions: EditorAction[]) => void;
  depth: number;
  rootActions: EditorAction[];
  listId: string;
  parentActionId?: string;
}) {
  const drag = useContext(ActionDragContext);
  const { setNodeRef, isOver } = useDroppable({ id: `list:${listId}` });

  return (
    <div className={depth ? "mt-0.5 border-l border-border pl-2.5" : "mt-1"}>
      <SortableContext
        items={actions.map((item) => item.clientId)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={isOver ? "rounded-md bg-primary/5" : undefined}
        >
          {actions.map((action, index) => (
            <ActionSortable key={action.clientId} id={action.clientId}>
              {(handle) => (
                <ActionRow
                  action={action}
                  handle={handle}
                  depth={depth}
                  rootActions={rootActions}
                  disableUp={index === 0 && !parentActionId}
                  disableDown={index === actions.length - 1 && !parentActionId}
                  onChange={(next) =>
                    onChange(
                      actions.map((item, i) => (i === index ? next : item)),
                    )
                  }
                  onUp={() => {
                    if (index === 0 && parentActionId)
                      drag?.moveOut(action.clientId, parentActionId, "before");
                    else onChange(moveItem(actions, index, -1));
                  }}
                  onDown={() => {
                    if (index === actions.length - 1 && parentActionId)
                      drag?.moveOut(action.clientId, parentActionId, "after");
                    else onChange(moveItem(actions, index, 1));
                  }}
                  onRemove={() => onChange(removeAt(actions, index))}
                  onInsertAfter={(next) => {
                    const copy = [...actions];
                    copy.splice(index + 1, 0, next);
                    onChange(copy);
                  }}
                />
              )}
            </ActionSortable>
          ))}
          {actions.length === 0 ? <div className="h-6" /> : null}
        </div>
      </SortableContext>
      <button
        type="button"
        className="mt-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/80"
        onClick={() => onChange([...actions, blankAction()])}
      >
        + Add action
      </button>
    </div>
  );
}

function ActionSortable({
  id,
  children,
}: {
  id: string;
  children: (handle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {children(
        <button
          type="button"
          className="cursor-grab rounded-md px-1.5 text-muted-foreground hover:text-white active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <svg
            viewBox="0 0 16 16"
            className="h-4 w-4"
            fill="currentColor"
            aria-hidden="true"
          >
            <circle cx="5" cy="4" r="1.2" />
            <circle cx="11" cy="4" r="1.2" />
            <circle cx="5" cy="8" r="1.2" />
            <circle cx="11" cy="8" r="1.2" />
            <circle cx="5" cy="12" r="1.2" />
            <circle cx="11" cy="12" r="1.2" />
          </svg>
        </button>,
      )}
    </div>
  );
}

function ActionRow({
  action,
  handle,
  depth,
  rootActions,
  onChange,
  onUp,
  onDown,
  onRemove,
  onInsertAfter,
  disableUp,
  disableDown,
}: {
  action: EditorAction;
  handle: ReactNode;
  depth: number;
  rootActions: EditorAction[];
  onChange: (action: EditorAction) => void;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  onInsertAfter: (action: EditorAction) => void;
  disableUp: boolean;
  disableDown: boolean;
}) {
  const fieldless = FIELDLESS.has(action.type);
  const complete = isActionComplete(action);
  const [open, setOpen] = useState(!complete && !fieldless);
  const badge = childBadge(action);

  // When type changes to incomplete, expand so user can fill fields.
  useEffect(() => {
    if (!isActionComplete(action) && !FIELDLESS.has(action.type)) {
      setOpen(true);
    }
  }, [action.type]);

  const summary = actionSummary(action);

  return (
    <div
      className={cn(
        "group my-1 min-w-0 max-w-full border px-1.5 py-1 transition-colors",
        actionSurface(action.type),
        open && "ring-1 ring-border/60",
      )}
    >
      <div className="flex min-w-0 items-center gap-1">
        {handle}
        {!fieldless ? (
          <button
            type="button"
            aria-label={open ? "Collapse" : "Expand"}
            aria-expanded={open}
            className="inline-flex h-7 w-5 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={() => setOpen((v) => !v)}
          >
            <Chevron open={open} />
          </button>
        ) : (
          <span className="inline-flex h-7 w-5 shrink-0" />
        )}

        {open && !fieldless ? (
          <div className="min-w-0 flex-1">
            <MenuSelect
              size="sm"
              ariaLabel="Action type"
              value={action.type}
              onChange={(type) =>
                onChange(blankAction(type as EditorAction["type"]))
              }
              options={actionTypeGroups.flatMap((g) =>
                g.types.map((type) => ({
                  value: type,
                  label: actionLabels[type],
                  group: g.label,
                })),
              )}
            />
          </div>
        ) : (
          <button
            type="button"
            className={cn(
              "flex min-w-0 flex-1 items-center text-left font-mono text-xs sm:text-sm",
              complete ? "text-foreground" : "text-muted-foreground",
            )}
            title={summary}
            onClick={() => {
              if (!fieldless) setOpen(true);
            }}
          >
            <span className="min-w-0 truncate">{summary}</span>
            {badge ? (
              <span className="ml-2 shrink-0 font-sans text-[11px] text-muted-foreground">
                {badge}
              </span>
            ) : null}
          </button>
        )}

        <ErrorHint type={action.type} />
        <ErrorMenu
          type={action.type}
          onBuildSwitch={(next) => onInsertAfter(next)}
        />
        <ActionMenu
          disableUp={disableUp}
          disableDown={disableDown}
          onUp={onUp}
          onDown={onDown}
          onRemove={onRemove}
        />
      </div>

      {open && !fieldless ? (
        <div className="min-w-0 pb-1 pl-6">
          <ActionFields
            action={action}
            depth={depth}
            rootActions={rootActions}
            onChange={onChange}
          />
        </div>
      ) : null}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")}
      fill="currentColor"
      aria-hidden
    >
      <path d="M6 3.5 11 8 6 12.5V3.5z" />
    </svg>
  );
}

const ACTION_ERRORS: Partial<Record<EditorAction["type"], string[]>> = {
  send_message: ["none", "send_rate", "mention_not_found"],
  send_media: ["none", "media_required", "send_rate"],
  reply_message: ["none", "no_message", "send_rate", "mention_not_found"],
  react_message: ["none", "no_message"],
  delete_message: ["none", "no_message"],
  kick: [
    "none",
    "not_group",
    "user_required",
    "mention_not_found",
    "not_admin",
    "not_in_group",
  ],
  promote: [
    "none",
    "not_group",
    "user_required",
    "mention_not_found",
    "not_admin",
    "not_in_group",
    "already_admin",
  ],
  demote: [
    "none",
    "not_group",
    "user_required",
    "mention_not_found",
    "not_admin",
    "not_in_group",
  ],
  add_member: [
    "none",
    "phone_required",
    "not_group",
    "not_on_whatsapp",
    "already_in_group",
    "privacy_blocked",
    "invalid_number",
    "not_admin",
  ],
  lock_group: ["none", "not_group", "not_admin"],
  unlock_group: ["none", "not_group", "not_admin"],
  get_link: ["none", "not_group", "not_admin"],
  reset_link: ["none", "not_group", "not_admin"],
  set_variable: ["none", "target_required"],
  get_asset: ["none", "asset_not_found"],
  get_user: ["none", "user_required"],
  get_user_from_mention: ["none", "mention_not_found"],
  get_type: ["none"],
  wait: ["none", "invalid_wait", "wait_cap", "wait_total"],
  call_function: [
    "none",
    "function_not_found",
    "dependency_not_declared",
    "dependency_not_installed",
    "function_not_exposed",
    "not_a_value_function",
    "action_cap",
    "call_depth",
  ],
  get_key: ["none", "key_required", "source_required", "key_not_found"],
  set_key: ["none", "key_required", "source_required"],
  delete_key: ["none", "key_required", "source_required", "key_not_found"],
  array_append: ["none", "target_required"],
  array_prepend: ["none", "target_required"],
  array_insert: ["none", "target_required", "not_an_array", "index_out_of_range"],
  array_remove: ["none", "target_required", "not_an_array", "index_out_of_range", "value_not_found"],
  array_set: ["none", "target_required", "not_an_array", "index_out_of_range"],
  array_clear: ["none", "target_required"],
  for_each: ["none"],
};

function ErrorHint({ type }: { type: EditorAction["type"] }) {
  const codes = ACTION_ERRORS[type];
  if (!codes?.length) return null;
  return (
    <span
      className="hidden max-w-[9rem] shrink truncate font-mono text-[10px] text-muted-foreground lg:inline"
      title={codes.join(", ")}
    >
      lastError: {codes.join(" | ")}
    </span>
  );
}

function errorSwitch(type: EditorAction["type"]): EditorAction | null {
  const codes = ACTION_ERRORS[type];
  if (!codes?.length) return null;
  return {
    clientId: clientId(),
    type: "switch",
    value: variableExpr("local.lastError"),
    cases: codes.map((code) => ({
      clientId: clientId(),
      match: literal(code),
      actions: [],
    })),
    defaultActions: [],
  };
}

function ErrorMenu({
  type,
  onBuildSwitch,
}: {
  type: EditorAction["type"];
  onBuildSwitch: (action: EditorAction) => void;
}) {
  const codes = ACTION_ERRORS[type];
  const [copied, setCopied] = useState("");

  if (!codes?.length) return null;

  return (
    <DropdownMenu onOpenChange={(o) => !o && setCopied("")}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Errors this action sets"
          className="shrink-0 rounded-sm px-1.5 py-1 font-mono text-[10px] text-muted-foreground hover:bg-[var(--color-hover)] hover:text-foreground data-[state=open]:bg-[var(--color-hover)] data-[state=open]:text-foreground"
        >
          err
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-mono">
          local.lastError
        </DropdownMenuLabel>
        {codes.map((code) => (
          <DropdownMenuItem
            key={code}
            className="justify-between gap-2 font-mono text-xs"
            onSelect={(event) => {
              event.preventDefault(); // stay open so "copied" is visible
              void navigator.clipboard?.writeText(code);
              setCopied(code);
            }}
          >
            <span className="min-w-0 truncate">{code}</span>
            {copied === code ? (
              <span className="shrink-0 font-sans text-[10px] text-muted-foreground">
                copied
              </span>
            ) : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-xs font-medium text-primary focus:text-primary"
          onSelect={() => {
            const next = errorSwitch(type);
            if (next) onBuildSwitch(next);
          }}
        >
          Build switch below
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ActionMenu(props: {
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  disableUp: boolean;
  disableDown: boolean;
}) {
  return <RowMenu label="Action menu" {...props} />;
}

/** If / then / else — else branch stays closed until "+ else". */
function IfActionFields({
  action,
  onChange,
  depth,
  rootActions,
}: {
  action: Extract<EditorAction, { type: "if" }>;
  onChange: (action: EditorAction) => void;
  depth: number;
  rootActions: EditorAction[];
}) {
  // Open if there are else actions; stay open after user clicks "+ else" even when empty.
  const [elseOpen, setElseOpen] = useState(action.elseActions.length > 0);

  useEffect(() => {
    if (action.elseActions.length > 0) setElseOpen(true);
  }, [action.elseActions.length]);

  function closeElse() {
    setElseOpen(false);
    onChange({ ...action, elseActions: [] });
  }

  function openElse() {
    setElseOpen(true);
  }

  return (
    <div className="mt-1.5 space-y-2">
      <ExprTextField
        value={action.condition}
        rootActions={rootActions}
        placeholder={"{{local.score}} > 5"}
        onChange={(condition) => onChange({ ...action, condition })}
      />
      <div className="space-y-1">
        <p className="font-mono text-[11px] text-muted-foreground">then</p>
        <ActionList
          actions={action.actions}
          depth={depth + 1}
          rootActions={rootActions}
          listId={listIdFor(action, "then")}
          parentActionId={action.clientId}
          onChange={(actions) => onChange({ ...action, actions })}
        />
      </div>

      {!elseOpen ? (
        <button
          type="button"
          className="text-xs font-medium text-primary hover:text-primary/80"
          onClick={openElse}
        >
          + else
        </button>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="font-mono text-[11px] text-muted-foreground">else</p>
            <button
              type="button"
              className="text-[11px] text-muted-foreground hover:text-destructive"
              onClick={closeElse}
              title="Remove else branch"
            >
              remove
            </button>
          </div>
          <ActionList
            actions={action.elseActions}
            depth={depth + 1}
            rootActions={rootActions}
            listId={listIdFor(action, "else")}
            parentActionId={action.clientId}
            onChange={(elseActions) => {
              onChange({ ...action, elseActions });
              // Keep branch open even if the user deletes the last action
              setElseOpen(true);
            }}
          />
        </div>
      )}
    </div>
  );
}

function SwitchActionFields({
  action,
  onChange,
  depth,
  rootActions,
}: {
  action: Extract<EditorAction, { type: "switch" }>;
  onChange: (action: EditorAction) => void;
  depth: number;
  rootActions: EditorAction[];
}) {
  const [defaultOpen, setDefaultOpen] = useState(
    action.defaultActions.length > 0,
  );
  const [openCases, setOpenCases] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (action.defaultActions.length > 0) setDefaultOpen(true);
  }, [action.defaultActions.length]);

  function updateCase(
    index: number,
    patch: Partial<(typeof action.cases)[number]>,
  ) {
    onChange({
      ...action,
      cases: action.cases.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    });
  }

  function moveCase(index: number, direction: -1 | 1) {
    onChange({
      ...action,
      cases: moveItem(action.cases, index, direction),
    });
  }

  return (
    <div className="mt-1.5 min-w-0 space-y-2">
      <ExprTextField
        value={action.value}
        rootActions={rootActions}
        placeholder={"{{local.lastError}}"}
        onChange={(value) => onChange({ ...action, value })}
      />
      {action.cases.map((item, index) => {
        const expanded = openCases[item.clientId] ?? item.actions.length > 0;
        const label = formatExpressionText(item.match) || "…";
        return (
          <div key={item.clientId} className="min-w-0 space-y-1">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                className="inline-flex min-w-0 items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() =>
                  setOpenCases((current) => ({
                    ...current,
                    [item.clientId]: !expanded,
                  }))
                }
              >
                <Chevron open={expanded} />
                <span className="truncate">case {label}</span>
              </button>
              <div className="ml-auto flex shrink-0 items-center gap-1">
                {action.cases.length > 1 ? (
                  <>
                    <button
                      type="button"
                      aria-label="Move case up"
                      disabled={index === 0}
                      className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-30"
                      onClick={() => moveCase(index, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="Move case down"
                      disabled={index === action.cases.length - 1}
                      className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-30"
                      onClick={() => moveCase(index, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        onChange({
                          ...action,
                          cases: action.cases.filter((_, i) => i !== index),
                        })
                      }
                    >
                      remove
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            {expanded ? (
              <>
                <ExprTextField
                  value={item.match}
                  rootActions={rootActions}
                  placeholder={'"not_on_whatsapp"'}
                  onChange={(match) => updateCase(index, { match })}
                />
                <ActionList
                  actions={item.actions}
                  depth={depth + 1}
                  rootActions={rootActions}
                  listId={`${item.clientId}:case`}
                  parentActionId={action.clientId}
                  onChange={(actions) => updateCase(index, { actions })}
                />
              </>
            ) : null}
          </div>
        );
      })}
      <button
        type="button"
        className="text-xs font-medium text-primary hover:text-primary/80"
        onClick={() =>
          onChange({
            ...action,
            cases: [
              ...action.cases,
              { clientId: clientId(), match: literal(""), actions: [] },
            ],
          })
        }
      >
        + case
      </button>
      {!defaultOpen ? (
        <button
          type="button"
          className="ml-3 text-xs font-medium text-primary hover:text-primary/80"
          onClick={() => setDefaultOpen(true)}
        >
          + default
        </button>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="font-mono text-[11px] text-muted-foreground">
              default
            </p>
            <button
              type="button"
              className="text-[11px] text-muted-foreground hover:text-destructive"
              onClick={() => {
                setDefaultOpen(false);
                onChange({ ...action, defaultActions: [] });
              }}
            >
              remove
            </button>
          </div>
          <ActionList
            actions={action.defaultActions}
            depth={depth + 1}
            rootActions={rootActions}
            listId={listIdFor(action, "default")}
            parentActionId={action.clientId}
            onChange={(defaultActions) => {
              onChange({ ...action, defaultActions });
              setDefaultOpen(true);
            }}
          />
        </div>
      )}
    </div>
  );
}

function JsonValueEditor({
  kind,
  value,
  onChange,
}: {
  kind: "object" | "array";
  value: EditorExpression;
  onChange: (value: EditorExpression) => void;
}) {
  const fallback = kind === "object" ? "{}" : "[]";
  const stored =
    value.type === "literal" && value.value != null ? String(value.value) : fallback;
  const [text, setText] = useState(stored);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(stored);
    setError(null);
  }, [stored]);

  function commit(next: string) {
    setText(next);
    const trimmed = next.trim();
    if (!trimmed) {
      setError(kind === "object" ? "Enter a JSON object" : "Enter a JSON array");
      return;
    }
    try {
      const parsed = JSON.parse(trimmed);
      const ok =
        kind === "object"
          ? parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
          : Array.isArray(parsed);
      if (!ok) {
        setError(kind === "object" ? "Must be a JSON object {}" : "Must be a JSON array []");
        return;
      }
      setError(null);
      onChange(literal(trimmed));
    } catch {
      setError("Invalid JSON");
    }
  }

  return (
    <div className="space-y-1.5">
      <Field label={kind === "object" ? "Object JSON" : "Array JSON"}>
        <TextArea
          value={text}
          spellCheck={false}
          className="min-h-24 font-mono text-xs"
          placeholder={kind === "object" ? '{"id": "user.id", "reason": "spam"}' : '["a", "b"]'}
          onChange={(event) => commit(event.target.value)}
        />
      </Field>
      {error ? <p className="text-xs text-amber-400/90">{error}</p> : null}
      <Hint>
        {kind === "object"
          ? "JSON object. Nested objects and arrays are fine."
          : "JSON array. Numbers, strings, objects, and nested arrays are fine."}
      </Hint>
    </div>
  );
}

function ActionFields({
  action,
  onChange,
  depth,
  rootActions,
}: {
  action: EditorAction;
  onChange: (action: EditorAction) => void;
  depth: number;
  rootActions: EditorAction[];
}) {
  const ctx = useEditorCtx();

  if (action.type === "send_message") {
    return (
      <div className="mt-1.5 space-y-1">
        <TextArea
          value={action.text}
          onChange={(event) =>
            onChange({ ...action, text: event.target.value })
          }
          className="min-h-16"
          placeholder="Hello {{tag(user.id)}}"
        />
        <InsertPathForMessage
          rootActions={rootActions}
          onInsert={(snippet) =>
            onChange({ ...action, text: action.text + snippet })
          }
        />
      </div>
    );
  }

  if (action.type === "reply_message") {
    return (
      <div className="mt-1.5 space-y-2">
        <TextArea
          value={action.text}
          onChange={(event) =>
            onChange({ ...action, text: event.target.value })
          }
          className="min-h-16"
          placeholder="Hello {{tag(message.quotedUserId)}}"
        />
        <InsertPathForMessage
          rootActions={rootActions}
          onInsert={(snippet) =>
            onChange({ ...action, text: action.text + snippet })
          }
        />
        <Field label="Message id">
          <PathField
            value={action.messageId}
            placeholder="message.id"
            actionsForLocal={rootActions}
            size="sm"
            onChange={(messageId) => onChange({ ...action, messageId })}
          />
        </Field>
      </div>
    );
  }

  if (action.type === "react_message") {
    return (
      <div className="mt-1.5 space-y-2">
        <TextInput
          value={action.emoji}
          placeholder="👍"
          onChange={(event) =>
            onChange({ ...action, emoji: event.target.value })
          }
        />
        <Field label="Message id">
          <PathField
            value={action.messageId}
            placeholder="message.id"
            actionsForLocal={rootActions}
            size="sm"
            onChange={(messageId) => onChange({ ...action, messageId })}
          />
        </Field>
      </div>
    );
  }

  if (action.type === "delete_message") {
    return (
      <div className="mt-1.5">
        <Field label="Message id">
          <PathField
            value={action.messageId}
            placeholder="message.id"
            actionsForLocal={rootActions}
            size="sm"
            onChange={(messageId) => onChange({ ...action, messageId })}
          />
        </Field>
      </div>
    );
  }

  if (action.type === "add_member") {
    return (
      <div className="mt-1.5">
        <ExprTextField
          value={action.users}
          onChange={(users) => onChange({ ...action, users })}
          placeholder='params.phone, "080…", or code_utils.ResolveUser(...)'
        />
      </div>
    );
  }

  if (
    action.type === "kick" ||
    action.type === "promote" ||
    action.type === "demote"
  ) {
    return (
      <div className="mt-1.5">
        <ExprTextField
          value={action.users}
          onChange={(users) => onChange({ ...action, users })}
          placeholder="params.mention, message.quotedUserId, or code_utils.ResolveUser(...)"
        />
      </div>
    );
  }

  if (action.type === "get_link" || action.type === "reset_link") {
    return (
      <div className="mt-1.5">
        <Field label="Store result (optional)">
          <PathField
            value={action.target}
            placeholder="local.getLink"
            actionsForLocal={rootActions}
            size="sm"
            onChange={(target) => onChange({ ...action, target })}
          />
        </Field>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Result is always in local.getLink as {"{ code, url }"}.
        </p>
      </div>
    );
  }

  if (action.type === "send_media") {
    const mediaAssets = ctx.assets.filter(
      (a) => a.type === "image" || a.type === "file",
    );
    return (
      <div className="mt-1.5 grid gap-2">
        <Field label="Image">
          <AssetOrUrlField
            value={action.image}
            assets={mediaAssets}
            onChange={(image) => onChange({ ...action, image })}
          />
        </Field>
        <Field label="File">
          <AssetOrUrlField
            value={action.file}
            assets={mediaAssets}
            onChange={(file) => onChange({ ...action, file })}
          />
        </Field>
        <Field label="Caption">
          <TextArea
            value={action.text}
            className="min-h-14"
            onChange={(event) =>
              onChange({ ...action, text: event.target.value })
            }
          />
          <div className="mt-1.5">
            <InsertPathForMessage
              rootActions={rootActions}
              onInsert={(snippet) =>
                onChange({ ...action, text: action.text + snippet })
              }
            />
          </div>
        </Field>
      </div>
    );
  }

  if (action.type === "set_variable") {
    const structured = action.valueType === "object" || action.valueType === "array";
    return (
      <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
        <Field label="Target">
          <PathField
            value={action.target}
            placeholder="local.score"
            actionsForLocal={rootActions}
            size="sm"
            onChange={(target) => onChange({ ...action, target })}
          />
        </Field>
        <Field label="Coerce">
          <MenuSelect
            size="sm"
            ariaLabel="Value type"
            value={action.valueType}
            placeholder="auto"
            onChange={(valueType) => {
              const nextType = valueType as ParameterType | "";
              let nextValue = action.value;
              if ((nextType === "object" || nextType === "array") && action.value.type === "literal") {
                const raw = String(action.value.value ?? "").trim();
                const fallback = nextType === "object" ? "{}" : "[]";
                try {
                  const parsed = raw ? JSON.parse(raw) : null;
                  const ok =
                    nextType === "object"
                      ? parsed && typeof parsed === "object" && !Array.isArray(parsed)
                      : Array.isArray(parsed);
                  if (!ok) nextValue = literal(fallback);
                } catch {
                  nextValue = literal(fallback);
                }
              }
              onChange({ ...action, valueType: nextType, value: nextValue });
            }}
            options={[
              { value: "", label: "auto" },
              ...parameterTypes.map((type) => ({ value: type, label: type })),
            ]}
          />
        </Field>
        <div className="sm:col-span-2">
          {structured && action.value.type === "literal" ? (
            <JsonValueEditor
              kind={action.valueType === "array" ? "array" : "object"}
              value={action.value}
              onChange={(value) => onChange({ ...action, value })}
            />
          ) : (
            <Field label="Value" hint={structured ? "Expression — result is coerced to " + action.valueType : undefined}>
              <ExprTextField
                value={action.value}
                rootActions={rootActions}
                placeholder={
                  action.valueType === "object"
                    ? '{"key": "value"}'
                    : action.valueType === "array"
                      ? '["a", "b"]'
                      : "{{params.n}} + 1"
                }
                onChange={(value) => onChange({ ...action, value })}
              />
            </Field>
          )}
          {structured && action.value.type !== "literal" ? (
            <button
              type="button"
              className="mt-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              onClick={() =>
                onChange({
                  ...action,
                  value: literal(action.valueType === "object" ? "{}" : "[]"),
                })
              }
            >
              Switch to JSON
            </button>
          ) : null}
          {structured && action.value.type === "literal" ? (
            <button
              type="button"
              className="mt-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => onChange({ ...action, value: variableExpr("") })}
            >
              Use expression instead
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (action.type === "get_asset") {
    return (
      <div className="mt-1.5">
        <Field label="Asset">
          <AssetOrUrlField
            value={action.asset}
            assets={ctx.assets}
            onChange={(asset) => onChange({ ...action, asset })}
          />
        </Field>
      </div>
    );
  }

  if (action.type === "get_user") {
    return (
      <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
        <Field label="User id">
          <ExprTextField
            value={action.userId}
            rootActions={rootActions}
            placeholder={"{{params.user}}"}
            onChange={(userId) => onChange({ ...action, userId })}
          />
        </Field>
        <Field label="Target">
          <PathField
            value={action.target}
            placeholder="local.user"
            actionsForLocal={rootActions}
            size="sm"
            onChange={(target) => onChange({ ...action, target })}
          />
        </Field>
      </div>
    );
  }

  if (action.type === "get_user_from_mention") {
    return (
      <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
        <Field label="Mention">
          <ExprTextField
            value={action.mention}
            rootActions={rootActions}
            placeholder={"{{params.userId}}"}
            onChange={(mention) => onChange({ ...action, mention })}
          />
        </Field>
        <Field label="Target">
          <PathField
            value={action.target}
            placeholder="local.user"
            actionsForLocal={rootActions}
            size="sm"
            onChange={(target) => onChange({ ...action, target })}
          />
        </Field>
      </div>
    );
  }

  if (action.type === "get_type") {
    return (
      <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
        <Field label="Value">
          <ExprTextField
            value={action.value}
            rootActions={rootActions}
            onChange={(value) => onChange({ ...action, value })}
          />
        </Field>
        <Field label="Target">
          <PathField
            value={action.target}
            placeholder="local.type"
            actionsForLocal={rootActions}
            size="sm"
            onChange={(target) => onChange({ ...action, target })}
          />
        </Field>
      </div>
    );
  }

  if (action.type === "wait") {
    return (
      <div className="mt-1.5">
        <Field label="Duration (ms)" hint="Number or expression">
          <ExprTextField
            value={action.duration}
            rootActions={rootActions}
            placeholder="1000"
            onChange={(duration) => onChange({ ...action, duration })}
          />
        </Field>
      </div>
    );
  }

  if (action.type === "if") {
    return (
      <IfActionFields
        action={action}
        depth={depth}
        rootActions={rootActions}
        onChange={onChange}
      />
    );
  }

  if (action.type === "switch") {
    return (
      <SwitchActionFields
        action={action}
        depth={depth}
        rootActions={rootActions}
        onChange={onChange}
      />
    );
  }

  if (action.type === "repeat") {
    return (
      <div className="mt-1.5 space-y-2">
        <Field label="Count" hint="Uses local._index inside the loop">
          <TextInput
            type="number"
            min={0}
            max={100}
            value={action.count}
            onChange={(event) =>
              onChange({ ...action, count: Number(event.target.value) })
            }
          />
        </Field>
        <ActionList
          actions={action.actions}
          depth={depth + 1}
          rootActions={rootActions}
          listId={listIdFor(action, "repeat")}
          parentActionId={action.clientId}
          onChange={(actions) => onChange({ ...action, actions })}
        />
      </div>
    );
  }

  if (action.type === "call_function") {
    const fnOptions = ctx.functions.map((fn) => ({
      value: fn.name || fn.id,
      label: fn.name || fn.id || "Untitled",
      hint: fn.id && fn.name ? fn.id : undefined,
    }));
    const selected =
      ctx.functions.find(
        (fn) =>
          fn.name === action.functionName || fn.id === action.functionName,
      ) ?? null;

    return (
      <div className="mt-1.5 space-y-2">
        <Field label="Function">
          {fnOptions.length > 0 ? (
            <div className="grid gap-1.5 sm:grid-cols-2">
              <MenuSelect
                size="sm"
                ariaLabel="Function"
                value={
                  fnOptions.some((o) => o.value === action.functionName)
                    ? action.functionName
                    : ""
                }
                placeholder="Choose"
                onChange={(functionName) => {
                  const fn = ctx.functions.find(
                    (f) => f.name === functionName || f.id === functionName,
                  );
                  const nextArgs =
                    fn && fn.parameters.length
                      ? fn.parameters
                          .filter((p) => p.name.trim())
                          .map((p) => ({
                            clientId: clientId(),
                            name: p.name.trim(),
                            value: literal("") as EditorExpression,
                          }))
                      : [];
                  onChange({
                    ...action,
                    functionName,
                    args: fn ? nextArgs : action.args,
                  });
                }}
                options={fnOptions}
              />
              <TextInput
                value={action.functionName}
                placeholder="or type name"
                spellCheck={false}
                className="font-mono"
                onChange={(event) =>
                  onChange({ ...action, functionName: event.target.value })
                }
              />
            </div>
          ) : (
            <TextInput
              value={action.functionName}
              placeholder="function name"
              spellCheck={false}
              className="font-mono"
              onChange={(event) =>
                onChange({ ...action, functionName: event.target.value })
              }
            />
          )}
        </Field>
        {selected && selected.parameters.length === 0 ? (
          <Hint>No parameters</Hint>
        ) : null}
        {action.args.map((arg, index) => (
          <div
            key={arg.clientId}
            className="grid gap-1.5 sm:grid-cols-[7rem_1fr_auto]"
          >
            <TextInput
              value={arg.name}
              placeholder="arg"
              spellCheck={false}
              className="font-mono"
              onChange={(event) =>
                onChange({
                  ...action,
                  args: patchAt(action.args, index, {
                    name: event.target.value,
                  }),
                })
              }
            />
            <ExprTextField
              value={arg.value}
              rootActions={rootActions}
              onChange={(value) =>
                onChange({
                  ...action,
                  args: patchAt(action.args, index, { value }),
                })
              }
            />
            <SecondaryButton
              type="button"
              onClick={() =>
                onChange({ ...action, args: removeAt(action.args, index) })
              }
            >
              ×
            </SecondaryButton>
          </div>
        ))}
        <SecondaryButton
          type="button"
          onClick={() =>
            onChange({
              ...action,
              args: [
                ...action.args,
                { clientId: clientId(), name: "", value: literal("") },
              ],
            })
          }
        >
          Add argument
        </SecondaryButton>
        <Hint>
          Args → params.* inside the function. Return value → local._return
        </Hint>
      </div>
    );
  }

  if (action.type === "return") {
    if (!action.value) {
      return (
        <SecondaryButton
          className="mt-1.5"
          type="button"
          onClick={() => onChange({ ...action, value: literal("") })}
        >
          Add return value
        </SecondaryButton>
      );
    }
    return (
      <div className="mt-1.5 space-y-2">
        <ExprTextField
          value={action.value}
          rootActions={rootActions}
          onChange={(value) => onChange({ ...action, value })}
        />
        <SecondaryButton
          type="button"
          onClick={() => onChange({ ...action, value: null })}
        >
          Clear value
        </SecondaryButton>
      </div>
    );
  }

  if (action.type === "get_key") {
    return (
      <div className="mt-1.5 space-y-2">
        <Field label="Map (object variable)">
          <PathField
            value={action.source}
            placeholder="chat.Bans"
            actionsForLocal={rootActions}
            onChange={(source) => onChange({ ...action, source })}
          />
        </Field>
        <Field label="Key">
          <ExprTextField
            value={action.key}
            rootActions={rootActions}
            placeholder="local.target or params.mention"
            onChange={(key) => onChange({ ...action, key })}
          />
        </Field>
        <Field label="Store result">
          <PathField
            value={action.target}
            placeholder="local.getKey"
            actionsForLocal={rootActions}
            onChange={(target) => onChange({ ...action, target })}
          />
        </Field>
      </div>
    );
  }

  if (action.type === "set_key") {
    return (
      <div className="mt-1.5 space-y-2">
        <Field label="Map (object variable)">
          <PathField
            value={action.source}
            placeholder="chat.Bans"
            actionsForLocal={rootActions}
            onChange={(source) => onChange({ ...action, source })}
          />
        </Field>
        <Field label="Key">
          <ExprTextField
            value={action.key}
            rootActions={rootActions}
            placeholder="local.target"
            onChange={(key) => onChange({ ...action, key })}
          />
        </Field>
        <Field label="Value">
          <ExprTextField
            value={action.value}
            rootActions={rootActions}
            onChange={(value) => onChange({ ...action, value })}
          />
        </Field>
      </div>
    );
  }

  if (action.type === "delete_key") {
    return (
      <div className="mt-1.5 space-y-2">
        <Field label="Map (object variable)">
          <PathField
            value={action.source}
            placeholder="chat.Bans"
            actionsForLocal={rootActions}
            onChange={(source) => onChange({ ...action, source })}
          />
        </Field>
        <Field label="Key">
          <ExprTextField
            value={action.key}
            rootActions={rootActions}
            placeholder="local.target"
            onChange={(key) => onChange({ ...action, key })}
          />
        </Field>
      </div>
    );
  }

  if (action.type === "array_append" || action.type === "array_prepend") {
    return (
      <div className="mt-1.5 space-y-2">
        <Field label="Array path">
          <PathField
            value={action.target}
            placeholder="chat.WarnHistory or local.list"
            actionsForLocal={rootActions}
            onChange={(target) => onChange({ ...action, target })}
          />
        </Field>
        <Field label={action.type === "array_append" ? "Value to append" : "Value to prepend"}>
          <ExprTextField
            value={action.value}
            rootActions={rootActions}
            placeholder="local.record or params.reason"
            onChange={(value) => onChange({ ...action, value })}
          />
        </Field>
        <Hint>
          Target must resolve to an array (declared array variable or local).
          Creates a new array if the path is empty.
        </Hint>
      </div>
    );
  }

  if (action.type === "array_insert" || action.type === "array_set") {
    return (
      <div className="mt-1.5 space-y-2">
        <Field label="Array path">
          <PathField
            value={action.target}
            placeholder="chat.Queue or local.list"
            actionsForLocal={rootActions}
            onChange={(target) => onChange({ ...action, target })}
          />
        </Field>
        <Field label="Index">
          <ExprTextField
            value={action.index}
            rootActions={rootActions}
            placeholder="0 or local._index"
            onChange={(index) => onChange({ ...action, index })}
          />
        </Field>
        <Field label="Value">
          <ExprTextField
            value={action.value}
            rootActions={rootActions}
            placeholder="local.item"
            onChange={(value) => onChange({ ...action, value })}
          />
        </Field>
        <Hint>
          Errors if the target is not an array or the index is out of range.
          {action.type === "array_insert" ? " Insert shifts later elements right." : " Set replaces the existing element."}
        </Hint>
      </div>
    );
  }

  if (action.type === "array_remove") {
    return (
      <div className="mt-1.5 space-y-2">
        <Field label="Array path">
          <PathField
            value={action.target}
            placeholder="chat.Bans or local.list"
            actionsForLocal={rootActions}
            onChange={(target) => onChange({ ...action, target })}
          />
        </Field>
        <Field label="Index (optional — leave empty to remove by value)">
          <ExprTextField
            value={action.index ?? literal("")}
            rootActions={rootActions}
            placeholder="leave empty for value mode, or 0 / local._index"
            onChange={(index) =>
              onChange({
                ...action,
                index: index.type === "literal" && index.value === "" ? null : index,
              })
            }
          />
        </Field>
        <Field label="Value (used when index is empty)">
          <ExprTextField
            value={action.value ?? literal("")}
            rootActions={rootActions}
            placeholder="params.userId or local.item"
            onChange={(value) => onChange({ ...action, value })}
          />
        </Field>
        <Field label="Store removed item (optional)">
          <PathField
            value={action.store}
            placeholder="local.removed"
            actionsForLocal={rootActions}
            onChange={(store) => onChange({ ...action, store })}
          />
        </Field>
        <Hint>
          First match only when removing by value. Errors on bad index or if the value is not found.
        </Hint>
      </div>
    );
  }

  if (action.type === "array_clear") {
    return (
      <div className="mt-1.5 space-y-2">
        <Field label="Array path">
          <PathField
            value={action.target}
            placeholder="chat.WarnIds or local.list"
            actionsForLocal={rootActions}
            onChange={(target) => onChange({ ...action, target })}
          />
        </Field>
        <Hint>Sets the path to an empty array [].</Hint>
      </div>
    );
  }

  if (action.type === "for_each") {
    return (
      <div className="mt-1.5 space-y-2">
        <Field label="List">
          <ExprTextField
            value={action.list}
            rootActions={rootActions}
            placeholder="chat.WarnHistory or local.list"
            onChange={(list) => onChange({ ...action, list })}
          />
        </Field>
        <Field label="Item path">
          <PathField
            value={action.as}
            placeholder="local.item"
            actionsForLocal={rootActions}
            onChange={(as) => onChange({ ...action, as })}
          />
        </Field>
        <Hint>
          Each element is written to the item path. local._index is the 0-based
          index. Use break / continue inside the loop.
        </Hint>
        <ActionList
          actions={action.actions}
          depth={depth + 1}
          rootActions={rootActions}
          listId={listIdFor(action, "foreach")}
          parentActionId={action.clientId}
          onChange={(actions) => onChange({ ...action, actions })}
        />
      </div>
    );
  }

  if (action.type === "log") {
    return (
      <div className="mt-1.5 space-y-2">
        <Field label="Level">
          <MenuSelect
            size="sm"
            ariaLabel="Log level"
            value={action.level}
            onChange={(level) =>
              onChange({
                ...action,
                level: level as "info" | "warn" | "error",
              })
            }
            options={[
              { value: "info", label: "info" },
              { value: "warn", label: "warn" },
              { value: "error", label: "error" },
            ]}
          />
        </Field>
        <Field label="Message">
          <TextArea
            value={action.text}
            placeholder="Ban failed {{local.lastError}}"
            className="min-h-12"
            onChange={(event) =>
              onChange({ ...action, text: event.target.value })
            }
          />
          <div className="mt-1.5">
            <InsertPathForMessage
              rootActions={rootActions}
              onInsert={(snippet) =>
                onChange({ ...action, text: action.text + snippet })
              }
            />
          </div>
        </Field>
      </div>
    );
  }

  return null;
}

function InsertPathForMessage({
  rootActions,
  onInsert,
}: {
  rootActions: EditorAction[];
  onInsert: (snippet: string) => void;
}) {
  return <InsertPathButton actionsForLocal={rootActions} onInsert={onInsert} />;
}

function AssetOrUrlField({
  value,
  assets,
  onChange,
}: {
  value: string;
  assets: { id: string; name: string; type: string }[];
  onChange: (value: string) => void;
}) {
  const options = assets.map((a) => ({
    value: a.id || a.name,
    label: a.name || a.id || "Untitled",
    hint: a.type + (a.id && a.name ? ` · ${a.id}` : ""),
  }));
  const matched = options.some((o) => o.value === value);

  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      <MenuSelect
        size="sm"
        ariaLabel="Asset"
        value={matched ? value : ""}
        placeholder="Asset"
        onChange={onChange}
        options={options}
      />
      <TextInput
        value={value}
        placeholder="id or https://"
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function ExpressionField({
  label,
  value,
  onChange,
  rootActions,
  preferNumber = false,
}: {
  label: string;
  value: EditorExpression;
  onChange: (value: EditorExpression) => void;
  rootActions?: EditorAction[];
  preferNumber?: boolean;
  depth?: number;
}) {
  return (
    <Field label={label}>
      <ExprTextField
        value={value}
        rootActions={rootActions}
        placeholder={preferNumber ? "1000" : "{{params.name}} > 5"}
        onChange={onChange}
      />
    </Field>
  );
}
