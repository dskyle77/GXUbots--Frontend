"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  actionLabels,
  actionTypes,
  blankAction,
  clientId,
  literal,
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
  IconButton,
  MenuSelect,
  SecondaryButton,
  SortableList,
  TextArea,
  TextInput,
  moveItem,
  patchAt,
  removeAt,
} from "./ui";
import { cn } from "../../lib/cn";

/** Actions with no editable fields — always stay compact. */
const FIELDLESS = new Set<EditorAction["type"]>([
  "continue",
  "break",
  "delete_message",
  "stop_event",
]);

/** Soft surface tint per action family — readable separation without loud colors. */
function actionSurface(type: EditorAction["type"]): string {
  switch (type) {
    case "if":
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
    case "get_type":
      return "bg-warning/[0.05] border-warning/15";
    case "call_function":
    case "return":
      return "bg-accent/40 border-primary/10";
    case "stop_event":
    case "kick":
    case "delete_message":
      return "bg-destructive/[0.06] border-destructive/15";
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
      return action.text.trim() ? `send  ${truncate(action.text)}` : "send message";
    case "reply_message":
      return action.text.trim() ? `reply  ${truncate(action.text)}` : "reply";
    case "react_message":
      return action.emoji.trim() ? `react  ${action.emoji}` : "react";
    case "delete_message":
      return "delete message";
    case "send_media": {
      const bits = [action.image, action.file].filter((x) => x.trim());
      const cap = action.text.trim() ? truncate(action.text, 24) : "";
      return bits.length
        ? `media  ${truncate(bits.join(" · "), 32)}${cap ? ` · ${cap}` : ""}`
        : "send media";
    }
    case "kick":
      return action.users.trim() ? `kick  ${truncate(action.users)}` : "kick";
    case "add_member":
      return action.users.trim() ? `add  ${truncate(action.users)}` : "add member";
    case "promote":
      return action.users.trim() ? `promote  ${truncate(action.users)}` : "promote";
    case "demote":
      return action.users.trim() ? `demote  ${truncate(action.users)}` : "demote";
    case "set_variable":
      return action.target.trim()
        ? `set  ${action.target} = ${exprSummary(action.value)}`
        : "set variable";
    case "get_asset":
      return action.asset.trim() ? `asset  ${truncate(action.asset)}` : "get asset";
    case "get_user":
      return `get user  ${exprSummary(action.userId)} → ${action.target.trim() || "…"}`;
    case "get_type":
      return `typeof  ${exprSummary(action.value)} → ${action.target.trim() || "…"}`;
    case "wait":
      return `wait  ${exprSummary(action.duration)}`;
    case "if":
      return `if  ${exprSummary(action.condition)}`;
    case "repeat":
      return `repeat  ${action.count}×`;
    case "break":
      return "break";
    case "continue":
      return "continue";
    case "stop_event":
      return "stop event";
    case "call_function": {
      const name = action.functionName.trim() || "…";
      const args =
        action.args.length === 0
          ? "()"
          : `(${action.args.map((a) => a.name.trim() || "…").join(", ")})`;
      return `call  ${name}${args}`;
    }
    case "return":
      return action.value ? `return  ${exprSummary(action.value)}` : "return";
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
    case "demote":
      return Boolean(action.users.trim());
    case "set_variable":
      return Boolean(action.target.trim());
    case "get_asset":
      return Boolean(action.asset.trim());
    case "get_user":
      return Boolean(action.target.trim());
    case "get_type":
      return Boolean(action.target.trim());
    case "wait":
      return true;
    case "if": {
      // Treat empty / bare variable as incomplete so new if opens expanded
      if (action.condition.type === "variable" && !action.condition.path.trim()) return false;
      if (action.condition.type === "literal" && action.condition.value === "") return false;
      return true;
    }
    case "repeat":
      return action.count > 0;
    case "call_function":
      return Boolean(action.functionName.trim());
    case "return":
      return true;
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
  if (action.type === "repeat" && action.actions.length) {
    return `${action.actions.length} action${action.actions.length === 1 ? "" : "s"}`;
  }
  return null;
}

export function ActionList({
  actions,
  onChange,
  depth = 0,
  rootActions,
}: {
  actions: EditorAction[];
  onChange: (actions: EditorAction[]) => void;
  depth?: number;
  rootActions?: EditorAction[];
}) {
  const tree = rootActions ?? actions;

  return (
    <div className={depth ? "mt-0.5 border-l border-border pl-2.5" : "mt-1"}>
      <SortableList
        items={actions}
        onChange={onChange}
        renderItem={(action, index, handle) => (
          <ActionRow
            action={action}
            handle={handle}
            depth={depth}
            rootActions={tree}
            disableUp={index === 0}
            disableDown={index === actions.length - 1}
            onChange={(next) =>
              onChange(actions.map((item, i) => (i === index ? next : item)))
            }
            onUp={() => onChange(moveItem(actions, index, -1))}
            onDown={() => onChange(moveItem(actions, index, 1))}
            onRemove={() => onChange(removeAt(actions, index))}
          />
        )}
      />
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

function ActionRow({
  action,
  handle,
  depth,
  rootActions,
  onChange,
  onUp,
  onDown,
  onRemove,
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
        "group my-1 border px-1.5 py-1 transition-colors",
        actionSurface(action.type),
        open && "ring-1 ring-border/60",
      )}
    >
      <div className="flex items-center gap-1">
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
              onChange={(type) => onChange(blankAction(type as EditorAction["type"]))}
              options={actionTypes.map((type) => ({
                value: type,
                label: actionLabels[type],
              }))}
            />
          </div>
        ) : (
          <button
            type="button"
            className={cn(
              "min-w-0 flex-1 truncate text-left font-mono text-xs sm:text-sm",
              complete ? "text-foreground" : "text-muted-foreground",
            )}
            onClick={() => {
              if (!fieldless) setOpen(true);
            }}
          >
            {summary}
            {badge ? (
              <span className="ml-2 font-sans text-[11px] text-muted-foreground">{badge}</span>
            ) : null}
          </button>
        )}

        <ActionMenu
          disableUp={disableUp}
          disableDown={disableDown}
          onUp={onUp}
          onDown={onDown}
          onRemove={onRemove}
        />
      </div>

      {open && !fieldless ? (
        <div className="pb-1 pl-6">
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

function ActionMenu({
  onUp,
  onDown,
  onRemove,
  disableUp,
  disableDown,
}: {
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  disableUp: boolean;
  disableDown: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <IconButton type="button" label="Action menu" onClick={() => setOpen((v) => !v)}>
        ⋯
      </IconButton>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 min-w-[7.5rem] rounded-sm border border-border bg-popover p-0.5 shadow-gxu">
          {(
            [
              ["Move up", onUp, disableUp],
              ["Move down", onDown, disableDown],
              ["Remove", onRemove, false],
            ] as const
          ).map(([label, fn, disabled]) => (
            <button
              key={label}
              type="button"
              disabled={disabled}
              onClick={() => {
                fn();
                setOpen(false);
              }}
              className={cn(
                "flex w-full rounded-sm px-2.5 py-1.5 text-left text-xs disabled:opacity-30",
                label === "Remove"
                  ? "text-destructive hover:bg-destructive/10"
                  : "text-foreground/85 hover:bg-[var(--color-hover)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
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
        placeholder={'{{local.score}} > 5'}
        onChange={(condition) => onChange({ ...action, condition })}
      />
      <div className="space-y-1">
        <p className="font-mono text-[11px] text-muted-foreground">then</p>
        <ActionList
          actions={action.actions}
          depth={depth + 1}
          rootActions={rootActions}
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
          onChange={(event) => onChange({ ...action, text: event.target.value })}
          className="min-h-16"
          placeholder="Message text…"
        />
        <InsertPathForMessage
          rootActions={rootActions}
          onInsert={(snippet) => onChange({ ...action, text: action.text + snippet })}
        />
      </div>
    );
  }

  if (action.type === "reply_message") {
    return (
      <div className="mt-1.5">
        <TextArea
          value={action.text}
          onChange={(event) => onChange({ ...action, text: event.target.value })}
          className="min-h-16"
          placeholder="Reply text…"
        />
      </div>
    );
  }

  if (action.type === "react_message") {
    return (
      <div className="mt-1.5">
        <TextInput
          value={action.emoji}
          placeholder="👍"
          onChange={(event) => onChange({ ...action, emoji: event.target.value })}
        />
      </div>
    );
  }

  if (action.type === "delete_message") return null;

  if (
    action.type === "kick" ||
    action.type === "add_member" ||
    action.type === "promote" ||
    action.type === "demote"
  ) {
    return (
      <div className="mt-1.5">
        <TextInput
          value={action.users}
          placeholder="user.id or expression"
          onChange={(event) => onChange({ ...action, users: event.target.value })}
        />
      </div>
    );
  }

  if (action.type === "send_media") {
    const mediaAssets = ctx.assets.filter((a) => a.type === "image" || a.type === "file");
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
            onChange={(event) => onChange({ ...action, text: event.target.value })}
          />
        </Field>
      </div>
    );
  }

  if (action.type === "set_variable") {
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
            onChange={(valueType) =>
              onChange({ ...action, valueType: valueType as ParameterType | "" })
            }
            options={[
              { value: "", label: "auto" },
              ...parameterTypes.map((type) => ({ value: type, label: type })),
            ]}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Value">
            <ExprTextField
              value={action.value}
              rootActions={rootActions}
              placeholder={'{{params.n}} + 1'}
              onChange={(value) => onChange({ ...action, value })}
            />
          </Field>
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
            placeholder={'{{params.user}}'}
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

  if (action.type === "repeat") {
    return (
      <div className="mt-1.5 space-y-2">
        <Field label="Count" hint="Uses local._index inside the loop">
          <TextInput
            type="number"
            min={0}
            max={100}
            value={action.count}
            onChange={(event) => onChange({ ...action, count: Number(event.target.value) })}
          />
        </Field>
        <ActionList
          actions={action.actions}
          depth={depth + 1}
          rootActions={rootActions}
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
      ctx.functions.find((fn) => fn.name === action.functionName || fn.id === action.functionName) ??
      null;

    return (
      <div className="mt-1.5 space-y-2">
        <Field label="Function">
          {fnOptions.length > 0 ? (
            <div className="grid gap-1.5 sm:grid-cols-2">
              <MenuSelect
                size="sm"
                ariaLabel="Function"
                value={fnOptions.some((o) => o.value === action.functionName) ? action.functionName : ""}
                placeholder="Choose"
                onChange={(functionName) => {
                  const fn = ctx.functions.find((f) => f.name === functionName || f.id === functionName);
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
                onChange={(event) => onChange({ ...action, functionName: event.target.value })}
              />
            </div>
          ) : (
            <TextInput
              value={action.functionName}
              placeholder="function name"
              spellCheck={false}
              className="font-mono"
              onChange={(event) => onChange({ ...action, functionName: event.target.value })}
            />
          )}
        </Field>
        {selected && selected.parameters.length === 0 ? <Hint>No parameters</Hint> : null}
        {action.args.map((arg, index) => (
          <div key={arg.clientId} className="grid gap-1.5 sm:grid-cols-[7rem_1fr_auto]">
            <TextInput
              value={arg.name}
              placeholder="arg"
              spellCheck={false}
              className="font-mono"
              onChange={(event) =>
                onChange({
                  ...action,
                  args: patchAt(action.args, index, { name: event.target.value }),
                })
              }
            />
            <ExprTextField
              value={arg.value}
              rootActions={rootActions}
              onChange={(value) =>
                onChange({ ...action, args: patchAt(action.args, index, { value }) })
              }
            />
            <SecondaryButton
              type="button"
              onClick={() => onChange({ ...action, args: removeAt(action.args, index) })}
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
              args: [...action.args, { clientId: clientId(), name: "", value: literal("") }],
            })
          }
        >
          Add argument
        </SecondaryButton>
        <Hint>Args → params.* inside the function. Return value → local._return</Hint>
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
        <SecondaryButton type="button" onClick={() => onChange({ ...action, value: null })}>
          Clear value
        </SecondaryButton>
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
        placeholder={preferNumber ? "1000" : '{{params.name}} > 5'}
        onChange={onChange}
      />
    </Field>
  );
}
