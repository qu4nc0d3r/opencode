export type EditorGuard = {
  tab: string
  path: string
  hasUnsaved: () => boolean
  save: () => Promise<boolean>
  discard: () => void
}

const guards = new Map<string, EditorGuard>()

export function registerEditorGuard(guard: EditorGuard) {
  guards.set(guard.tab, guard)
  return () => {
    if (guards.get(guard.tab) !== guard) return
    guards.delete(guard.tab)
  }
}

export function unregisterEditorGuard(tab: string) {
  guards.delete(tab)
}

export function unsavedEditorGuards(tab?: string) {
  const list = tab === undefined ? [...guards.values()] : [guards.get(tab)].filter((guard) => !!guard)
  return list.filter((guard) => guard.hasUnsaved())
}
