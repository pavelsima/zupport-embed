// Default Firebase Storage bucket where the main Answerlay app publishes
// per-assistant public JSON. Change this constant when you deploy under a
// different bucket — every consumer that doesn't supply
// `data-config-base-url` (or a fully custom `data-config-url`) follows it.
//
// Files served from the bucket follow the path:
//   public/assistants/{assistantId}/{config|scenarios|vectors-mlm12}.json
//
// The bucket must allow unauthenticated reads on these paths (or the
// per-file token must be embedded inside the published config.json's
// scenariosPublicUrl / vectorsPublicUrl fields).
export const DEFAULT_CONFIG_BASE_URL =
  'https://firebasestorage.googleapis.com/v0/b/fincalc-prod.firebasestorage.app/o'

// Build a Firebase Storage download URL for a given object path. Firebase
// requires the *whole* object path to be URL-encoded (slashes become %2F)
// and the `alt=media` query so the API returns the file body directly
// rather than its metadata.
export const buildPublicJsonUrl = (
  baseUrl: string,
  assistantId: string,
  filename: string,
): string => {
  const path = `public/assistants/${assistantId}/${filename}`
  const trimmedBase = baseUrl.replace(/\/$/, '')
  return `${trimmedBase}/${encodeURIComponent(path)}?alt=media`
}

export const deriveConfigUrl = (assistantId: string, baseUrl?: string | null): string =>
  buildPublicJsonUrl(baseUrl || DEFAULT_CONFIG_BASE_URL, assistantId, 'config.json')
