import { describe, expect, test } from "bun:test"
import { fileManagerMenuItems, newTargetPath, parentPath } from "./file-manager-v2-model"

describe("fileManagerMenuItems", () => {
  test("folders can create and delete but not download", () => {
    expect(fileManagerMenuItems({ type: "directory", path: "a", name: "a" })).toEqual([
      "newFile",
      "newFolder",
      "rename",
      "delete",
    ])
  })
  test("files can rename, delete and download", () => {
    expect(fileManagerMenuItems({ type: "file", path: "a.txt", name: "a.txt" })).toEqual([
      "rename",
      "delete",
      "download",
    ])
  })
})

describe("newTargetPath", () => {
  test("joins a name to a directory", () => {
    expect(newTargetPath("/root/project", "note.txt")).toBe("/root/project/note.txt")
  })
  test("does not duplicate slashes", () => {
    expect(newTargetPath("/root/project/", "note.txt")).toBe("/root/project/note.txt")
    expect(newTargetPath("/", "note.txt")).toBe("/note.txt")
  })
})

describe("parentPath", () => {
  test("returns the containing directory of a file", () => {
    expect(parentPath("/root/project/note.txt")).toBe("/root/project")
  })
  test("stops at the filesystem root", () => {
    expect(parentPath("/note.txt")).toBe("/")
  })
})
