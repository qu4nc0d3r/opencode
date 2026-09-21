import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@opencode-ai/ui/v2/dialog-v2"
import { DividerV2 } from "@opencode-ai/ui/v2/divider-v2"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { createSignal, Show } from "solid-js"
import type { EditorGuard } from "@/pages/session/v2/file-editor-guard"

export function useUnsavedChangesGuard() {
  const dialog = useDialog()
  return (guards: EditorGuard[], run: () => void) => {
    if (guards.length === 0) {
      run()
      return
    }
    dialog.show(() => (
      <DialogUnsavedChangesV2
        path={guards[0]?.path}
        onSave={async () => {
          for (const guard of guards) {
            if (!(await guard.save())) return false
          }
          run()
          return true
        }}
        onDiscard={() => {
          for (const guard of guards) guard.discard()
          run()
        }}
      />
    ))
  }
}

export function DialogUnsavedChangesV2(props: {
  path?: string
  onSave: () => Promise<boolean>
  onDiscard: () => void
}) {
  const dialog = useDialog()
  const [saving, setSaving] = createSignal(false)

  const cancel = () => {
    dialog.close()
  }

  const discard = () => {
    props.onDiscard()
    dialog.close()
  }

  const save = async () => {
    if (saving()) return
    setSaving(true)
    try {
      const ok = await props.onSave()
      if (!ok) return
      dialog.close()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog size="normal">
      <DialogHeader>
        <DialogTitle>Unsaved changes</DialogTitle>
      </DialogHeader>
      <DividerV2 />
      <DialogBody class="flex flex-col gap-3 pt-4!">
        <div class="text-13-regular text-v2-text-text-weak">
          <Show
            when={props.path}
            fallback={<>Save changes before continuing? Unsaved edits will be lost.</>}
          >
            {(path) => (
              <>
                Save changes to <span class="font-mono">{path()}</span> before continuing? Unsaved edits will be lost.
              </>
            )}
          </Show>
        </div>
      </DialogBody>
      <DialogFooter>
        <ButtonV2 variant="neutral" onClick={cancel} disabled={saving()}>
          Cancel
        </ButtonV2>
        <ButtonV2 variant="danger" onClick={discard} disabled={saving()}>
          Discard
        </ButtonV2>
        <ButtonV2 variant="contrast" onClick={() => void save()} disabled={saving()}>
          {saving() ? "Saving…" : "Save"}
        </ButtonV2>
      </DialogFooter>
    </Dialog>
  )
}
