"use client";

import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, ButtonHTMLAttributes } from "react";
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

export const inputClass =
  "h-9 w-full rounded-md border border-white/10 bg-black/25 px-2.5 text-sm text-white outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20";

export const textAreaClass =
  "min-h-20 w-full rounded-md border border-white/10 bg-black/25 px-2.5 py-2 text-sm text-white outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20";

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
        <span className="mb-1 block text-xs font-medium text-white/80">{label}</span>
      ) : null}
      {children}
      {error ? <p className="mt-1 text-xs text-amber-400/90">{error}</p> : null}
      {!error && hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </label>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-[11px] leading-snug text-muted-foreground">{children}</p>;
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

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${textAreaClass} ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function SecondaryButton({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`h-8 rounded-md border border-white/10 px-2.5 text-xs font-medium text-white/90 transition-colors hover:bg-white/5 disabled:opacity-50 ${className}`}
    />
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
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
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-white disabled:pointer-events-none disabled:opacity-30 ${
        danger ? "hover:bg-destructive/10 hover:text-destructive" : ""
      } ${className}`}
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
    <article className="rounded-lg border border-white/10 bg-white/[0.02]">
      <div className="flex items-center gap-0.5 border-b border-white/[0.06] px-1 py-0.5">
        {handle}
        <input
          value={title}
          placeholder={titlePlaceholder}
          aria-label={titlePlaceholder}
          onChange={(event) => onTitleChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent px-1.5 py-1 text-sm font-medium text-white outline-none placeholder:font-normal placeholder:text-white/30"
        />
        <div ref={menuRef} className={`relative shrink-0 ${menuOpen ? "z-30" : ""}`}>
          <IconButton label="More actions" onClick={() => setMenuOpen((v) => !v)}>
            <MoreIcon />
          </IconButton>
          {menuOpen ? (
            <div className="absolute right-0 z-30 mt-1 min-w-[9rem] rounded-lg border border-white/10 bg-[#14161e] p-1 shadow-gxu">
              <button
                type="button"
                disabled={disableUp}
                onClick={() => {
                  onUp();
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-white/85 hover:bg-white/5 disabled:opacity-30"
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
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-white/85 hover:bg-white/5 disabled:opacity-30"
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
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);

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

  return (
    <div ref={rootRef} className={`relative ${open ? "z-30" : ""}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 text-left text-sm outline-none transition-colors hover:border-white/20 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 ${
          size === "sm" ? "h-8" : "h-9"
        }`}
      >
        <span className={`min-w-0 truncate ${selected ? "text-white" : "text-muted-foreground"}`}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-white/10 bg-[#14161e] p-1 shadow-gxu"
        >
          {options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Nothing to choose</p>
          ) : (
            options.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value || option.label}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm ${
                    active ? "bg-primary/15 text-white" : "text-white/85 hover:bg-white/5"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{option.label}</span>
                    {option.hint ? <span className="block truncate text-xs text-muted-foreground">{option.hint}</span> : null}
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
