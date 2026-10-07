"use client";

import type {
  ReactNode,
  SelectHTMLAttributes,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  ButtonHTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useEffect, useId, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "../../lib/cn";

/** Prefer importing Input from components/ui — kept for editor compatibility. */
export const inputClass =
  "h-11 sm:h-9 w-full rounded-sm border border-border bg-[var(--color-inset)] px-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20";

export const textAreaClass =
  "min-h-20 w-full rounded-sm border border-border bg-[var(--color-inset)] px-2.5 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20";

export function Field({
  label,
  children,
  hint,
  error,
  className = "",
}: {
  label?: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      {label ? (
        <span className="mb-1 block text-xs font-medium text-foreground/80">{label}</span>
      ) : null}
      {children}
      {error ? <p className="mt-1 text-xs text-amber-400/90">{error}</p> : null}
      {!error && hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </label>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-snug text-muted-foreground">{children}</p>;
}

export function WarnList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-100/90">
      <ul className="list-disc space-y-0.5 pl-3.5">
        {items.slice(0, 6).map((item, i) => (
          <li key={`${item}-${i}`}>{item}</li>
        ))}
        {items.length > 6 ? <li>+{items.length - 6} more</li> : null}
      </ul>
    </div>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, className)} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(textAreaClass, className)} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputClass, className)} />;
}

export function SecondaryButton({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "h-8 rounded-sm border border-border px-2.5 text-xs font-medium text-foreground/90 transition-colors hover:bg-[var(--color-hover)] disabled:opacity-50",
        className,
      )}
    />
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  );
}

