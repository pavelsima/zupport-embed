import { franc } from 'franc-min'

export type Lang = 'en' | 'de' | 'fr' | 'es' | 'it' | 'pt' | 'cs' | 'pl' | 'nl' | 'ja'

const ISO_639_3_TO_1: Record<string, Lang> = {
  eng: 'en',
  deu: 'de',
  fra: 'fr',
  spa: 'es',
  ita: 'it',
  por: 'pt',
  ces: 'cs',
  pol: 'pl',
  nld: 'nl',
  jpn: 'ja',
}

const MIN_TEXT_LENGTH = 10

export const detectLanguage = (text: string): Lang => {
  const trimmed = text?.trim() ?? ''
  if (trimmed.length < MIN_TEXT_LENGTH) return 'en'
  const code = franc(trimmed)
  if (code === 'und') return 'en'
  return ISO_639_3_TO_1[code] ?? 'en'
}
