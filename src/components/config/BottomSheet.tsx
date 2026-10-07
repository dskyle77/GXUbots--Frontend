"use client";

import type { ReactNode } from "react";

export function BottomSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-background/80 sm:items-center sm:justify-center">
      <button type="button" aria-label="Close" className="absolute inset-0" onClick={onClose} />
      <section className="relative z-10 max-h-[88vh] w-full overflow-y-auto rounded-t-2xl border border-border bg-popover p-4 pb-8 sm:max-w-lg sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button type="button" onClick={onClose} className="min-h-11 rounded-lg px-3 text-sm text-white">
            Close
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
