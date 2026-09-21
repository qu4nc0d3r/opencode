import { afterEach, describe, expect, test } from "bun:test"
import path from "path"
import * as fs from "fs/promises"
import { tmpdir as mkTmp } from "../fixture/fixture"
import { AuditLog } from "../../src/file/audit"

const saved = process.env.OPENCODE_AUDIT_PATH

afterEach(() => {
  if (saved === undefined) delete process.env.OPENCODE_AUDIT_PATH
  else process.env.OPENCODE_AUDIT_PATH = saved
})

describe("AuditLog", () => {
  test("appends one JSON line per record", async () => {
    await using tmp = await mkTmp()
    const target = path.join(tmp.path, "audit", "fs.jsonl")
    process.env.OPENCODE_AUDIT_PATH = target

    await AuditLog.record({ op: "write", path: "/tmp/x.txt", ok: true })
    await AuditLog.record({ op: "remove", path: "/tmp/x.txt", ok: false, error: "boom" })

    expect(AuditLog.filePath()).toBe(target)

    const text = await fs.readFile(target, "utf8")
    const lines = text.trim().split("\n").map((line) => JSON.parse(line))
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ op: "write", path: "/tmp/x.txt", ok: true })
    expect(lines[1]).toMatchObject({ op: "remove", ok: false, error: "boom" })
    expect(typeof lines[0].ts).toBe("string")
  })
})
