import { FileSystem } from "@opencode-ai/core/filesystem"
import { NonNegativeInt } from "@opencode-ai/core/schema"
import { LSP } from "@/lsp/lsp"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiError, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { Authorization } from "../middleware/authorization"
import { InstanceContextMiddleware } from "../middleware/instance-context"
import {
  WorkspaceRoutingMiddleware,
  WorkspaceRoutingQuery,
  WorkspaceRoutingQueryFields,
} from "../middleware/workspace-routing"
import { described } from "./metadata"

export const FileQuery = Schema.Struct({
  ...WorkspaceRoutingQueryFields,
  path: Schema.String,
})

export const FindTextQuery = Schema.Struct({
  ...WorkspaceRoutingQueryFields,
  pattern: Schema.String,
})

export const FindFileQuery = Schema.Struct({
  ...WorkspaceRoutingQueryFields,
  query: Schema.String,
  dirs: Schema.optional(Schema.Literals(["true", "false"])),
  type: Schema.optional(Schema.Literals(["file", "directory"])),
  limit: Schema.optional(
    Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(200)),
  ),
})

export const FindSymbolQuery = Schema.Struct({
  ...WorkspaceRoutingQueryFields,
  query: Schema.String,
})

export const LegacyMatch = Schema.Struct({
  path: Schema.Struct({ text: Schema.String }),
  lines: Schema.Struct({ text: Schema.String }),
  line_number: NonNegativeInt,
  absolute_offset: NonNegativeInt,
  submatches: Schema.Array(
    Schema.Struct({
      match: Schema.Struct({ text: Schema.String }),
      start: NonNegativeInt,
      end: NonNegativeInt,
    }),
  ),
})

export const LegacyEntry = Schema.Struct({
  name: Schema.String,
  path: Schema.String,
  absolute: Schema.String,
  type: Schema.Literals(["file", "directory"]),
  ignored: Schema.Boolean,
}).annotate({ identifier: "FileNode" })

export const LegacyContent = Schema.Struct({
  type: Schema.Literals(["text", "binary"]),
  content: Schema.String,
  diff: Schema.optional(Schema.String),
  patch: Schema.optional(
    Schema.Struct({
      oldFileName: Schema.String,
      newFileName: Schema.String,
      oldHeader: Schema.optional(Schema.String),
      newHeader: Schema.optional(Schema.String),
      hunks: Schema.Array(
        Schema.Struct({
          oldStart: NonNegativeInt,
          oldLines: NonNegativeInt,
          newStart: NonNegativeInt,
          newLines: NonNegativeInt,
          lines: Schema.Array(Schema.String),
        }),
      ),
      index: Schema.optional(Schema.String),
    }),
  ),
  encoding: Schema.optional(Schema.Literal("base64")),
  mimeType: Schema.optional(Schema.String),
}).annotate({ identifier: "FileContent" })

export const LegacyStatus = Schema.Struct({
  path: Schema.String,
  added: NonNegativeInt,
  removed: NonNegativeInt,
  status: Schema.Literals(["added", "deleted", "modified"]),
}).annotate({ identifier: "File" })

export const WritePayload = Schema.Struct({
  path: Schema.String,
  content: Schema.String,
  encoding: Schema.optional(Schema.Literals(["utf8", "base64"])),
})

export const MkdirPayload = Schema.Struct({
  path: Schema.String,
  recursive: Schema.optional(Schema.Boolean),
})

export const RenamePayload = Schema.Struct({
  from: Schema.String,
  to: Schema.String,
})

export const RemovePayload = Schema.Struct({
  path: Schema.String,
  recursive: Schema.optional(Schema.Boolean),
})

export const CopyPayload = Schema.Struct({
  from: Schema.String,
  to: Schema.String,
  overwrite: Schema.optional(Schema.Boolean),
})

export const ArchivePayload = Schema.Struct({
  paths: Schema.Array(Schema.String),
  dest: Schema.String,
})

export const ExtractPayload = Schema.Struct({
  path: Schema.String,
  dest: Schema.optional(Schema.String),
})

export const UploadQuery = Schema.Struct({
  ...WorkspaceRoutingQueryFields,
  path: Schema.String,
})

export const DownloadQuery = Schema.Struct({
  ...WorkspaceRoutingQueryFields,
  path: Schema.String,
})

export const FileMutationResult = Schema.Struct({ path: Schema.String }).annotate({
  identifier: "FileMutationResult",
})

export const UploadResult = Schema.Struct({
  path: Schema.String,
  bytes: Schema.Number,
}).annotate({ identifier: "FileUploadResult" })

export const ArchiveResult = Schema.Struct({
  path: Schema.String,
  bytes: Schema.Number,
}).annotate({ identifier: "FileArchiveResult" })

