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

/** Detect `{{path fragment` under the cursor for autocomplete. */
function pathHintAt(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const open = before.lastIndexOf("{{");
  if (open < 0) return null;
  const afterOpen = before.slice(open + 2);
  if (afterOpen.includes("}}")) return null;
  // Only allow path-like characters inside the braces
  if (/[^a-zA-Z0-9_./]/.test(afterOpen)) return null;
  return { start: open, query: afterOpen };
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
    if (!hint) {
      const snippet = `{{${path}}}`;
      const next =
        text + (text && !/\s$/.test(text) ? " " : "") + snippet;
      apply(next, false, next.length);
      return;
    }
    const end = caret;
    const before = text.slice(0, hint.start);
    const after = text.slice(end);
    const inserted = `{{${path}}}`;
    const next = before + inserted + after;
    const newCaret = before.length + inserted.length;
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
      <div className="flex items-center gap-1.5">
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
          className={`${inputClass} min-w-0 flex-1 font-mono text-[13px] ${
            error ? "border-amber-500/50 focus:border-amber-500/70" : ""
          }`}
        />
        <InsertPathButton
          actionsForLocal={rootActions}
          onInsert={(snippet) => {
            const next = text + (text && !/\s$/.test(text) ? " " : "") + snippet;
            apply(next, false, next.length);
          }}
        />
      </div>
      {menuOpen && grouped.length > 0 ? (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-10 z-40 mt-1 max-h-56 overflow-auto rounded-lg border border-white/10 bg-[#14161e] p-1 shadow-gxu"
        >
          {grouped.map(({ group, items }) => (
            <div key={group} className="mb-1">
              <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
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
                  className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-1.5 text-left text-sm text-white/85 hover:bg-white/5"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-[13px]">{`{{${option.path}}}`}</span>
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
        <p className="text-[11px] text-amber-400/95" role="alert">
          {error}
        </p>
      ) : compactHint ? (
        <p className="text-[10px] text-muted-foreground/80">
          {"{{path}}"} · &quot;str&quot; · true · 1 · + − == and or not — type {"{{"} for path hints
        </p>
      ) : null}
    </div>
  );
}
