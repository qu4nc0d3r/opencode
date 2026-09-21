import { describe, expect, test } from "bun:test"
import { bulkActions, createSelectionState } from "./file-selection-model"

describe("createSelectionState", () => {
  test("toggles and clears", () => {
    const state = createSelectionState()
    state.toggle("/a")
    state.toggle("/b")
    expect(state.count()).toBe(2)
    expect(state.has("/a")).toBe(true)
    state.toggle("/a")
    expect(state.count()).toBe(1)
    state.clear()
    expect(state.count()).toBe(0)
  })

  test("set replaces the whole selection", () => {
    const state = createSelectionState()
    state.toggle("/a")
    state.set(["/b", "/c"])
    expect(state.list()).toEqual(["/b", "/c"])
  })

  test("range selects the inclusive span in row order", () => {
    const state = createSelectionState()
    state.range(["/a", "/b", "/c", "/d"], "/b", "/d")
    expect(state.list()).toEqual(["/b", "/c", "/d"])
  })

  test("range works when dragging upwards", () => {
    const state = createSelectionState()
    state.range(["/a", "/b", "/c", "/d"], "/d", "/b")
    expect(state.list()).toEqual(["/b", "/c", "/d"])
  })

  test("range ignores paths missing from the row order", () => {
    const state = createSelectionState()
    state.range(["/a", "/b"], "/a", "/missing")
    expect(state.count()).toBe(0)
  })
})

describe("bulkActions", () => {
  test("bulk actions need a selection", () => {
    expect(bulkActions(0)).toEqual([])
    expect(bulkActions(3)).toEqual(["download", "compress", "copy", "move", "delete"])
  })
})
