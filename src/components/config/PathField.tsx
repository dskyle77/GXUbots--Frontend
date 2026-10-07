"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  buildPathOptions,
  collectLocalNames,
  groupLabel,
  useEditorCtx,
  type PathGroup,
  type PathOption,
} from "./config-context";
import type { EditorAction } from "../../lib/config-editor";
import { inputClass } from "./ui";

const GROUP_ORDER: PathGroup[] = ["params", "local", "chat", "user", "global", "session", "builtin"];

export function PathField({
  value,
  onChange,
  placeholder = "chat.score",
  ariaLabel = "Path",
  actionsForLocal,
  allowFree = true,
  size = "md",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  /** Action tree used to discover local.* names from set_variable */
  actionsForLocal?: EditorAction[];
  allowFree?: boolean;
  size?: "md" | "sm";
}) {
  const ctx = useEditorCtx();
  const localNames = useMemo(
    () => (actionsForLocal ? collectLocalNames(actionsForLocal) : []),
    [actionsForLocal],
  );
  const options = useMemo(() => buildPathOptions(ctx, localNames), [ctx, localNames]);
  const known = useMemo(() => new Set(options.map((o) => o.path)), [options]);
  const unknown = Boolean(value.trim()) && !known.has(value.trim());

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.path.toLowerCase().includes(q) || (o.hint && o.hint.toLowerCase().includes(q)),
    );
  }, [options, query]);

  const grouped = useMemo(() => {
    const map = new Map<PathGroup, PathOption[]>();
    for (const opt of filtered) {
      const list = map.get(opt.group) ?? [];
      list.push(opt);
      map.set(opt.group, list);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({
      group: g,
      items: map.get(g)!,
    }));
  }, [filtered]);

  function commit(next: string) {
    onChange(next);
    setQuery(next);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative ${open ? "z-40" : ""}`}>
      <input
        value={query}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          if (allowFree) onChange(next);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            return;
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) {
              setOpen(true);
              return;
            }
            setHighlight((h) => {
              const n = filtered.length;
              if (!n) return -1;
              if (event.key === "ArrowDown") return h < 0 ? 0 : (h + 1) % n;
              return h <= 0 ? n - 1 : h - 1;
            });
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            if (highlight >= 0 && filtered[highlight]) commit(filtered[highlight].path);
            else if (filtered[0]) commit(filtered[0].path);
            else commit(query);
          }
        }}
        className={`${inputClass} font-mono ${size === "sm" ? "!h-9" : ""} ${
          unknown ? "border-amber-500/40 focus:border-amber-500/60" : ""
        }`}
      />
      {unknown ? (
        <p className="mt-1 text-xs text-amber-400/90">Unknown path — allowed, but not in the catalog</p>
      ) : null}
      {open ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-popover p-1 shadow-gxu"
        >
          {grouped.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              {allowFree ? "Type a path or pick from the catalog" : "No matching paths"}
            </p>
          ) : (
            grouped.map(({ group, items }) => (
              <div key={group} className="mb-1">
                <p className="px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {groupLabel(group)}
                </p>
                {items.map((option) => {
                  const active = option.path === value;
                  const flatIndex = filtered.indexOf(option);
                  const focused = flatIndex === highlight;
                  return (
                    <button
                      key={option.path}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setHighlight(flatIndex)}
                      onClick={() => commit(option.path)}
                      className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-1.5 text-left text-sm ${
                        focused
                          ? "bg-[var(--color-hover)] text-foreground"
                          : active
                            ? "bg-primary/15 text-foreground"
                            : "text-foreground/85 hover:bg-[var(--color-hover)]"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-sm">{option.path}</span>
                        {option.hint ? (
                          <span className="block truncate text-xs text-muted-foreground">{option.hint}</span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Insert `{{path}}` into a text field (messages). */
export function InsertPathButton({
  onInsert,
  actionsForLocal,
}: {
  onInsert: (snippet: string) => void;
  actionsForLocal?: EditorAction[];
}) {
  const ctx = useEditorCtx();
  const localNames = useMemo(
    () => (actionsForLocal ? collectLocalNames(actionsForLocal) : []),
    [actionsForLocal],
  );
  const options = useMemo(() => buildPathOptions(ctx, localNames), [ctx, localNames]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-8 rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground hover:bg-[var(--color-hover)] hover:text-foreground"
      >
        Insert path
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-1 max-h-56 w-64 overflow-auto rounded-lg border border-border bg-popover p-1 shadow-gxu">
          {options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No paths yet</p>
          ) : (
            options.map((option) => (
              <button
                key={option.path}
                type="button"
                onClick={() => {
                  onInsert(`{{${option.path}}}`);
                  setOpen(false);
                }}
                className="flex w-full flex-col rounded-md px-3 py-1.5 text-left hover:bg-[var(--color-hover)]"
              >
                <span className="font-mono text-sm text-foreground">{option.path}</span>
                {option.hint ? (
                  <span className="text-xs text-muted-foreground">{option.hint}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
