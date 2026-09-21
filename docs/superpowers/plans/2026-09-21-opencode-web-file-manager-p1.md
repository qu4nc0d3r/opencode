# opencode web File Manager — P1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm file manager cơ bản (write/mkdir/rename/delete/upload/download), editor có save, và picker điều hướng folder con vào `opencode web` của fork, deploy lên VPS.

**Architecture:** Thêm 6 endpoint vào Effect HttpApi group `file` sẵn có (`packages/opencode`), regenerate typed SDK, mở dialog chọn thư mục V2 cho web, rồi bổ sung toolbar/context menu/editor/upload vào cây file session trong `packages/app`. Build bằng GitHub Actions trên fork, deploy artifact linux-x64 lên VPS thay binary.

**Tech Stack:** Bun 1.3+, Effect (HttpApi/HttpApiBuilder), SolidJS, `bun test`, GitHub Actions, Cloudflare Tunnel + systemd trên VPS Ubuntu 22.04.

**Spec:** `docs/superpowers/specs/2026-09-21-opencode-web-file-manager-design.md`

## Global Constraints

- Repo làm việc: `C:\Users\minha\dev\opencode` (clone của fork `qu4nc0d3r/opencode`). `origin` = fork, `upstream` = `anomalyco/opencode`. Branch: `custom-fs`.
- Bun ≥ 1.3 (repo `packageManager` = `bun@1.3.x`). Test runner: `bun test` cho cả hai package (không dùng vitest).
- Server: mọi endpoint mới nằm trong group `file` (`packages/opencode/src/server/routes/instance/httpapi/groups/file.ts` + `handlers/file.ts`), theo `AGENTS.md` cùng thư mục: khai báo bằng `HttpApiEndpoint.*`, implement bằng `HttpApiBuilder.group(...)`; dùng `handleRaw` cho upload/download.
- Query schema mọi endpoint mới phải có `...WorkspaceRoutingQueryFields` (nếu thiếu, request mang `directory`/`workspace` sẽ bị 400).
- API là **full filesystem**: absolute path được phép; relative resolve theo `InstanceState.context.directory`. Reject path rỗng hoặc chứa `\0`.
- Mọi mutation ghi audit JSONL vào `$XDG_DATA_HOME/opencode/audit/fs.jsonl` (fallback `~/.local/share/opencode/audit/fs.jsonl`).
- UI strings mới phải thêm key vào `packages/app/src/i18n/en.ts`. Test `parity.test.ts` yêu cầu **mọi locale** có đủ key → chạy script sync ở Task 9.
- Không sửa file lõi ngoài phạm vi liệt kê (giữ rebase dễ).
- Mỗi task kết thúc bằng 1 commit trên `custom-fs`.

## File Structure

**Server (`packages/opencode`)**
- Modify `src/server/routes/instance/httpapi/groups/file.ts` — schemas + paths + endpoint declarations.
- Modify `src/server/routes/instance/httpapi/handlers/file.ts` — handlers.
- Create `src/file/audit.ts` — audit log helper.
- Create `test/server/httpapi-file-mutations.test.ts` — tests cho endpoint mới.

**SDK**
- Regenerate `packages/sdk/js/src/v2/gen/*` bằng `./script/generate.ts`.

**Client (`packages/app`)**
- Modify `src/components/directory-picker.tsx` — dùng dialog V2 cho web.
- Modify `src/components/directory-picker-policy.ts` + `src/components/directory-picker.test.ts` — predicate thuần + test.
- Create `src/context/file/ops.ts` + `src/context/file/ops.test.ts` — client ops (write/mkdir/rename/remove/upload) thuần, injectable.
- Modify `src/context/file.tsx` — expose `ops`.
- Create `src/components/file-manager-v2.tsx` + `src/components/file-manager-v2-model.ts` + `.test.ts` — toolbar/context menu.
- Create `src/components/dialog-confirm-v2.tsx` — confirm dialog.
- Create `src/pages/session/v2/file-editor-v2.tsx` + `src/pages/session/v2/file-editor-model.ts` + `.test.ts` — editor.
- Modify `src/pages/session/file-tabs.tsx` — gắn editor vào `SessionFileView`.
- Create `src/components/file-upload-v2.tsx` + `src/components/file-upload-queue.ts` + `.test.ts` — upload queue.
- Modify `src/pages/session/v2/session-file-browser-tab.tsx`, `src/components/file-tree-v2.tsx` — wiring.
- Modify `src/i18n/en.ts` (+ sync script đổ sang các locale khác).
- Create `scripts/custom-i18n-sync.ts` — sync key mới sang mọi locale (English fallback).

**CI/Deploy**
- Create `.github/workflows/custom-build.yml`.
- Create `scripts/deploy-custom.sh`.

---

### Task 0: Môi trường dev local

**Files:** none (setup).

- [ ] **Step 1: Cài Bun (nếu chưa có)**

Run (PowerShell):
```
npm install -g bun
bun --version
```
Expected: in ra `1.3.x` trở lên.

- [ ] **Step 2: Cài dependencies**

Run: `bun install` (repo root)
Expected: hoàn tất không lỗi (lần đầu có thể 3–10 phút).

- [ ] **Step 3: Chạy test sẵn có để lấy baseline**

Run: `cd packages/opencode; bun test test/server/httpapi-file.test.ts`
Expected: PASS (2 test).

- [ ] **Step 4: Commit** — không có thay đổi, bỏ qua commit.

---

### Task 1: CI workflow build binary

**Files:**
- Create: `.github/workflows/custom-build.yml`

**Interfaces:**
- Produces: artifact GitHub Actions tên `opencode-linux-x64` chứa file binary `opencode` (dùng ở Task 12).

- [ ] **Step 1: Viết workflow**

```yaml
name: custom-build

on:
  workflow_dispatch:
  push:
    branches:
      - custom-fs

jobs:
  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-tags: true

      - uses: ./.github/actions/setup-bun

      - name: Build
        run: ./packages/opencode/script/build.ts --single
        env:
          OPENCODE_VERSION: 0.1.0-custom

      - uses: actions/upload-artifact@v4
        with:
          name: opencode-linux-x64
          path: packages/opencode/dist/opencode-linux-x64/bin/opencode
          if-no-files-found: error
```

- [ ] **Step 2: Commit + push**

```bash
git add .github/workflows/custom-build.yml
git commit -m "ci: custom linux-x64 build workflow"
git push origin custom-fs
```

- [ ] **Step 3: Bật Actions trên fork + chạy build**

```bash
gh api -X PUT repos/qu4nc0d3r/opencode/actions/permissions -f enabled=true || true
gh workflow run custom-build.yml --repo qu4nc0d3r/opencode --ref custom-fs
sleep 5
gh run watch "$(gh run list --repo qu4nc0d3r/opencode --workflow custom-build.yml --limit 1 --json databaseId --jq '.[0].databaseId')" --repo qu4nc0d3r/opencode
```
Expected: run kết thúc `success`. Nếu Actions vẫn bị chặn: mở `https://github.com/qu4nc0d3r/opencode/actions` bấm nút "I understand my workflows, go ahead and enable them" rồi chạy lại bước trên.

- [ ] **Step 4: Tải artifact kiểm chứng**

```bash
mkdir -p /tmp/oc-artifact
gh run download "$(gh run list --repo qu4nc0d3r/opencode --workflow custom-build.yml --limit 1 --json databaseId --jq '.[0].databaseId')" --repo qu4nc0d3r/opencode -n opencode-linux-x64 -D /tmp/oc-artifact
ls -la /tmp/oc-artifact
```
Expected: có file `opencode` (~170–200MB).

- [ ] **Step 5: Commit** — đã commit ở Step 2.

---

