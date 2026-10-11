"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { EditorAction, EditorExpression } from "../../lib/config-editor";
import { formatExpressionText, parseExpressionText } from "../../lib/expression-lang";
import {
  buildPathOptions,
  collectLocalNames,
  groupLabel,
  useEditorCtx,
  type PathGroup,
  type PathOption,
} from "./config-context";
import { InsertPathButton } from "./PathField";
import { inputClass } from "./ui";

const GROUP_ORDER: PathGroup[] = [
  "params",
  "local",
  "chat",
  "user",
  "global",
  "session",
  "builtin",
];

/** Detect a path fragment under the cursor. `{{` is optional — expressions are typed bare. */
function pathHintAt(text: string, caret: number): { start: number; query: string; braced: boolean } | null {
  const before = text.slice(0, caret);
  const open = before.lastIndexOf("{{");
  if (open >= 0) {
    const afterOpen = before.slice(open + 2);
    if (!afterOpen.includes("}}") && !/[^a-zA-Z0-9_./]/.test(afterOpen)) {
      return { start: open, query: afterOpen, braced: true };
    }
  }
  const match = before.match(/(?:^|[^A-Za-z0-9_.])([A-Za-z_][A-Za-z0-9_.]*)$/);
  if (!match || match.index === undefined) return null;
  const query = match[1] ?? "";
  if (!query) return null;
  return { start: caret - query.length, query, braced: false };
}

export function ExprTextField({
  value,
  onChange,
  rootActions,
  placeholder = "{{params.name}} > 5",
  ariaLabel = "Expression",
  compactHint = true,
}: {
  value: EditorExpression;
  onChange: (value: EditorExpression) => void;
  rootActions?: EditorAction[];
  placeholder?: string;
  ariaLabel?: string;
  compactHint?: boolean;
}) {
  const formatted = useMemo(() => formatExpressionText(value), [value]);
  const [text, setText] = useState(formatted);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [caret, setCaret] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const ctx = useEditorCtx();
  const localNames = useMemo(
    () => (rootActions ? collectLocalNames(rootActions) : []),
    [rootActions],
  );
  const options = useMemo(() => buildPathOptions(ctx, localNames), [ctx, localNames]);

  const hint = useMemo(() => pathHintAt(text, caret), [text, caret]);

  const filtered = useMemo(() => {
    if (!hint) return [] as PathOption[];
    const q = hint.query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.path.toLowerCase().includes(q) ||
        (o.hint && o.hint.toLowerCase().includes(q)),
    );
  }, [hint, options]);

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

  useEffect(() => {
    if (!focused) {
      setText(formatted);
      setError(null);
      setMenuOpen(false);
    }
  }, [formatted, focused]);

  useEffect(() => {
    setMenuOpen(Boolean(focused && hint));
  }, [focused, hint]);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [menuOpen]);

  function apply(next: string, commitFormat: boolean, nextCaret?: number) {
    setText(next);
    if (nextCaret !== undefined) setCaret(nextCaret);
    const result = parseExpressionText(next);
    if (result.ok) {
      setError(null);
      onChange(result.expr);
      if (commitFormat) setText(formatExpressionText(result.expr));
    } else {
      setError(result.error);
    }
  }

  function insertPath(path: string) {
    const snippet = hint?.braced ? `{{${path}}}` : path;
    if (!hint) {
      const next = text + (text && !/\s$/.test(text) ? " " : "") + snippet;
      apply(next, false, next.length);
      return;
    }
    const end = caret;
    const before = text.slice(0, hint.start);
    const after = text.slice(end);
    const next = before + snippet + after;
    const newCaret = before.length + snippet.length;
    apply(next, false, newCaret);
    setMenuOpen(false);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(newCaret, newCaret);
      }
    });
  }

  function syncCaret(el: HTMLInputElement) {
    setCaret(el.selectionStart ?? el.value.length);
  }

  return (
    <div ref={rootRef} className={`space-y-1 ${menuOpen ? "relative z-40" : "relative"}`}>
      <input
        ref={inputRef}
        value={text}
        aria-label={ariaLabel}
        aria-invalid={Boolean(error)}
        aria-autocomplete="list"
        aria-expanded={menuOpen}
        aria-controls={listId}
        placeholder={placeholder}
        spellCheck={false}
        onFocus={() => {
          setFocused(true);
          if (inputRef.current) syncCaret(inputRef.current);
        }}
        onBlur={() => {
          setFocused(false);
          apply(text, true);
        }}
        onChange={(event) => {
          const el = event.target;
          apply(el.value, false, el.selectionStart ?? el.value.length);
        }}
        onClick={(event) => syncCaret(event.currentTarget)}
        onKeyUp={(event) => syncCaret(event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            if (menuOpen && filtered[0]) {
              event.preventDefault();
              insertPath(filtered[0].path);
              return;
            }
            event.preventDefault();
            apply(text, true);
            (event.target as HTMLInputElement).blur();
          }
          if (event.key === "Escape" && menuOpen) {
            event.preventDefault();
            setMenuOpen(false);
          }
        }}
        className={`${inputClass} min-w-0 font-mono text-sm ${
          error ? "border-amber-500/50 focus:border-amber-500/70" : ""
        }`}
      />
      <InsertPathButton
        actionsForLocal={rootActions}
        onInsert={(snippet) => {
          const bare = snippet.replace(/^\{\{|\}\}$/g, "");
          const next = text + (text && !/\s$/.test(text) ? " " : "") + bare;
          apply(next, false, next.length);
        }}
      />
      {menuOpen && grouped.length > 0 ? (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-40 mt-1 max-h-56 overflow-auto rounded-lg border border-border bg-popover p-1 shadow-gxu"
        >
          {grouped.map(({ group, items }) => (
            <div key={group} className="mb-1">
              <p className="px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {groupLabel(group)}
              </p>
              {items.slice(0, 12).map((option) => (
                <button
                  key={option.path}
                  type="button"
                  role="option"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    insertPath(option.path);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-1.5 text-left text-sm text-foreground/85 hover:bg-[var(--color-hover)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-sm">
                      {hint?.braced ? `{{${option.path}}}` : option.path}
                    </span>
                    {option.hint ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {option.hint}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
      {error ? (
        <p className="text-xs text-amber-400/95" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
