import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@opencode-ai/ui/v2/dialog-v2"
import { DividerV2 } from "@opencode-ai/ui/v2/divider-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { createSignal, Show } from "solid-js"
import { useLanguage } from "@/context/language"

export function ConfirmDialogV2(props: {
  title: string
  description: string
  confirmLabel: string
  destructive?: boolean
  requireTypedName?: string
  onConfirm: () => void
  onCancel?: () => void
}) {
  const dialog = useDialog()
  const language = useLanguage()
  const [typed, setTyped] = createSignal("")
  const disabled = () => props.requireTypedName !== undefined && typed().trim() !== props.requireTypedName

  const cancel = () => {
    props.onCancel?.()
    dialog.close()
  }

  const confirm = () => {
    if (disabled()) return
    props.onConfirm()
    dialog.close()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return
    event.preventDefault()
    confirm()
  }

  return (
    <Dialog size="normal">
      <DialogHeader>
        <DialogTitle>{props.title}</DialogTitle>
      </DialogHeader>
      <DividerV2 />
      <DialogBody class="flex flex-col gap-3 pt-4!">
        <div class="text-13-regular text-v2-text-text-weak">{props.description}</div>
        <Show when={props.requireTypedName}>
          {(name) => (
            <TextInputV2
              autofocus
              autocomplete="off"
              spellcheck={false}
              value={typed()}
              aria-label={language.t("file.confirm.typeName", { name: name() })}
              placeholder={name()}
              onInput={(event) => setTyped(event.currentTarget.value)}
              onKeyDown={onKeyDown}
            />
          )}
        </Show>
      </DialogBody>
      <DialogFooter>
        <ButtonV2 variant="neutral" onClick={cancel}>
          {language.t("common.cancel")}
        </ButtonV2>
        <ButtonV2 variant={props.destructive ? "danger" : "contrast"} disabled={disabled()} onClick={confirm}>
          {props.confirmLabel}
        </ButtonV2>
      </DialogFooter>
    </Dialog>
  )
}
