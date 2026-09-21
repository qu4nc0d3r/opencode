import { readdir, readFile, writeFile } from "fs/promises"
import path from "path"

const dir = path.join(import.meta.dir, "..", "src", "i18n")
const source = await readFile(path.join(dir, "en.ts"), "utf8")

function keys(text: string) {
  return new Map(Array.from(text.matchAll(/^\s*"([^"]+)":\s*(".*?"),?$/gm), (match) => [match[1], match[2]]))
}

const sourceKeys = keys(source)
let touched = 0
let added = 0

for (const entry of await readdir(dir)) {
  if (!entry.endsWith(".ts") || entry === "en.ts" || entry.includes("test") || entry === "desktop-native.ts") continue
  const file = path.join(dir, entry)
  const text = await readFile(file, "utf8")
  const existing = keys(text)
  const missing = [...sourceKeys].filter(([key]) => !existing.has(key))
  if (missing.length === 0) continue
  const insertAt = text.lastIndexOf("}")
  const additions = missing.map(([key, value]) => `  ${JSON.stringify(key)}: ${value},`).join("\n")
  await writeFile(file, text.slice(0, insertAt) + additions + "\n" + text.slice(insertAt), "utf8")
  touched += 1
  added += missing.length
  console.log(`${entry}: +${missing.length}`)
}

console.log(`synced ${added} keys into ${touched} locale files`)
