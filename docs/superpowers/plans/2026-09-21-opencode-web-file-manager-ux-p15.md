# opencode web File Manager UI/UX Upgrade (P1.5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng file manager/picker/editor của fork lên mức dùng hằng ngày trên mobile: cây file + menu native, CodeMirror, copy/move/zip, multi-select, preview/info, bottom sheet + PWA.

**Architecture:** 3 wave độc lập (A cây file + editor, B copy/move/zip + multi-select, C preview/info/polish). Mỗi wave: TDD cho logic thuần, build qua GitHub Actions, deploy artifact lên VPS, test thật trên mobile trước khi sang wave sau.

**Tech Stack:** SolidJS, `@opencode-ai/ui` v2 (`MenuV2`, `DialogV2`), CodeMirror 6 (lazy-load), Effect HttpApi, `fflate`, Bun test, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-21-opencode-web-file-manager-ux-design.md`

## Global Constraints

- Repo: `C:\Users\minha\dev\opencode`, branch `custom-fs`, `origin` = fork. Bun 1.4.2, deps đã cài.
- Test app: `bun test --conditions=solid --preload ./happydom.ts <file>` (cwd `packages/app`). Test server: `bun test --timeout 30000 <file>` (cwd `packages/opencode`).
- Server endpoint mới theo pattern P1 trong `packages/opencode/src/server/routes/instance/httpapi/groups/file.ts` + `handlers/file.ts`; query phải có `...WorkspaceRoutingQueryFields`; mutation phải ghi audit (`AuditLog.record`, xem `packages/opencode/src/file/audit.ts`).
- API full filesystem (absolute path), reject path rỗng/NUL. Zip: chống zip-slip + giới hạn giải nén.
- Menu: dùng `MenuV2` từ `@opencode-ai/ui/v2/components/menu-v2` (`MenuV2.Context` cho right-click). Không tự chế popover nữa.
- Toolbar render trong children của `SessionReviewV2Sidebar` (không đụng package `session-ui`).
- **i18n**: mỗi wave chỉ **một** agent được sửa `packages/app/src/i18n/**` (chỉ định rõ trong task); agent khác dùng chuỗi tiếng Anh literal và liệt kê lại trong report. Sau khi sync phải chạy `bun test --conditions=solid --preload ./happydom.ts src/i18n/parity.test.ts`.
- Mỗi agent KHÔNG commit/push (orchestrator commit theo wave).
- Luôn giữ `bun run typecheck` không phát sinh lỗi mới (lỗi Windows symlink `custom-elements.d.ts` là pre-existing, bỏ qua).

## Execution waves (cho orchestrator)

| Wave | Task | Agent | Song song với |
|---|---|---|---|
| A | A1 toolbar/breadcrumb/tree UX → A2 MenuV2 + long-press | Agent A (1 agent, tuần tự, sở hữu i18n wave A) | Agent B (A3 editor) |
| A | A3 CodeMirror editor | Agent B | Agent A |
| B | B1 server copy/archive/extract | Agent C | Agent D (B2→B3→B4) |
| B | B2 client ops → B3 multi-select → B4 zip UX | Agent D (sở hữu i18n wave B) | Agent C |
| C | C1 preview | Agent E | Agent F (C2→C3) |
| C | C2 info endpoint+panel → C3 sheet + PWA verify | Agent F (sở hữu i18n wave C) | Agent E |
| — | build + deploy + E2E mỗi wave | orchestrator | — |

---

## WAVE A — Cây file + Editor

### Task A1: Toolbar đúng chỗ + breadcrumb + tree UX

**Files:**
- Create: `packages/app/src/components/file-manager-toolbar-v2.tsx`
- Create: `packages/app/src/components/file-manager-toolbar-model.ts` + `.test.ts`
- Modify: `packages/app/src/pages/session/v2/session-file-browser-tab.tsx`
- Modify: `packages/app/src/components/file-tree-v2.tsx` (props: `hidden`, `filter`, `activePath` highlight đã có sẵn)
- Modify: `packages/app/src/i18n/en.ts` (+ sync script `packages/app/scripts/custom-i18n-sync.ts`)

**Interfaces:**
- Produces:
  - `breadcrumbSegments(root: string, current: string): Array<{ name: string; path: string }>` (pure)
  - `shouldShowEntry(node: { name: string; ignored?: boolean }, showHidden: boolean): boolean` (pure)
  - `<FileManagerToolbar props={{ breadcrumb, currentDir, onNavigate, onNewFile, onNewFolder, onUpload, onRefresh, onToggleHidden, showHidden, onExpandAll, onCollapseAll }} />`

- [ ] **Step 1: Test model (RED)**

`file-manager-toolbar-model.test.ts`:
```ts
import { describe, expect, test } from "bun:test"
import { breadcrumbSegments, shouldShowEntry } from "./file-manager-toolbar-model"

describe("breadcrumbSegments", () => {
  test("returns root-relative segments", () => {
    expect(breadcrumbSegments("/root/project", "/root/project/src/lib")).toEqual([
      { name: "project", path: "/root/project" },
      { name: "src", path: "/root/project/src" },
      { name: "lib", path: "/root/project/src/lib" },
    ])
  })
  test("returns empty for the root itself", () => {
    expect(breadcrumbSegments("/root/project", "/root/project")).toEqual([])
  })
})

describe("shouldShowEntry", () => {
  test("hides dotfiles and ignored entries by default", () => {
    expect(shouldShowEntry({ name: ".env", ignored: false }, false)).toBe(false)
    expect(shouldShowEntry({ name: "dist", ignored: true }, false)).toBe(false)
    expect(shouldShowEntry({ name: "src", ignored: false }, false)).toBe(true)
  })
  test("shows everything when enabled", () => {
    expect(shouldShowEntry({ name: ".env", ignored: true }, true)).toBe(true)
  })
})
```

- [ ] **Step 2: Chạy RED**

Run: `bun test --conditions=solid --preload ./happydom.ts src/components/file-manager-toolbar-model.test.ts` (cwd `packages/app`)
Expected: FAIL module not found.

- [ ] **Step 3: Implement model**

```ts
export function breadcrumbSegments(root: string, current: string) {
  const base = root.replace(/\/+$/, "")
  const value = current.replace(/\/+$/, "")
  if (!value || value === base) return []
  const relative = value.startsWith(base + "/") ? value.slice(base.length + 1) : value
  const parts = relative.split("/").filter(Boolean)
  return parts.map((name, index) => ({ name, path: `${base}/${parts.slice(0, index + 1).join("/")}` }))
}

export function shouldShowEntry(node: { name: string; ignored?: boolean }, showHidden: boolean) {
  if (showHidden) return true
  if (node.name.startsWith(".")) return false
  return !node.ignored
}
```

- [ ] **Step 4: Toolbar component + wiring**

- Toolbar render **đầu children** của `SessionReviewV2Sidebar` trong `session-file-browser-tab.tsx` (trên `<FileTreeV2>`): một hàng breadcrumb (ngang, scroll được, segment click → `file.tree.expand` cho các cấp + set `currentDir`) + một hàng nút icon (New file, New folder, Upload, Refresh, Expand all, Collapse all, toggle `👁` hidden).
- State mới trong browser tab: `const [currentDir, setCurrentDir] = createSignal(directory)`, `const [showHidden, setShowHidden] = createSignal(false)`.
- `FileTreeV2` nhận thêm props `hidden?: (node) => boolean` và lọc rows bằng `shouldShowEntry` (truyền callback từ browser tab; giữ default cũ khi không truyền).
- Nút New file/New folder/Upload/Refresh giữ nguyên handlers từ P1 (`file.ops`, dialog prompt) nhưng đổi vị trí.

- [ ] **Step 5: i18n keys + sync**

Thêm key mới vào `en.ts`: `file.tree.root`, `file.tree.hidden.show`, `file.tree.hidden.hide`, `file.tree.expandAll`, `file.tree.collapseAll`, `file.breadcrumb.aria`, `file.toolbar.aria`. Chạy sync script:
`bun scripts/custom-i18n-sync.ts` (cwd `packages/app`) rồi `bun test --conditions=solid --preload ./happydom.ts src/i18n/parity.test.ts`.

- [ ] **Step 6: Test + typecheck**

Run: `bun test --conditions=solid --preload ./happydom.ts src/components/file-manager-toolbar-model.test.ts src/i18n/parity.test.ts && bun run typecheck`
Expected: pass (trừ lỗi symlink pre-existing).

---

### Task A2: MenuV2 context menu + long-press

**Files:**
- Rewrite: `packages/app/src/components/file-manager-v2.tsx` (bỏ popover tự chế, dùng `MenuV2`)
- Modify: `packages/app/src/components/file-manager-v2-model.ts` + `.test.ts` (giữ `fileManagerMenuItems`, thêm `longPressDecision`)
- Modify: `packages/app/src/components/file-tree-v2.tsx` (long-press + dispatch contextmenu)
- Modify: `packages/app/src/pages/session/v2/session-file-browser-tab.tsx` (menu items wiring, dùng `MenuV2.Context`)
- Modify: `packages/app/src/components/dialog-confirm-v2.tsx` (giữ nguyên API; Wave C sẽ thay bằng sheet)

**Interfaces:**
- Consumes: `MenuV2.Context`, `file.ops` (P1), `fileManagerMenuItems` (P1).
- Produces: `longPressDecision(input: { moved: number; durationMs: number }): "open" | "cancel"` (pure, `moved <= 10 && durationMs >= 500`).

- [ ] **Step 1: Test long-press helper (RED→GREEN)**

Thêm test vào `file-manager-v2-model.test.ts`:
```ts
test("long press opens only when still and long enough", () => {
  expect(longPressDecision({ moved: 0, durationMs: 600 })).toBe("open")
  expect(longPressDecision({ moved: 24, durationMs: 600 })).toBe("cancel")
  expect(longPressDecision({ moved: 0, durationMs: 300 })).toBe("cancel")
})
```
Implement:
```ts
export function longPressDecision(input: { moved: number; durationMs: number }) {
  return input.moved <= 10 && input.durationMs >= 500 ? ("open" as const) : ("cancel" as const)
}
```

- [ ] **Step 2: Long-press → contextmenu event trong `FileTreeV2`**

Thêm handler trên mỗi row (dùng `pointerdown/pointermove/pointerup/pointercancel` với `{ passive: true }`, timer 500ms):
```ts
const startLongPress = (event: PointerEvent, element: HTMLElement) => {
  const startX = event.clientX
  const startY = event.clientY
  const startedAt = Date.now()
  let moved = 0
  const move = (e: PointerEvent) => {
    moved = Math.max(moved, Math.hypot(e.clientX - startX, e.clientY - startY))
  }
  const finish = () => {
    clearTimeout(timer)
    element.removeEventListener("pointermove", move)
    element.removeEventListener("pointerup", finish)
    element.removeEventListener("pointercancel", finish)
  }
  const timer = setTimeout(() => {
    if (longPressDecision({ moved, durationMs: Date.now() - startedAt }) !== "open") return finish()
    element.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: startX, clientY: startY }))
    finish()
  }, 520)
  element.addEventListener("pointermove", move)
  element.addEventListener("pointerup", finish)
  element.addEventListener("pointercancel", finish)
}
```
Gắn vào `FileTreeNodeV2` qua prop `onPointerDown`.

- [ ] **Step 3: Menu dùng `MenuV2.Context`**

Rewrite `file-manager-v2.tsx`:
```tsx
import { MenuV2 } from "@opencode-ai/ui/v2/components/menu-v2"

export function FileManagerContextMenu(props: {
  node: { type: "file" | "directory"; path: string; name: string }
  onAction: (action: FileManagerAction) => void
  children: JSX.Element
}) {
  return (
    <MenuV2.Context>
      {(trigger) => (
        <span {...trigger} class="contents">{props.children}</span>
      )}
      <MenuV2.Portal>
        <MenuV2.Content>
          <For each={fileManagerMenuItems(props.node)}>
            {(item) => (
              <MenuV2.Item onSelect={() => props.onAction(item)}>
                {labelFor(item)}
              </MenuV2.Item>
            )}
          </For>
        </MenuV2.Content>
      </MenuV2.Portal>
    </MenuV2.Context>
  )
}
```
Lưu ý: kiểm tra export path thật của `MenuV2` trong `packages/ui/package.json` (`./v2/*`) trước khi import; nếu `MenuV2.Context` nhận `children` trigger khác kiểu thì đọc `menu-v2.tsx` và adapt (báo lại trong report).

- [ ] **Step 4: Wiring trong browser tab**

- Bọc mỗi row trong `FileManagerContextMenu` (hoặc bọc container và chọn node theo `event.target.closest("[data-path]")`).
- Action Copy/Move/Extract chỉ hiện khi Wave B có (`fileManagerMenuItems` nhận cờ `features: { copy: boolean; zip: boolean }`; giữ mặc định false ở wave A).
- Nút `⋯` (mobile) vẫn giữ: tap → mở menu tại vị trí nút (dispatch contextmenu như long-press).

- [ ] **Step 5: Test + typecheck**

Run: `bun test --conditions=solid --preload ./happydom.ts src/components/file-manager-v2-model.test.ts && bun run typecheck`

---

### Task A3: CodeMirror 6 editor (lazy-load)

**Files:**
- Modify: `packages/app/package.json` (deps mới)
- Create: `packages/app/src/pages/session/v2/file-editor-codemirror.ts`
- Create: `packages/app/src/pages/session/v2/file-editor-language.ts` + `.test.ts`
- Rewrite: `packages/app/src/pages/session/v2/file-editor-v2.tsx` (giữ nguyên props API hiện có)
- Modify: `packages/app/src/pages/session/file-tabs.tsx` (save-guard: chặn đóng tab/đổi file/beforeunload)

**Interfaces:**
- Produces: `languageNameFor(path: string): string | undefined`; `createCodeMirrorEditor(input: { parent: HTMLElement; path: string; value: string; onSave: (value: string) => void; onChange: (value: string) => void }): { destroy(): void; getValue(): string }` (async, dynamic import).

- [ ] **Step 1: Cài deps**

Run (repo root): `bun add --cwd packages/app codemirror @codemirror/state @codemirror/view @codemirror/commands @codemirror/search @codemirror/language-data`
Expected: `packages/app/package.json` + `bun.lock` cập nhật.

- [ ] **Step 2: Test language mapping (RED→GREEN)**

`file-editor-language.test.ts`:
```ts
import { describe, expect, test } from "bun:test"
import { languageNameFor } from "./file-editor-language"

describe("languageNameFor", () => {
  test("maps common extensions", () => {
    expect(languageNameFor("a.ts")).toBe("typescript")
    expect(languageNameFor("b.py")).toBe("python")
    expect(languageNameFor("c.unknown")).toBeUndefined()
  })
})
```
Implement map (không phụ thuộc CodeMirror để test nhanh):
```ts
const LANGUAGES: Record<string, string> = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript", json: "json", css: "css", scss: "scss",
  html: "html", md: "markdown", py: "python", go: "go", rs: "rust",
  java: "java", sh: "shell", bash: "shell", yaml: "yaml", yml: "yaml",
  sql: "sql", toml: "toml", xml: "xml",
}
export function languageNameFor(path: string) {
  const base = path.split(/[\\/]/).pop() ?? ""
  const dot = base.lastIndexOf(".")
  if (dot <= 0) return undefined
  return LANGUAGES[base.slice(dot + 1).toLowerCase()]
}
```

- [ ] **Step 3: Module CodeMirror (lazy)**

`file-editor-codemirror.ts`:
```ts
import { EditorState } from "@codemirror/state"
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection, dropCursor } from "@codemirror/view"
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands"
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search"
import { bracketMatching, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language"
import { languages } from "@codemirror/language-data"

async function languageExtension(path: string) {
  const base = path.split(/[\\/]/).pop() ?? ""
  const dot = base.lastIndexOf(".")
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : ""
  const description = languages.find((item) => item.extensions.includes(ext) || item.alias.includes(ext))
  return description?.load()
}

export async function createCodeMirrorEditor(input: {
  parent: HTMLElement
  path: string
  value: string
  onSave: (value: string) => void
  onChange: (value: string) => void
}) {
  const language = await languageExtension(input.path)
  const theme = EditorView.theme({
    "&": { height: "100%", fontSize: "12px", backgroundColor: "transparent" },
    ".cm-content": { fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)", padding: "8px 0" },
    ".cm-gutters": { backgroundColor: "transparent", border: "none", color: "var(--v2-text-faint, #666)" },
    "&.cm-focused": { outline: "none" },
  })
  const state = EditorState.create({
    doc: input.value,
    extensions: [
      lineNumbers(),
      history(),
      drawSelection(),
      dropCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      indentOnInput(),
      bracketMatching(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      EditorView.lineWrapping,
      keymap.of([
        { key: "Mod-s", preventDefault: true, run: () => (input.onSave(view.state.doc.toString()), true) },
        indentWithTab,
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) input.onChange(update.state.doc.toString())
      }),
      theme,
      ...(language ? [language] : []),
    ],
  })
  const view = new EditorView({ state, parent: input.parent })
  return { destroy: () => view.destroy(), getValue: () => view.state.doc.toString() }
}
```

- [ ] **Step 4: Rewrite `file-editor-v2.tsx` để lazy-load**

Giữ nguyên props hiện có (`value`, `onInput`/`onChange`, `onSave`, `saving`, `onRevert`) nhưng thân component:
```tsx
const [host, setHost] = createSignal<HTMLDivElement>()
let instance: { destroy(): void } | undefined
onMount(() => {
  void (async () => {
    const { createCodeMirrorEditor } = await import("./file-editor-codemirror")
    if (!host()) return
    instance = await createCodeMirrorEditor({ parent: host()!, path: props.path, value: props.value, onSave: props.onSave, onChange: props.onChange })
  })()
})
onCleanup(() => instance?.destroy())
```
Fallback khi dynamic import lỗi (offline/asset cũ): render `<textarea>` như P1 (giữ code cũ trong nhánh `Show`).

- [ ] **Step 5: Save-guard**

Trong `file-tabs.tsx` (V2 view):
- Chặn đổi file: khi `hasUnsaved()` và người dùng bấm mở file khác → mở dialog 3 lựa chọn (`Save` / `Discard` / `Cancel`); chỉ chuyển khi Save thành công hoặc Discard.
- Chặn đóng tab: tìm API đóng tab trong `useLayout()`/tab store (`layout.tabs`), bọc handler tương tự.
- `beforeunload`: `useEffect`-kiểu Solid — `window.addEventListener("beforeunload", (e) => { if (hasUnsaved()) e.preventDefault() })` + cleanup.

- [ ] **Step 6: Test + typecheck + build thử app**

Run: `bun test --conditions=solid --preload ./happydom.ts src/pages/session/v2/file-editor-model.test.ts src/pages/session/v2/file-editor-language.test.ts && bun run typecheck`
Expected: pass. (Build thật sẽ do CI lo.)

---

## WAVE B — Copy/Move/Zip + Multi-select

### Task B1: Server `copy` / `archive` / `extract`

**Files:**
- Modify: `packages/opencode/package.json` (`fflate`)
- Modify: `packages/opencode/src/server/routes/instance/httpapi/groups/file.ts`
- Modify: `packages/opencode/src/server/routes/instance/httpapi/handlers/file.ts`
- Modify: `packages/opencode/test/server/httpapi-file-mutations.test.ts`

**Interfaces:**
- Produces:
  - `POST /file/copy` `{ from, to, overwrite?: boolean }` → `{ path }`
  - `POST /file/archive` `{ paths: string[], dest: string }` → `{ path, bytes }`
  - `POST /file/extract` `{ path, dest?: string }` → `{ path }`
  - `FilePaths.copy`, `.archive`, `.extract`; audit ops `copy`, `archive`, `extract`.
  - Constants: `MAX_EXTRACT_BYTES = 2 * 1024 ** 3`, `MAX_ARCHIVE_INPUT_BYTES = 256 * 1024 ** 2`.

- [ ] **Step 1: Deps**

Run (repo root): `bun add --cwd packages/opencode fflate`

- [ ] **Step 2: Tests (RED)**

Thêm vào `httpapi-file-mutations.test.ts`:
```ts
  test("copy duplicates a directory", async () => {
    await using tmp = await tmpdir({ git: true })
    const from = path.join(tmp.path, "src")
    await fs.mkdir(from)
    await Bun.write(path.join(from, "a.txt"), "x")
    const to = path.join(tmp.path, "dst")

    const response = await post(FilePaths.copy, tmp.path, { from, to })

    expect(response.status).toBe(200)
    expect(await fs.readFile(path.join(to, "a.txt"), "utf8")).toBe("x")
  })

  test("copy refuses to overwrite without the flag", async () => {
    await using tmp = await tmpdir({ git: true })
    const from = path.join(tmp.path, "a.txt")
    const to = path.join(tmp.path, "b.txt")
    await Bun.write(from, "x")
    await Bun.write(to, "y")

    const response = await post(FilePaths.copy, tmp.path, { from, to })

    expect(response.status).toBe(400)
    expect(await fs.readFile(to, "utf8")).toBe("y")
  })

  test("archive and extract round-trip", async () => {
    await using tmp = await tmpdir({ git: true })
    const folder = path.join(tmp.path, "pack")
    await fs.mkdir(folder)
    await Bun.write(path.join(folder, "one.txt"), "1")
    await Bun.write(path.join(folder, "two.txt"), "2")
    const zip = path.join(tmp.path, "pack.zip")

    const archived = await post(FilePaths.archive, tmp.path, { paths: [folder], dest: zip })
    expect(archived.status).toBe(200)

    const out = path.join(tmp.path, "out")
    const extracted = await post(FilePaths.extract, tmp.path, { path: zip, dest: out })
    expect(extracted.status).toBe(200)
    expect(await fs.readFile(path.join(out, "pack", "one.txt"), "utf8")).toBe("1")
  })

  test("extract rejects zip-slip entries", async () => {
    await using tmp = await tmpdir({ git: true })
    const zip = path.join(tmp.path, "evil.zip")
    const { zipSync } = await import("fflate")
    await fs.writeFile(zip, Buffer.from(zipSync({ "../escape.txt": new TextEncoder().encode("x") })))

    const response = await post(FilePaths.extract, tmp.path, { path: zip })

    expect(response.status).toBe(400)
    await expect(fs.stat(path.join(tmp.path, "..", "escape.txt"))).rejects.toThrow()
  })
```

- [ ] **Step 3: Chạy RED**

Run: `cd packages/opencode; bun test --timeout 30000 test/server/httpapi-file-mutations.test.ts`
Expected: FAIL (404).

- [ ] **Step 4: Endpoint declarations**

Trong `groups/file.ts`: thêm `CopyPayload` (`from`, `to`, `overwrite?`), `ArchivePayload` (`paths: Schema.Array(Schema.String)`, `dest`), `ExtractPayload` (`path`, `dest?`), `ArchiveResult` (`path`, `bytes`); paths `copy: "/file/copy"`, `archive: "/file/archive"`, `extract: "/file/extract"`; 3 endpoint POST theo mẫu Task 2 P1 (identifier `file.copy|file.archive|file.extract`, error `[HttpApiError.BadRequest, FileOperationError]`).

- [ ] **Step 5: Handlers**

```ts
    const copy = Effect.fn("FileHttpApi.copy")(function* (ctx: {
      payload: { from: string; to: string; overwrite?: boolean }
    }) {
      const directory = (yield* InstanceState.context).directory
      const from = resolveTarget(directory, ctx.payload.from)
      const to = resolveTarget(directory, ctx.payload.to)
      if (!from || !to) return yield* new FileOperationError({ message: "Invalid path", operation: "copy" })
      const exists = yield* Effect.promise(() => fsPromises.stat(to).then(() => true, () => false))
      if (exists && !ctx.payload.overwrite)
        return yield* new FileOperationError({ message: "Destination exists", operation: "copy", path: to })
      yield* Effect.tryPromise({
        try: async () => {
          await fsPromises.rm(to, { recursive: true, force: true })
          await fsPromises.mkdir(path.dirname(to), { recursive: true })
          await fsPromises.cp(from, to, { recursive: true, force: true })
        },
        catch: (cause) => new FileOperationError({ message: String(cause), operation: "copy", path: to }),
      })
      yield* Effect.promise(() => AuditLog.record({ op: "copy", from, to, ok: true }))
      return { path: to }
    })
```

For archive/extract, use a helper module `packages/opencode/src/file/zip.ts`:
```ts
import { unzipSync, zipSync } from "fflate"
import path from "path"
import { readFile, writeFile, mkdir, stat, readdir } from "fs/promises"

export const MAX_EXTRACT_BYTES = 2 * 1024 ** 3
export const MAX_ARCHIVE_INPUT_BYTES = 256 * 1024 ** 2

async function collectFiles(root: string, base: string, out: Record<string, Uint8Array>, total: { bytes: number }) {
  const info = await stat(root)
  if (info.isDirectory()) {
    for (const entry of await readdir(root, { withFileTypes: true })) {
      await collectFiles(path.join(root, entry.name), base, out, total)
    }
    return
  }
  const name = path.relative(base, root).split(path.sep).join("/")
  const data = new Uint8Array(await readFile(root))
  total.bytes += data.byteLength
  if (total.bytes > MAX_ARCHIVE_INPUT_BYTES) throw new Error("archive input too large")
  out[name] = data
}

function commonParent(paths: string[]) {
  const roots = paths.map((item) => path.resolve(item).split(path.sep))
  const first = roots[0] ?? []
  const shared: string[] = []
  for (let index = 0; index < first.length; index++) {
    if (roots.every((parts) => parts[index] === first[index])) shared.push(first[index])
    else break
  }
  const joined = shared.join(path.sep)
  return joined || path.sep
}

export async function createZip(inputPaths: { paths: string[]; dest: string }) {
  const base = inputPaths.paths.length === 1 ? path.dirname(path.resolve(inputPaths.paths[0]!)) : commonParent(inputPaths.paths)
  const files: Record<string, Uint8Array> = {}
  const total = { bytes: 0 }
  for (const target of inputPaths.paths) await collectFiles(target, base, files, total)
  const archive = zipSync(files)
  await mkdir(path.dirname(inputPaths.dest), { recursive: true })
  await writeFile(inputPaths.dest, archive)
  return { bytes: archive.byteLength }
}

export async function extractZip(input: { path: string; dest: string }) {
  const buffer = new Uint8Array(await readFile(input.path))
  const entries = Object.entries(unzipSync(buffer))
  const dest = path.resolve(input.dest)
  let total = 0
  for (const [name, data] of entries) {
    const target = path.resolve(dest, name)
    if (!(target === dest || target.startsWith(dest + path.sep))) throw new Error(`zip-slip entry: ${name}`)
    total += data.byteLength
    if (total > MAX_EXTRACT_BYTES) throw new Error("extract exceeds size limit")
  }
  for (const [name, data] of entries) {
    const target = path.resolve(dest, name)
    if (name.endsWith("/")) {
      await mkdir(target, { recursive: true })
      continue
    }
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, data)
  }
  return { entries: entries.length }
}
```

- [ ] **Step 6: GREEN + audit**

Run: `cd packages/opencode; bun test --timeout 30000 test/server/httpapi-file-mutations.test.ts test/file/audit.test.ts`
Expected: pass hết (13+ test).

---

### Task B2: Client ops `copy` / `archive` / `extract`

**Files:**
- Modify: `packages/app/src/context/file/ops.ts` + `.test.ts`
- Modify: `packages/app/src/context/file.tsx` (wire thêm api methods)

**Interfaces:**
- Produces: `ops.copy(from, to, overwrite?)`, `ops.archive(paths, dest)`, `ops.extract(path, dest?)`; deps.api thêm `copy`, `archive`, `extract` (flat params như SDK: `{ directory, from, to, paths, dest, path }`).

- [ ] **Step 1: Test (RED)** — thêm vào `ops.test.ts`:
```ts
test("copy calls the api and refreshes destination parent", async () => {
  const { ops, calls, refreshed } = deps()
  await ops.copy("/root/a.txt", "/root/b/c.txt")
  expect(calls[0]).toContain("copy:")
  expect(refreshed).toContain("/root/b")
})

test("extract refreshes the parent of the destination", async () => {
  const { ops, calls, refreshed } = deps()
  await ops.extract("/root/pack.zip")
  expect(calls[0]).toContain("extract:")
  expect(refreshed).toContain("/root")
})
```
(Fake api thêm `copy/archive/extract` ghi vào `calls`.)

- [ ] **Step 2: Implement + GREEN** — theo cùng pattern `run()` của P1; sau `archive` phải refresh đồng thời parent của `dest`.

- [ ] **Step 3: Wire `file.tsx`** — `api.copy/archive/extract` → `serverSDK().client.file.*` (giống P1 đã làm với `write`), giữ `throwOnError: true`.

- [ ] **Step 4: Test + typecheck**

Run: `bun test --conditions=solid --preload ./happydom.ts src/context/file/ops.test.ts && bun run typecheck`

---

### Task B3: Multi-select + bulk action bar

**Files:**
- Create: `packages/app/src/components/file-selection-model.ts` + `.test.ts`
- Create: `packages/app/src/components/file-bulk-bar-v2.tsx`
- Modify: `packages/app/src/pages/session/v2/session-file-browser-tab.tsx`
- Modify: `packages/app/src/components/file-tree-v2.tsx` (checkbox + shift-range)
- Modify: `packages/app/src/i18n/en.ts` (i18n wave B key mới)

**Interfaces:**
- Produces: `createSelectionState()` với `toggle(path)`, `set(paths)`, `range(paths, from, to)`, `clear()`, `has(path)`, `list()`, `count()`; `bulkActions(count: number): Array<"delete" | "copy" | "move" | "download" | "compress">` (pure).

- [ ] **Step 1: Test model (RED)**

```ts
import { describe, expect, test } from "bun:test"
import { createSelectionState, bulkActions } from "./file-selection-model"

describe("selection", () => {
  test("toggles and clears", () => {
    const state = createSelectionState()
    state.toggle("/a")
    state.toggle("/b")
    expect(state.count()).toBe(2)
    expect(state.has("/a")).toBe(true)
    state.toggle("/a")
    expect(state.count()).toBe(1)
    state.clear()
    expect(state.count()).toBe(0)
  })
  test("bulk actions need a selection", () => {
    expect(bulkActions(0)).toEqual([])
    expect(bulkActions(3)).toEqual(["download", "compress", "copy", "move", "delete"])
  })
})
```

- [ ] **Step 2: UI**

- Mobile: long-press vào node → `setSelectionMode(true)` + toggle node đó (long-press đã dùng cho menu — thứ tự: long-press lần đầu mở **menu**; trong menu có item "Select"; hoặc long-press 600ms vs 500ms? **Chốt**: long-press mở menu (A2), menu có "Select"; khi đang ở selection mode thì tap = toggle, long-press = thoát. Đơn giản và không xung đột.)
- Desktop: Ctrl/Cmd-click toggle, Shift-click chọn dải (dùng `rows()` order).
- Checkbox hiển thị bên trái khi selection mode bật.
- `FileBulkBarV2`: fixed bottom bar (`position: fixed; bottom: 0; padding-bottom: env(safe-area-inset-bottom)`), hiển thị `N selected` + nút actions; Delete xác nhận; Download → `ops.archive` vào `${parent}/selection-<ts>.zip` rồi `downloadUrl` + click; Compress tương tự nhưng không tải; Copy/Move → mở `DialogSelectDirectoryV2` (mode directory) → `ops.copy`/`ops.rename` từng path.
- i18n keys mới: `file.selection.count`, `file.selection.clear`, `file.selection.select`, `file.bulk.download`, `file.bulk.compress`, `file.bulk.copy`, `file.bulk.move`, `file.bulk.delete`; chạy sync script + parity test.

- [ ] **Step 3: Test + typecheck**

Run: `bun test --conditions=solid --preload ./happydom.ts src/components/file-selection-model.test.ts src/i18n/parity.test.ts && bun run typecheck`

---

### Task B4: Zip UX (extract here / compress)

**Files:**
- Modify: `packages/app/src/components/file-manager-v2-model.ts` + `.test.ts` (thêm action `extract`, `compress`)
- Modify: `packages/app/src/pages/session/v2/session-file-browser-tab.tsx` (wire handlers)
- Modify: `packages/app/src/i18n/en.ts` (key `file.menu.extract`, `file.menu.compress`)

**Interfaces:**
- `fileManagerMenuItems(node, features: { copy: boolean; zip: boolean })`:
  - folder + zip → `["newFile","newFolder","rename","copy","move","compress","delete"]`
  - file `.zip` + zip → `["open","rename","copy","move","extract","download","delete"]`
  - còn lại giữ như P1.

- [ ] **Step 1: Update tests (RED→GREEN)** cho 3 case trên.
- [ ] **Step 2: Handler wiring**: extract → `ops.extract(path)` + toast; compress → `ops.archive([path], `${path}.zip`)`.
- [ ] **Step 3: Test + sync + typecheck** (như B3).

---

## WAVE C — Preview + Info + Mobile polish

### Task C1: Preview ảnh/video/PDF + zoom

**Files:**
- Modify: `packages/app/src/pages/session/file-tabs.tsx` (viewer switch)
- Create: `packages/app/src/components/file-preview-model.ts` + `.test.ts`
- Create: `packages/app/src/components/file-preview-v2.tsx`

**Interfaces:**
- Produces: `previewKind(mime: string, path: string): "image" | "video" | "pdf" | "markdown" | "text" | "binary"`.

- [ ] **Step 1: Test model (RED→GREEN)** với các case: `image/png` → image; `.mp4` → video; `.pdf` → pdf; `.md` → markdown; `.txt` → text; `.bin` → binary.
- [ ] **Step 2: Component**: nhánh image dùng `<img class="max-h-full max-w-full object-contain" style="touch-action: pinch-zoom">` (zoom bằng pinch native + double-tap để fit/1:1 qua state scale); video `<video controls playsinline>`; pdf `<iframe src={previewUrl} class="w-full h-full" />` (URL `/file/content?path=...` + auth đã có cookie — kiểm tra bằng thực nghiệm, nếu iframe không gửi cookie thì dùng fetch blob + object URL).
- [ ] **Step 3: Wire vào `file-tabs.tsx`**: trước khi render viewer shiki hiện có, nếu `previewKind(...) !== "text" && !== "binary"` thì render `FilePreviewV2`.
- [ ] **Step 4: Test + typecheck.**

---

### Task C2: Endpoint `info` + panel thông tin

**Files:**
- Modify: `packages/opencode/src/server/routes/instance/httpapi/groups/file.ts` + `handlers/file.ts`
- Modify: `packages/opencode/test/server/httpapi-file-mutations.test.ts`
- Modify: `packages/app/src/context/file/ops.ts` + `.test.ts` (thêm `info`)
- Create: `packages/app/src/components/file-info-model.ts` + `.test.ts`
- Create: `packages/app/src/components/file-info-v2.tsx`
- Modify: `packages/app/src/pages/session/v2/session-file-browser-tab.tsx` (menu item Info)

**Interfaces:**
- `GET /file/info?path=` → `{ path, type: "file" | "directory" | "symlink", size, mtime: string(ISO), mode: string(octal), mime, target? }`
- Client: `ops.info(path) => Promise<FileInfo>`; `formatBytes(size: number): string`; `formatMtime(iso: string): string`.

- [ ] **Step 1: Server test (RED→GREEN)** — tạo file, gọi `/file/info`, assert `type === "file"`, `size === 1`, `mode` khớp regex `/^[0-7]{3,4}$/`.
- [ ] **Step 2: Server handler** dùng `fsPromises.lstat` (symlink → `fsPromises.readlink` cho `target`), `mime` từ `FSUtil.mimeType`.
- [ ] **Step 3: Client model tests (RED→GREEN)** cho `formatBytes` (0→"0 B", 1536→"1.5 KB", 1048576→"1.0 MB") và `formatMtime` (ISO → chuỗi locale ngắn).
- [ ] **Step 4: UI**: `FileInfoV2` hiển thị trong **bottom sheet** (C3) hoặc dialog tạm; nút Copy path.
- [ ] **Step 5: Test + typecheck.**

---

### Task C3: Bottom sheet + mobile polish + PWA verify

**Files:**
- Create: `packages/app/src/components/sheet-v2.tsx`
- Modify: `packages/app/src/pages/session/v2/session-file-browser-tab.tsx` (thay dialog nhập tên/confirm bằng sheet)
- Modify: `packages/app/src/components/dialog-confirm-v2.tsx` (giữ làm wrapper, thêm variant sheet) 
- Modify: `packages/app/index.html` (theme-color khớp manifest `#080808`; giữ các meta iOS đã có)
- Verify only: `packages/ui/src/assets/favicon/site.webmanifest` (đã chuẩn: standalone + maskable — chỉ cần xác nhận trên điện thoại)
- Modify: `packages/app/src/i18n/en.ts` (nếu có text mới)

**Interfaces:**
- Produces: `<SheetV2 open title onClose children footer? />` — overlay + panel trượt từ dưới, kéo xuống đóng (pointer events, ngưỡng 80px), `padding-bottom: env(safe-area-inset-bottom)`, `max-height: 85vh`, scroll trong.

- [ ] **Step 1: Component** (không cần test đơn vị phức tạp; test model nhỏ cho ngưỡng kéo: `dismissed(deltaY: number): boolean` = `deltaY > 80`).
- [ ] **Step 2: Thay thế** các dialog prompt/confirm trong browser tab bằng `SheetV2` khi màn hình nhỏ (`window.matchMedia("(max-width: 640px)")`), desktop vẫn dùng dialog hiện có.
- [ ] **Step 3: PWA**: đổi `<meta name="theme-color" content="#080808">` (khớp manifest); chạy checklist cài đặt trên điện thoại (Add to Home Screen → mở standalone).
- [ ] **Step 4: Test + typecheck.**

---

## Verification (mỗi wave)

- [ ] **Build wave**: orchestrator push `custom-fs` → chờ `custom-build` xanh → `bash scripts/deploy-custom.sh`.
- [ ] **E2E mobile checklist**:
  - Wave A: toolbar nằm đầu sidebar; breadcrumb nhảy đúng thư mục; toggle hidden; long-press mở menu; menu hành động đúng; mở file → Edit → CodeMirror hiện highlight + line numbers; sửa → Save; thử đóng tab khi chưa lưu → cảnh báo.
  - Wave B: chọn nhiều file (mobile long-press → Select, desktop shift); bulk bar hiện; nén → tải `.zip` mở được trên máy; extract `.zip` đúng cây; copy/move sang thư mục khác qua picker.
  - Wave C: preview ảnh (pinch zoom), video play, PDF hiện trong khung, markdown render; menu Info hiện size/mtime/mode; sheet trượt từ dưới + kéo đóng; Add to Home Screen mở standalone.
- [ ] Sau mỗi wave: `journalctl -u opencode-web` không có error mới; audit log có bản ghi `copy/archive/extract`.

## Self-Review

- **Spec coverage:** A1/A2/A3 ↔ cây file+menu+editor; B1–B4 ↔ copy/move/zip+multi-select; C1–C3 ↔ preview/info/polish/PWA. Không có mục spec nào thiếu task.
- **Placeholder scan:** các điểm cần chốt khi execute đã ghi rõ cách xử lý (import path `MenuV2`, `MenuV2.Context` API shape, iframe cookie → fallback blob, dynamic import fallback textarea). Không có TBD mơ hồ.
- **Type consistency:** tên hàm/kiểu dùng thống nhất giữa các task: `languageNameFor`, `createCodeMirrorEditor`, `createSelectionState`, `bulkActions`, `fileManagerMenuItems(node, features)`, `previewKind`, `formatBytes/formatMtime`, `ops.copy/archive/extract/info`, endpoint `copy/archive/extract/info`.