### Task 2: Endpoint `write` + `mkdir` (TDD)

**Files:**
- Modify: `packages/opencode/src/server/routes/instance/httpapi/groups/file.ts`
- Modify: `packages/opencode/src/server/routes/instance/httpapi/handlers/file.ts`
- Test: `packages/opencode/test/server/httpapi-file-mutations.test.ts`

**Interfaces:**
- Produces (dùng bởi Task 3, 4, 8):
  - `POST /file/write` payload `{ path: string, content: string, encoding?: "utf8" | "base64" }` → `{ path: string }`
  - `POST /file/mkdir` payload `{ path: string, recursive?: boolean }` → `{ path: string }`
  - `FilePaths.write`, `FilePaths.mkdir`; schema `FileMutationPayload`-style structs export từ `groups/file.ts`.
  - Helper handler `resolveTarget(directory: string, input: string): string` (absolute hoặc resolve theo directory).

- [ ] **Step 1: Viết test fail trước**

`packages/opencode/test/server/httpapi-file-mutations.test.ts`:
```ts
import { afterEach, describe, expect, test } from "bun:test"
import { Context } from "effect"
import path from "path"
import * as fs from "fs/promises"
import { HttpApiApp } from "../../src/server/routes/instance/httpapi/server"
import { FilePaths } from "../../src/server/routes/instance/httpapi/groups/file"
import { resetDatabase } from "../fixture/db"
import { disposeAllInstances, tmpdir } from "../fixture/fixture"

const context = Context.empty() as Context.Context<unknown>

function post(route: string, directory: string, payload: unknown) {
  return HttpApiApp.webHandler().handler(
    new Request(new URL(`http://localhost${route}`), {
      method: "POST",
      headers: { "x-opencode-directory": directory, "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
    context,
  )
}

afterEach(async () => {
  await disposeAllInstances()
  await resetDatabase()
})

describe("file HttpApi mutations", () => {
  test("write creates a file and parent directories", async () => {
    await using tmp = await tmpdir({ git: true })
    const target = path.join(tmp.path, "a", "b", "note.txt")

    const response = await post(FilePaths.write, tmp.path, { path: target, content: "hello" })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ path: target })
    expect(await fs.readFile(target, "utf8")).toBe("hello")
  })

  test("write replaces an existing file", async () => {
    await using tmp = await tmpdir({ git: true })
    const target = path.join(tmp.path, "note.txt")
    await Bun.write(target, "old")

    const response = await post(FilePaths.write, tmp.path, { path: target, content: "new" })

    expect(response.status).toBe(200)
    expect(await fs.readFile(target, "utf8")).toBe("new")
  })

  test("mkdir creates nested directories", async () => {
    await using tmp = await tmpdir({ git: true })
    const target = path.join(tmp.path, "x", "y")

    const response = await post(FilePaths.mkdir, tmp.path, { path: target })

    expect(response.status).toBe(200)
    expect(await fs.stat(target)).toBeTruthy()
  })

  test("rejects an empty path", async () => {
    await using tmp = await tmpdir({ git: true })
    const response = await post(FilePaths.write, tmp.path, { path: "", content: "x" })
    expect(response.status).toBe(400)
  })
})
```

- [ ] **Step 2: Chạy test cho fail**

Run: `cd packages/opencode; bun test test/server/httpapi-file-mutations.test.ts`
Expected: FAIL — `FilePaths.write` undefined / endpoint 404.

- [ ] **Step 3: Thêm schema + endpoint declarations**

Trong `groups/file.ts` — thêm sau `FilePaths` hiện có:

```ts
export const WritePayload = Schema.Struct({
  path: Schema.String,
  content: Schema.String,
  encoding: Schema.optional(Schema.Literals(["utf8", "base64"])),
})

export const MkdirPayload = Schema.Struct({
  path: Schema.String,
  recursive: Schema.optional(Schema.Boolean),
})

export const FileMutationResult = Schema.Struct({ path: Schema.String }).annotate({
  identifier: "FileMutationResult",
})

export class FileOperationError extends Schema.TaggedErrorClass<FileOperationError>()(
  "FileOperationError",
  {
    message: Schema.String,
    operation: Schema.optional(Schema.String),
    path: Schema.optional(Schema.String),
  },
  { httpApiStatus: 400 },
) {}
```

Cập nhật `FilePaths` (giữ nguyên các key cũ):
```ts
export const FilePaths = {
  findText: "/find",
  findFile: "/find/file",
  findSymbol: "/find/symbol",
  list: "/file",
  content: "/file/content",
  status: "/file/status",
  write: "/file/write",
  mkdir: "/file/mkdir",
} as const
```

Thêm vào `HttpApiGroup.make("file").add(...)` — sau endpoint `status`:
```ts
        HttpApiEndpoint.post("write", FilePaths.write, {
          query: WorkspaceRoutingQuery,
          payload: WritePayload,
          success: described(FileMutationResult, "Written file"),
          error: [HttpApiError.BadRequest, FileOperationError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "file.write",
            summary: "Write file",
            description: "Create or overwrite a file, creating parent directories when missing.",
          }),
        ),
        HttpApiEndpoint.post("mkdir", FilePaths.mkdir, {
          query: WorkspaceRoutingQuery,
          payload: MkdirPayload,
          success: described(FileMutationResult, "Created directory"),
          error: [HttpApiError.BadRequest, FileOperationError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "file.mkdir",
            summary: "Create directory",
            description: "Create a directory, including parents.",
          }),
        ),
```
Thêm import `HttpApiError` vào câu import từ `effect/unstable/httpapi` trong file này.

- [ ] **Step 4: Implement handlers**

Trong `handlers/file.ts`, thêm import: `import { FileOperationError, FilePaths, MkdirPayload, WritePayload } from "../groups/file"` (chỉ import những gì cần), `import * as fsPromises from "fs/promises"`, `import { dirname } from "path"`, `import { AuditLog } from "@/file/audit"` (Task 5 tạo — task này tạm gọi trực tiếp; nếu làm Task 5 trước thì dùng luôn).

Helper resolve (đặt trong handler layer, phía trên `return handlers`):
```ts
    const resolveTarget = (directory: string, input: string) => {
      if (input.includes("\0") || input.trim() === "") return undefined
      return path.isAbsolute(input) ? path.normalize(input) : path.resolve(directory, input)
    }

    const write = Effect.fn("FileHttpApi.write")(function* (ctx: {
      payload: { path: string; content: string; encoding?: "utf8" | "base64" }
    }) {
      const directory = (yield* InstanceState.context).directory
      const target = resolveTarget(directory, ctx.payload.path)
      if (!target) return yield* new FileOperationError({ message: "Invalid path", operation: "write" })
      const bytes = ctx.payload.encoding === "base64" ? Buffer.from(ctx.payload.content, "base64") : ctx.payload.content
      yield* Effect.tryPromise({
        try: async () => {
          await fsPromises.mkdir(dirname(target), { recursive: true })
          await fsPromises.writeFile(target, bytes)
        },
        catch: (cause) =>
          new FileOperationError({ message: String(cause), operation: "write", path: target }),
      })
      return { path: target }
    })

    const mkdir = Effect.fn("FileHttpApi.mkdir")(function* (ctx: {
      payload: { path: string; recursive?: boolean }
    }) {
      const directory = (yield* InstanceState.context).directory
      const target = resolveTarget(directory, ctx.payload.path)
      if (!target) return yield* new FileOperationError({ message: "Invalid path", operation: "mkdir" })
      yield* Effect.tryPromise({
        try: () => fsPromises.mkdir(target, { recursive: ctx.payload.recursive ?? true }).then(() => undefined),
        catch: (cause) =>
          new FileOperationError({ message: String(cause), operation: "mkdir", path: target }),
      })
      return { path: target }
    })
