import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { resolveEnvPath } from './lib/env.js';
import { getStatus } from './auth/store.js';

export function runDoctor({ envPath }) {
  const finalEnv = resolveEnvPath(envPath);
  const checks = [];

  checks.push({
    name: 'node-version',
    ok: Number(process.versions.node.split('.')[0]) >= 18,
    detail: process.versions.node
  });

  const codex = spawnSync('bash', ['-lc', 'command -v codex >/dev/null 2>&1']);
  checks.push({ name: 'codex-cli', ok: codex.status === 0, detail: codex.status === 0 ? 'found' : 'missing' });

  checks.push({ name: 'env-file-dir-writable', ok: canWrite(finalEnv), detail: finalEnv });

  const ping = spawnSync('bash', ['-lc', "curl -sS -o /dev/null -w '%{http_code}' https://api.openai.com"], { timeout: 8000 });
  const code = String(ping.stdout || '').trim();
  const okPing = ping.status === 0 && /^\d{3}$/.test(code);
  checks.push({ name: 'internet-openai', ok: okPing, detail: okPing ? `http ${code}` : 'failed' });

  const auth = getStatus({ envPath: finalEnv });
  checks.push({ name: 'any-provider-auth', ok: auth.some((a) => a.configured), detail: auth.filter((a) => a.configured).map((a) => a.provider).join(', ') || 'none' });

  return { ok: checks.every((c) => c.ok), checks, envPath: finalEnv, host: os.hostname() };
}

function canWrite(envPath) {
  try {
    const dir = envPath.split('/').slice(0, -1).join('/') || '.';
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}