export class FileOperationError extends Schema.TaggedErrorClass<FileOperationError>()(
  "FileOperationError",
  {
    message: Schema.String,
    operation: Schema.optional(Schema.String),
    path: Schema.optional(Schema.String),
  },
  { httpApiStatus: 400 },
) {}

export const FilePaths = {
  findText: "/find",
  findFile: "/find/file",
  findSymbol: "/find/symbol",
  list: "/file",
  content: "/file/content",
  status: "/file/status",
  write: "/file/write",
  mkdir: "/file/mkdir",
  rename: "/file/rename",
  remove: "/file/remove",
  copy: "/file/copy",
  archive: "/file/archive",
  extract: "/file/extract",
  upload: "/file/upload",
  download: "/file/download",
} as const

export const FileApi = HttpApi.make("file")
  .add(
    HttpApiGroup.make("file")
      .add(
        HttpApiEndpoint.get("findText", FilePaths.findText, {
          query: FindTextQuery,
          success: described(Schema.Array(LegacyMatch), "Matches"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "find.text",
            summary: "Find text",
            description: "Search for text patterns across files in the project using ripgrep.",
          }),
        ),
        HttpApiEndpoint.get("findFile", FilePaths.findFile, {
          query: FindFileQuery,
          success: described(Schema.Array(Schema.String), "File paths"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "find.files",
            summary: "Find files",
            description: "Search for files or directories by name or pattern in the project directory.",
          }),
        ),
        HttpApiEndpoint.get("findSymbol", FilePaths.findSymbol, {
          query: FindSymbolQuery,
          success: described(Schema.Array(LSP.Symbol), "Symbols"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "find.symbols",
            summary: "Find symbols",
            description: "Search for workspace symbols like functions, classes, and variables using LSP.",
          }),
        ),
        HttpApiEndpoint.get("list", FilePaths.list, {
          query: FileQuery,
          success: described(Schema.Array(LegacyEntry), "Files and directories"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "file.list",
            summary: "List files",
            description: "List files and directories in a specified path.",
          }),
        ),
        HttpApiEndpoint.get("content", FilePaths.content, {
          query: FileQuery,
          success: described(LegacyContent, "File content"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "file.read",
            summary: "Read file",
            description: "Read the content of a specified file.",
          }),
        ),
        HttpApiEndpoint.get("status", FilePaths.status, {
          query: WorkspaceRoutingQuery,
          success: described(Schema.Array(LegacyStatus), "File status"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "file.status",
            summary: "Get file status",
            description: "Get the git status of all files in the project.",
          }),
        ),
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
        HttpApiEndpoint.post("rename", FilePaths.rename, {
          query: WorkspaceRoutingQuery,
          payload: RenamePayload,
          success: described(FileMutationResult, "Renamed path"),
          error: [HttpApiError.BadRequest, FileOperationError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "file.rename",
            summary: "Rename file",
            description: "Move a file or directory, creating parent directories when missing.",
          }),
        ),
        HttpApiEndpoint.post("remove", FilePaths.remove, {
          query: WorkspaceRoutingQuery,
          payload: RemovePayload,
          success: described(FileMutationResult, "Removed path"),
          error: [HttpApiError.BadRequest, FileOperationError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "file.remove",
            summary: "Remove file",
            description: "Delete a file or directory. Non-empty directories require recursive.",
          }),
        ),
        HttpApiEndpoint.post("copy", FilePaths.copy, {
          query: WorkspaceRoutingQuery,
          payload: CopyPayload,
          success: described(FileMutationResult, "Copied path"),
          error: [HttpApiError.BadRequest, FileOperationError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "file.copy",
            summary: "Copy file",
            description: "Copy a file or directory, refusing to overwrite the destination unless requested.",
          }),
        ),
        HttpApiEndpoint.post("archive", FilePaths.archive, {
          query: WorkspaceRoutingQuery,
          payload: ArchivePayload,
          success: described(ArchiveResult, "Created archive"),
          error: [HttpApiError.BadRequest, FileOperationError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "file.archive",
            summary: "Archive files",
            description: "Compress one or more files or directories into a zip archive.",
          }),
        ),
        HttpApiEndpoint.post("extract", FilePaths.extract, {
          query: WorkspaceRoutingQuery,
          payload: ExtractPayload,
          success: described(FileMutationResult, "Extracted archive"),
          error: [HttpApiError.BadRequest, FileOperationError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "file.extract",
            summary: "Extract archive",
            description: "Extract a zip archive, rejecting entries that escape the destination.",
          }),
        ),
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
      )
      .annotateMerge(
        OpenApi.annotations({
          title: "file",
          description: "Experimental HttpApi file routes.",
        }),
      )
      .middleware(InstanceContextMiddleware)
      .middleware(WorkspaceRoutingMiddleware)
      .middleware(Authorization),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "opencode experimental HttpApi",
      version: "0.0.1",
      description: "Experimental HttpApi surface for selected instance routes.",
    }),
  )
