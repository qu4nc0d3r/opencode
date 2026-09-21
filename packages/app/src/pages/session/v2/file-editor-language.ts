const LANGUAGES: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  json: "json",
  css: "css",
  scss: "scss",
  html: "html",
  md: "markdown",
  py: "python",
  go: "go",
  rs: "rust",
  java: "java",
  sh: "shell",
  bash: "shell",
  yaml: "yaml",
  yml: "yaml",
  sql: "sql",
  toml: "toml",
  xml: "xml",
}

export function languageNameFor(path: string) {
  const base = path.split(/[\\/]/).pop() ?? ""
  const dot = base.lastIndexOf(".")
  if (dot <= 0) return undefined
  return LANGUAGES[base.slice(dot + 1).toLowerCase()]
}
