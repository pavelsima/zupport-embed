// Base URL where the Answerlay queue service publishes per-assistant JSON.
// In development this resolves to the local Docker assets container;
// in production it points to the CDN.
//
// Files follow the path:  assistants/{assistantId}/{config|scenarios|vectors-e5s}.json
//
// Override per-embed via `data-config-base-url` (relative URL rewrite) or
// `data-config-url` (fully custom config.json URL, bypasses this entirely).
//
// The VITE_CONFIG_BASE_URL env var is baked in at build time:
//   .env.development  →  http://localhost:8080  (Docker Caddy direct port)
//   .env.production   →  https://cdn.answerlay.com
export const DEFAULT_CONFIG_BASE_URL: string =
  import.meta.env.VITE_CONFIG_BASE_URL ?? 'https://cdn.answerlay.com'

// Build the public URL for an assistant JSON file.
// Path layout on the assets server: assistants/{assistantId}/{filename}
export const buildPublicJsonUrl = (
  baseUrl: string,
  assistantId: string,
  filename: string,
): string => {
  const trimmedBase = baseUrl.replace(/\/$/, '')
  return `${trimmedBase}/assistants/${assistantId}/${filename}`
}

export const deriveConfigUrl = (assistantId: string, baseUrl?: string | null): string =>
  buildPublicJsonUrl(baseUrl || DEFAULT_CONFIG_BASE_URL, assistantId, 'config.json')
