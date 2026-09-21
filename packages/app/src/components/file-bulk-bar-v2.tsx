import { For } from "solid-js"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { Icon } from "@opencode-ai/ui/v2/icon"
import { useLanguage } from "@/context/language"
import { bulkActions, type BulkAction } from "@/components/file-selection-model"

const actionKeys = {
  download: "file.bulk.download",
  compress: "file.bulk.compress",
  copy: "file.bulk.copy",
  move: "file.bulk.move",
  delete: "file.bulk.delete",
} as const satisfies Record<BulkAction, string>

const touchTarget = { "min-width": "40px", "min-height": "40px" } as const

export function FileBulkBarV2(props: { count: number; onAction: (action: BulkAction) => void; onClear: () => void }) {
  const language = useLanguage()
  const label = () => language.t("file.selection.count", { count: props.count })

  return (
    <div
      data-slot="file-bulk-bar-v2"
      role="toolbar"
      aria-label={label()}
      class="fixed inset-x-0 bottom-0 z-40 flex flex-wrap items-center gap-1 border-t border-v2-border-border-base bg-v2-background-bg-base px-2 pt-2"
      style={{ "padding-bottom": "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}
    >
      <IconButtonV2
        type="button"
        size="normal"
        variant="ghost-muted"
        style={touchTarget}
        aria-label={language.t("file.selection.clear")}
        title={language.t("file.selection.clear")}
        onClick={props.onClear}
        icon={<Icon name="xmark-small" size="small" />}
      />
      <span class="text-12-medium text-v2-text-text-muted">{label()}</span>
      <span class="min-w-1 flex-1" />
      <For each={bulkActions(props.count)}>
        {(action) => (
          <ButtonV2
            type="button"
            variant={action === "delete" ? "danger" : "ghost"}
            size="normal"
            style={touchTarget}
            onClick={() => props.onAction(action)}
          >
            {language.t(actionKeys[action])}
          </ButtonV2>
        )}
      </For>
    </div>
  )
}
