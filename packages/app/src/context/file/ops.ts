export type FileOpsDeps = {
  directory: () => string
  api: {
    write: (input: {
      directory: string
      path: string
      content: string
      encoding?: "utf8" | "base64"
    }) => Promise<unknown>
    mkdir: (input: { directory: string; path: string; recursive?: boolean }) => Promise<unknown>
    rename: (input: { directory: string; from: string; to: string }) => Promise<unknown>
    remove: (input: { directory: string; path: string; recursive?: boolean }) => Promise<unknown>
    copy: (input: { directory: string; from: string; to: string; overwrite?: boolean }) => Promise<unknown>
    archive: (input: { directory: string; paths: string[]; dest: string }) => Promise<unknown>
    extract: (input: { directory: string; path: string; dest?: string }) => Promise<unknown>
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
      run(() => deps.api.write({ directory: deps.directory(), path: target, content, encoding }), target),
    mkdir: (target: string) => run(() => deps.api.mkdir({ directory: deps.directory(), path: target }), target),
    rename: (from: string, to: string) =>
      run(() => deps.api.rename({ directory: deps.directory(), from, to }), to).then((ok) => {
        if (ok) deps.refresh(parentOf(from))
        return ok
      }),
    remove: (target: string, recursive?: boolean) =>
      run(() => deps.api.remove({ directory: deps.directory(), path: target, recursive }), target),
    copy: (from: string, to: string, overwrite?: boolean) =>
      run(() => deps.api.copy({ directory: deps.directory(), from, to, overwrite }), to),
    archive: (paths: string[], dest: string) =>
      run(() => deps.api.archive({ directory: deps.directory(), paths, dest }), dest),
    extract: (target: string, dest?: string) =>
      run(() => deps.api.extract({ directory: deps.directory(), path: target, dest }), dest ?? target),
    async upload(target: string, data: Uint8Array) {
      try {
        const response = await fetch(
          `/file/upload?path=${encodeURIComponent(target)}&directory=${encodeURIComponent(deps.directory())}`,
          { method: "PUT", body: data as BodyInit },
        )
        if (!response.ok) throw new Error(`upload failed: ${response.status}`)
        deps.refresh(parentOf(target))
        return { bytes: data.byteLength }
      } catch (error) {
        deps.onError(error instanceof Error ? error.message : String(error))
        return { bytes: 0 }
      }
    },
    downloadUrl: (target: string, serverUrl: string) =>
      `${serverUrl}/file/download?${new URLSearchParams({ path: target }).toString()}`,
  }
}
