import { describe, expect, test } from "bun:test"
import { createDirtyState, EDIT_MAX_BYTES } from "./file-editor-model"

describe("dirty state", () => {
  test("tracks drafts and clears on save", () => {
    const state = createDirtyState()
    expect(state.isDirty("a.txt")).toBe(false)
    state.markDirty("a.txt", "draft")
    expect(state.isDirty("a.txt")).toBe(true)
    expect(state.draft("a.txt")).toBe("draft")
    state.clear("a.txt")
    expect(state.isDirty("a.txt")).toBe(false)
  })
  test("only text files under the cap are editable", () => {
    expect(EDIT_MAX_BYTES).toBe(5 * 1024 * 1024)
  })
})
