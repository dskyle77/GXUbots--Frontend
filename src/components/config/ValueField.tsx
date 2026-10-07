"use client";

import {
  literal,
  variableExpr,
  type EditorExpression,
} from "../../lib/config-editor";
import type { EditorAction } from "../../lib/config-editor";
import { PathField } from "./PathField";
import { TextInput } from "./ui";

type LeafKind = "value" | "path";

function leafKind(expr: EditorExpression): LeafKind {
  return expr.type === "variable" ? "path" : "value";
}

/** Leaf editor: Value (literal) | Path (variable). Emits only literal or variable nodes. */
export function ValueField({
  value,
  onChange,
  rootActions,
  preferNumber = false,
  ariaLabel = "Value",
}: {
  value: EditorExpression;
  onChange: (value: EditorExpression) => void;
  rootActions?: EditorAction[];
  /** Prefer number input when literal (e.g. wait duration). */
  preferNumber?: boolean;
  ariaLabel?: string;
}) {
  const kind = leafKind(value);
  const literalValue = value.type === "literal" ? value.value : "";
  const pathValue = value.type === "variable" ? value.path : "";

  function setKind(next: LeafKind) {
    if (next === kind) return;
    if (next === "path") {
      onChange(variableExpr(typeof literalValue === "string" ? literalValue : ""));
    } else {
      onChange(literal(preferNumber ? 0 : ""));
    }
  }

  function setLiteral(raw: string, as: "string" | "number" | "boolean" | "null") {
    if (as === "boolean") {
      onChange(literal(raw === "true"));
      return;
    }
    if (as === "null") {
      onChange(literal(null));
      return;
    }
    if (as === "number") {
      const n = raw === "" || raw === "-" ? raw : Number(raw);
      onChange(literal(typeof n === "number" && !Number.isNaN(n) ? n : raw === "" ? 0 : raw));
      return;
    }
    onChange(literal(raw));
  }

  const isBool = value.type === "literal" && typeof value.value === "boolean";
  const isNum =
    preferNumber ||
    (value.type === "literal" && (typeof value.value === "number" || value.value === null));

  return (
    <div className="space-y-2">
      <div className="flex rounded-md border border-border p-0.5">
        <button
          type="button"
          onClick={() => setKind("value")}
          className={`h-7 flex-1 rounded px-2 text-xs font-medium ${
            kind === "value" ? "bg-white/10 text-foreground" : "text-muted-foreground"
          }`}
        >
          Value
        </button>
        <button
          type="button"
          onClick={() => setKind("path")}
          className={`h-7 flex-1 rounded px-2 text-xs font-medium ${
            kind === "path" ? "bg-white/10 text-foreground" : "text-muted-foreground"
          }`}
        >
          Path
        </button>
      </div>
      {kind === "path" ? (
        <PathField
          value={pathValue}
          ariaLabel={ariaLabel}
          actionsForLocal={rootActions}
          onChange={(path) => onChange(variableExpr(path))}
        />
      ) : isBool ? (
        <button
          type="button"
          aria-pressed={literalValue === true}
          onClick={() => setLiteral(literalValue === true ? "false" : "true", "boolean")}
          className={`h-9 w-full rounded-lg border px-3 text-left text-sm ${
            literalValue === true
              ? "border-primary/40 bg-primary/15 text-foreground"
              : "border-border bg-[var(--color-inset)] text-muted-foreground"
          }`}
        >
          {literalValue === true ? "true" : "false"}
        </button>
      ) : (
        <TextInput
          type={isNum && typeof literalValue === "number" ? "number" : "text"}
          value={literalValue === null ? "null" : String(literalValue ?? "")}
          aria-label={ariaLabel}
          onChange={(event) => {
            const raw = event.target.value;
            if (preferNumber || typeof literalValue === "number") {
              setLiteral(raw, "number");
            } else if (raw === "true" || raw === "false") {
              setLiteral(raw, "boolean");
            } else {
              setLiteral(raw, "string");
            }
          }}
        />
      )}
    </div>
  );
}
