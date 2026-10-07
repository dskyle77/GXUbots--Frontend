import type { ExposedVariable } from "./packs";

export function groupExposed(variables: ExposedVariable[]) {
  const groups = new Map<string, ExposedVariable[]>();
  for (const variable of variables) {
    const label = variable.group || "Settings";
    groups.set(label, [...(groups.get(label) ?? []), variable]);
  }
  return [...groups.entries()].map(([label, fields]) => ({ label, fields }));
}

export function updateAvailable(pinned: string, latest: string | null) {
  // Draft installs always offer Reload so saving a pack can be picked up.
  if (pinned === "draft") return true;
  return Boolean(latest && pinned !== latest);
}
