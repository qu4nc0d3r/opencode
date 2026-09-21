import { describe, expect, test } from "bun:test"
import { createUploadQueue, UPLOAD_WARN_BYTES } from "./file-upload-queue"

describe("upload queue", () => {
  test("runs uploads sequentially and tracks state", async () => {
    const order: string[] = []
    const queue = createUploadQueue(async (item) => {
      order.push(item.file.name)
    })
    const file = (name: string) => new File([new Uint8Array([1])], name)
    await queue.enqueue([
      { file: file("a.bin"), target: "/tmp/a.bin" },
      { file: file("b.bin"), target: "/tmp/b.bin" },
    ])
    expect(order).toEqual(["a.bin", "b.bin"])
    expect(queue.state().done).toBe(2)
    expect(queue.state().failed).toBe(0)
  })

  test("keeps going after a failure", async () => {
    const queue = createUploadQueue(async (item) => {
      if (item.file.name === "bad.bin") throw new Error("no")
    })
    const file = (name: string) => new File([new Uint8Array([1])], name)
    await queue.enqueue([
      { file: file("bad.bin"), target: "/tmp/bad.bin" },
      { file: file("ok.bin"), target: "/tmp/ok.bin" },
    ])
    expect(queue.state().failed).toBe(1)
    expect(queue.state().done).toBe(1)
    expect(UPLOAD_WARN_BYTES).toBe(100 * 1024 * 1024)
  })

  test("cancelAll drops queued items", async () => {
    const order: string[] = []
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const queue = createUploadQueue(async (item) => {
      order.push(item.file.name)
      if (item.file.name === "a.bin") await gate
    })
    const file = (name: string) => new File([new Uint8Array([1])], name)
    const pending = queue.enqueue([
      { file: file("a.bin"), target: "/tmp/a.bin" },
      { file: file("b.bin"), target: "/tmp/b.bin" },
      { file: file("c.bin"), target: "/tmp/c.bin" },
    ])
    queue.cancelAll()
    release()
    await pending
    expect(order).toEqual(["a.bin"])
    expect(queue.state().done).toBe(1)
  })
})
