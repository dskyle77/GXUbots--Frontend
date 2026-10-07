"use client";

import { useMemo, useState } from "react";
import { BottomSheet } from "../config/BottomSheet";
import { actionLabel, insertTree, type InsertItem, type PackDocument } from "../../lib/pack-document";

export function InsertSheet({
  doc,
  dependencies,
  onClose,
  onPick,
}: {
  doc: PackDocument;
  dependencies: { slug: string; functions: { name: string; kind?: string; exposed?: boolean }[] }[];
  onClose: () => void;
  onPick: (item: InsertItem) => void;
}) {
  const [query, setQuery] = useState("");
  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return insertTree(doc, dependencies).filter((item) => !needle || item.label.toLowerCase().includes(needle));
  }, [doc, dependencies, query]);
  const groups = [...new Set(items.map((item) => item.group))];
  return (
    <BottomSheet title="Insert" onClose={onClose}>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search actions" className="min-h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white" />
      <div className="mt-3 space-y-4">
        {groups.map((group) => (
          <section key={group}>
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground">{group}</h3>
            <div className="mt-2 space-y-2">
              {items.filter((item) => item.group === group).map((item) => (
                <button key={item.id} type="button" onClick={() => onPick(item)} className="min-h-11 w-full rounded-lg border border-white/10 px-3 text-left text-sm text-white">
                  {item.label}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </BottomSheet>
  );
}

export function ActionRows({
  actions,
  onChange,
}: {
  actions: { type: string; [key: string]: unknown }[];
  onChange: (next: { type: string; [key: string]: unknown }[]) => void;
}) {
  return (
    <div className="space-y-2">
      {actions.map((action, index) => (
        <article key={`${action.type}-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-white">{actionLabel(action.type)}</p>
            <div className="flex gap-2">
              <button type="button" className="min-h-11 px-2 text-sm text-white" onClick={() => onChange(move(actions, index, -1))}>Up</button>
              <button type="button" className="min-h-11 px-2 text-sm text-white" onClick={() => onChange(move(actions, index, 1))}>Down</button>
              <button type="button" className="min-h-11 px-2 text-sm text-white" onClick={() => onChange(actions.filter((_, item) => item !== index))}>Delete</button>
            </div>
          </div>
          <ActionFields action={action} onChange={(next) => onChange(actions.map((item, itemIndex) => itemIndex === index ? next : item))} />
          {Array.isArray(action.actions) ? (
            <div className="mt-2 border-l border-white/10 pl-3">
              <ActionRows actions={action.actions as { type: string }[]} onChange={(next) => onChange(actions.map((item, itemIndex) => itemIndex === index ? { ...item, actions: next } : item))} />
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function ActionFields({
  action,
  onChange,
}: {
  action: { type: string; [key: string]: unknown };
  onChange: (next: { type: string; [key: string]: unknown }) => void;
}) {
  if (action.type === "send_message" || action.type === "reply_message") {
    return <input value={String(action.text ?? "")} onChange={(event) => onChange({ ...action, text: event.target.value })} placeholder="Message" className="mt-2 min-h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white" />;
  }
  if (action.type === "get_user") {
    return <input value={String(action.userId ?? "")} onChange={(event) => onChange({ ...action, userId: event.target.value })} placeholder="user.id" className="mt-2 min-h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white" />;
  }
  if (action.type === "call_function") {
    return <input value={String(action.function ?? "")} onChange={(event) => onChange({ ...action, function: event.target.value })} placeholder="slug.name" className="mt-2 min-h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white" />;
  }
  if (action.type === "future_action" || !["if", "repeat", "break", "continue", "return", "get_group"].includes(action.type)) {
    return <p className="mt-2 text-xs text-muted-foreground">Kept as {action.type}. Extra fields stay on save.</p>;
  }
  return null;
}

function move<T>(items: T[], index: number, delta: number): T[] {
  const next = [...items];
  const target = index + delta;
  if (target < 0 || target >= next.length) return next;
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item!);
  return next;
}