export function IconButton({
  label,
  danger = false,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-[var(--color-hover)] hover:text-foreground disabled:pointer-events-none disabled:opacity-30",
        danger && "hover:bg-destructive/10 hover:text-destructive",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function ItemCard({
  handle,
  title,
  titlePlaceholder,
  onTitleChange,
  onUp,
  onDown,
  onRemove,
  disableUp = false,
  disableDown = false,
  children,
}: {
  handle: ReactNode;
  title: string;
  titlePlaceholder: string;
  onTitleChange: (value: string) => void;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  disableUp?: boolean;
  disableDown?: boolean;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <article className="border-b border-border py-2 last:border-b-0">
      <div className="flex items-center gap-0.5 px-0.5 py-0.5">
        {handle}
        <input
          value={title}
          placeholder={titlePlaceholder}
          aria-label={titlePlaceholder}
          onChange={(event) => onTitleChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent px-1.5 py-1 text-sm font-medium text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
        />
        <div ref={menuRef} className={`relative shrink-0 ${menuOpen ? "z-30" : ""}`}>
          <IconButton label="More actions" onClick={() => setMenuOpen((v) => !v)}>
            <MoreIcon />
          </IconButton>
          {menuOpen ? (
            <div className="absolute right-0 z-30 mt-1 min-w-[9rem] rounded-lg border border-border bg-popover p-1 shadow-gxu">
              <button
                type="button"
                disabled={disableUp}
                onClick={() => {
                  onUp();
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-foreground hover:bg-[var(--color-hover)] disabled:opacity-30"
              >
                Move up
              </button>
              <button
                type="button"
                disabled={disableDown}
                onClick={() => {
                  onDown();
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-foreground hover:bg-[var(--color-hover)] disabled:opacity-30"
              >
                Move down
              </button>
              <button
                type="button"
                onClick={() => {
                  onRemove();
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
              >
                Remove
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {children ? <div className="space-y-3 p-3">{children}</div> : null}
    </article>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <circle cx="8" cy="3.5" r="1.25" />
      <circle cx="8" cy="8" r="1.25" />
      <circle cx="8" cy="12.5" r="1.25" />
    </svg>
  );
}

export type MenuOption = { value: string; label: string; hint?: string };

export function MenuSelect({
  value,
  onChange,
  options,
  placeholder = "Choose",
  ariaLabel,
  size = "md",
}: {
  value: string;
  onChange: (value: string) => void;
  options: MenuOption[];
  placeholder?: string;
  ariaLabel?: string;
  size?: "md" | "sm";
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const idx = options.findIndex((o) => o.value === value);
    setHighlight(idx >= 0 ? idx : 0);
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, options, value]);

  useEffect(() => {
    if (!open || highlight < 0) return;
    const el = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[highlight];
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  function selectIndex(i: number) {
    const opt = options[i];
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
  }

  function onTriggerKeyDown(event: ReactKeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        if (highlight >= 0) selectIndex(highlight);
        return;
      }
      if (event.key === "ArrowDown") {
        setHighlight((h) => (h + 1) % Math.max(options.length, 1));
      } else if (event.key === "ArrowUp") {
        setHighlight((h) => (h <= 0 ? options.length - 1 : h - 1));
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Home" && open) {
      event.preventDefault();
      setHighlight(0);
    } else if (event.key === "End" && open) {
      event.preventDefault();
      setHighlight(Math.max(options.length - 1, 0));
    }
  }

  return (
    <div ref={rootRef} className={`relative ${open ? "z-30" : ""}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && highlight >= 0 ? `${listId}-opt-${highlight}` : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-sm border border-border bg-[var(--color-inset)] px-3 text-left text-sm outline-none transition-colors hover:bg-[var(--color-hover)] focus:border-primary/50 focus:ring-1 focus:ring-primary/20",
          size === "sm" ? "h-8" : "h-9",
        )}
      >
        <span className={cn("min-w-0 truncate", selected ? "text-foreground" : "text-muted-foreground")}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-sm border border-border bg-popover p-1 shadow-gxu"
        >
          {options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Nothing to choose</p>
          ) : (
            options.map((option, i) => {
              const active = option.value === value;
              const focused = i === highlight;
              return (
                <button
                  key={option.value || option.label}
                  id={`${listId}-opt-${i}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => selectIndex(i)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm",
                    focused ? "bg-[var(--color-hover)] text-foreground" : "text-foreground/90",
                    active && "text-primary",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{option.label}</span>
                    {option.hint ? (
                      <span className="block truncate text-xs text-muted-foreground">{option.hint}</span>
                    ) : null}
                  </span>
                  {active ? <span className="text-xs text-primary">Selected</span> : null}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

function ChevronUp() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M4 10l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDown({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" strokeLinecap="round" />
    </svg>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </p>
  );
}

export function SortableList<T extends { clientId: string }>({
  items,
  onChange,
  renderItem,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  renderItem: (item: T, index: number, handle: ReactNode) => ReactNode;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.clientId === active.id);
    const newIndex = items.findIndex((item) => item.clientId === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(items, oldIndex, newIndex));
  }

  if (items.length === 0) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((item) => item.clientId)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {items.map((item, index) => (
            <SortableRow key={item.clientId} id={item.clientId}>
              {(handle) => renderItem(item, index, handle)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, children }: { id: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      {children(<DragHandle attributes={attributes} listeners={listeners} />)}
    </div>
  );
}

function DragHandle({
  attributes,
  listeners,
}: {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
}) {
  return (
    <button
      type="button"
      className="cursor-grab rounded-md px-1.5 text-muted-foreground hover:text-white active:cursor-grabbing"
      aria-label="Drag to reorder"
      {...attributes}
      {...listeners}
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
        <circle cx="5" cy="4" r="1.2" />
        <circle cx="11" cy="4" r="1.2" />
        <circle cx="5" cy="8" r="1.2" />
        <circle cx="11" cy="8" r="1.2" />
        <circle cx="5" cy="12" r="1.2" />
        <circle cx="11" cy="12" r="1.2" />
      </svg>
    </button>
  );
}

export function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const next = index + direction;
  if (next < 0 || next >= items.length) return items;
  const copy = [...items];
  const [item] = copy.splice(index, 1);
  copy.splice(next, 0, item!);
  return copy;
}

export function patchAt<T>(items: T[], index: number, patch: Partial<T>) {
  return items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item));
}

export function removeAt<T>(items: T[], index: number) {
  return items.filter((_, itemIndex) => itemIndex !== index);
}
