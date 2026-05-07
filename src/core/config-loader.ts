import {
  DEFAULT_CONFIG,
  type AssistantConfig,
  type PublishedConfig,
} from '../public/types'

export interface ResolvedConfig {
  assistantId: string
  config: AssistantConfig
  scenariosPublicUrl: string | null
  vectorsPublicUrl: string | null
  builtAt: string | null
}

export interface ConfigLoaderInput {
  assistantId: string
  configUrl?: string | null
  inlineConfig?: AssistantConfig | null
}

const applyDefaults = (cfg: Partial<AssistantConfig>): AssistantConfig => ({
  ...DEFAULT_CONFIG,
  ...cfg,
})

export const loadConfig = async (input: ConfigLoaderInput): Promise<ResolvedConfig> => {
  if (input.inlineConfig) {
    return {
      assistantId: input.assistantId,
      config: applyDefaults(input.inlineConfig),
      scenariosPublicUrl: null,
      vectorsPublicUrl: null,
      builtAt: null,
    }
  }

  if (!input.configUrl) {
    throw new Error('Either configUrl or inlineConfig is required')
  }

  const res = await fetch(input.configUrl, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`config.json: HTTP ${res.status}`)
  const data = (await res.json()) as PublishedConfig

  if (!data || data.schema !== 1 || !data.config) {
    throw new Error('config.json: malformed (expected schema:1 PublishedConfig)')
  }

  return {
    assistantId: data.assistantId || input.assistantId,
    config: applyDefaults(data.config),
    scenariosPublicUrl: data.scenariosPublicUrl,
    vectorsPublicUrl: data.vectorsPublicUrl,
    builtAt: data.builtAt,
  }
}
