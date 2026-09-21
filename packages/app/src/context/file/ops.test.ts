import { describe, expect, test } from "bun:test"
import { createFileOps } from "./ops"

function deps() {
  const calls: string[] = []
  const sdk = {
    write: async (input: unknown) => {
      calls.push(`write:${JSON.stringify(input)}`)
      return { data: { path: "/x" } }
    },
    mkdir: async (input: unknown) => {
      calls.push(`mkdir:${JSON.stringify(input)}`)
      return { data: { path: "/x" } }
    },
    rename: async (input: unknown) => {
      calls.push(`rename:${JSON.stringify(input)}`)
      return { data: { path: "/y" } }
    },
    remove: async (input: unknown) => {
      calls.push(`remove:${JSON.stringify(input)}`)
      return { data: { path: "/x" } }
    },
  }
  const refreshed: string[] = []
  const errors: string[] = []
  return {
    calls,
    refreshed,
    errors,
    ops: createFileOps({
      directory: () => "/root/project",
      api: sdk as never,
      refresh: (dir) => {
        refreshed.push(dir)
      },
      onError: (message) => {
        errors.push(message)
      },
    }),
  }
}

describe("createFileOps", () => {
  test("write passes directory and payload then refreshes the parent", async () => {
    const { ops, calls, refreshed } = deps()
    await ops.write("/root/project/a/b.txt", "hi")
    expect(calls[0]).toBe(
      'write:{"directory":"/root/project","path":"/root/project/a/b.txt","content":"hi"}',
    )
    expect(refreshed).toEqual(["/root/project/a"])
  })

  test("remove refreshes the parent and reports errors", async () => {
    const { ops, errors } = deps()
    const failing = createFileOps({
      directory: () => "/root/project",
      api: {
        remove: async () => {
          throw new Error("denied")
        },
      } as never,
      refresh: () => {},
      onError: (message) => errors.push(message),
    })
    await ops.remove("/root/project/a.txt")
    await failing.remove("/root/project/a.txt")
    expect(errors).toEqual(["denied"])
  })

  test("downloadUrl builds an absolute download link", () => {
    const { ops } = deps()
    expect(ops.downloadUrl("/root/a b.txt", "https://agent.hehez.net")).toBe(
      "https://agent.hehez.net/file/download?path=%2Froot%2Fa+b.txt",
    )
  })
})
