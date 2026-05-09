import type { RetrievalChunk } from '../rag/types'
import type { Tier, EngineMode } from './tier'

export interface ProgressUpdate {
  file?: string
  loaded?: number
  total?: number
  progress?: number
  done?: boolean
  phase?: 'starting' | 'downloading' | 'compiling' | 'ready'
}

export type ProgressCallback = (p: ProgressUpdate) => void
export type GenerationCallback = (token: string) => void

export interface AskInput {
  question: string
  shopName: string
  chunks: RetrievalChunk[]
  maxTokens?: number
  language?: string
}

export interface InitResult {
  device: string
}

export interface Engine {
  readonly tier: Tier
  readonly label: string
  readonly mode: EngineMode
  readonly approxSizeMB: number

  init(onProgress: ProgressCallback): Promise<InitResult>
  ask(input: AskInput, onToken?: GenerationCallback): Promise<string>
  destroy(): void
}