```

Gắn vào chuỗi handler:
```ts
    return handlers
      .handle("findText", findText)
      .handle("findFile", findFile)
      .handle("findSymbol", findSymbol)
      .handle("list", list)
      .handle("content", content)
      .handle("status", status)
      .handle("write", write)
      .handle("mkdir", mkdir)
```

- [ ] **Step 5: Chạy test cho pass**

Run: `cd packages/opencode; bun test test/server/httpapi-file-mutations.test.ts`
Expected: PASS cả 4 test.

- [ ] **Step 6: Commit**

```bash
git add packages/opencode/src/server/routes/instance/httpapi/groups/file.ts packages/opencode/src/server/routes/instance/httpapi/handlers/file.ts packages/opencode/test/server/httpapi-file-mutations.test.ts
git commit -m "feat(server): add file write and mkdir endpoints"
```

---

### Task 3: Endpoint `rename` + `remove`

**Files:**
- Modify: `groups/file.ts`, `handlers/file.ts`
- Test: `test/server/httpapi-file-mutations.test.ts` (thêm test)

**Interfaces:**
- Produces:
  - `POST /file/rename` payload `{ from: string, to: string }` → `{ path: string }`
  - `POST /file/remove` payload `{ path: string, recursive?: boolean }` → `{ path: string }`
  - `FilePaths.rename`, `FilePaths.remove`; `RenamePayload`, `RemovePayload`.

- [ ] **Step 1: Thêm test fail**

Thêm vào describe hiện có:
```ts
  test("rename moves a file", async () => {
    await using tmp = await tmpdir({ git: true })
    const from = path.join(tmp.path, "a.txt")
    const to = path.join(tmp.path, "sub", "b.txt")
    await Bun.write(from, "x")

    const response = await post(FilePaths.rename, tmp.path, { from, to })

    expect(response.status).toBe(200)
    expect(await fs.readFile(to, "utf8")).toBe("x")
    await expect(fs.stat(from)).rejects.toThrow()
  })

  test("remove deletes a file", async () => {
    await using tmp = await tmpdir({ git: true })
    const target = path.join(tmp.path, "gone.txt")
    await Bun.write(target, "x")

    const response = await post(FilePaths.remove, tmp.path, { path: target })

    expect(response.status).toBe(200)
    await expect(fs.stat(target)).rejects.toThrow()
  })

  test("remove refuses a non-empty directory without recursive", async () => {
    await using tmp = await tmpdir({ git: true })
    const dir = path.join(tmp.path, "dir")
    await fs.mkdir(dir)
    await Bun.write(path.join(dir, "child.txt"), "x")

    const response = await post(FilePaths.remove, tmp.path, { path: dir })

    expect(response.status).toBe(400)
    expect(await fs.stat(dir)).toBeTruthy()
  })

  test("remove deletes a non-empty directory with recursive", async () => {
    await using tmp = await tmpdir({ git: true })
    const dir = path.join(tmp.path, "dir")
    await fs.mkdir(dir)
    await Bun.write(path.join(dir, "child.txt"), "x")

    const response = await post(FilePaths.remove, tmp.path, { path: dir, recursive: true })

    expect(response.status).toBe(200)
    await expect(fs.stat(dir)).rejects.toThrow()
  })
```

- [ ] **Step 2: Chạy test cho fail**

Run: `cd packages/opencode; bun test test/server/httpapi-file-mutations.test.ts`
Expected: FAIL — 404 cho `/file/rename`, `/file/remove`.

- [ ] **Step 3: Khai báo schema + endpoint**

Trong `groups/file.ts`:
```ts
export const RenamePayload = Schema.Struct({
  from: Schema.String,
  to: Schema.String,
})

export const RemovePayload = Schema.Struct({
  path: Schema.String,
  recursive: Schema.optional(Schema.Boolean),
})
```
`FilePaths` thêm: `rename: "/file/rename", remove: "/file/remove",`.
Thêm 2 endpoint POST (`"rename"`, `"remove"`) theo đúng mẫu của Task 2 Step 3 (identifier `file.rename`, `file.remove`; description tương ứng).

- [ ] **Step 4: Implement handlers**

```ts
    const rename = Effect.fn("FileHttpApi.rename")(function* (ctx: {
      payload: { from: string; to: string }
    }) {
      const directory = (yield* InstanceState.context).directory
      const from = resolveTarget(directory, ctx.payload.from)
      const to = resolveTarget(directory, ctx.payload.to)
      if (!from || !to) return yield* new FileOperationError({ message: "Invalid path", operation: "rename" })
      yield* Effect.tryPromise({
        try: async () => {
          await fsPromises.mkdir(path.dirname(to), { recursive: true })
          await fsPromises.rename(from, to)
        },
        catch: (cause) => new FileOperationError({ message: String(cause), operation: "rename", path: from }),
      })
      return { path: to }
    })

    const remove = Effect.fn("FileHttpApi.remove")(function* (ctx: {
      payload: { path: string; recursive?: boolean }
    }) {
      const directory = (yield* InstanceState.context).directory
      const target = resolveTarget(directory, ctx.payload.path)
      if (!target) return yield* new FileOperationError({ message: "Invalid path", operation: "remove" })
      yield* Effect.tryPromise({
        try: async () => {
          await fsPromises.rm(target, { recursive: ctx.payload.recursive ?? false, force: false })
        },
        catch: (cause) => new FileOperationError({ message: String(cause), operation: "remove", path: target }),
      })
      return { path: target }
    })
```

- [ ] **Step 5: Chạy test cho pass + commit**

Run: `cd packages/opencode; bun test test/server/httpapi-file-mutations.test.ts`
Expected: PASS 8 test.

```bash
git add -A packages/opencode
git commit -m "feat(server): add file rename and remove endpoints"
```

---

### Task 4: Raw endpoints `upload` + `download`

**Files:**
- Modify: `groups/file.ts`, `handlers/file.ts`
- Test: `test/server/httpapi-file-mutations.test.ts`

**Interfaces:**
- Produces:
  - `PUT /file/upload?path=<absolute>` body = raw bytes → `{ path: string, bytes: number }`
  - `GET /file/download?path=<absolute>` → stream bytes, headers `content-type` (mime) + `content-disposition: attachment; filename="..."`.
  - `FilePaths.upload`, `FilePaths.download`; `UploadQuery`, `DownloadQuery`.

- [ ] **Step 1: Thêm test fail**

```ts
  test("upload streams bytes to disk and download returns them", async () => {
    await using tmp = await tmpdir({ git: true })
    const target = path.join(tmp.path, "data", "blob.bin")
    const body = new Uint8Array([1, 2, 3, 4, 5])

    const upload = await HttpApiApp.webHandler().handler(
      new Request(new URL(`http://localhost${FilePaths.upload}?path=${encodeURIComponent(target)}`), {
        method: "PUT",
        headers: { "x-opencode-directory": tmp.path },
        body,
      }),
      context,
    )
    expect(upload.status).toBe(200)
    expect(await upload.json()).toEqual({ path: target, bytes: 5 })
    expect(new Uint8Array(await fs.readFile(target))).toEqual(body)

    const download = await HttpApiApp.webHandler().handler(
      new Request(new URL(`http://localhost${FilePaths.download}?path=${encodeURIComponent(target)}`), {
        headers: { "x-opencode-directory": tmp.path },
      }),
      context,
    )
    expect(download.status).toBe(200)
    expect(download.headers.get("content-disposition")).toContain("blob.bin")
    expect(new Uint8Array(await download.arrayBuffer())).toEqual(body)
  })
