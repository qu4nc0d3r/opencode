import { afterEach, describe, expect, test } from "bun:test"
import { Context } from "effect"
import path from "path"
import * as fs from "fs/promises"
import { HttpApiApp } from "../../src/server/routes/instance/httpapi/server"
import { FilePaths } from "../../src/server/routes/instance/httpapi/groups/file"
import { resetDatabase } from "../fixture/db"
import { disposeAllInstances, tmpdir } from "../fixture/fixture"

const context = Context.empty() as Context.Context<unknown>

function post(route: string, directory: string, payload: unknown) {
  return HttpApiApp.webHandler().handler(
    new Request(new URL(`http://localhost${route}`), {
      method: "POST",
      headers: { "x-opencode-directory": directory, "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
    context,
  )
}

afterEach(async () => {
  await disposeAllInstances()
  await resetDatabase()
})

describe("file HttpApi mutations", () => {
  test("write creates a file and parent directories", async () => {
    await using tmp = await tmpdir({ git: true })
    const target = path.join(tmp.path, "a", "b", "note.txt")

    const response = await post(FilePaths.write, tmp.path, { path: target, content: "hello" })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ path: target })
    expect(await fs.readFile(target, "utf8")).toBe("hello")
  })

  test("write replaces an existing file", async () => {
    await using tmp = await tmpdir({ git: true })
    const target = path.join(tmp.path, "note.txt")
    await Bun.write(target, "old")

    const response = await post(FilePaths.write, tmp.path, { path: target, content: "new" })

    expect(response.status).toBe(200)
    expect(await fs.readFile(target, "utf8")).toBe("new")
  })

  test("mkdir creates nested directories", async () => {
    await using tmp = await tmpdir({ git: true })
    const target = path.join(tmp.path, "x", "y")

    const response = await post(FilePaths.mkdir, tmp.path, { path: target })

    expect(response.status).toBe(200)
    expect(await fs.stat(target)).toBeTruthy()
  })

  test("rejects an empty path", async () => {
    await using tmp = await tmpdir({ git: true })
    const response = await post(FilePaths.write, tmp.path, { path: "", content: "x" })
    expect(response.status).toBe(400)
  })

  test("rename moves a file", async () => {
    await using tmp = await tmpdir({ git: true })
    const from = path.join(tmp.path, "a.txt")
    const to = path.join(tmp.path, "sub", "b.txt")
    await Bun.write(from, "x")

    const response = await post(FilePaths.rename, tmp.path, { from, to })

    expect(response.status).toBe(200)
    expect(await fs.readFile(to, "utf8")).toBe("x")
    await expect(fs.stat(from)).rejects.toThrow()
  })

  test("remove deletes a file", async () => {
    await using tmp = await tmpdir({ git: true })
    const target = path.join(tmp.path, "gone.txt")
    await Bun.write(target, "x")

    const response = await post(FilePaths.remove, tmp.path, { path: target })

    expect(response.status).toBe(200)
    await expect(fs.stat(target)).rejects.toThrow()
  })

  test("remove refuses a non-empty directory without recursive", async () => {
    await using tmp = await tmpdir({ git: true })
    const dir = path.join(tmp.path, "dir")
    await fs.mkdir(dir)
    await Bun.write(path.join(dir, "child.txt"), "x")

    const response = await post(FilePaths.remove, tmp.path, { path: dir })

    expect(response.status).toBe(400)
    expect(await fs.stat(dir)).toBeTruthy()
  })

  test("remove deletes a non-empty directory with recursive", async () => {
    await using tmp = await tmpdir({ git: true })
    const dir = path.join(tmp.path, "dir")
    await fs.mkdir(dir)
    await Bun.write(path.join(dir, "child.txt"), "x")

    const response = await post(FilePaths.remove, tmp.path, { path: dir, recursive: true })

    expect(response.status).toBe(200)
    await expect(fs.stat(dir)).rejects.toThrow()
  })

  test("upload streams bytes to disk and download returns them", async () => {
    await using tmp = await tmpdir({ git: true })
    const target = path.join(tmp.path, "data", "blob.bin")
    const body = new Uint8Array([1, 2, 3, 4, 5])

    const upload = await HttpApiApp.webHandler().handler(
      new Request(new URL(`http://localhost${FilePaths.upload}?path=${encodeURIComponent(target)}`), {
        method: "PUT",
        headers: { "x-opencode-directory": tmp.path },
        body,
      }),
      context,
    )
    expect(upload.status).toBe(200)
    expect(await upload.json()).toEqual({ path: target, bytes: 5 })
    expect(new Uint8Array(await fs.readFile(target))).toEqual(body)

    const download = await HttpApiApp.webHandler().handler(
      new Request(new URL(`http://localhost${FilePaths.download}?path=${encodeURIComponent(target)}`), {
        headers: { "x-opencode-directory": tmp.path },
      }),
      context,
    )
    expect(download.status).toBe(200)
    expect(download.headers.get("content-disposition")).toContain("blob.bin")
    expect(new Uint8Array(await download.arrayBuffer())).toEqual(body)
  })
})
