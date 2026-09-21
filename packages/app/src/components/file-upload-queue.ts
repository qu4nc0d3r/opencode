import { createSignal } from "solid-js"

export const UPLOAD_WARN_BYTES = 100 * 1024 * 1024

export type UploadQueueItem = { file: File; target: string }

export type UploadQueueState = {
  total: number
  done: number
  failed: number
  active: string | undefined
}

export function createUploadQueue(run: (item: UploadQueueItem) => Promise<void>) {
  const [state, setState] = createSignal<UploadQueueState>({ total: 0, done: 0, failed: 0, active: undefined })
  const queue: UploadQueueItem[] = []
  let active = false
  let drain: Promise<void> | undefined
  let resolveDrain: (() => void) | undefined

  const process = async () => {
    while (queue.length > 0) {
      const item = queue.shift()!
      setState((current) => ({ ...current, active: item.file.name }))
      try {
        await run(item)
        setState((current) => ({ ...current, done: current.done + 1 }))
      } catch {
        setState((current) => ({ ...current, failed: current.failed + 1 }))
      }
    }
    active = false
    setState((current) => ({ ...current, active: undefined }))
    resolveDrain?.()
    resolveDrain = undefined
  }

  const pump = () => {
    if (active) return drain ?? Promise.resolve()
    active = true
    drain = new Promise<void>((resolve) => {
      resolveDrain = resolve
    })
    void process()
    return drain
  }

  return {
    async enqueue(items: UploadQueueItem[]) {
      if (items.length === 0) return
      queue.push(...items)
      setState((current) => ({ ...current, total: current.total + items.length }))
      await pump()
    },
    state,
    cancelAll() {
      const dropped = queue.length
      queue.length = 0
      if (dropped === 0) return
      setState((current) => ({ ...current, total: Math.max(0, current.total - dropped) }))
    },
  }
}
