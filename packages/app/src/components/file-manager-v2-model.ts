export type FileManagerAction =
  | "open"
  | "newFile"
  | "newFolder"
  | "rename"
  | "copy"
  | "move"
  | "compress"
  | "extract"
  | "download"
  | "delete"

export type FileManagerNode = { type: "file" | "directory"; path: string; name: string }

export type FileManagerFeatures = { copy: boolean; zip: boolean }

const noFeatures: FileManagerFeatures = { copy: false, zip: false }

const isZipName = (name: string) => name.toLowerCase().endsWith(".zip")

export function fileManagerMenuItems(
  node: FileManagerNode,
  features: FileManagerFeatures = noFeatures,
): FileManagerAction[] {
  if (node.type === "directory") {
    if (!features.copy && !features.zip) return ["newFile", "newFolder", "rename", "delete"]
    const items: FileManagerAction[] = ["newFile", "newFolder", "rename"]
    if (features.copy) items.push("copy", "move")
    if (features.zip) items.push("compress")
    items.push("delete")
    return items
  }
  const archive = features.zip && isZipName(node.name)
  if (!features.copy && !archive) return ["rename", "delete", "download"]
  const items: FileManagerAction[] = []
  if (archive) items.push("open")
  items.push("rename")
  if (features.copy) items.push("copy", "move")
  if (archive) items.push("extract")
  items.push("download", "delete")
  return items
}

export function longPressDecision(input: { moved: number; durationMs: number }) {
  return input.moved <= 10 && input.durationMs >= 500 ? ("open" as const) : ("cancel" as const)
}

export function parentPath(target: string) {
  const trimmed = target.replace(/\/+$/, "")
  const index = trimmed.lastIndexOf("/")
  if (index < 0) return "."
  if (index === 0) return "/"
  return trimmed.slice(0, index)
}

export function newTargetPath(directory: string, name: string) {
  const base = directory.replace(/\/+$/, "")
  if (base === "") return `/${name}`
  return `${base}/${name}`
}
