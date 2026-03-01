import fs from 'node:fs';
import { resolveEnvPath, setEnvValue } from './lib/env.js';

export function runInit({ envPath }) {
  const finalEnv = resolveEnvPath(envPath);
  if (!fs.existsSync(finalEnv)) fs.writeFileSync(finalEnv, '', { mode: 0o600 });

  setIfMissing(finalEnv, 'DESTINY_PRIMARY_MODEL', 'openai-codex/gpt-5.3-codex');
  setIfMissing(finalEnv, 'DESTINY_FALLBACK_MODELS', 'openai-codex/gpt-5.2,openrouter/minimax/minimax-m2.5');
  setIfMissing(finalEnv, 'OPENAI_OAUTH_PROVIDER', 'codex');

  return { envPath: finalEnv };
}

function setIfMissing(envPath, key, value) {
  const raw = fs.readFileSync(envPath, 'utf8');
  const re = new RegExp(`^${key}=`, 'm');
  if (!re.test(raw)) setEnvValue(envPath, key, value);
}
