import { createAvatar } from '@dicebear/core'
import { bottts } from '@dicebear/collection'

const cache = new Map<string, string>()

export function thumbsAvatarSvg(seed: string): string {
  const key = seed || 'Answerlay'
  let svg = cache.get(key)
  if (!svg) {
    svg = createAvatar(bottts, { seed: key, radius: 50 }).toString()
    cache.set(key, svg)
  }
  return svg
}

// Neutral person-on-circle silhouette. Uses currentColor for the ring so
// callers can theme it via CSS (the chat header sets color: var(--answerlay-brand)).
export function silhouetteAvatarSvg(): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true">' +
      '<circle cx="32" cy="32" r="32" fill="currentColor" />' +
      '<g fill="#ffffff">' +
        '<circle cx="32" cy="25" r="10" />' +
        '<path d="M14 54c0-10 8-16 18-16s18 6 18 16v6H14z" />' +
      '</g>' +
    '</svg>'
  )
}
