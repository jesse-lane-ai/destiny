import { loadEnv, resolveEnvPath, setEnvValue } from './lib/env.js';

const DEFAULT_PRIMARY = 'openai-codex/gpt-5.3-codex';
const DEFAULT_FALLBACKS = ['openai-codex/gpt-5.2', 'openrouter/minimax/minimax-m2.5'];

const PROVIDER_PROFILES = {
  openai: {
    primary: 'openai-codex/gpt-5.3-codex',
    fallbacks: ['openai-codex/gpt-5.2', 'openrouter/minimax/minimax-m2.5']
  },
  openrouter: {
    primary: 'openrouter/minimax/minimax-m2.5',
    fallbacks: ['openai-codex/gpt-5.3-codex', 'openai-codex/gpt-5.2']
  },
  anthropic: {
    primary: 'anthropic/claude-3.7-sonnet',
    fallbacks: ['openai-codex/gpt-5.3-codex', 'openrouter/minimax/minimax-m2.5']
  },
  google: {
    primary: 'google/gemini-2.0-flash',
    fallbacks: ['openai-codex/gpt-5.3-codex', 'openrouter/minimax/minimax-m2.5']
  }
};

export function getModelConfig({ envPath }) {
  const finalPath = resolveEnvPath(envPath);
  const env = loadEnv(finalPath);

  const primary = env.DESTINY_PRIMARY_MODEL || process.env.DESTINY_PRIMARY_MODEL || DEFAULT_PRIMARY;
  const fallbacksRaw = env.DESTINY_FALLBACK_MODELS || process.env.DESTINY_FALLBACK_MODELS || DEFAULT_FALLBACKS.join(',');
  const fallbacks = parseFallbacks(fallbacksRaw).filter((m) => m !== primary);

  return { envPath: finalPath, primary, fallbacks, resolvedOrder: [primary, ...fallbacks] };
}

export function setPrimaryModel({ envPath, model }) {
  if (!model || !model.trim()) throw new Error('Primary model cannot be empty.');
  const finalPath = resolveEnvPath(envPath);
  setEnvValue(finalPath, 'DESTINY_PRIMARY_MODEL', model.trim());

  const current = getModelConfig({ envPath: finalPath });
  const cleanedFallbacks = current.fallbacks.filter((m) => m !== model.trim());
  setEnvValue(finalPath, 'DESTINY_FALLBACK_MODELS', cleanedFallbacks.join(','));
  return getModelConfig({ envPath: finalPath });
}

export function setFallbackModels({ envPath, models }) {
  const finalPath = resolveEnvPath(envPath);
  const current = getModelConfig({ envPath: finalPath });
  const clean = (models || []).map((m) => m.trim()).filter(Boolean).filter((m) => m !== current.primary);
  setEnvValue(finalPath, 'DESTINY_FALLBACK_MODELS', clean.join(','));
  return getModelConfig({ envPath: finalPath });
}

export function useProviderProfile({ envPath, provider }) {
  const key = String(provider || '').toLowerCase();
  const profile = PROVIDER_PROFILES[key];
  if (!profile) throw new Error(`Unknown provider profile: ${provider}`);
  const finalPath = resolveEnvPath(envPath);
  setEnvValue(finalPath, 'DESTINY_PRIMARY_MODEL', profile.primary);
  setEnvValue(finalPath, 'DESTINY_FALLBACK_MODELS', profile.fallbacks.join(','));
  return { provider: key, ...getModelConfig({ envPath: finalPath }) };
}

export function listProviderProfiles() {
  return Object.keys(PROVIDER_PROFILES);
}

function parseFallbacks(raw) {
  return String(raw).split(',').map((x) => x.trim()).filter(Boolean);
}
