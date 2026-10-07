"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { EditorConfig } from "../../lib/config-editor";
import type { ParamDraft, PathCatalogCtx } from "../../lib/path-catalog";

export type { PathGroup, PathOption, ParamDraft } from "../../lib/path-catalog";
export {
  buildPathOptions,
  collectLocalNames,
  groupLabel,
  paramDraftsFromCommand,
  paramDraftsFromFunction,
} from "../../lib/path-catalog";

export type EditorCtx = PathCatalogCtx;

const Ctx = createContext<EditorCtx | null>(null);

export function useEditorCtx(): EditorCtx {
  const value = useContext(Ctx);
  if (!value) {
    return { variables: [], functions: [], assets: [], extraParams: [] };
  }
  return value;
}

export function EditorConfigProvider({
  config,
  extraParams = [],
  children,
}: {
  config: EditorConfig;
  extraParams?: ParamDraft[];
  children: ReactNode;
}) {
  const value = useMemo<EditorCtx>(() => {
    const variables = config.packs.flatMap((p) => p.variables);
    const functions = config.packs.flatMap((p) => p.functions);
    const assets = config.packs.flatMap((p) => p.assets);
    return { variables, functions, assets, extraParams };
  }, [config.packs, extraParams]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function ExtraParamsProvider({
  extraParams,
  children,
}: {
  extraParams: ParamDraft[];
  children: ReactNode;
}) {
  const parent = useEditorCtx();
  const value = useMemo<EditorCtx>(
    () => ({ ...parent, extraParams }),
    [parent, extraParams],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
