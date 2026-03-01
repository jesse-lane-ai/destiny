import { getProvider, listProviders } from './providers.js';
import { loadEnv, removeEnvValue, resolveEnvPath, setEnvValue } from '../lib/env.js';

export function getStatus({ envPath }) {
  const finalPath = resolveEnvPath(envPath);
  const env = loadEnv(finalPath);

  return listProviders().map((providerName) => {
    const provider = getProvider(providerName);
    const found = provider.envKeys
      .map((key) => ({ key, value: env[key] || process.env[key] || null, source: env[key] ? '.env' : process.env[key] ? 'process.env' : 'none' }))
      .find((x) => Boolean(x.value));

    return {
      provider: providerName,
      label: provider.label,
      key: found?.key || provider.envKeys[0],
      configured: Boolean(found?.value),
      source: found?.source || 'none',
      masked: found?.value ? maskSecret(found.value) : null
    };
  });
}

export function addCredential({ providerName, value, envPath }) {
  const provider = getProvider(providerName);
  if (!provider) throw new Error(`Unknown provider: ${providerName}`);
  if (!value || !value.trim()) throw new Error('Credential value cannot be empty.');

  const finalPath = resolveEnvPath(envPath);
  const key = provider.envKeys[0];
  setEnvValue(finalPath, key, value.trim());
  return { providerName, key, envPath: finalPath };
}

export function removeCredential({ providerName, envPath }) {
  const provider = getProvider(providerName);
  if (!provider) throw new Error(`Unknown provider: ${providerName}`);

  const finalPath = resolveEnvPath(envPath);
  for (const key of provider.envKeys) {
    removeEnvValue(finalPath, key);
  }
  return { providerName, key: provider.envKeys.join(','), envPath: finalPath };
}

export function testCredential({ providerName, envPath }) {
  const provider = getProvider(providerName);
  if (!provider) throw new Error(`Unknown provider: ${providerName}`);

  const status = getStatus({ envPath }).find((s) => s.provider === providerName);
  return {
    provider: providerName,
    ok: status?.configured || false,
    reason: status?.configured ? 'Credential found.' : `Missing one of: ${provider.envKeys.join(', ')}`
  };
}

function maskSecret(value) {
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
