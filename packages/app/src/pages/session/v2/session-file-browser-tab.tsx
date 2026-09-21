import { createMemo, createSignal, createUniqueId, Show } from "solid-js"
import { createQuery, keepPreviousData } from "@tanstack/solid-query"
import { Icon } from "@opencode-ai/ui/icon"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { SessionFilePanelV2, SessionFilePanelV2Empty } from "@opencode-ai/session-ui/v2/session-file-panel-v2"
import { SessionReviewV2Sidebar } from "@opencode-ai/session-ui/v2/session-review-v2"
import FileTreeV2, { type Kind } from "@/components/file-tree-v2"
import type { FileTreeV2Node } from "@/components/file-tree-v2-model"
import { ConfirmDialogV2 } from "@/components/dialog-confirm-v2"
import { FileManagerMenu, FileManagerPromptV2, FileManagerToolbar } from "@/components/file-manager-v2"
import {
  newTargetPath,
  parentPath,
  type FileManagerAction,
  type FileManagerNode,
} from "@/components/file-manager-v2-model"
import { FileUploadDropzone, FileUploadProgress, FileUploadV2, createFileUploader } from "@/components/file-upload-v2"
import { useFile } from "@/context/file"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { useSDK } from "@/context/sdk"
import { displayName } from "@/pages/layout/helpers"
import { useSessionLayout } from "@/pages/session/session-layout"
import { SessionFileView } from "@/pages/session/file-tabs"
import { applyFileListKeyDown, SessionFileListV2 } from "@/pages/session/v2/session-file-list-v2"
import { showToast } from "@/utils/toast"
import { pathKey } from "@/utils/path-key"

const emptyFiles: string[] = []

export type SessionFileBrowserState = {
  sidebarOpened: () => boolean
  sidebarWidth: () => number
  sidebarTransition: () => boolean
  resizeSidebar: (width: number) => void
  toggleSidebar: () => void
}

