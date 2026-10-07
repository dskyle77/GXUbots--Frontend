"use client";

import { useEffect, useRef, useState } from "react";
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
    <div className={depth ? "mt-2 border-l border-white/10 pl-2.5" : "mt-2"}>
      <SortableList
        items={actions}
        onChange={onChange}
        renderItem={(action, index, handle) => (
          <article className="rounded-lg border border-white/10 bg-black/20 p-2">
            <div className="flex items-center gap-1.5">
              {handle}
              <div className="min-w-0 flex-1">
                <MenuSelect
                  size="sm"
                  ariaLabel="Action type"
                  value={action.type}
                  onChange={(type) =>
                    onChange(
                      actions.map((item, itemIndex) =>
                        itemIndex === index ? blankAction(type as EditorAction["type"]) : item,
                      ),
                    )
                  }
                  options={actionTypes.map((type) => ({
                    value: type,
                    label: actionLabels[type],
                  }))}
                />
              </div>
              <ActionMenu
                disableUp={index === 0}
                disableDown={index === actions.length - 1}
                onUp={() => onChange(moveItem(actions, index, -1))}
                onDown={() => onChange(moveItem(actions, index, 1))}
                onRemove={() => onChange(removeAt(actions, index))}
              />
            </div>
            <ActionFields
              action={action}
              depth={depth}
              rootActions={tree}
              onChange={(next) =>
                onChange(actions.map((item, itemIndex) => (itemIndex === index ? next : item)))
              }
            />
          </article>
        )}
      />
      <SecondaryButton
        className="mt-2"
        type="button"
        onClick={() => onChange([...actions, blankAction()])}
      >
        Add action
      </SecondaryButton>
    </div>
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
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${open ? "z-20" : ""}`}>
      <IconButton label="More" onClick={() => setOpen((v) => !v)}>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
          <circle cx="8" cy="3.5" r="1.2" />
          <circle cx="8" cy="8" r="1.2" />
          <circle cx="8" cy="12.5" r="1.2" />
        </svg>
      </IconButton>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 min-w-[7.5rem] rounded-md border border-white/10 bg-[#14161e] p-0.5 shadow-gxu">
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
              className={`flex w-full rounded px-2.5 py-1.5 text-left text-xs ${
                label === "Remove"
                  ? "text-destructive hover:bg-destructive/10"
                  : "text-white/85 hover:bg-white/5"
              } disabled:opacity-30`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
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
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-white/80">Text</span>
        </div>
        <TextArea
          value={action.text}
          onChange={(event) => onChange({ ...action, text: event.target.value })}
          className="min-h-16"
        />
        <Hint>
          {"Use {{path}} or {{fn()}}, e.g. Hello {{user.name}} or {{quiz.double(2)}}"}
        </Hint>
        <div className="pt-0.5">
          <InsertPathForMessage
            rootActions={rootActions}
            onInsert={(snippet) => onChange({ ...action, text: action.text + snippet })}
          />
        </div>
      </div>
    );
  }

  if (action.type === "reply_message") {
    return (
      <div className="mt-2">
        <Field label="Reply text">
          <TextArea value={action.text} onChange={(event) => onChange({ ...action, text: event.target.value })} className="min-h-16" />
        </Field>
      </div>
    );
  }

  if (action.type === "react_message") {
    return (
      <div className="mt-2">
        <Field label="Emoji">
          <TextInput value={action.emoji} placeholder="👍" onChange={(event) => onChange({ ...action, emoji: event.target.value })} />
        </Field>
      </div>
    );
  }

  if (action.type === "delete_message") return null;

  if (action.type === "kick" || action.type === "add_member" || action.type === "promote" || action.type === "demote") {
    return (
      <div className="mt-2">
        <Field label="User id">
          <TextInput value={action.users} placeholder="user.id" onChange={(event) => onChange({ ...action, users: event.target.value })} />
        </Field>
      </div>
    );
  }

  if (action.type === "send_media") {
    const mediaAssets = ctx.assets.filter((a) => a.type === "image" || a.type === "file");
    return (
      <div className="mt-2 grid gap-2">
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
        <Field label="Caption" hint={'Supports {{path}}'}>
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
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
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
          <Field label="Value" hint="Expression: {{path}}, &quot;str&quot;, numbers, operators">
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
      <Field label="Asset" className="mt-2">
        <AssetOrUrlField
          value={action.asset}
          assets={ctx.assets}
          onChange={(asset) => onChange({ ...action, asset })}
        />
      </Field>
    );
  }

  if (action.type === "get_user") {
    return (
      <div className="mt-2 space-y-2">
        <Field label="User id">
          <ExprTextField
            value={action.userId}
            rootActions={rootActions}
            placeholder="{{message.quotedUserId}}"
            onChange={(userId) => onChange({ ...action, userId })}
          />
        </Field>
        <Hint>
          Result is stored on local.getUser. When the id is bot.id, returns the bot
          identity.
        </Hint>
        <Field label="Also store at (optional)">
          <PathField
            value={action.target}
            actionsForLocal={rootActions}
            placeholder="local.loadedUser"
            onChange={(target) => onChange({ ...action, target })}
          />
        </Field>
      </div>
    );
  }

  if (action.type === "get_type") {
    return (
      <div className="mt-2 space-y-2">
        <Field label="Value">
          <ExprTextField
            value={action.value}
            rootActions={rootActions}
            placeholder="{{params.rounds}}"
            onChange={(value) => onChange({ ...action, value })}
          />
        </Field>
        <Hint>
          Runtime type → local.getType (&quot;string&quot; | &quot;number&quot; | &quot;boolean&quot; |
          &quot;array&quot; | &quot;object&quot; | &quot;null&quot; | &quot;undefined&quot;)
        </Hint>
        <Field label="Also store at (optional)">
          <PathField
            value={action.target}
            actionsForLocal={rootActions}
            placeholder="local.typeOfRounds"
            onChange={(target) => onChange({ ...action, target })}
          />
        </Field>
      </div>
    );
  }

  if (action.type === "wait") {
    return (
      <Field label="Duration (ms)" className="mt-2">
        <ExprTextField
          value={action.duration}
          rootActions={rootActions}
          placeholder="1000"
          onChange={(duration) => onChange({ ...action, duration })}
        />
      </Field>
    );
  }

  if (action.type === "if") {
    return (
      <div className="mt-2 space-y-2">
        <Field label="Condition">
          <ExprTextField
            value={action.condition}
            rootActions={rootActions}
            placeholder={'{{local.score}} > 5'}
            onChange={(condition) => onChange({ ...action, condition })}
          />
        </Field>
        <p className="text-xs font-medium text-white/70">Then</p>
        <ActionList
          actions={action.actions}
          depth={depth + 1}
          rootActions={rootActions}
          onChange={(actions) => onChange({ ...action, actions })}
        />
        <p className="text-xs font-medium text-white/70">Else</p>
        <ActionList
          actions={action.elseActions}
          depth={depth + 1}
          rootActions={rootActions}
          onChange={(elseActions) => onChange({ ...action, elseActions })}
        />
      </div>
    );
  }

  if (action.type === "repeat") {
    return (
      <div className="mt-2 space-y-2">
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
      <div className="mt-2 space-y-2">
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
        {selected && selected.parameters.length === 0 ? (
          <Hint>No parameters</Hint>
        ) : null}
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
          className="mt-2"
          type="button"
          onClick={() => onChange({ ...action, value: literal("") })}
        >
          Add return value
        </SecondaryButton>
      );
    }
    return (
      <div className="mt-2 space-y-2">
        <Field label="Value">
          <ExprTextField
            value={action.value}
            rootActions={rootActions}
            onChange={(value) => onChange({ ...action, value })}
          />
        </Field>
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
