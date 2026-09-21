import { describe, expect, test } from "bun:test"
import {
  fileManagerMenuItems,
  longPressDecision,
  newTargetPath,
  parentPath,
  type FileManagerFeatures,
} from "./file-manager-v2-model"

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
  test("wave B actions stay hidden while features are off", () => {
    const off: FileManagerFeatures = { copy: false, zip: false }
    expect(fileManagerMenuItems({ type: "directory", path: "a", name: "a" }, off)).toEqual([
      "newFile",
      "newFolder",
      "rename",
      "delete",
    ])
    expect(fileManagerMenuItems({ type: "file", path: "a.zip", name: "a.zip" }, off)).toEqual([
      "rename",
      "delete",
      "download",
    ])
  })
  test("copy and zip features add their actions", () => {
    const on: FileManagerFeatures = { copy: true, zip: true }
    expect(fileManagerMenuItems({ type: "directory", path: "a", name: "a" }, on)).toEqual([
      "newFile",
      "newFolder",
      "rename",
      "copy",
      "move",
      "compress",
      "delete",
    ])
    expect(fileManagerMenuItems({ type: "file", path: "pack.zip", name: "pack.zip" }, on)).toEqual([
      "open",
      "rename",
      "copy",
      "move",
      "extract",
      "download",
      "delete",
    ])
  })
})

describe("longPressDecision", () => {
  test("long press opens only when still and long enough", () => {
    expect(longPressDecision({ moved: 0, durationMs: 600 })).toBe("open")
    expect(longPressDecision({ moved: 24, durationMs: 600 })).toBe("cancel")
    expect(longPressDecision({ moved: 0, durationMs: 300 })).toBe("cancel")
  })
  test("tolerates small movement and opens at the threshold", () => {
    expect(longPressDecision({ moved: 10, durationMs: 500 })).toBe("open")
    expect(longPressDecision({ moved: 11, durationMs: 500 })).toBe("cancel")
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
