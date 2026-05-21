// Shape of the per-assistant vectors payload, written by the Answerlay
// ingest pipeline and consumed here by the retriever. Embedded with
// bge-small-en-v1.5 (q8, WASM) — English-only.

export interface Chunk {
  chunk_id: string
  text: string
  embedding: number[]
  meta: {
    source_file: string
    source_file_id: string
    source_type: 'pdf' | 'md' | 'txt'
    section_heading: string | null
    chunk_index: number
    token_count: number
    language: string
    page_number?: number | null
  }
}

export interface VectorsPayload {
  model: 'bge-small-en-v1.5'
  dim: number
  builtAt: string
  chunkCount: number
  chunks: Chunk[]
}

// Engine-facing chunk shape. Generation engines stuff `heading` + `text`
// into the prompt; the retrieval-only path formats these as suggestions.
export interface RetrievalChunk {
  id: string
  heading: string
  text: string
  score?: number
}
