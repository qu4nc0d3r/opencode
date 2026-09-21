import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@opencode-ai/ui/v2/dialog-v2"
import { DividerV2 } from "@opencode-ai/ui/v2/divider-v2"
import { MenuV2 } from "@opencode-ai/ui/v2/menu-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { createSignal, For, type ParentProps } from "solid-js"
import { useLanguage } from "@/context/language"
import {
  fileManagerMenuItems,
  type FileManagerAction,
  type FileManagerFeatures,
  type FileManagerNode,
} from "@/components/file-manager-v2-model"

const actionKeys = {
  open: "common.open",
  select: "file.selection.select",
  newFile: "file.manager.newFile",
  newFolder: "file.manager.newFolder",
  rename: "file.manager.rename",
  copy: "file.menu.copy",
  move: "file.menu.move",
  compress: "file.menu.compress",
  extract: "file.menu.extract",
  download: "file.manager.download",
  delete: "file.manager.delete",
} as const satisfies Record<FileManagerAction, string>

export function FileManagerContextMenu(
  props: ParentProps<{
    node: FileManagerNode
    features?: FileManagerFeatures
    onAction: (action: FileManagerAction) => void
  }>,
) {
  const language = useLanguage()

  return (
    <MenuV2.Context>
      <MenuV2.Context.Trigger as="div" class="contents">
        {props.children}
      </MenuV2.Context.Trigger>
      <MenuV2.Context.Portal>
        <MenuV2.Context.Content>
          <For each={fileManagerMenuItems(props.node, props.features)}>
            {(action) => (
              <MenuV2.Item onSelect={() => props.onAction(action)}>{language.t(actionKeys[action])}</MenuV2.Item>
            )}
          </For>
          <MenuV2.Item onSelect={() => props.onAction("select")}>{language.t(actionKeys.select)}</MenuV2.Item>
        </MenuV2.Context.Content>
      </MenuV2.Context.Portal>
    </MenuV2.Context>
  )
}

export function FileManagerPromptV2(props: {
  title: string
  initialValue?: string
  confirmLabel: string
  onConfirm: (value: string) => void
}) {
  const dialog = useDialog()
  const language = useLanguage()
  const [value, setValue] = createSignal(props.initialValue ?? "")

  const confirm = () => {
    const next = value().trim()
    if (!next) return
    props.onConfirm(next)
    dialog.close()
  }

  return (
    <Dialog size="normal">
      <DialogHeader>
        <DialogTitle>{props.title}</DialogTitle>
      </DialogHeader>
      <DividerV2 />
      <DialogBody class="pt-4!">
        <TextInputV2
          autofocus
          autocomplete="off"
          spellcheck={false}
          value={value()}
          aria-label={language.t("file.manager.name")}
          placeholder={language.t("file.manager.name")}
          onInput={(event) => setValue(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            event.preventDefault()
            confirm()
          }}
        />
      </DialogBody>
      <DialogFooter>
        <ButtonV2 variant="neutral" onClick={() => dialog.close()}>
          {language.t("common.cancel")}
        </ButtonV2>
        <ButtonV2 variant="contrast" disabled={!value().trim()} onClick={confirm}>
          {props.confirmLabel}
        </ButtonV2>
      </DialogFooter>
    </Dialog>
  )
}
