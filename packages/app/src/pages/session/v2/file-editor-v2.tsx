import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js"
import type { CodeMirrorEditor } from "./file-editor-codemirror"

export type FileEditorV2Props = {
  path: string
  content: string
  value: string
  saving: boolean
  onInput: (value: string) => void
  onChange?: (value: string) => void
  onSave: (value: string) => Promise<void>
  onRevert?: () => void
}

export function FileEditorV2(props: FileEditorV2Props) {
  const changed = () => props.value !== props.content
  const [host, setHost] = createSignal<HTMLDivElement>()
  const [ready, setReady] = createSignal(false)
  const [failed, setFailed] = createSignal(false)
  let instance: CodeMirrorEditor | undefined
  let applyingExternal = false

  const notify = (value: string) => {
    props.onInput(value)
    props.onChange?.(value)
  }

  const applyExternal = (value: string) => {
    if (!instance) return
    applyingExternal = true
    try {
      instance.setValue(value)
    } finally {
      applyingExternal = false
    }
  }

  const save = () => {
    if (props.saving) return
    void props.onSave(props.value)
  }

  onMount(() => {
    let disposed = false
    void (async () => {
      try {
        const { createCodeMirrorEditor } = await import("./file-editor-codemirror")
        const parent = host()
        if (disposed) return
        if (!parent) {
          setFailed(true)
          return
        }
        const editor = await createCodeMirrorEditor({
          parent,
          path: props.path,
          value: props.value,
          onSave: (value) => {
            if (props.saving) return
            void props.onSave(value)
          },
          onChange: (value) => {
            if (applyingExternal) return
            notify(value)
          },
        })
        if (disposed) {
          editor.destroy()
          return
        }
        instance = editor
        applyExternal(props.value)
        setReady(true)
      } catch {
        if (!disposed) setFailed(true)
      }
    })()

    onCleanup(() => {
      disposed = true
      instance?.destroy()
      instance = undefined
    })
  })

  createEffect(() => {
    applyExternal(props.value)
  })

  const onKeyDown = (event: KeyboardEvent) => {
    if (ready()) return
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return
    if (event.key.toLowerCase() !== "s") return
    event.preventDefault()
    event.stopPropagation()
    save()
  }

  return (
    <div
      class="flex h-full min-h-0 flex-col"
      data-component="file-editor-v2"
      data-path={props.path}
      onKeyDown={onKeyDown}
    >
      <div class="flex shrink-0 items-center justify-end gap-2 px-6 pb-2">
        <Show when={props.saving}>
          <span class="text-12-regular text-text-weak">Saving…</span>
        </Show>
        <Show when={!props.saving && changed()}>
          <span class="text-12-regular text-text-weak">Unsaved changes</span>
        </Show>
        <ButtonV2 size="small" variant="ghost" disabled={props.saving} onClick={() => props.onRevert?.()}>
          Revert
        </ButtonV2>
        <ButtonV2 size="small" variant="contrast" disabled={props.saving} onClick={save}>
          Save
        </ButtonV2>
      </div>
      <Show
        when={!failed()}
        fallback={
          <textarea
            class="h-full w-full flex-1 resize-none bg-transparent px-6 pb-6 font-mono text-12-regular text-text-base outline-none"
            data-slot="file-editor-v2-textarea"
            value={props.value}
            spellcheck={false}
            autocomplete="off"
            autocapitalize="off"
            onInput={(event) => notify(event.currentTarget.value)}
          />
        }
      >
        <div class="relative min-h-0 flex-1">
          <div ref={setHost} class="h-full" data-slot="file-editor-v2-codemirror" />
          <Show when={!ready()}>
            <textarea
              class="absolute inset-0 h-full w-full resize-none bg-transparent px-6 pb-6 font-mono text-12-regular text-text-base outline-none"
              data-slot="file-editor-v2-textarea"
              value={props.value}
              spellcheck={false}
              autocomplete="off"
              autocapitalize="off"
              onInput={(event) => notify(event.currentTarget.value)}
            />
          </Show>
        </div>
      </Show>
    </div>
  )
}
