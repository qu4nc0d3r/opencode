import { describe, expect, test } from "bun:test"
import { joinChildPath, pickerMenuItems } from "./directory-picker-menu-model"

describe("pickerMenuItems", () => {
  test("directories expose navigation and folder operations", () => {
    expect(pickerMenuItems({ kind: "directory", name: "project", path: "project/" })).toEqual([
      "open",
      "select",
      "newFolder",
      "rename",
      "delete",
      "refresh",
    ])
  })

  test("files expose no picker actions", () => {
    expect(pickerMenuItems({ kind: "file", name: "README.md", path: "README.md" })).toEqual([])
  })
})

describe("joinChildPath", () => {
  test("joins a name under a directory", () => {
    expect(joinChildPath("project", "src")).toBe("project/src")
  })

  test("strips trailing separators before joining", () => {
    expect(joinChildPath("project/", "src")).toBe("project/src")
    expect(joinChildPath("project///", "src")).toBe("project/src")
  })

  test("keeps a leading separator when the parent is empty", () => {
    expect(joinChildPath("", "src")).toBe("/src")
  })
})
