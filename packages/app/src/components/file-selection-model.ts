import { createSignal } from "solid-js"

export type BulkAction = "delete" | "copy" | "move" | "download" | "compress"

export function bulkActions(count: number): BulkAction[] {
  if (count <= 0) return []
  return ["download", "compress", "copy", "move", "delete"]
}

export function createSelectionState() {
  const [selected, setSelected] = createSignal<ReadonlySet<string>>(new Set())

  const replace = (next: ReadonlySet<string>) => setSelected(() => next)

  return {
    has: (path: string) => selected().has(path),
    list: () => [...selected()],
    count: () => selected().size,
    toggle: (path: string) =>
      setSelected((current) => {
        const next = new Set(current)
        if (next.has(path)) next.delete(path)
        else next.add(path)
        return next
      }),
    set: (paths: readonly string[]) => replace(new Set(paths)),
    clear: () => replace(new Set()),
    range: (paths: readonly string[], from: string, to: string) => {
      const start = paths.indexOf(from)
      const end = paths.indexOf(to)
      if (start === -1 || end === -1) return
      const low = Math.min(start, end)
      const high = Math.max(start, end)
      setSelected((current) => {
        const next = new Set(current)
        for (let index = low; index <= high; index++) next.add(paths[index])
        return next
      })
    },
  }
}

export type SelectionState = ReturnType<typeof createSelectionState>
