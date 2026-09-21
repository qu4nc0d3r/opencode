export type PickerMenuAction = "open" | "select" | "newFolder" | "rename" | "delete" | "refresh"

export function pickerMenuItems(item: { kind: "directory" | "file"; name: string; path: string }): PickerMenuAction[] {
  if (item.kind !== "directory") return []
  return ["open", "select", "newFolder", "rename", "delete", "refresh"]
}

export function joinChildPath(parent: string, name: string): string {
  const base = parent.replace(/\/+$/, "")
  return `${base}/${name}`
}
