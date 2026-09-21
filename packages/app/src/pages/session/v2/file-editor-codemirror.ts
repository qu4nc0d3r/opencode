import { EditorState } from "@codemirror/state"
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands"
import { bracketMatching, defaultHighlightStyle, indentOnInput, syntaxHighlighting } from "@codemirror/language"
import { languages } from "@codemirror/language-data"
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search"
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from "@codemirror/view"

async function languageExtension(path: string) {
  const base = path.split(/[\\/]/).pop() ?? ""
  const dot = base.lastIndexOf(".")
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : ""
  if (!ext) return
  const description = languages.find((item) => item.extensions.includes(ext) || item.alias.includes(ext))
  return description?.load()
}

export type CodeMirrorEditor = {
  destroy(): void
  getValue(): string
  setValue(value: string): void
}

export async function createCodeMirrorEditor(input: {
  parent: HTMLElement
  path: string
  value: string
  onSave: (value: string) => void
  onChange: (value: string) => void
}): Promise<CodeMirrorEditor> {
  const language = await languageExtension(input.path)
  const theme = EditorView.theme({
    "&": {
      height: "100%",
      fontSize: "12px",
      backgroundColor: "transparent",
      color: "var(--v2-text-text-base)",
    },
    ".cm-scroller": { overflow: "auto" },
    ".cm-content": {
      fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
      padding: "8px 0",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      border: "none",
      color: "var(--v2-text-text-faint, #666)",
    },
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
  return {
    destroy: () => view.destroy(),
    getValue: () => view.state.doc.toString(),
    setValue(value: string) {
      if (view.state.doc.toString() === value) return
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
    },
  }
}
