export type FileManagerAction = "newFile" | "newFolder" | "rename" | "delete" | "download"

export type FileManagerNode = { type: "file" | "directory"; path: string; name: string }

export function fileManagerMenuItems(node: FileManagerNode): FileManagerAction[] {
  if (node.type === "directory") return ["newFile", "newFolder", "rename", "delete"]
  return ["rename", "delete", "download"]
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
