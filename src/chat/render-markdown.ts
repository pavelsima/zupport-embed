import { marked } from 'marked'

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

// Strip <script>, <style>, on* attribute handlers, and javascript: URIs
// from the rendered HTML. Scenario answers are author-controlled (the
// assistant owner wrote them) so XSS risk is low — but the LLM output
// path also flows through here, so we keep a defensive sanitiser.
const sanitiseHtml = (html: string): string => {
  if (typeof DOMParser === 'undefined') return html
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild
  if (!root) return ''
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  const toRemove: Element[] = []
  while (walker.nextNode()) {
    const el = walker.currentNode as Element
    const tag = el.tagName.toLowerCase()
    if (tag === 'script' || tag === 'style' || tag === 'iframe' || tag === 'object') {
      toRemove.push(el)
      continue
    }
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name)
      if (
        (attr.name === 'href' || attr.name === 'src') &&
        /^\s*javascript:/i.test(attr.value)
      ) {
        el.removeAttribute(attr.name)
      }
    }
  }
  for (const el of toRemove) el.remove()
  return root.innerHTML
}

export const renderMarkdown = (text: string): string => {
  if (!text) return ''
  try {
    const html = marked.parse(text, { async: false, breaks: true, gfm: true }) as string
    return sanitiseHtml(html)
  } catch {
    return escapeHtml(text)
  }
}