```

- [ ] **Step 2: Chạy test cho fail**

Run: `cd packages/opencode; bun test test/server/httpapi-file-mutations.test.ts`
Expected: FAIL — 404.

- [ ] **Step 3: Khai báo endpoint raw**

Trong `groups/file.ts`:
```ts
export const UploadQuery = Schema.Struct({
  ...WorkspaceRoutingQueryFields,
  path: Schema.String,
})

export const DownloadQuery = Schema.Struct({
  ...WorkspaceRoutingQueryFields,
  path: Schema.String,
})

export const UploadResult = Schema.Struct({
  path: Schema.String,
  bytes: Schema.Number,
}).annotate({ identifier: "FileUploadResult" })
```
`FilePaths` thêm `upload: "/file/upload", download: "/file/download",`.
Endpoints (khai báo trong group; implement bằng handleRaw):
```ts
        HttpApiEndpoint.put("upload", FilePaths.upload, {
          query: UploadQuery,
          success: described(UploadResult, "Uploaded file"),
          error: [HttpApiError.BadRequest, FileOperationError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "file.upload",
            summary: "Upload file",
            description: "Stream a raw request body to the given path.",
          }),
        ),
        HttpApiEndpoint.get("download", FilePaths.download, {
          query: DownloadQuery,
          success: described(Schema.Uint8Array, "File bytes"),
          error: [HttpApiError.BadRequest, FileOperationError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "file.download",
            summary: "Download file",
            description: "Download a file with an attachment content disposition.",
          }),
        ),
```
(Nếu `Schema.Uint8Array` không tồn tại trong Effect version này, dùng `Schema.String` và ghi chú `format: binary`; kiểm tra bằng `bun run --cwd packages/opencode typecheck`.)

- [ ] **Step 4: Implement bằng handleRaw**

Thay `.handle("upload", ...)` bằng `.handleRaw("upload", ...)` và `.handleRaw("download", ...)`:
```ts
      .handleRaw("upload", (ctx) =>
        filesystem(
          Effect.gen(function* () {
            const directory = (yield* InstanceState.context).directory
            const target = resolveTarget(directory, ctx.query.path)
            if (!target) return HttpServerResponse.empty({ status: 400 })
            yield* Effect.tryPromise({
              try: () => fsPromises.mkdir(path.dirname(target), { recursive: true }),
              catch: () => new FileOperationError({ message: "mkdir failed", operation: "upload", path: target }),
            })
            const bytes = new Uint8Array(yield* Effect.promise(() => ctx.request.arrayBuffer()))
            yield* Effect.tryPromise({
              try: () => fsPromises.writeFile(target, bytes),
              catch: (cause) => new FileOperationError({ message: String(cause), operation: "upload", path: target }),
            })
            return HttpServerResponse.unsafeJson({ path: target, bytes: bytes.byteLength })
          }),
        ),
      )
      .handleRaw("download", (ctx) =>
        filesystem(
          Effect.gen(function* () {
            const directory = (yield* InstanceState.context).directory
            const target = resolveTarget(directory, ctx.query.path)
            if (!target) return HttpServerResponse.empty({ status: 400 })
            const stat = yield* Effect.promise(() => fsPromises.stat(target).catch(() => undefined))
            if (!stat || !stat.isFile()) return HttpServerResponse.empty({ status: 404 })
            const body = yield* Effect.promise(() => fsPromises.readFile(target))
            const name = path.basename(target).replace(/["\\\r\n]/g, "_")
            return HttpServerResponse.uint8Array(body, {
              headers: {
                "content-type": FSUtil.mimeType(target),
                "content-disposition": `attachment; filename="${name}"`,
                "content-length": String(body.byteLength),
              },
            })
          }),
        ),
      )
```
Import thêm `HttpServerResponse` từ `effect/unstable/http`; `FSUtil` đã import sẵn trong handlers/file.ts.

- [ ] **Step 5: Chạy test cho pass + commit**

Run: `cd packages/opencode; bun test test/server/httpapi-file-mutations.test.ts`
Expected: PASS 9 test.

```bash
git add -A packages/opencode
git commit -m "feat(server): add raw file upload and download endpoints"
```

---

### Task 5: Audit log

**Files:**
- Create: `packages/opencode/src/file/audit.ts`
- Modify: `handlers/file.ts` (gọi audit trong write/mkdir/rename/remove/upload)
- Test: `packages/opencode/test/file/audit.test.ts`

**Interfaces:**
- Produces: `AuditLog.record(input: { op: string; path?: string; from?: string; to?: string; bytes?: number; ok: boolean; error?: string }): Promise<void>`; `AuditLog.path(): string`; `AuditLog.reset(): void` (test hook).
- Env override cho test: `OPENCODE_AUDIT_PATH` trỏ tới file log.

- [ ] **Step 1: Viết test fail**

`packages/opencode/test/file/audit.test.ts`:
```ts
import { afterEach, describe, expect, test } from "bun:test"
import path from "path"
import * as fs from "fs/promises"
import { tmpdir as mkTmp } from "../fixture/fixture"
import { AuditLog } from "../../src/file/audit"

const saved = process.env.OPENCODE_AUDIT_PATH

afterEach(() => {
  if (saved === undefined) delete process.env.OPENCODE_AUDIT_PATH
  else process.env.OPENCODE_AUDIT_PATH = saved
})

describe("AuditLog", () => {
  test("appends one JSON line per record", async () => {
    await using tmp = await mkTmp()
    process.env.OPENCODE_AUDIT_PATH = path.join(tmp.path, "audit", "fs.jsonl")

    await AuditLog.record({ op: "write", path: "/tmp/x.txt", ok: true })
    await AuditLog.record({ op: "remove", path: "/tmp/x.txt", ok: false, error: "boom" })

    const text = await fs.readFile(process.env.OPENCODE_AUDIT_PATH, "utf8")
    const lines = text.trim().split("\n").map((line) => JSON.parse(line))
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ op: "write", path: "/tmp/x.txt", ok: true })
    expect(lines[1]).toMatchObject({ op: "remove", ok: false, error: "boom" })
    expect(typeof lines[0].ts).toBe("string")
  })
})
```
(Lưu ý: bỏ field `recursive` khỏi input type — test dùng `as never` chỉ minh hoạ; giữ input đúng kiểu khi implement.)

- [ ] **Step 2: Chạy test cho fail**

Run: `cd packages/opencode; bun test test/file/audit.test.ts`
Expected: FAIL — module không tồn tại.

- [ ] **Step 3: Implement audit**

`packages/opencode/src/file/audit.ts`:
```ts
import path from "path"
import { appendFile, mkdir } from "fs/promises"

export type AuditRecord = {
  op: string
  path?: string
  from?: string
  to?: string
  bytes?: number
  ok: boolean
  error?: string
}

function auditPath() {
  const override = process.env.OPENCODE_AUDIT_PATH
  if (override) return override
  const data = process.env.XDG_DATA_HOME || path.join(process.env.HOME ?? process.env.USERPROFILE ?? ".", ".local", "share")
  return path.join(data, "opencode", "audit", "fs.jsonl")
}

export namespace AuditLog {
  export function filePath() {
    return auditPath()
  }

  export async function record(input: AuditRecord) {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...input })
    try {
      const target = auditPath()
      await mkdir(path.dirname(target), { recursive: true })
      await appendFile(target, line + "\n", "utf8")
    } catch {
      // audit failures must never break the operation
    }
  }
}
```
(Không export trùng tên biến `path` đã import; API công khai là `AuditLog.filePath()`.)

- [ ] **Step 4: Chạy test cho pass**

Run: `cd packages/opencode; bun test test/file/audit.test.ts`
Expected: PASS.

- [ ] **Step 5: Gọi audit trong handlers**

Trong mỗi handler Task 2–4, sau khi thao tác thành công hoặc lỗi, thêm:
```ts
      yield* Effect.promise(() => AuditLog.record({ op: "write", path: target, ok: true }))
