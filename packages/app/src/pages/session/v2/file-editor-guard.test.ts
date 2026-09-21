import { describe, expect, test } from "bun:test"
import { registerEditorGuard, unregisterEditorGuard, unsavedEditorGuards } from "./file-editor-guard"

function guard(tab: string, dirty: boolean) {
  return {
    tab,
    path: `/root/${tab}.ts`,
    hasUnsaved: () => dirty,
    save: async () => true,
    discard: () => {},
  }
}

describe("editor guard registry", () => {
  test("lists only unsaved guards", () => {
    registerEditorGuard(guard("a", true))
    registerEditorGuard(guard("b", false))
    expect(unsavedEditorGuards().map((item) => item.tab)).toEqual(["a"])
    expect(unsavedEditorGuards("b")).toEqual([])
    expect(unsavedEditorGuards("a").map((item) => item.tab)).toEqual(["a"])
    unregisterEditorGuard("a")
    unregisterEditorGuard("b")
  })

  test("the disposer only removes its own registration", () => {
    const first = guard("c", true)
    const second = guard("c", true)
    const disposeFirst = registerEditorGuard(first)
    registerEditorGuard(second)
    disposeFirst()
    expect(unsavedEditorGuards("c")).toEqual([second])
    unregisterEditorGuard("c")
  })
})
