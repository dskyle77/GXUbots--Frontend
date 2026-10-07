/**
 * Small expression language → backend Expression AST.
 *
 *  {{user.name}}     path
 *  "hello" / 'hi'    string literal
 *  true false null   literals
 *  42  3.14          numbers
 *  + - * / %         arithmetic
 *  == != > < >= <=   compare
 *  and or not        logic (&& || ! also accepted)
 *  ( ... )           grouping
 *
 * Bare words (hello) are errors — use "hello" or {{path}}.
 */

import {
  binaryExpr,
  clientId,
  literal,
  unaryExpr,
  variableExpr,
  type BinaryOperator,
  type EditorExpression,
} from "./config-editor";

export type ParseResult =
  | { ok: true; expr: EditorExpression }
  | { ok: false; error: string; index?: number };

type Tok =
  | { kind: "path"; value: string; start: number }
  | { kind: "string"; value: string; start: number }
  | { kind: "number"; value: number; start: number }
  | { kind: "bool"; value: boolean; start: number }
  | { kind: "null"; start: number }
  | { kind: "op"; value: string; start: number }
  | { kind: "lparen"; start: number }
  | { kind: "rparen"; start: number }
  | { kind: "comma"; start: number }
  | { kind: "not"; start: number }
  | { kind: "and"; start: number }
  | { kind: "or"; start: number };

const OP_MAP: Record<string, BinaryOperator> = {
  "==": "==",
  "!=": "!=",
  ">": ">",
  "<": "<",
  ">=": ">=",
  "<=": "<=",
  "+": "+",
  "-": "-",
  "*": "*",
  "/": "/",
  "%": "%",
  and: "and",
  or: "or",
  "&&": "and",
  "||": "or",
};

export function parseExpressionText(source: string): ParseResult {
  const trimmed = source.trim();
  if (!trimmed) {
    return { ok: true, expr: literal("") };
  }

  let tokens: Tok[];
  try {
    tokens = tokenize(trimmed);
  } catch (e) {
    const err = e as { message: string; index?: number };
    return { ok: false, error: err.message, index: err.index };
  }

  let i = 0;

  function peek(): Tok | undefined {
    return tokens[i];
  }
  function next(): Tok {
    return tokens[i++]!;
  }
  function expect(kind: Tok["kind"], label?: string): Tok {
    const t = next();
    if (!t || t.kind !== kind) {
      throw fail(`Expected ${label ?? kind}`, t?.start ?? trimmed.length);
    }
    return t;
  }

  function fail(message: string, index?: number): Error {
    const err = new Error(message) as Error & { index?: number };
    err.index = index;
    return err;
  }

  // precedence: or < and < compare < sum < product < unary < primary
  function parseOr(): EditorExpression {
    let left = parseAnd();
    while (peek()?.kind === "or" || (peek()?.kind === "op" && (peek() as Tok & { value: string }).value === "||")) {
      next();
      const right = parseAnd();
      left = binaryExpr("or", left, right);
    }
    return left;
  }

  function parseAnd(): EditorExpression {
    let left = parseCompare();
    while (peek()?.kind === "and" || (peek()?.kind === "op" && (peek() as Tok & { value: string }).value === "&&")) {
      next();
      const right = parseCompare();
      left = binaryExpr("and", left, right);
    }
    return left;
  }

  function parseCompare(): EditorExpression {
    let left = parseSum();
    while (peek()?.kind === "op") {
      const op = (peek() as { value: string }).value;
      if (!["==", "!=", ">", "<", ">=", "<="].includes(op)) break;
      next();
      const right = parseSum();
      left = binaryExpr(OP_MAP[op]!, left, right);
    }
    return left;
  }

  function parseSum(): EditorExpression {
    let left = parseProduct();
    while (peek()?.kind === "op") {
      const op = (peek() as { value: string }).value;
      if (op !== "+" && op !== "-") break;
      next();
      const right = parseProduct();
      left = binaryExpr(op, left, right);
    }
    return left;
  }

  function parseProduct(): EditorExpression {
    let left = parseUnary();
    while (peek()?.kind === "op") {
      const op = (peek() as { value: string }).value;
      if (op !== "*" && op !== "/" && op !== "%") break;
      next();
      const right = parseUnary();
      left = binaryExpr(op, left, right);
    }
    return left;
  }

  function parseUnary(): EditorExpression {
    const t = peek();
    if (t?.kind === "not" || (t?.kind === "op" && t.value === "!")) {
      next();
      return unaryExpr("not", parseUnary());
    }
    if (t?.kind === "op" && t.value === "-") {
      next();
      return unaryExpr("negative", parseUnary());
    }
    return parsePrimary();
  }

  function parsePrimary(): EditorExpression {
    const t = peek();
    if (!t) throw fail("Unexpected end of expression");

    if (t.kind === "path") {
      next();
      if (peek()?.kind === "lparen") {
        next();
        const args: EditorExpression[] = [];
        if (peek()?.kind !== "rparen") {
          args.push(parseOr());
          while (peek()?.kind === "comma") {
            next();
            args.push(parseOr());
          }
        }
        expect("rparen", ")");
        return { clientId: `c_${Math.random().toString(36).slice(2, 10)}`, type: "call", callee: t.value, args };
      }
      return variableExpr(t.value);
    }
    if (t.kind === "string") {
      next();
      return literal(t.value);
    }
    if (t.kind === "number") {
      next();
      return literal(t.value);
    }
    if (t.kind === "bool") {
      next();
      return literal(t.value);
    }
    if (t.kind === "null") {
      next();
      return literal(null);
    }
    if (t.kind === "lparen") {
      next();
      const inner = parseOr();
      expect("rparen", ")");
      return inner;
    }
    throw fail(`Unexpected token`, t.start);
  }

  try {
    const expr = parseOr();
    if (i < tokens.length) {
      const extra = tokens[i]!;
      return { ok: false, error: "Unexpected extra input", index: extra.start };
    }
    return { ok: true, expr };
  } catch (e) {
    const err = e as Error & { index?: number };
    return { ok: false, error: err.message || "Invalid expression", index: err.index };
  }
}

