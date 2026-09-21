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
    copy: async (input: unknown) => {
      calls.push(`copy:${JSON.stringify(input)}`)
      return { data: { path: "/x" } }
    },
    archive: async (input: unknown) => {
      calls.push(`archive:${JSON.stringify(input)}`)
      return { data: { path: "/x", bytes: 1 } }
    },
    extract: async (input: unknown) => {
      calls.push(`extract:${JSON.stringify(input)}`)
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
    expect(calls[0]).toBe('write:{"directory":"/root/project","path":"/root/project/a/b.txt","content":"hi"}')
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

  test("copy calls the api and refreshes destination parent", async () => {
    const { ops, calls, refreshed } = deps()
    await ops.copy("/root/a.txt", "/root/b/c.txt")
    expect(calls[0]).toContain("copy:")
    expect(calls[0]).toContain('"from":"/root/a.txt"')
    expect(calls[0]).toContain('"to":"/root/b/c.txt"')
    expect(refreshed).toContain("/root/b")
  })

  test("archive calls the api and refreshes the parent of the destination", async () => {
    const { ops, calls, refreshed } = deps()
    await ops.archive(["/root/a", "/root/b"], "/root/out.zip")
    expect(calls[0]).toContain("archive:")
    expect(calls[0]).toContain('"paths":["/root/a","/root/b"]')
    expect(calls[0]).toContain('"dest":"/root/out.zip"')
    expect(refreshed).toContain("/root")
  })

  test("extract refreshes the parent of the destination", async () => {
    const { ops, calls, refreshed } = deps()
    await ops.extract("/root/pack.zip")
    expect(calls[0]).toContain("extract:")
    expect(refreshed).toContain("/root")
  })

  test("extract with a destination refreshes that destination's parent", async () => {
    const { ops, calls, refreshed } = deps()
    await ops.extract("/root/pack.zip", "/root/out/nested")
    expect(calls[0]).toContain('"dest":"/root/out/nested"')
    expect(refreshed).toContain("/root/out")
  })

  test("downloadUrl builds an absolute download link", () => {
    const { ops } = deps()
    expect(ops.downloadUrl("/root/a b.txt", "https://agent.hehez.net")).toBe(
      "https://agent.hehez.net/file/download?path=%2Froot%2Fa+b.txt",
    )
  })
})
