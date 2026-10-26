import rehypeStringify from 'rehype-stringify'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { describe, expect, it } from 'vitest'
import rehypeLangBlocks from './rehype-lang-blocks'

function render(markdown: string): string {
  return unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeLangBlocks)
    .use(rehypeStringify)
    .processSync(markdown)
    .toString()
    .replace(/>\s+</g, '><')
}

describe('rehypeLangBlocks', () => {
  it('wraps a block separated by blank lines', () => {
    const html = render('Before\n\n::: lang c\n\nOnly C.\n\n:::\n\nAfter')

    expect(html).toBe(
      '<p>Before</p><div class="lang-block" data-lang="c"><p>Only C.</p></div><p>After</p>',
    )
  })

  it('splits markers off a paragraph without blank lines', () => {
    const html = render('::: lang go\nOnly `Go` here.\n:::')

    expect(html).toBe(
      '<div class="lang-block" data-lang="go"><p>Only <code>Go</code> here.</p></div>',
    )
  })

  it('keeps nested code-group markers for rehype-code-group', () => {
    const html = render(
      '::: lang c\n\n::: code-group labels=[A, B]\n\n```c\na\n```\n\n:::\n\n:::',
    )

    expect(html).toMatch(
      /^<div class="lang-block" data-lang="c"><p>::: code-group labels=\[A, B\]<\/p><pre>[\s\S]*<\/pre><p>:::<\/p><\/div>$/,
    )
  })

  it('leaves unclosed blocks and stray closers unchanged', () => {
    expect(render('::: lang c\n\nText')).toBe('<p>::: lang c</p><p>Text</p>')
    expect(render(':::\n\nText')).toBe('<p>:::</p><p>Text</p>')
  })
})
