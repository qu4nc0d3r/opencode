export type FileBreadcrumbSegment = { name: string; path: string }

export function breadcrumbSegments(root: string, current: string): FileBreadcrumbSegment[] {
  const base = root.replace(/\/+$/, "")
  const value = current.replace(/\/+$/, "")
  if (!value || value === base) return []
  const relative = value.startsWith(base + "/") ? value.slice(base.length + 1) : value
  const parts = relative.split("/").filter(Boolean)
  const segments = parts.map((name, index) => ({ name, path: `${base}/${parts.slice(0, index + 1).join("/")}` }))
  if (!base) return segments
  return [{ name: base.split("/").filter(Boolean).pop() ?? base, path: base }, ...segments]
}

export function shouldShowEntry(node: { name: string; ignored?: boolean }, showHidden: boolean) {
  if (showHidden) return true
  if (node.name.startsWith(".")) return false
  return !node.ignored
}
