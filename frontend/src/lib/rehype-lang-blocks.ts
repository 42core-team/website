/**
 * Rehype plugin for language-specific wiki content:
 *
 *   ::: lang c
 *   Free the array, never the `t_obj` inside it.
 *   :::
 *
 * The content between the markers is wrapped in
 * `<div class="lang-block" data-lang="c">`, which the wiki shows only while
 * that language is selected. Blocks may contain `::: code-group` blocks; their
 * markers are left for rehype-code-group, so this plugin must run before it.
 * Unclosed blocks are left unchanged.
 */

interface HastNode {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

interface Frame {
  opener?: HastNode
  language?: string // set for lang blocks, unset for other ::: blocks
  children: HastNode[]
}

const LANG_OPENER = /^::: lang ([\w+#-]+)$/
const OTHER_OPENER = /^:::\s*\S/
const CLOSER = ':::'
const LEADING_LANG_OPENER = /^::: lang [\w+#-]+\n/
const TRAILING_CLOSER = /\n:::$/

export default function rehypeLangBlocks() {
  return (tree: HastNode) => {
    transformChildren(tree)
  }
}

function transformChildren(parent: HastNode) {
  if (!parent.children) return

  const root: Frame = { children: [] }
  const stack: Frame[] = [root]
  const top = () => stack[stack.length - 1]

  for (const child of splitMarkers(parent.children)) {
    const text = markerText(child)

    if (text !== null && LANG_OPENER.test(text)) {
      const language = text.match(LANG_OPENER)![1].toLowerCase()
      stack.push({ opener: child, language, children: [] })
    } else if (text === CLOSER && stack.length > 1) {
      const frame = stack.pop()!
      if (frame.language) {
        warnAboutHeadings(frame)
        top().children.push(langBlock(frame.language, frame.children))
      } else {
        top().children.push(frame.opener!, ...frame.children, child)
      }
    } else if (text !== null && OTHER_OPENER.test(text)) {
      stack.push({ opener: child, children: [] })
    } else {
      transformChildren(child)
      top().children.push(child)
    }
  }

  // Leave unclosed blocks as they were.
  while (stack.length > 1) {
    const frame = stack.pop()!
    top().children.push(frame.opener!, ...frame.children)
  }

  parent.children = root.children
}

// Splits a lang opener at the start or a closer at the end of a paragraph into
// its own paragraph, so markers work without blank lines around them.
function splitMarkers(children: HastNode[]): HastNode[] {
  const result: HastNode[] = []
  for (const child of children) {
    if (!isParagraph(child) || !child.children?.length) {
      result.push(child)
      continue
    }

    const parts = [...child.children]
    let opener: HastNode | undefined
    let closer: HastNode | undefined

    const first = parts[0]
    if (first.type === 'text' && LEADING_LANG_OPENER.test(first.value ?? '')) {
      const newline = first.value!.indexOf('\n')
      opener = paragraph(first.value!.slice(0, newline))
      parts[0] = { ...first, value: first.value!.slice(newline + 1) }
    }

    const last = parts[parts.length - 1]
    if (last.type === 'text' && TRAILING_CLOSER.test(last.value ?? '')) {
      closer = paragraph(CLOSER)
      parts[parts.length - 1] = {
        ...last,
        value: last.value!.replace(TRAILING_CLOSER, ''),
      }
    }

    if (!opener && !closer) {
      result.push(child)
      continue
    }
    if (opener) result.push(opener)
    result.push({ ...child, children: parts })
    if (closer) result.push(closer)
  }
  return result
}

// Returns the trimmed text of a paragraph that consists only of text, or null.
function markerText(node: HastNode): string | null {
  if (!isParagraph(node) || !node.children?.length) return null
  if (!node.children.every((child) => child.type === 'text')) return null
  return node.children
    .map((child) => child.value ?? '')
    .join('')
    .trim()
}

function isParagraph(node: HastNode): boolean {
  return node.type === 'element' && node.tagName === 'p'
}

function paragraph(text: string): HastNode {
  return {
    type: 'element',
    tagName: 'p',
    properties: {},
    children: [{ type: 'text', value: text }],
  }
}

function langBlock(language: string, children: HastNode[]): HastNode {
  return {
    type: 'element',
    tagName: 'div',
    properties: { className: ['lang-block'], dataLang: language },
    children,
  }
}

// Headings inside a lang block would make the table of contents depend on the
// selected language, so they are reported during development.
function warnAboutHeadings(frame: Frame) {
  if (!import.meta.env.DEV) return
  const hasHeading = (node: HastNode): boolean =>
    /^h[1-6]$/.test(node.tagName ?? '') ||
    (node.children ?? []).some(hasHeading)
  if (frame.children.some(hasHeading)) {
    console.warn(
      `Wiki: heading inside "::: lang ${frame.language}" block; move it outside so the table of contents is the same for every language.`,
    )
  }
}
