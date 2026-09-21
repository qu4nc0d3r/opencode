import { describe, expect, test } from "bun:test"
import { breadcrumbSegments, shouldShowEntry } from "./file-manager-toolbar-model"

describe("breadcrumbSegments", () => {
  test("returns root-relative segments", () => {
    expect(breadcrumbSegments("/root/project", "/root/project/src/lib")).toEqual([
      { name: "project", path: "/root/project" },
      { name: "src", path: "/root/project/src" },
      { name: "lib", path: "/root/project/src/lib" },
    ])
  })
  test("returns empty for the root itself", () => {
    expect(breadcrumbSegments("/root/project", "/root/project")).toEqual([])
  })
})

describe("shouldShowEntry", () => {
  test("hides dotfiles and ignored entries by default", () => {
    expect(shouldShowEntry({ name: ".env", ignored: false }, false)).toBe(false)
    expect(shouldShowEntry({ name: "dist", ignored: true }, false)).toBe(false)
    expect(shouldShowEntry({ name: "src", ignored: false }, false)).toBe(true)
  })
  test("shows everything when enabled", () => {
    expect(shouldShowEntry({ name: ".env", ignored: true }, true)).toBe(true)
  })
})
