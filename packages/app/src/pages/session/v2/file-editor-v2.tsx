import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Show } from "solid-js"

export type FileEditorV2Props = {
  path: string
  content: string
  value: string
  saving: boolean
  onInput: (value: string) => void
  onSave: (value: string) => Promise<void>
  onRevert?: () => void
}

export function FileEditorV2(props: FileEditorV2Props) {
  const changed = () => props.value !== props.content

  const save = () => {
    if (props.saving) return
    void props.onSave(props.value)
  }

  const onKeyDown = (event: KeyboardEvent) => {
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
      <textarea
        class="h-full w-full flex-1 resize-none bg-transparent px-6 pb-6 font-mono text-12-regular text-text-base outline-none"
        data-slot="file-editor-v2-textarea"
        value={props.value}
        spellcheck={false}
        autocomplete="off"
        autocapitalize="off"
        onInput={(event) => props.onInput(event.currentTarget.value)}
      />
    </div>
  )
}
