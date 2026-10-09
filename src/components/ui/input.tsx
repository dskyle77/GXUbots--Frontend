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

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, onChange, onInput, ...props }, ref) => {
  const innerRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useImperativeHandle(ref, () => innerRef.current!);

  const adjustHeight = React.useCallback(() => {
    const el = innerRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, []);

  React.useEffect(() => {
    adjustHeight();
  }, [props.value, props.defaultValue, adjustHeight]);

  return (
    <textarea
      ref={innerRef}
      className={cn(
        "flex min-h-20 w-full resize-none overflow-hidden rounded-sm border border-border bg-inset px-3 py-2 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
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
Textarea.displayName = "Textarea";
