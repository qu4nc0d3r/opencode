import { describe, expect, test } from "bun:test"
import { languageNameFor } from "./file-editor-language"

describe("languageNameFor", () => {
  test("maps common extensions", () => {
    expect(languageNameFor("a.ts")).toBe("typescript")
    expect(languageNameFor("b.py")).toBe("python")
    expect(languageNameFor("c.unknown")).toBeUndefined()
  })
  test("uses the file name over directories", () => {
    expect(languageNameFor("/root/dir.md/README.md")).toBe("markdown")
    expect(languageNameFor("C:\\root\\src\\main.go")).toBe("go")
  })
  test("ignores dotfiles without an extension", () => {
    expect(languageNameFor(".env")).toBeUndefined()
    expect(languageNameFor("Makefile")).toBeUndefined()
  })
  test("supports common aliases", () => {
    expect(languageNameFor("script.sh")).toBe("shell")
    expect(languageNameFor("data.yml")).toBe("yaml")
    expect(languageNameFor("index.tsx")).toBe("typescript")
    expect(languageNameFor("style.scss")).toBe("scss")
  })
  test("is case insensitive", () => {
    expect(languageNameFor("A.TS")).toBe("typescript")
  })
})
