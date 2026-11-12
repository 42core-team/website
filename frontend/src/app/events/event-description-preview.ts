import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

const markdownParser = unified().use(remarkParse).use(remarkGfm).freeze()
const PREVIEW_LENGTH = 160

interface MarkdownNode {
  type: string
  value?: string
  alt?: string | null
  children?: MarkdownNode[]
}

function plainText(node: MarkdownNode): string {
  if (node.type === 'html' || node.type === 'definition') return ''
  if (node.type === 'break') return ' '
  if (!node.children) return node.value ?? node.alt ?? ''

  const separator = [
    'root',
    'blockquote',
    'list',
    'listItem',
    'table',
    'tableRow',
  ].includes(node.type)
    ? ' '
    : ''

  return node.children.map(plainText).join(separator)
}

export function eventDescriptionPreview(markdown: string): string {
  const text = plainText(markdownParser.parse(markdown))
    .replace(/\s+/g, ' ')
    .trim()

  if (text.length <= PREVIEW_LENGTH) return text

  const excerpt = text.slice(0, PREVIEW_LENGTH - 1)
  const wordBoundary = text.lastIndexOf(' ', PREVIEW_LENGTH - 1)

  return `${(wordBoundary > 0 ? text.slice(0, wordBoundary) : excerpt).trimEnd()}…`
}
