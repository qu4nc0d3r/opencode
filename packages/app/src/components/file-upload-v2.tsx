import { createSignal, onMount, Show, type JSX } from "solid-js"
import { useLanguage } from "@/context/language"
import { createUploadQueue, UPLOAD_WARN_BYTES, type UploadQueueState } from "@/components/file-upload-queue"

export function createFileUploader(props: {
  upload: (target: string, data: Uint8Array) => Promise<{ bytes: number }>
  warn?: (files: File[]) => boolean
  onComplete?: (state: UploadQueueState) => void
}) {
  const queue = createUploadQueue(async (item) => {
    const data = new Uint8Array(await item.file.arrayBuffer())
    const result = await props.upload(item.target, data)
    if (data.byteLength > 0 && result.bytes === 0) throw new Error(`Upload failed: ${item.file.name}`)
  })

  const enqueue = async (files: readonly File[], target: string) => {
    if (files.length === 0) return
    const large = files.filter((file) => file.size > UPLOAD_WARN_BYTES)
    if (large.length > 0 && props.warn && !props.warn(large)) return
    await queue.enqueue(files.map((file) => ({ file, target })))
    props.onComplete?.(queue.state())
  }

  return {
    enqueue,
    state: queue.state,
    cancelAll: queue.cancelAll,
  }
}

export function FileUploadV2(props: {
  onFiles: (files: File[]) => void
  onOpenReady?: (open: () => void) => void
}) {
  let input: HTMLInputElement | undefined

  onMount(() => {
    props.onOpenReady?.(() => input?.click())
  })

  return (
    <input
      ref={input}
      type="file"
      multiple
      class="hidden"
      aria-hidden="true"
      tabindex={-1}
      onChange={(event) => {
        const files = Array.from(event.currentTarget.files ?? [])
        event.currentTarget.value = ""
        if (files.length > 0) props.onFiles(files)
      }}
    />
  )
}

export function FileUploadDropzone(props: { onFiles: (files: File[]) => void; children: JSX.Element }) {
  const language = useLanguage()
  const [dragging, setDragging] = createSignal(false)

  return (
    <div
      class="relative min-h-full"
      onDragOver={(event) => {
        if (!event.dataTransfer?.types.includes("Files")) return
        event.preventDefault()
        event.dataTransfer.dropEffect = "copy"
        setDragging(true)
      }}
      onDragLeave={(event) => {
        const next = event.relatedTarget as Node | null
        if (next && event.currentTarget.contains(next)) return
        setDragging(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        const files = Array.from(event.dataTransfer?.files ?? [])
        if (files.length > 0) props.onFiles(files)
      }}
    >
      {props.children}
      <Show when={dragging()}>
        <div class="pointer-events-none absolute inset-x-2 top-1 z-20 rounded-md border border-dashed border-v2-border-border-base bg-v2-background-bg-layer-01 px-2 py-1 text-center text-12-regular text-v2-text-text-muted">
          {language.t("file.manager.upload")}
        </div>
      </Show>
    </div>
  )
}

export function FileUploadProgress(props: { state: UploadQueueState; class?: string }) {
  const language = useLanguage()
  const visible = () =>
    props.state.total > 0 &&
    (props.state.active !== undefined || props.state.done + props.state.failed < props.state.total)

  return (
    <Show when={visible()}>
      <span class={props.class ?? "text-12-regular text-v2-text-text-muted"}>
        {language.t("file.manager.uploading", {
          done: props.state.done + props.state.failed,
          total: props.state.total,
        })}
      </span>
    </Show>
  )
}