export function SessionFileBrowserTab(props: {
  tab: string
  placeholder: boolean
  active?: string
  kinds: ReadonlyMap<string, Kind>
  state: SessionFileBrowserState
  onSelect: (path: string) => void
  onSelectPermanent: (path: string) => void
  filterRef?: (element: HTMLInputElement) => void
}) {
  const file = useFile()
  const language = useLanguage()
  const layout = useLayout()
  const sdk = useSDK()
  const dialog = useDialog()
  const { workspaceKey } = useSessionLayout()
  const resultsID = `session-file-browser-results-${createUniqueId()}`
  const [filter, setFilter] = createSignal("")
  const [explicitHighlight, setExplicitHighlight] = createSignal<string>()
  const [menu, setMenu] = createSignal<{ node: FileManagerNode; point: { x: number; y: number } }>()
  const [activeNode, setActiveNode] = createSignal<FileManagerNode>()
  let openUpload: (() => void) | undefined
  const sidebarOpened = () => props.placeholder || props.state.sidebarOpened()
  const query = createMemo(() => filter().trim())
  const search = createQuery(() => {
    const value = query()
    return {
      queryKey: ["session-open-file", workspaceKey(), value] as const,
      enabled: value.length > 0,
      queryFn: ({ signal }) => file.searchFiles(value, { limit: 200, signal }),
      placeholderData: keepPreviousData,
    }
  })
  const files = createMemo(() => {
    if (!query() || search.isPending) return emptyFiles
    return [...new Set(search.data ?? emptyFiles)]
  })
  const highlighted = createMemo(() => {
    const values = files()
    if (values.length === 0) return undefined
    const explicit = explicitHighlight()
    if (explicit && values.includes(explicit)) return explicit
    return values[0]
  })
  const loading = createMemo(() => query().length > 0 && search.isPending)
  const project = createMemo(() => {
    const directory = pathKey(sdk().directory)
    return layout.projects
      .list()
      .find(
        (item) =>
          pathKey(item.worktree) === directory || item.sandboxes?.some((sandbox) => pathKey(sandbox) === directory),
      )
  })
  const title = createMemo(() => displayName(project() ?? { worktree: sdk().directory }))
  const optionID = (path: string) => `${resultsID}-option-${files().indexOf(path)}`
  const activeDirectory = () => {
    const node = activeNode()
    if (!node) return sdk().directory
    return node.type === "directory" ? node.path : parentPath(node.path)
  }

  const uploader = createFileUploader({
    upload: (target, data) => file.ops.upload(target, data),
    warn: (files) => window.confirm(language.t("file.manager.uploadWarning", { count: files.length })),
    onComplete: (state) => {
      if (state.failed > 0) {
        showToast({ variant: "error", title: language.t("file.manager.uploadFailed", { count: state.failed }) })
        return
      }
      showToast({ variant: "success", title: language.t("file.manager.uploaded") })
    },
  })

  const openPrompt = (title: string, confirmLabel: string, initialValue: string, onConfirm: (value: string) => void) =>
    dialog.show(() => (
      <FileManagerPromptV2
        title={title}
        confirmLabel={confirmLabel}
        initialValue={initialValue}
        onConfirm={onConfirm}
      />
    ))

  const createFile = (directory: string) =>
    openPrompt(language.t("file.manager.newFile"), language.t("file.manager.create"), "", (name) => {
      void file.ops.write(newTargetPath(directory, name), "")
    })

  const createFolder = (directory: string) =>
    openPrompt(language.t("file.manager.newFolder"), language.t("file.manager.create"), "", (name) => {
      void file.ops.mkdir(newTargetPath(directory, name))
    })

  const renameNode = (node: FileManagerNode) =>
    openPrompt(language.t("file.manager.rename"), language.t("file.manager.rename"), node.name, (name) => {
      void file.ops.rename(node.path, newTargetPath(parentPath(node.path), name))
    })

  const deleteNode = (node: FileManagerNode) =>
    dialog.show(() => (
      <ConfirmDialogV2
        title={language.t("file.confirm.delete.title", { name: node.name })}
        description={language.t("file.confirm.delete.description")}
        confirmLabel={language.t("file.manager.delete")}
        destructive
        requireTypedName={node.type === "directory" ? node.name : undefined}
        onConfirm={() => void file.ops.remove(node.path, node.type === "directory")}
      />
    ))

  const downloadNode = (node: FileManagerNode) => {
    const anchor = document.createElement("a")
    anchor.href = file.ops.downloadUrl(node.path, location.origin)
    anchor.download = node.name
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  const runAction = (action: FileManagerAction, node: FileManagerNode) => {
    if (action === "newFile") return createFile(node.path)
    if (action === "newFolder") return createFolder(node.path)
    if (action === "rename") return renameNode(node)
    if (action === "delete") return deleteNode(node)
    downloadNode(node)
  }

  const openNodeMenu = (node: FileTreeV2Node, event: MouseEvent) => {
    setActiveNode({ type: node.type, path: node.path, name: node.name })
    setMenu({ node: { type: node.type, path: node.path, name: node.name }, point: { x: event.clientX, y: event.clientY } })
  }

  const onFilterKeyDown = (event: KeyboardEvent & { currentTarget: HTMLInputElement }) => {
    if (event.key === "Escape" && query()) {
      event.preventDefault()
      setFilter("")
      return
    }
    if (!query()) return
    applyFileListKeyDown(event, files(), highlighted(), {
      onHighlight: setExplicitHighlight,
      onSelect: props.onSelectPermanent,
    })
  }

  // Keep the sidebar outside Kobalte Tabs.Content: a morphing content value
  // unmounts the whole panel on every file-tab switch and resets sidebar scroll.
  return (
    <>
      <SessionFilePanelV2
        toolbar
        toolbarStart={
          <FileManagerToolbar
            onNewFile={() => createFile(activeDirectory())}
            onNewFolder={() => createFolder(activeDirectory())}
            onUpload={() => openUpload?.()}
            onRefresh={() => void file.tree.refresh(activeDirectory())}
          />
        }
        toolbarEnd={<FileUploadProgress state={uploader.state()} />}
        sidebar={
          <SessionReviewV2Sidebar
            open={sidebarOpened()}
            transition={props.state.sidebarTransition()}
            title={<span class="truncate">{title()}</span>}
            filter={filter()}
            onFilterChange={setFilter}
            onFilterKeyDown={onFilterKeyDown}
            filterAutofocus={props.placeholder}
            filterRef={props.filterRef}
            filterControls={resultsID}
            filterActiveDescendant={highlighted() ? optionID(highlighted()!) : undefined}
            filterExpanded={query().length > 0 && files().length > 0}
            width={props.state.sidebarWidth()}
            onWidthChange={props.state.resizeSidebar}
          >
            <Show
              when={query()}
              fallback={
                <FileUploadDropzone
                  onFiles={(files) => void uploader.enqueue(files, activeDirectory())}
                >
                  <FileTreeV2
                    active={props.active}
                    kinds={props.kinds}
                    onFileClick={(node) => props.onSelect(node.path)}
                    onFileDoubleClick={(node) => props.onSelectPermanent(node.path)}
                    onContextMenu={openNodeMenu}
                    onActiveChange={(node) =>
                      setActiveNode({ type: node.type, path: node.path, name: node.name })
                    }
                  />
                </FileUploadDropzone>
              }
            >
              <Show
                when={!loading()}
                fallback={
                  <div role="status" class="px-2 py-2 text-12-regular text-text-weak">
                    {language.t("common.loading")}
                    {language.t("common.loading.ellipsis")}
                  </div>
                }
              >
                <Show
                  when={files().length > 0}
                  fallback={
                    <div role="status" class="px-2 py-2 text-12-regular text-text-weak">
                      {language.t("palette.empty")}
                    </div>
                  }
                >
                  <SessionFileListV2
                    id={resultsID}
                    role="listbox"
                    optionID={optionID}
                    files={files()}
                    kinds={props.kinds}
                    active={props.active}
                    highlighted={highlighted()}
                    onFileClick={(path) => {
                      setExplicitHighlight(path)
                      props.onSelect(path)
                    }}
                    onFileDoubleClick={props.onSelectPermanent}
                  />
                </Show>
              </Show>
            </Show>
          </SessionReviewV2Sidebar>
        }
      >
        <Show
          when={!props.placeholder}
          fallback={
            <SessionFilePanelV2Empty>
              <div class="flex flex-col items-center gap-3 text-center text-text-weak">
                <Icon name="file-tree" size="large" />
                <div class="text-14-medium text-text-strong">{language.t("command.file.open")}</div>
                <div class="text-13-regular">{language.t("session.files.selectToOpen")}</div>
              </div>
            </SessionFilePanelV2Empty>
          }
        >
          <div class="min-h-0 flex-1">
            <Show when={props.tab} keyed>
              {(tab) => <SessionFileView tab={tab} />}
            </Show>
          </div>
        </Show>
      </SessionFilePanelV2>
      <Show when={menu()}>
        {(current) => (
          <FileManagerMenu
            node={current().node}
            point={current().point}
            onClose={() => setMenu(undefined)}
            onAction={(action) => {
              const node = current().node
              setMenu(undefined)
              runAction(action, node)
            }}
          />
        )}
      </Show>
      <FileUploadV2
        onFiles={(files) => void uploader.enqueue(files, activeDirectory())}
        onOpenReady={(open) => {
          openUpload = open
        }}
      />
    </>
  )
}
