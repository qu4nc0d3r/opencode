import { createSignal } from "solid-js"

export const EDIT_MAX_BYTES = 5 * 1024 * 1024

export type DirtyState = {
  markDirty: (path: string, draft: string) => void
  clear: (path: string) => void
  isDirty: (path: string) => boolean
  draft: (path: string) => string | undefined
}

export function createDirtyState(): DirtyState {
  const [drafts, setDrafts] = createSignal<Record<string, string>>({})

  return {
    markDirty(path, draft) {
      setDrafts((prev) => ({ ...prev, [path]: draft }))
    },
    clear(path) {
      setDrafts((prev) => {
        if (!Object.hasOwn(prev, path)) return prev
        const next = { ...prev }
        delete next[path]
        return next
      })
    },
    isDirty(path) {
      return Object.hasOwn(drafts(), path)
    },
    draft(path) {
      return drafts()[path]
    },
  }
}
