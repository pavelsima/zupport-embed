import { createAvatar } from '@dicebear/core'
import { thumbs } from '@dicebear/collection'

const cache = new Map<string, string>()

export function thumbsAvatarSvg(seed: string): string {
  const key = seed || 'Answerlay'
  let svg = cache.get(key)
  if (!svg) {
    svg = createAvatar(thumbs, { seed: key, radius: 50 }).toString()
    cache.set(key, svg)
  }
  return svg
}
