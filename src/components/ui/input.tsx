"use client";

import * as React from "react";
import { cn } from "../../lib/cn";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-11 w-full rounded-sm border border-border bg-[var(--color-inset)] px-3 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 sm:h-9",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Grow and shrink with content. Default false. */
  autoResize?: boolean;
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, autoResize = false, onInput, value, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);

    const setRefs = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
      },
      [ref],
    );

    const fit = React.useCallback(() => {
      const el = innerRef.current;
      if (!el || !autoResize) return;
      el.style.height = "auto";
      el.style.height = `${Math.max(el.scrollHeight, 36)}px`;
    }, [autoResize]);

    React.useLayoutEffect(() => {
      fit();
    }, [fit, value]);

    const { rows: rowsProp, ...rest } = props;

    return (
      <textarea
        {...rest}
        className={cn(
          "flex min-h-9 w-full rounded-sm border border-border bg-[var(--color-inset)] px-3 py-2 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
          autoResize ? "resize-none overflow-hidden" : "min-h-20",
          className,
        )}
        ref={setRefs}
        value={value}
        rows={autoResize ? 1 : rowsProp}
        onInput={(event) => {
          if (autoResize) {
            const el = event.currentTarget;
            el.style.height = "auto";
            el.style.height = `${Math.max(el.scrollHeight, 36)}px`;
          }
          onInput?.(event);
        }}
      />
    );
  },
);
Textarea.displayName = "Textarea";
