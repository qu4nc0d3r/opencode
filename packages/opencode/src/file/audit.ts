import path from "path"
import { appendFile, mkdir } from "fs/promises"

export type AuditRecord = {
  op: string
  path?: string
  from?: string
  to?: string
  bytes?: number
  ok: boolean
  error?: string
}

function auditPath() {
  const override = process.env.OPENCODE_AUDIT_PATH
  if (override) return override
  const data = process.env.XDG_DATA_HOME || path.join(process.env.HOME ?? process.env.USERPROFILE ?? ".", ".local", "share")
  return path.join(data, "opencode", "audit", "fs.jsonl")
}

export namespace AuditLog {
  export function filePath() {
    return auditPath()
  }

  export async function record(input: AuditRecord) {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...input })
    try {
      const target = auditPath()
      await mkdir(path.dirname(target), { recursive: true })
      await appendFile(target, line + "\n", "utf8")
    } catch {
      // audit failures must never break the operation
    }
  }
}
