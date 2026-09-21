import * as InstanceState from "@/effect/instance-state"
import { AuditLog } from "@/file/audit"
import { FileSystem } from "@opencode-ai/core/filesystem"
import { LocationServiceMap, locationServiceMapLayer } from "@opencode-ai/core/location-services"
import { Ripgrep } from "@opencode-ai/core/ripgrep"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Location } from "@opencode-ai/core/location"
import { AbsolutePath, RelativePath } from "@opencode-ai/core/schema"
import { Effect, Layer, Option } from "effect"
import ignore from "ignore"
import * as fsPromises from "fs/promises"
import path from "path"
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { FileOperationError } from "../groups/file"
import { InstanceHttpApi } from "../api"

export const fileHandlers = HttpApiBuilder.group(InstanceHttpApi, "file", (handlers) =>
  Effect.gen(function* () {
    const ripgrep = yield* Ripgrep.Service
    const locations = yield* LocationServiceMap.Service

    const filesystem = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
      return yield* effect.pipe(
        Effect.provide(
          locations.get(Location.Ref.make({ directory: AbsolutePath.make((yield* InstanceState.context).directory) })),
        ),
      )
    })

    const findText = Effect.fn("FileHttpApi.findText")(function* (ctx: { query: { pattern: string } }) {
      return (yield* ripgrep
        .grep({ cwd: (yield* InstanceState.context).directory, pattern: ctx.query.pattern, limit: 10 })
        .pipe(Effect.orDie)).map((match) => ({
        path: { text: match.entry.path },
        lines: { text: match.text },
        line_number: match.line,
        absolute_offset: match.offset,
        submatches: match.submatches.map((submatch) => ({
          match: { text: submatch.text },
          start: submatch.start,
          end: submatch.end,
        })),
      }))
    })

    const findFile = Effect.fn("FileHttpApi.findFile")(function* (ctx: {
      query: { query: string; dirs?: "true" | "false"; type?: "file" | "directory"; limit?: number }
    }) {
      const directory = (yield* InstanceState.context).directory
      const limit = ctx.query.limit ?? 10
      const type = ctx.query.type ?? (ctx.query.dirs === "false" ? "file" : undefined)
      const started = performance.now()
      const found = yield* filesystem(FileSystem.Service.use((fs) => fs.find({ query: ctx.query.query, limit, type })))
      yield* Effect.logInfo("find file", {
        query: ctx.query.query,
        type,
        directory,
        limit,
        results: found.length,
        duration: Math.round(performance.now() - started),
      })
      return found.map((item) => item.path)
    })

    const findSymbol = Effect.fn("FileHttpApi.findSymbol")(function* () {
      return []
    })

    const list = Effect.fn("FileHttpApi.list")(function* (ctx: { query: { path: string } }) {
      const directory = (yield* InstanceState.context).directory
      return yield* filesystem(
        Effect.gen(function* () {
          const fs = yield* FileSystem.Service
          const raw = yield* FSUtil.Service
          const location = yield* Location.Service
          const ignored = ignore()
          const gitignore = yield* raw
            .readFileString(path.join(location.project.directory, ".gitignore"))
            .pipe(Effect.catch(() => Effect.succeed("")))
          if (gitignore) ignored.add(gitignore)
          const ignorefile = yield* raw
            .readFileString(path.join(location.project.directory, ".ignore"))
            .pipe(Effect.catch(() => Effect.succeed("")))
          if (ignorefile) ignored.add(ignorefile)
          return (yield* fs.list({ path: RelativePath.make(ctx.query.path) })).map((item) => ({
            name: path.basename(item.path),
            path: item.path,
            absolute: path.resolve(location.directory, item.path),
            type: item.type,
            ignored: ignored.ignores(
              path.relative(location.project.directory, path.resolve(location.directory, item.path)) +
                (item.type === "directory" ? "/" : ""),
            ),
          }))
        }),
      )
    })

    const content = Effect.fn("FileHttpApi.content")(function* (ctx: { query: { path: string } }) {
      const directory = (yield* InstanceState.context).directory
      const file = path.resolve(directory, ctx.query.path)
      if (!FSUtil.contains(directory, file)) return yield* Effect.die(new Error("Path escapes the location"))
      if (!(yield* FSUtil.Service.use((fs) => fs.existsSafe(file)))) return { type: "text" as const, content: "" }
      return yield* filesystem(
        FileSystem.Service.use((fs) => fs.read({ path: RelativePath.make(ctx.query.path) })),
      ).pipe(
        Effect.flatMap((item) =>
          Effect.gen(function* () {
            const text = item.content.includes(0)
              ? Option.none<string>()
              : yield* Effect.sync(() => new TextDecoder("utf-8", { fatal: true }).decode(item.content)).pipe(
                  Effect.option,
                )
            return { item, text }
          }),
        ),
        Effect.map(({ item, text }) =>
          Option.isSome(text)
            ? { type: "text" as const, content: text.value.trim() }
            : {
                type: "binary" as const,
                content: Buffer.from(item.content).toString("base64"),
                encoding: "base64" as const,
                mimeType: item.mime,
              },
        ),
      )
    })

    const status = Effect.fn("FileHttpApi.status")(function* () {
      return []
    })

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
      const bytes =
        ctx.payload.encoding === "base64" ? Buffer.from(ctx.payload.content, "base64") : ctx.payload.content
      yield* Effect.tryPromise({
        try: async () => {
          await fsPromises.mkdir(path.dirname(target), { recursive: true })
          await fsPromises.writeFile(target, bytes)
        },
        catch: (cause) => new FileOperationError({ message: String(cause), operation: "write", path: target }),
      }).pipe(
        Effect.tapError((error) =>
          Effect.promise(() => AuditLog.record({ op: "write", path: target, ok: false, error: String(error) })),
        ),
      )
      yield* Effect.promise(() => AuditLog.record({ op: "write", path: target, ok: true }))
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
        catch: (cause) => new FileOperationError({ message: String(cause), operation: "mkdir", path: target }),
      }).pipe(
        Effect.tapError((error) =>
          Effect.promise(() => AuditLog.record({ op: "mkdir", path: target, ok: false, error: String(error) })),
        ),
      )
      yield* Effect.promise(() => AuditLog.record({ op: "mkdir", path: target, ok: true }))
      return { path: target }
    })

    const rename = Effect.fn("FileHttpApi.rename")(function* (ctx: { payload: { from: string; to: string } }) {
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
      }).pipe(
        Effect.tapError((error) =>
          Effect.promise(() => AuditLog.record({ op: "rename", from, to, ok: false, error: String(error) })),
        ),
      )
      yield* Effect.promise(() => AuditLog.record({ op: "rename", from, to, ok: true }))
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
      }).pipe(
        Effect.tapError((error) =>
          Effect.promise(() => AuditLog.record({ op: "remove", path: target, ok: false, error: String(error) })),
        ),
      )
      yield* Effect.promise(() => AuditLog.record({ op: "remove", path: target, ok: true }))
      return { path: target }
    })

    const upload = Effect.fn("FileHttpApi.upload")(function* (ctx: {
      query: { path: string }
      request: HttpServerRequest.HttpServerRequest
    }) {
      const directory = (yield* InstanceState.context).directory
      const target = resolveTarget(directory, ctx.query.path)
      if (!target) return HttpServerResponse.empty({ status: 400 })
      yield* Effect.tryPromise({
        try: () => fsPromises.mkdir(path.dirname(target), { recursive: true }),
        catch: () => new FileOperationError({ message: "mkdir failed", operation: "upload", path: target }),
      }).pipe(
        Effect.tapError((error) =>
          Effect.promise(() => AuditLog.record({ op: "upload", path: target, ok: false, error: String(error) })),
        ),
      )
      const bytes = new Uint8Array(
        yield* ctx.request.arrayBuffer.pipe(
          Effect.mapError(
            (cause) => new FileOperationError({ message: String(cause), operation: "upload", path: target }),
          ),
        ),
      )
      yield* Effect.tryPromise({
        try: () => fsPromises.writeFile(target, bytes),
        catch: (cause) => new FileOperationError({ message: String(cause), operation: "upload", path: target }),
      }).pipe(
        Effect.tapError((error) =>
          Effect.promise(() => AuditLog.record({ op: "upload", path: target, ok: false, error: String(error) })),
        ),
      )
      yield* Effect.promise(() => AuditLog.record({ op: "upload", path: target, ok: true, bytes: bytes.byteLength }))
      return HttpServerResponse.jsonUnsafe({ path: target, bytes: bytes.byteLength })
    })

    const download = Effect.fn("FileHttpApi.download")(function* (ctx: {
      query: { path: string }
      request: HttpServerRequest.HttpServerRequest
    }) {
      const directory = (yield* InstanceState.context).directory
      const target = resolveTarget(directory, ctx.query.path)
      if (!target) return HttpServerResponse.empty({ status: 400 })
      const stat = yield* Effect.promise(() => fsPromises.stat(target).catch(() => undefined))
      if (!stat || !stat.isFile()) return HttpServerResponse.empty({ status: 404 })
      const body = yield* Effect.promise(() => fsPromises.readFile(target))
      const name = path.basename(target).replace(/["\\\r\n]/g, "_")
      return HttpServerResponse.uint8Array(new Uint8Array(body), {
        contentType: FSUtil.mimeType(target),
        headers: {
          "content-disposition": `attachment; filename="${name}"`,
          "content-length": String(body.byteLength),
        },
      })
    })

    return handlers
      .handle("findText", findText)
      .handle("findFile", findFile)
      .handle("findSymbol", findSymbol)
      .handle("list", list)
      .handle("content", content)
      .handle("status", status)
      .handle("write", write)
      .handle("mkdir", mkdir)
      .handle("rename", rename)
      .handle("remove", remove)
      .handleRaw("upload", upload)
      .handleRaw("download", download)
  }),
).pipe(Layer.provide(locationServiceMapLayer))
