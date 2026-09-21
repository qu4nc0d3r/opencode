import { For, type ParentProps } from "solid-js"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { Icon as IconV1 } from "@opencode-ai/ui/icon"
import { Icon } from "@opencode-ai/ui/v2/icon"
import { useLanguage } from "@/context/language"
import type { FileBreadcrumbSegment } from "@/components/file-manager-toolbar-model"

const touchTarget = { "min-width": "40px", "min-height": "40px" } as const

const normalizeDir = (value: string) => value.replace(/^\/+|\/+$/g, "")

export function FileManagerToolbarV2(
  props: ParentProps<{
    breadcrumb: FileBreadcrumbSegment[]
    currentDir: string
    onNavigate: (path: string) => void
    onNewFile: () => void
    onNewFolder: () => void
    onUpload: () => void
    onRefresh: () => void
    onToggleHidden: () => void
    showHidden: boolean
    onExpandAll: () => void
    onCollapseAll: () => void
  }>,
) {
  const language = useLanguage()
  const rootLabel = () => language.t("file.tree.root")
  const hiddenLabel = () => (props.showHidden ? language.t("file.tree.hidden.hide") : language.t("file.tree.hidden.show"))
  const atRoot = () => normalizeDir(props.currentDir).length === 0
  const atSegment = (segment: FileBreadcrumbSegment) => normalizeDir(segment.path) === normalizeDir(props.currentDir)

  return (
    <div data-slot="file-manager-v2-toolbar" class="sticky top-0 z-20 flex flex-col gap-0.5 bg-v2-background-bg-base pb-1">
      <nav
        data-slot="file-manager-v2-breadcrumb"
        aria-label={language.t("file.breadcrumb.aria")}
        class="flex items-center gap-0.5 overflow-x-auto px-1 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <IconButtonV2
          type="button"
          size="normal"
          variant={atRoot() ? "ghost" : "ghost-muted"}
          state={atRoot() ? "pressed" : "rest"}
          style={touchTarget}
          aria-label={rootLabel()}
          title={rootLabel()}
          aria-current={atRoot() ? "location" : undefined}
          onClick={() => props.onNavigate("")}
          icon={<Icon name="folder" size="small" />}
        />
        <For each={props.breadcrumb}>
          {(segment) => (
            <>
              <span aria-hidden="true" class="shrink-0 text-12-regular text-v2-text-text-faint">
                /
              </span>
              <button
                type="button"
                data-slot="file-manager-v2-breadcrumb-segment"
                class="flex h-10 max-w-36 shrink-0 items-center rounded-md px-2 text-12-regular text-v2-text-text-muted hover:bg-v2-overlay-simple-overlay-hover"
                aria-current={atSegment(segment) ? "location" : undefined}
                title={segment.path}
                onClick={() => props.onNavigate(segment.path)}
              >
                <bdi dir="auto" class="truncate">
                  {segment.name}
                </bdi>
              </button>
            </>
          )}
        </For>
      </nav>
      <div
        data-slot="file-manager-v2-actions"
        role="toolbar"
        aria-label={language.t("file.toolbar.aria")}
        class="flex flex-wrap items-center gap-0.5 px-1"
      >
        <ButtonV2
          variant="ghost"
          icon="plus"
          size="normal"
          style={touchTarget}
          aria-label={language.t("file.manager.newFile")}
          onClick={props.onNewFile}
        >
          <span class="hidden sm:inline">{language.t("file.manager.newFile")}</span>
        </ButtonV2>
        <ButtonV2
          variant="ghost"
          icon="folder-add-left"
          size="normal"
          style={touchTarget}
          aria-label={language.t("file.manager.newFolder")}
          onClick={props.onNewFolder}
        >
          <span class="hidden sm:inline">{language.t("file.manager.newFolder")}</span>
        </ButtonV2>
        <ButtonV2
          variant="ghost"
          icon="outline-share"
          size="normal"
          style={touchTarget}
          aria-label={language.t("file.manager.upload")}
          onClick={props.onUpload}
        >
          <span class="hidden sm:inline">{language.t("file.manager.upload")}</span>
        </ButtonV2>
        <ButtonV2
          variant="ghost"
          icon="outline-reset"
          size="normal"
          style={touchTarget}
          aria-label={language.t("file.manager.refresh")}
          onClick={props.onRefresh}
        >
          <span class="hidden sm:inline">{language.t("file.manager.refresh")}</span>
        </ButtonV2>
        <span class="min-w-1 flex-1" />
        <IconButtonV2
          type="button"
          size="normal"
          variant="ghost-muted"
          style={touchTarget}
          aria-label={language.t("file.tree.expandAll")}
          title={language.t("file.tree.expandAll")}
          onClick={props.onExpandAll}
          icon={<Icon name="expand" size="small" />}
        />
        <IconButtonV2
          type="button"
          size="normal"
          variant="ghost-muted"
          style={touchTarget}
          aria-label={language.t("file.tree.collapseAll")}
          title={language.t("file.tree.collapseAll")}
          onClick={props.onCollapseAll}
          icon={<Icon name="collapse" size="small" />}
        />
        <IconButtonV2
          type="button"
          size="normal"
          variant={props.showHidden ? "ghost" : "ghost-muted"}
          style={touchTarget}
          aria-pressed={props.showHidden}
          aria-label={hiddenLabel()}
          title={hiddenLabel()}
          onClick={props.onToggleHidden}
          icon={<IconV1 name="eye" size="small" />}
        />
      </div>
      {props.children}
    </div>
  )
}