function tokenize(source: string): Tok[] {
  const tokens: Tok[] = [];
  let i = 0;

  function error(message: string, index = i): never {
    const err = new Error(message) as Error & { index?: number };
    err.index = index;
    throw err;
  }

  while (i < source.length) {
    const ch = source[i]!;

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // {{ path }}
    if (ch === "{" && source[i + 1] === "{") {
      const start = i;
      i += 2;
      const pathStart = i;
      while (i < source.length && !(source[i] === "}" && source[i + 1] === "}")) {
        i++;
      }
      if (i >= source.length) error("Unclosed {{ path }}", start);
      const path = source.slice(pathStart, i).trim();
      if (!path) error("Empty path in {{ }}", start);
      // bare path only — no spaces in middle of multi-part? allow dotted paths with optional spaces stripped
      if (/\s/.test(path)) error("Path must not contain spaces inside {{ }}", pathStart);
      i += 2;
      tokens.push({ kind: "path", value: path, start });
      continue;
    }

    // string "..." or '...'
    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i;
      i++;
      let value = "";
      while (i < source.length && source[i] !== quote) {
        if (source[i] === "\\" && i + 1 < source.length) {
          const n = source[i + 1]!;
          if (n === "n") value += "\n";
          else if (n === "t") value += "\t";
          else value += n;
          i += 2;
          continue;
        }
        value += source[i];
        i++;
      }
      if (i >= source.length) error("Unclosed string", start);
      i++; // closing quote
      tokens.push({ kind: "string", value, start });
      continue;
    }

    // multi-char ops
    const two = source.slice(i, i + 2);
    if (["==", "!=", ">=", "<=", "&&", "||"].includes(two)) {
      tokens.push({ kind: "op", value: two, start: i });
      i += 2;
      continue;
    }

    // single ops
    if ("+-*/%<>!()".includes(ch)) {
      if (ch === "(") tokens.push({ kind: "lparen", start: i });
      else if (ch === ")") tokens.push({ kind: "rparen", start: i });
      else if (ch === ",") tokens.push({ kind: "comma", start: i });
      else if (ch === "!") tokens.push({ kind: "op", value: "!", start: i });
      else tokens.push({ kind: "op", value: ch, start: i });
      i++;
      continue;
    }

    // number
    if (/\d/.test(ch) || (ch === "." && /\d/.test(source[i + 1] ?? ""))) {
      const start = i;
      let num = "";
      while (i < source.length && /[\d.]/.test(source[i]!)) {
        num += source[i];
        i++;
      }
      const n = Number(num);
      if (Number.isNaN(n)) error("Invalid number", start);
      tokens.push({ kind: "number", value: n, start });
      continue;
    }

    // word: true false null and or not — else ERROR (bare identifier)
    if (/[a-zA-Z_]/.test(ch)) {
      const start = i;
      let word = "";
      while (i < source.length && /[a-zA-Z0-9_]/.test(source[i]!)) {
        word += source[i];
        i++;
      }
      if (word === "true") tokens.push({ kind: "bool", value: true, start });
      else if (word === "false") tokens.push({ kind: "bool", value: false, start });
      else if (word === "null") tokens.push({ kind: "null", start });
      else if (word === "and") tokens.push({ kind: "and", start });
      else if (word === "or") tokens.push({ kind: "or", start });
      else if (word === "not") tokens.push({ kind: "not", start });
      else {
        error(`Unexpected "${word}". Use "{{${word}}}" for a path or "\\"${word}\\"" for a string.`, start);
      }
      continue;
    }

    error(`Unexpected character "${ch}"`, i);
  }

  return tokens;
}

/** Format AST back to expression text for the single-line editor. */
export function formatExpressionText(expr: EditorExpression): string {
  return format(expr, 0);
}

function format(expr: EditorExpression, parentPrec: number): string {
  switch (expr.type) {
    case "literal": {
      if (expr.value === null) return "null";
      if (typeof expr.value === "boolean") return expr.value ? "true" : "false";
      if (typeof expr.value === "number") return String(expr.value);
      return JSON.stringify(expr.value);
    }
    case "variable":
      return `{{${expr.path}}}`;
    case "call":
      return `${expr.callee}(${expr.args.map((arg) => format(arg, 0)).join(", ")})`;
    case "unary": {
      const op = expr.operator === "not" ? "not " : "-";
      const inner = format(expr.operand, 5);
      return `${op}${inner}`;
    }
    case "binary": {
      const prec = binaryPrec(expr.operator);
      const left = format(expr.left, prec);
      const right = format(expr.right, prec + 1);
      const op = expr.operator;
      const body = `${left} ${op} ${right}`;
      return prec < parentPrec ? `(${body})` : body;
    }
  }
}

function binaryPrec(op: BinaryOperator): number {
  switch (op) {
    case "or":
      return 1;
    case "and":
      return 2;
    case "==":
    case "!=":
    case ">":
    case "<":
    case ">=":
    case "<=":
      return 3;
    case "+":
    case "-":
      return 4;
    case "*":
    case "/":
    case "%":
      return 5;
    default:
      return 0;
  }
}

/** Try parse; on failure keep previous expr and return error string. */
export function tryParseExpressionText(
  source: string,
  previous: EditorExpression,
): { expr: EditorExpression; error: string | null } {
  const result = parseExpressionText(source);
  if (result.ok) return { expr: result.expr, error: null };
  return { expr: previous, error: result.error };
}