```
và ở nhánh lỗi (bao quanh `Effect.tryPromise` bằng `Effect.tapError`):
```ts
      .pipe(Effect.tapError((error) => Effect.promise(() => AuditLog.record({ op: "write", path: target, ok: false, error: String(error) }))))
```
Áp dụng tương tự cho `mkdir` (`op: "mkdir"`), `rename` (`op: "rename", from, to`), `remove` (`op: "remove"`), `upload` (`op: "upload", bytes`).

- [ ] **Step 6: Chạy toàn bộ test file server + audit + commit**

Run: `cd packages/opencode; bun test test/server/httpapi-file-mutations.test.ts test/file/audit.test.ts`
Expected: PASS tất cả.

```bash
git add -A packages/opencode
git commit -m "feat(server): audit log for file mutations"
```

---

### Task 6: Regenerate SDK

**Files:**
- Modify: `packages/sdk/js/src/v2/gen/*` (generated)
- Modify: các file generated khác theo script.

- [ ] **Step 1: Chạy generate**

Run (repo root): `bun script/generate.ts` (hoặc `./script/generate.ts`)
Expected: không lỗi; git status cho thấy file generated thay đổi.

- [ ] **Step 2: Kiểm tra method mới có trong SDK**

Run:
```
rg -n "write|mkdir|remove|upload|download" packages/sdk/js/src/v2/gen/sdk.gen.ts | Select-Object -First 20
```
Expected: thấy các method mới trong class `File` (tên theo endpoint: `write`, `mkdir`, `rename`, `remove`, `upload`, `download`) với params dạng `{ directory?, workspace?, path? }` hoặc `{ location: { directory } }` tuỳ generator.

- [ ] **Step 3: Typecheck server + sdk**

Run: `bun run --cwd packages/opencode typecheck` và `bun run --cwd packages/sdk/js typecheck` (nếu package có script).
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add packages/sdk packages/opencode
git commit -m "chore(sdk): regenerate client for file mutation endpoints"
```

---

### Task 7: Picker dùng dialog V2 cho web

**Files:**
- Modify: `packages/app/src/components/directory-picker-policy.ts`
- Modify: `packages/app/src/components/directory-picker.test.ts`
- Modify: `packages/app/src/components/directory-picker.tsx:39`

**Interfaces:**
- Produces: `useV2DirectoryDialog(platform: Platform["platform"], server: ServerConnection.Any): boolean` — true khi nên dùng `DialogSelectDirectoryV2` (web hoặc desktop-new-layout; false khi desktop-local vì có native picker).
- Consumes: `directoryPickerKind` hiện có.

- [ ] **Step 1: Viết test fail**

Thêm vào `directory-picker.test.ts`:
```ts
import { useV2DirectoryDialog } from "./directory-picker-policy"

describe("useV2DirectoryDialog", () => {
  test("web always uses the V2 dialog", () => {
    expect(useV2DirectoryDialog("web", {} as never)).toBe(true)
  })
  test("desktop local uses the native picker instead", () => {
    expect(useV2DirectoryDialog("desktop", localServer)).toBe(false)
  })
  test("desktop remote uses the V2 dialog", () => {
    expect(useV2DirectoryDialog("desktop", remoteServer)).toBe(true)
  })
})
```
Trong đó `localServer`/`remoteServer` lấy theo helper đã dùng trong test hiện có của file (đọc file trước khi viết test; nếu test hiện có chưa mock ServerConnection thì tạo object tối thiểu `{ type: "local" }` / `{ type: "remote" }` theo type `ServerConnection.Any`).

- [ ] **Step 2: Chạy test cho fail**

Run: `cd packages/app; bun test --conditions=solid --preload ./happydom.ts src/components/directory-picker.test.ts`
Expected: FAIL — export không tồn tại.

- [ ] **Step 3: Implement predicate + sửa caller**

`directory-picker-policy.ts` thêm:
```ts
export function useV2DirectoryDialog(platform: Platform["platform"], server: ServerConnection.Any) {
  return !(platform === "desktop" && ServerConnection.local(server))
}
```
(Chỉ dùng dialog V2 khi không có native picker — đúng điều kiện `directoryPickerKind(...) !== "native"` nhưng không phụ thuộc thêm hàm.)

`directory-picker.tsx` sửa nhánh:
```ts
    if (settings.general.newLayoutDesigns() && useV2DirectoryDialog(platform.platform, input.server)) {
      dialog.show(() => <DialogSelectDirectoryV2 {...input} onSelect={onSelect} />, cancel)
      return
    }
    dialog.show(() => <DialogSelectDirectory {...input} onSelect={onSelect} />, cancel)
```

- [ ] **Step 4: Chạy test cho pass**

Run: `cd packages/app; bun test --conditions=solid --preload ./happydom.ts src/components/directory-picker.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/components/directory-picker.tsx packages/app/src/components/directory-picker-policy.ts packages/app/src/components/directory-picker.test.ts
git commit -m "feat(app): use V2 directory dialog on web"
```

---

### Task 8: Client ops trong context file

**Files:**
- Create: `packages/app/src/context/file/ops.ts`
- Create: `packages/app/src/context/file/ops.test.ts`
- Modify: `packages/app/src/context/file.tsx`

**Interfaces:**
- Produces: `createFileOps(deps)` trả về object:
  - `write(path: string, content: string, encoding?: "utf8" | "base64"): Promise<void>`
  - `mkdir(path: string): Promise<void>`
  - `rename(from: string, to: string): Promise<void>`
  - `remove(path: string, recursive?: boolean): Promise<void>`
  - `upload(target: string, data: Uint8Array): Promise<{ bytes: number }>` (component Task 11 chuyển `File` → `Uint8Array` trước khi gọi)
  - `downloadUrl(path: string, serverUrl: string): string` (URL tuyệt đối tới `/file/download?path=...` để dùng `<a download>`)
- Consumes trong `file.tsx`: `serverSDK().api.file.*`, `tree.refresh`, `showToast`, `language`.

- [ ] **Step 1: Viết test fail**

`ops.test.ts` (thuần, không cần DOM — chỉ test `downloadUrl` và thứ tự refresh/toast qua fake deps):
```ts
import { describe, expect, test } from "bun:test"
import { createFileOps } from "./ops"

function deps() {
  const calls: string[] = []
  const sdk = {
    write: async (input: unknown) => { calls.push(`write:${JSON.stringify(input)}`); return { data: { path: "/x" } } },
    mkdir: async (input: unknown) => { calls.push(`mkdir:${JSON.stringify(input)}`); return { data: { path: "/x" } } },
    rename: async (input: unknown) => { calls.push(`rename:${JSON.stringify(input)}`); return { data: { path: "/y" } } },
    remove: async (input: unknown) => { calls.push(`remove:${JSON.stringify(input)}`); return { data: { path: "/x" } } },
  }
  const refreshed: string[] = []
  const errors: string[] = []
  return {
    calls,
    refreshed,
    errors,
    ops: createFileOps({
      directory: () => "/root/project",
      api: sdk as never,
      refresh: (dir) => { refreshed.push(dir) },
      onError: (message) => { errors.push(message) },
    }),
  }
}

describe("createFileOps", () => {
  test("write passes location and payload then refreshes the parent", async () => {
    const { ops, calls, refreshed } = deps()
    await ops.write("/root/project/a/b.txt", "hi")
    expect(calls[0]).toBe(
      'write:{"location":{"directory":"/root/project"},"path":"/root/project/a/b.txt","content":"hi"}',
    )
    expect(refreshed).toEqual(["/root/project/a"])
  })

  test("remove refreshes the parent and reports errors", async () => {
    const { ops, errors } = deps()
    const failing = createFileOps({
      directory: () => "/root/project",
      api: { remove: async () => { throw new Error("denied") } } as never,
      refresh: () => {},
      onError: (message) => errors.push(message),
    })
    await ops.remove("/root/project/a.txt")
    await failing.remove("/root/project/a.txt")
    expect(errors).toEqual(["denied"])
  })

  test("downloadUrl builds an absolute download link", () => {
    const { ops } = deps()
    expect(ops.downloadUrl("/root/a b.txt", "https://agent.hehez.net")).toBe(
      "https://agent.hehez.net/file/download?path=%2Froot%2Fa+b.txt",
    )
  })
})
```
(Chốt shape tham số SDK sau Task 6: nếu generator trả params phẳng `{ directory, path, content }` thay vì `location`, sửa test + implementation tương ứng — test này là nguồn chân lý cho shape.)

- [ ] **Step 2: Chạy test cho fail**

Run: `cd packages/app; bun test --conditions=solid --preload ./happydom.ts src/context/file/ops.test.ts`
Expected: FAIL — module không tồn tại.

- [ ] **Step 3: Implement `ops.ts`**

```ts
export type FileOpsDeps = {
  directory: () => string
  api: {
    write: (input: { location: { directory: string }; path: string; content: string; encoding?: "utf8" | "base64" }) => Promise<unknown>
    mkdir: (input: { location: { directory: string }; path: string }) => Promise<unknown>
    rename: (input: { location: { directory: string }; from: string; to: string }) => Promise<unknown>
    remove: (input: { location: { directory: string }; path: string; recursive?: boolean }) => Promise<unknown>
  }
  refresh: (directory: string) => void
  onError: (message: string) => void
}

function parentOf(target: string) {
  const index = target.lastIndexOf("/")
  return index <= 0 ? "/" : target.slice(0, index)
}

export function createFileOps(deps: FileOpsDeps) {
  const run = async (action: () => Promise<unknown>, refreshTarget: string) => {
    try {
      await action()
      deps.refresh(parentOf(refreshTarget))
      return true
    } catch (error) {
      deps.onError(error instanceof Error ? error.message : String(error))
      return false
    }
  }

  return {
    write: (target: string, content: string, encoding?: "utf8" | "base64") =>
      run(() => deps.api.write({ location: { directory: deps.directory() }, path: target, content, encoding }), target),
    mkdir: (target: string) => run(() => deps.api.mkdir({ location: { directory: deps.directory() }, path: target }), target),
    rename: (from: string, to: string) =>
      run(() => deps.api.rename({ location: { directory: deps.directory() }, from, to }), to).then(async (ok) => {
        if (ok) deps.refresh(parentOf(from))
        return ok
      }),
    remove: (target: string, recursive?: boolean) =>
      run(() => deps.api.remove({ location: { directory: deps.directory() }, path: target, recursive }), target),
    upload: (target: string, data: Uint8Array) =>
      run(() => deps.api.upload({ location: { directory: deps.directory() }, path: target, body: data }), target),
    downloadUrl: (target: string, serverUrl: string) =>
      `${serverUrl}/file/download?path=${encodeURIComponent(target)}`,
  }
}
```
Deps type bổ sung:
```ts
  api: {
    // ...write/mkdir/rename/remove như trên
    upload: (input: { location: { directory: string }; path: string; body: Uint8Array }) => Promise<unknown>
  }
```
Nếu client SDK không nhận raw `body` (generator chỉ sinh JSON payload), dùng fetch trực tiếp trong `upload`:
```ts
    async upload(target: string, data: Uint8Array) {
      try {
        const response = await fetch(
          `/file/upload?path=${encodeURIComponent(target)}&directory=${encodeURIComponent(deps.directory())}`,
          { method: "PUT", body: data },
        )
        if (!response.ok) throw new Error(`upload failed: ${response.status}`)
        deps.refresh(parentOf(target))
        return { bytes: data.byteLength }
      } catch (error) {
        deps.onError(error instanceof Error ? error.message : String(error))
        return { bytes: 0 }
      }
    }
```
Lưu ý: nếu dùng `fetch` trực tiếp thì bỏ `upload` khỏi `deps.api` và chấp nhận phụ thuộc `fetch` toàn cục (đã có trong browser).

- [ ] **Step 4: Chạy test cho pass**

Run: `cd packages/app; bun test --conditions=solid --preload ./happydom.ts src/context/file/ops.test.ts`
Expected: PASS 3 test.

- [ ] **Step 5: Wire vào `file.tsx`**

Trong `init()` của `useFile` (sau `tree`), thêm:
```ts
    const ops = createFileOps({
      directory: scope,
      api: {
        write: (input) => serverSDK().api.file.write(input as never),
        mkdir: (input) => serverSDK().api.file.mkdir(input as never),
        rename: (input) => serverSDK().api.file.rename(input as never),
        remove: (input) => serverSDK().api.file.remove(input as never),
        upload: (input) => serverSDK().api.file.upload(input as never),
      },
      refresh: (dir) => {
        void tree.listDir(dir, { force: true })
      },
      onError: (message) =>
        showToast({ variant: "error", title: language.t("file.ops.failed"), description: message }),
    })
```
và thêm `ops` vào object return của context. Thêm key i18n `file.ops.failed` ở Task 9 (dùng cùng script sync).

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/context/file.tsx packages/app/src/context/file/ops.ts packages/app/src/context/file/ops.test.ts
git commit -m "feat(app): client file ops (write/mkdir/rename/remove/upload)"
```

---

### Task 9: i18n keys + toolbar + context menu

**Files:**
- Modify: `packages/app/src/i18n/en.ts`
- Create: `packages/app/scripts/custom-i18n-sync.ts` (đặt cạnh các script app hiện có; nếu `packages/app/scripts` không tồn tại thì dùng `scripts/` ở repo root)
- Create: `packages/app/src/components/file-manager-v2-model.ts` + `.test.ts`
- Create: `packages/app/src/components/file-manager-v2.tsx`
- Create: `packages/app/src/components/dialog-confirm-v2.tsx`
- Modify: `packages/app/src/components/file-tree-v2.tsx`
- Modify: `packages/app/src/pages/session/v2/session-file-browser-tab.tsx`

**Interfaces:**
- Produces:
  - `fileManagerMenuItems(node: { type: "file" | "directory"; path: string; name: string }): Array<"newFile" | "newFolder" | "rename" | "delete" | "download">` (pure)
  - `<FileManagerToolbar onNewFile onNewFolder onUpload onRefresh />`
  - `<FileManagerMenu node onAction />` (context menu; mobile mở bằng nút `⋯` khi row đang active)
  - `<ConfirmDialogV2 title description confirmLabel requireTypedName? onConfirm onCancel />`
  - i18n keys: `file.manager.newFile`, `file.manager.newFolder`, `file.manager.upload`, `file.manager.refresh`, `file.manager.rename`, `file.manager.delete`, `file.manager.download`, `file.confirm.delete.title`, `file.confirm.delete.description`, `file.confirm.typeName`, `file.ops.failed`.

- [ ] **Step 1: Test model trước**

`file-manager-v2-model.test.ts`:
```ts
import { describe, expect, test } from "bun:test"
import { fileManagerMenuItems } from "./file-manager-v2-model"

describe("fileManagerMenuItems", () => {
  test("folders can create and delete but not download", () => {
    expect(fileManagerMenuItems({ type: "directory", path: "a", name: "a" })).toEqual([
      "newFile",
      "newFolder",
      "rename",
      "delete",
    ])
  })
  test("files can rename, delete and download", () => {
    expect(fileManagerMenuItems({ type: "file", path: "a.txt", name: "a.txt" })).toEqual([
      "rename",
      "delete",
      "download",
    ])
  })
})
```

- [ ] **Step 2: Chạy test fail**

Run: `cd packages/app; bun test --conditions=solid --preload ./happydom.ts src/components/file-manager-v2-model.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement model + i18n keys + sync script**

`file-manager-v2-model.ts`:
```ts
export type FileManagerAction = "newFile" | "newFolder" | "rename" | "delete" | "download"

export function fileManagerMenuItems(node: { type: "file" | "directory"; path: string; name: string }): FileManagerAction[] {
  if (node.type === "directory") return ["newFile", "newFolder", "rename", "delete"]
  return ["rename", "delete", "download"]
}

export function newTargetPath(directory: string, name: string) {
  return `${directory.replace(/\/+$/, "")}/${name}`
}
```
`en.ts` thêm các key ở mục `file.manager.*`/`file.confirm.*`/`file.ops.failed` với English text. Script sync (chạy 1 lần, có thể giữ lại trong repo):
```ts
// packages/app/scripts/custom-i18n-sync.ts
import { readdir, readFile, writeFile } from "fs/promises"
import path from "path"

const dir = path.join(import.meta.dir, "..", "src", "i18n")
const source = await readFile(path.join(dir, "en.ts"), "utf8")

function keys(text: string) {
  return new Map(Array.from(text.matchAll(/^\s*"([^"]+)":\s*(".*?"),?$/gm), (match) => [match[1], match[2]]))
}

const sourceKeys = keys(source)
for (const entry of await readdir(dir)) {
  if (!entry.endsWith(".ts") || entry === "en.ts" || entry.includes("test")) continue
  const file = path.join(dir, entry)
  const text = await readFile(file, "utf8")
  const existing = keys(text)
  const missing = [...sourceKeys].filter(([key]) => !existing.has(key))
  if (missing.length === 0) continue
  const insertAt = text.lastIndexOf("}")
  const additions = missing.map(([key, value]) => `  ${JSON.stringify(key)}: ${value},`).join("\n")
  await writeFile(file, text.slice(0, insertAt) + additions + "\n" + text.slice(insertAt), "utf8")
  console.log(`${entry}: +${missing.length}`)
}
```
Chạy: `cd packages/app; bun scripts/custom-i18n-sync.ts` rồi `bun test --conditions=solid --preload ./happydom.ts src/i18n/parity.test.ts` → PASS.

- [ ] **Step 4: Implement `ConfirmDialogV2`**

Dùng `Dialog`/`DialogHeader`/`DialogFooter` từ `@opencode-ai/ui/v2/dialog-v2` + `ButtonV2` (xem mẫu ở `dialog-select-directory-v2.tsx`). Props: `title`, `description`, `confirmLabel`, `destructive?: boolean`, `requireTypedName?: string`, `onConfirm`, `onCancel`. Nút confirm disabled khi `requireTypedName` set và input khác giá trị.

- [ ] **Step 5: Implement `FileManagerToolbar` + `FileManagerMenu`**

`file-manager-v2.tsx`: toolbar 4 nút (dùng `ButtonV2 size="small" variant="ghost"` + `Icon`), menu render từ `fileManagerMenuItems(node)`, mỗi action gọi callback props (`onAction(action, node)`). Mobile: nút `⋯` hiện khi row được chọn (long-press không cần ở P1).

- [ ] **Step 6: Wire vào tree + browser tab**

`file-tree-v2.tsx`: thêm props `onContextMenu?: (node: FileTreeV2Node, event: MouseEvent) => void`, `onActiveChange?: (node: FileTreeV2Node | undefined) => void`; gắn `onContextMenu`, và với mỗi row set active khi click. Trong row file/directory hiện có, thêm `<Show when={...}>` nút `⋯` gọi `props.onContextMenu`.

`session-file-browser-tab.tsx`: state `menuNode` + `confirmState`; toolbar:
- New file / New folder → prompt tên (dùng `DialogConfirmV2` variant nhập text hoặc dialog nhỏ riêng) → `file.ops.mkdir(newTargetPath(dir, name))` / `file.ops.write(..., "")` → toast.
- Upload → Task 11 component.
- Refresh → `file.tree.refresh(dir)`.
Menu actions:
- rename → dialog nhập tên mới → `file.ops.rename(old, newTargetPath(parentOf(old), name))`
- delete → `ConfirmDialogV2` (folder không rỗng: `requireTypedName: node.name`; gọi `file.ops.remove(path, true)` cho folder) 
- download → tạo `<a href={file.ops.downloadUrl(path, location.origin)} download>` và click.

- [ ] **Step 7: Chạy test app**

Run: `cd packages/app; bun test --conditions=solid --preload ./happydom.ts src/components/file-manager-v2-model.test.ts src/i18n/parity.test.ts`
Expected: PASS.

- [ ] **Step 8: Typecheck + commit**

Run: `cd packages/app; bun run typecheck`
Expected: pass.

```bash
git add -A packages/app
git commit -m "feat(app): file manager toolbar and context menu"
```

---

### Task 10: Editor (edit + save)

**Files:**
- Create: `packages/app/src/pages/session/v2/file-editor-model.ts` + `.test.ts`
- Create: `packages/app/src/pages/session/v2/file-editor-v2.tsx`
- Modify: `packages/app/src/pages/session/file-tabs.tsx`

**Interfaces:**
- Produces: `createDirtyState()` với `markDirty(path, draft)`, `clear(path)`, `isDirty(path)`, `draft(path)`; `EDIT_MAX_BYTES = 5 * 1024 * 1024`; component `<FileEditorV2 path content onSave />`.

- [ ] **Step 1: Test model fail**

```ts
import { describe, expect, test } from "bun:test"
import { createDirtyState, EDIT_MAX_BYTES } from "./file-editor-model"

describe("dirty state", () => {
  test("tracks drafts and clears on save", () => {
    const state = createDirtyState()
    expect(state.isDirty("a.txt")).toBe(false)
    state.markDirty("a.txt", "draft")
    expect(state.isDirty("a.txt")).toBe(true)
    expect(state.draft("a.txt")).toBe("draft")
    state.clear("a.txt")
    expect(state.isDirty("a.txt")).toBe(false)
  })
  test("only text files under the cap are editable", () => {
    expect(EDIT_MAX_BYTES).toBe(5 * 1024 * 1024)
  })
})
```

- [ ] **Step 2: Chạy fail → implement model → chạy pass**

Run: `cd packages/app; bun test --conditions=solid --preload ./happydom.ts src/pages/session/v2/file-editor-model.test.ts`

- [ ] **Step 3: Editor component**

`file-editor-v2.tsx`: `<textarea class="w-full h-full font-mono text-12-regular ..." value={draft()} onInput={...} />` + hàng nút: `Save` (`Ctrl/Cmd+S` qua `onKeyDown`), `Revert`. Props: `content: string`, `onSave: (value: string) => Promise<void>`, `saving: boolean`.

- [ ] **Step 4: Wire vào `SessionFileView`**

Trong `file-tabs.tsx` (xem `SessionFileView` tại dòng ~216): state `editing` + `dirty` (từ model), nút `Edit` khi `content.type === "text"` và `content.content.length <= EDIT_MAX_BYTES`; khi editing render `<FileEditorV2>` thay viewer; Save gọi `file.ops.write(path, value)` rồi `clear(path)` + reload file (`file.load(path, { force: true })`). Khi bấm nút Edit lần đầu: `markDirty(path, content.content)`.

- [ ] **Step 5: Chạy test + typecheck + commit**

Run: `cd packages/app; bun test --conditions=solid --preload ./happydom.ts src/pages/session/v2/file-editor-model.test.ts && bun run typecheck`

```bash
git add -A packages/app
git commit -m "feat(app): inline file editor with save"
```

---

### Task 11: Upload UI (input + queue)

**Files:**
- Create: `packages/app/src/components/file-upload-queue.ts` + `.test.ts`
- Create: `packages/app/src/components/file-upload-v2.tsx`
- Modify: `packages/app/src/pages/session/v2/session-file-browser-tab.tsx`

**Interfaces:**
- Produces: `createUploadQueue(run: (item: { file: File; target: string }) => Promise<void>)` với `enqueue(items)`, `state()`, `cancelAll()`; hằng `UPLOAD_WARN_BYTES = 100 * 1024 * 1024`.

- [ ] **Step 1: Test queue fail**

```ts
import { describe, expect, test } from "bun:test"
import { createUploadQueue, UPLOAD_WARN_BYTES } from "./file-upload-queue"

describe("upload queue", () => {
  test("runs uploads sequentially and tracks state", async () => {
    const order: string[] = []
    const queue = createUploadQueue(async (item) => {
      order.push(item.file.name)
    })
    const file = (name: string) => new File([new Uint8Array([1])], name)
    await queue.enqueue([
      { file: file("a.bin"), target: "/tmp/a.bin" },
      { file: file("b.bin"), target: "/tmp/b.bin" },
    ])
    expect(order).toEqual(["a.bin", "b.bin"])
    expect(queue.state().done).toBe(2)
    expect(queue.state().failed).toBe(0)
  })
  test("keeps going after a failure", async () => {
    const queue = createUploadQueue(async (item) => {
      if (item.file.name === "bad.bin") throw new Error("no")
    })
    const file = (name: string) => new File([new Uint8Array([1])], name)
    await queue.enqueue([
      { file: file("bad.bin"), target: "/tmp/bad.bin" },
      { file: file("ok.bin"), target: "/tmp/ok.bin" },
    ])
    expect(queue.state().failed).toBe(1)
    expect(queue.state().done).toBe(1)
    expect(UPLOAD_WARN_BYTES).toBe(100 * 1024 * 1024)
  })
})
```

- [ ] **Step 2: Implement queue + chạy pass**

Run: `cd packages/app; bun test --conditions=solid --preload ./happydom.ts src/components/file-upload-queue.test.ts`

- [ ] **Step 3: UI upload**

`file-upload-v2.tsx`: `<input type="file" multiple style="display:none" ref>` + nút trigger; trước khi enqueue, cảnh báo `window.confirm` cho file > `UPLOAD_WARN_BYTES`; hiển thị tiến trình bằng text `n/total` + toast khi xong. Drag&drop: thêm `onDragOver`/`onDrop` trên wrapper của tree trong `session-file-browser-tab.tsx`, target = thư mục đang active (hoặc root của project).

- [ ] **Step 4: Commit**

```bash
git add -A packages/app
git commit -m "feat(app): file upload with queue and warnings"
```

---

### Task 12: Deploy lên VPS + E2E

**Files:**
- Create: `scripts/deploy-custom.sh`
- Create (local, không commit): `C:\Users\minha\AppData\Local\Temp\opencode\vps_upload.py` (paramiko SFTP helper)

**Interfaces:**
- Consumes: artifact Task 1, VPS `160.187.240.56:25901` (root/`quancoder`), service `opencode-web`.

- [ ] **Step 1: Viết deploy script**

`scripts/deploy-custom.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
REPO=qu4nc0d3r/opencode
RUN=$(gh run list --repo "$REPO" --workflow custom-build.yml --branch custom-fs --limit 1 --json databaseId --jq '.[0].databaseId')
rm -rf /tmp/opencode-custom
mkdir -p /tmp/opencode-custom
gh run download "$RUN" --repo "$REPO" -n opencode-linux-x64 -D /tmp/opencode-custom
ls -la /tmp/opencode-custom/opencode
echo "Binary ready at /tmp/opencode-custom/opencode"
```

- [ ] **Step 2: Push code + chờ build xanh**

```bash
git push origin custom-fs
gh run watch "$(gh run list --repo qu4nc0d3r/opencode --workflow custom-build.yml --limit 1 --json databaseId --jq '.[0].databaseId')" --repo qu4nc0d3r/opencode
bash scripts/deploy-custom.sh
```
Expected: artifact tải về, ~170–200MB.

- [ ] **Step 3: Upload binary lên VPS**

Tạo `vps_upload.py` (paramiko SFTP):
```python
import os, sys, paramiko
host, port = os.environ["VPS_HOST"], int(os.environ["VPS_PORT"])
local, remote = sys.argv[1], sys.argv[2]
t = paramiko.Transport((host, port)); t.start_client(timeout=30)
t.auth_password("root", os.environ["VPS_PASSWORD"])
sftp = paramiko.SFTPClient.from_transport(t)
sftp.put(local, remote)
sftp.chmod(remote, 0o755)
print("uploaded", remote)
t.close()
```
Run:
```
python vps_upload.py /tmp/opencode-custom/opencode /tmp/opencode-custom-bin
```

- [ ] **Step 4: Swap binary + restart (có backup, có rollback)**

Chạy qua `vps_run.py`:
```
cp /usr/bin/opencode /usr/bin/opencode.bak; install -m 755 /tmp/opencode-custom-bin /usr/bin/opencode; systemctl restart opencode-web; sleep 5; systemctl is-active opencode-web; journalctl -u opencode-web --no-pager -n 5 | tail -5
```
Expected: `active`, log có dòng `Web interface: http://127.0.0.1:3082/`.

- [ ] **Step 5: E2E checklist trên mobile**

1. `https://agent.hehez.net` → "Add project" → mở cây thư mục → điều hướng vào `/root/projects` (nút `Parent`/`Root`/gõ path) → chọn folder con → project được thêm.
2. Mở session → file tree → toolbar "New folder" tạo `/root/opencode-workspace/demo` → SSH kiểm chứng `ls`.
3. Tạo file mới, mở, sửa nội dung, Save → SSH `cat` đúng nội dung.
4. Upload 1 ảnh từ điện thoại vào folder → tải lại (download) mở được.
5. Rename + Delete (confirm) hoạt động; xóa folder không rỗng đòi gõ tên.
6. `cat /root/.local/share/opencode/audit/fs.jsonl | tail` → có bản ghi các thao tác.
7. Nếu bước nào fail: ghi lại lỗi + stack từ `journalctl -u opencode-web`, sửa, lặp Step 2.

- [ ] **Step 6: Commit script + ghi chú deploy**

```bash
git add scripts/deploy-custom.sh
git commit -m "chore: custom deploy script"
git push origin custom-fs
```

---

## Self-Review

- **Spec coverage:** API P1 (write/mkdir/rename/remove/upload/download) → Task 2–4; audit → Task 5; picker V2 cho web → Task 7; client ops → Task 8; file manager toolbar/menu/confirm → Task 9; editor → Task 10; upload → Task 11; CI + deploy + E2E → Task 1, 12. P2 (copy/move/zip) nằm ngoài plan này — đúng phạm vi P1.
- **Placeholder scan:** còn 2 chỗ cần chốt khi execute: (a) shape params SDK sau generate (Task 6 Step 2 quyết định), (b) `Schema.Uint8Array` có tồn tại không (Task 4 Step 3 có fallback). Cả hai đã ghi rõ cách xử lý, không phải TBD mơ hồ.
- **Type consistency:** endpoint names `write/mkdir/rename/remove/upload/download` dùng thống nhất giữa groups/handlers/tests/ops; `FileMutationResult`, `FileOperationError`, `resolveTarget`, `createFileOps`, `fileManagerMenuItems`, `createUploadQueue`, `createDirtyState` xuất hiện đúng ở task tạo và task dùng.
