import { describe, expect, test } from "bun:test"
import { directoryPickerKind, useV2DirectoryDialog } from "./directory-picker-policy"

const local = {
  type: "sidecar",
  variant: "base",
  http: { url: "http://localhost:4096" },
} as const
const remote = {
  type: "ssh",
  host: "example.test",
  http: { url: "http://localhost:4096" },
} as const

describe("directoryPickerKind", () => {
  test("uses the native picker only for local desktop projects", () => {
    expect(directoryPickerKind("desktop", local)).toBe("native")
    expect(directoryPickerKind("desktop", remote)).toBe("server")
    expect(directoryPickerKind("web", local)).toBe("server")
  })
})

describe("useV2DirectoryDialog", () => {
  test("web always uses the V2 dialog", () => {
    expect(useV2DirectoryDialog("web", local)).toBe(true)
  })
  test("desktop local uses the native picker instead", () => {
    expect(useV2DirectoryDialog("desktop", local)).toBe(false)
  })
  test("desktop remote uses the V2 dialog", () => {
    expect(useV2DirectoryDialog("desktop", remote)).toBe(true)
  })
})
