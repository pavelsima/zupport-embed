import type { Chunk } from './types'

const DB_NAME = 'answerlay-embed'
const VECTORS_STORE = 'vectors'
const DB_VERSION = 1
const TTL_MS = 60 * 60 * 1000

export type EmbeddingModel = 'e5s'

export interface CachedVectors {
  loadedAt: number
  builtAt: string
  chunks: Chunk[]
}

interface CacheRecord extends CachedVectors {
  key: string
}

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(VECTORS_STORE)) {
        db.createObjectStore(VECTORS_STORE, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })

const cacheKey = (assistantId: string, model: EmbeddingModel) => `${assistantId}-${model}`

export const getCachedVectors = async (
  assistantId: string,
  model: EmbeddingModel,
): Promise<CachedVectors | null> => {
  let db: IDBDatabase
  try {
    db = await openDb()
  } catch {
    return null
  }
  return new Promise<CachedVectors | null>((resolve) => {
    const tx = db.transaction(VECTORS_STORE, 'readonly')
    const store = tx.objectStore(VECTORS_STORE)
    const req = store.get(cacheKey(assistantId, model))
    req.onsuccess = () => {
      const record = req.result as CacheRecord | undefined
      if (!record) return resolve(null)
      if (Date.now() - record.loadedAt > TTL_MS) return resolve(null)
      resolve({ loadedAt: record.loadedAt, builtAt: record.builtAt, chunks: record.chunks })
    }
    req.onerror = () => resolve(null)
    tx.oncomplete = () => db.close()
  })
}

export const setCachedVectors = async (
  assistantId: string,
  model: EmbeddingModel,
  payload: CachedVectors,
): Promise<void> => {
  let db: IDBDatabase
  try {
    db = await openDb()
  } catch {
    return
  }
  const key = cacheKey(assistantId, model)
  const record: CacheRecord = { key, ...payload }
  await new Promise<void>((resolve) => {
    const tx = db.transaction(VECTORS_STORE, 'readwrite')
    tx.objectStore(VECTORS_STORE).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
  db.close()
}

export const clearCachedVectors = async (
  assistantId: string,
  model: EmbeddingModel,
): Promise<void> => {
  let db: IDBDatabase
  try {
    db = await openDb()
  } catch {
    return
  }
  await new Promise<void>((resolve) => {
    const tx = db.transaction(VECTORS_STORE, 'readwrite')
    tx.objectStore(VECTORS_STORE).delete(cacheKey(assistantId, model))
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
  db.close()
}
