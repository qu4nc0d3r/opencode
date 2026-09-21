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
  const base =
    inputPaths.paths.length === 1 ? path.dirname(path.resolve(inputPaths.paths[0])) : commonParent(inputPaths.paths)
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
