import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@opencode-ai/ui/v2/dialog-v2"
import { DividerV2 } from "@opencode-ai/ui/v2/divider-v2"
import { Icon } from "@opencode-ai/ui/v2/icon"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { createEffect, createSignal, For, onCleanup } from "solid-js"
import { useLanguage } from "@/context/language"
import {
  fileManagerMenuItems,
  type FileManagerAction,
  type FileManagerNode,
} from "@/components/file-manager-v2-model"

const actionKeys = {
  newFile: "file.manager.newFile",
  newFolder: "file.manager.newFolder",
  rename: "file.manager.rename",
  delete: "file.manager.delete",
  download: "file.manager.download",
} as const satisfies Record<FileManagerAction, string>

export function FileManagerToolbar(props: {
  onNewFile: () => void
  onNewFolder: () => void
  onUpload: () => void
  onRefresh: () => void
}) {
  const language = useLanguage()

  return (
    <div class="flex items-center gap-1">
      <ButtonV2
        size="normal"
        variant="ghost"
        icon="plus"
        aria-label={language.t("file.manager.newFile")}
        onClick={props.onNewFile}
      >
        <span class="hidden sm:inline">{language.t("file.manager.newFile")}</span>
      </ButtonV2>
      <ButtonV2
        size="normal"
        variant="ghost"
        icon="folder-add-left"
        aria-label={language.t("file.manager.newFolder")}
        onClick={props.onNewFolder}
      >
        <span class="hidden sm:inline">{language.t("file.manager.newFolder")}</span>
      </ButtonV2>
      <ButtonV2
        size="normal"
        variant="ghost"
        icon="outline-share"
        aria-label={language.t("file.manager.upload")}
        onClick={props.onUpload}
      >
        <span class="hidden sm:inline">{language.t("file.manager.upload")}</span>
      </ButtonV2>
      <ButtonV2
        size="normal"
        variant="ghost"
        icon="outline-reset"
        aria-label={language.t("file.manager.refresh")}
        onClick={props.onRefresh}
      >
        <span class="hidden sm:inline">{language.t("file.manager.refresh")}</span>
      </ButtonV2>
    </div>
  )
}

export function FileManagerMenu(props: {
  node: FileManagerNode
  point: { x: number; y: number }
  onAction: (action: FileManagerAction) => void
  onClose: () => void
}) {
  const language = useLanguage()
  const items = () => fileManagerMenuItems(props.node)
  const position = () => {
    const width = 184
    const height = items().length * 36 + 8
    const maxWidth = typeof window === "undefined" ? width : window.innerWidth - 8
    const maxHeight = typeof window === "undefined" ? height : window.innerHeight - 8
    return {
      left: `${Math.max(8, Math.min(props.point.x, maxWidth - width))}px`,
      top: `${Math.max(8, Math.min(props.point.y, maxHeight - height))}px`,
    }
  }

  createEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      props.onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    onCleanup(() => window.removeEventListener("keydown", onKeyDown))
  })

  return (
    <div
      class="fixed inset-0 z-50"
      onPointerDown={() => props.onClose()}
      onContextMenu={(event) => {
        event.preventDefault()
        props.onClose()
      }}
    >
      <div
        role="menu"
        aria-label={language.t("common.moreOptions")}
        class="absolute min-w-44 rounded-lg border border-v2-border-border-base bg-v2-background-bg-layer-01 p-1 shadow-lg"
        style={position()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <For each={items()}>
          {(action) => (
            <button
              type="button"
              role="menuitem"
              class="flex w-full items-center rounded-md px-2 py-2 text-start text-13-regular text-v2-text-text-base hover:bg-v2-overlay-simple-overlay-hover"
              onClick={() => props.onAction(action)}
            >
              {language.t(actionKeys[action])}
            </button>
          )}
        </For>
      </div>
    </div>
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
