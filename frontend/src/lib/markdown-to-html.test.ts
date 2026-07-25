import { describe, expect, it } from 'vitest'
import { markdownToHtml } from './markdown-to-html'

describe('markdownToHtml', () => {
  it('renders GitHub-flavored Markdown', () => {
    const html = markdownToHtml(
      [
        '## Schedule',
        '',
        '- [x] Registration',
        '- [ ] Finals',
        '',
        '| Round | Time |',
        '| --- | --- |',
        '| One | 10:00 |',
      ].join('\n'),
    )

    expect(html).toContain('<h2>Schedule</h2>')
    expect(html).toContain('type="checkbox" checked disabled')
    expect(html).toContain('<table>')
  })

  it('does not render embedded HTML or unsafe link protocols', () => {
    const html = markdownToHtml(
      '<script>alert("unsafe")</script>\n\n[unsafe](javascript:alert("x"))',
    )

    expect(html).not.toContain('<script')
    expect(html).not.toContain('javascript:')
  })
})
