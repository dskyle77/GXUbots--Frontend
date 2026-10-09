"use client";

import type {
  ReactNode,
  SelectHTMLAttributes,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  ButtonHTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  useCallback,
  useEffect,
  forwardRef,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

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
        <span className="mb-1 block text-xs font-medium text-foreground/80">
          {label}
        </span>
      ) : null}
      {children}
      {error ? <p className="mt-1 text-xs text-amber-400/90">{error}</p> : null}
      {!error && hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </label>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs leading-snug text-muted-foreground">{children}</p>
  );
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

export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, className)} />;
}

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, onChange, onInput, ...props }, ref) => {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  useImperativeHandle(ref, () => innerRef.current!);

  const adjustHeight = useCallback(() => {
    const el = innerRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [props.value, props.defaultValue, adjustHeight]);

  return (
    <textarea
      ref={innerRef}
      className={cn(textAreaClass, "resize-none overflow-hidden", className)}
      onChange={(e) => {
        adjustHeight();
        onChange?.(e);
      }}
      onInput={(e) => {
        adjustHeight();
        onInput?.(e);
      }}
      {...props}
    />
  );
});
TextArea.displayName = "TextArea";

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputClass, className)} />;
}

export function SecondaryButton({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
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
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  danger?: boolean;
}) {
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
  return (
    <article className="min-w-0 border-b border-border py-2 last:border-b-0">
      <div className="flex items-center gap-0.5 px-0.5 py-0.5">
        {handle}
        <input
          value={title}
          placeholder={titlePlaceholder}
          aria-label={titlePlaceholder}
          onChange={(event) => onTitleChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent px-1.5 py-1 text-sm font-medium text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
        />
        <RowMenu
          label="More actions"
          disableUp={disableUp}
          disableDown={disableDown}
          onUp={onUp}
          onDown={onDown}
          onRemove={onRemove}
        />
      </div>
      {children ? <div className="space-y-3 p-3">{children}</div> : null}
    </article>
  );
}

/** Move up / Move down / Remove. Shared by ItemCard and action rows. */
export function RowMenu({
  label = "More actions",
  onUp,
  onDown,
  onRemove,
  disableUp = false,
  disableDown = false,
}: {
  label?: string;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  disableUp?: boolean;
  disableDown?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-[var(--color-hover)] hover:text-foreground data-[state=open]:bg-[var(--color-hover)] data-[state=open]:text-foreground"
        >
          <MoreIcon />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[9rem]">
        <DropdownMenuItem disabled={disableUp} onSelect={onUp}>
          Move up
        </DropdownMenuItem>
        <DropdownMenuItem disabled={disableDown} onSelect={onDown}>
          Move down
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem danger onSelect={onRemove}>
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MoreIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="8" cy="3.5" r="1.25" />
      <circle cx="8" cy="8" r="1.25" />
      <circle cx="8" cy="12.5" r="1.25" />
    </svg>
  );
}

export type MenuOption = {
  value: string;
  label: string;
  hint?: string;
  /** Optional section heading when rendering grouped menus */
  group?: string;
};

/** Kept for PathField / ExprTextField fixed positioning. */
export function measureMenuCoords(
  anchor: HTMLElement,
  opts?: { minHeight?: number; maxHeight?: number; minWidth?: number },
): { top: number; left: number; width: number; maxHeight: number } {
  const minHeight = opts?.minHeight ?? 100;
  const maxCap = opts?.maxHeight ?? 280;
  const minWidth = opts?.minWidth ?? 160;
  const rect = anchor.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - 12;
  const spaceAbove = rect.top - 12;
  const preferBelow = spaceBelow >= 140 || spaceBelow >= spaceAbove;
  const maxHeight = Math.min(
    maxCap,
    Math.max(minHeight, preferBelow ? spaceBelow : spaceAbove),
  );
  const width = Math.max(rect.width, minWidth);
  return {
    top: preferBelow ? rect.bottom + 4 : Math.max(8, rect.top - maxHeight - 4),
    left: Math.min(rect.left, window.innerWidth - Math.min(width, 320) - 8),
    width,
    maxHeight,
  };
}

/**
 * Custom select — same pattern as `front`: absolute list under the trigger,
 * relative z-index when open, solid popover surface. Adds search + groups
 * for long lists (action types).
 */
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
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);
  const searchable = options.length > 6;
  const hasGroups = options.some((o) => o.group);

  const filtered = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        (o.hint && o.hint.toLowerCase().includes(q)) ||
        (o.group && o.group.toLowerCase().includes(q)),
    );
  })();

  const sections = (() => {
    if (!hasGroups) return [{ label: null as string | null, items: filtered }];
    const order: string[] = [];
    const map = new Map<string, MenuOption[]>();
    for (const opt of filtered) {
      const g = opt.group || "";
      if (!map.has(g)) {
        map.set(g, []);
        order.push(g);
      }
      map.get(g)!.push(opt);
    }
    return order.map((label) => ({
      label: label || null,
      items: map.get(label)!,
    }));
  })();

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const idx = filtered.findIndex((o) => o.value === value);
    setHighlight(idx >= 0 ? idx : filtered.length ? 0 : -1);
    if (searchable) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, options, value]);

  useEffect(() => {
    if (!open) return;
    const idx = filtered.findIndex((o) => o.value === value);
    setHighlight(idx >= 0 ? idx : filtered.length ? 0 : -1);
  }, [query, open, value, filtered]);

  useEffect(() => {
    if (!open || highlight < 0) return;
    const el =
      listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[
        highlight
      ];
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open, filtered.length]);

  function selectOption(opt: MenuOption) {
    onChange(opt.value);
    setOpen(false);
  }

  function onListKeyDown(event: ReactKeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((h) => (h + 1) % Math.max(filtered.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => (h <= 0 ? filtered.length - 1 : h - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (highlight >= 0 && filtered[highlight]) selectOption(filtered[highlight]);
    } else if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Home") {
      event.preventDefault();
      setHighlight(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setHighlight(Math.max(filtered.length - 1, 0));
    }
  }

  function onTriggerKeyDown(event: ReactKeyboardEvent) {
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        if (highlight >= 0 && filtered[highlight]) selectOption(filtered[highlight]);
      } else if (event.key === "ArrowDown") {
        setHighlight((h) => (h + 1) % Math.max(filtered.length, 1));
      } else if (event.key === "ArrowUp") {
        setHighlight((h) => (h <= 0 ? filtered.length - 1 : h - 1));
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  let flatIndex = 0;

  return (
    <div ref={rootRef} className={`relative ${open ? "z-40" : ""}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={
          open && highlight >= 0 ? `${listId}-opt-${highlight}` : undefined
        }
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-sm border border-border bg-[var(--color-inset)] px-3 text-left text-sm outline-none transition-colors hover:bg-[var(--color-hover)] focus:border-primary/50 focus:ring-1 focus:ring-primary/20",
          size === "sm" ? "h-8" : "h-9",
        )}
      >
        <span
          className={cn(
            "min-w-0 truncate",
            selected ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {selected?.label || placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          onKeyDown={onListKeyDown}
          className="absolute z-40 mt-1 flex max-h-64 w-full min-w-[12rem] flex-col overflow-hidden rounded-sm border border-border bg-popover text-popover-foreground shadow-gxu"
        >
          {searchable ? (
            <div className="shrink-0 border-b border-border p-1.5">
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onListKeyDown}
                placeholder="Search…"
                className="h-8 w-full rounded-sm border border-border bg-[var(--color-inset)] px-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
              />
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                {options.length === 0 ? "Nothing to choose" : "No matches"}
              </p>
            ) : (
              sections.map(({ label, items }) => (
                <div key={label ?? "_"} className="mb-0.5">
                  {label ? (
                    <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {label}
                    </p>
                  ) : null}
                  {items.map((option) => {
                    const i = flatIndex++;
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
                        onClick={() => selectOption(option)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm",
                          focused
                            ? "bg-[var(--color-hover)] text-foreground"
                            : "text-foreground/90",
                          active && "text-primary",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate">{option.label}</span>
                          {option.hint ? (
                            <span className="block truncate font-mono text-[11px] text-muted-foreground">
                              {option.hint}
                            </span>
                          ) : null}
                        </span>
                        {active ? (
                          <span className="shrink-0 text-xs text-primary">✓</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}


function ChevronUp() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M4 10l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDown({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" strokeLinecap="round" />
    </svg>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={items.map((item) => item.clientId)}
        strategy={verticalListSortingStrategy}
      >
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

function SortableRow({
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
      className="min-w-0"
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
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
  return items.map((item, itemIndex) =>
    itemIndex === index ? { ...item, ...patch } : item,
  );
}

export function removeAt<T>(items: T[], index: number) {
  return items.filter((_, itemIndex) => itemIndex !== index);
}
