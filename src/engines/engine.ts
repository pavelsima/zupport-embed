import type { RetrievalChunk } from '../rag/types'
import type { EngineKind } from './tier'

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

export interface HistoryTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface AskInput {
  question: string
  shopName: string
  chunks: RetrievalChunk[]
  maxTokens?: number
  history?: HistoryTurn[]
}

export interface InitResult {
  device: string
}

export interface Engine {
  readonly kind: EngineKind
  readonly label: string
  readonly approxSizeMB: number

  init(onProgress: ProgressCallback): Promise<InitResult>
  ask(input: AskInput, onToken?: GenerationCallback): Promise<string>
  destroy(): void
}
