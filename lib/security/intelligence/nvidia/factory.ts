import {
  NvidiaNimProvider,
  NvidiaSecurityIntelligenceProvider,
  OpenAIClientLike,
  UnavailableNvidiaProvider,
} from './provider';
import type { NvidiaProviderConfig } from './types';

export function isNvidiaIntelligenceEnabled(): boolean {
  const envEnabled = process.env.NEXUS_NVIDIA_ENABLED?.trim().toLowerCase();
  return envEnabled === 'true' || envEnabled === '1';
}

export function isNvidiaIntelligenceConfigured(): boolean {
  if (!isNvidiaIntelligenceEnabled()) {
    return false;
  }
  const apiKey = process.env.NEXUS_NVIDIA_API_KEY?.trim();
  return Boolean(apiKey && apiKey.length > 0);
}

export function getNvidiaProvider(
  config?: Partial<NvidiaProviderConfig>,
  customClient?: OpenAIClientLike
): NvidiaSecurityIntelligenceProvider {
  // If custom client is supplied (for testing/dependency injection), instantiate directly
  if (customClient) {
    return new NvidiaNimProvider(
      {
        enabled: true,
        baseUrl: config?.baseUrl || process.env.NEXUS_NVIDIA_BASE_URL,
        apiKey: config?.apiKey || 'mock-api-key',
        model: config?.model || process.env.NEXUS_NVIDIA_MODEL,
        timeoutMs: config?.timeoutMs,
      },
      customClient
    );
  }

  // Determine enabled status
  const enabled =
    config?.enabled !== undefined ? config.enabled : isNvidiaIntelligenceEnabled();

  const apiKey = config?.apiKey || process.env.NEXUS_NVIDIA_API_KEY?.trim();

  // If disabled or API key is absent, return safe Unavailable provider
  if (!enabled || !apiKey) {
    return new UnavailableNvidiaProvider();
  }

  return new NvidiaNimProvider({
    enabled: true,
    baseUrl: config?.baseUrl || process.env.NEXUS_NVIDIA_BASE_URL,
    apiKey,
    model: config?.model || process.env.NEXUS_NVIDIA_MODEL,
    timeoutMs: config?.timeoutMs,
  });
}
