import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { resolveEnvPath, setEnvValue, removeEnvValue } from '../lib/env.js';

export function defaultCodexAuthPath() {
  return path.join(os.homedir(), '.codex', 'auth.json');
}

export async function loginOpenAIViaCodex({ envPath, deviceAuth = true }) {
  const codexBin = resolveCodexBinary();
  if (!codexBin) {
    throw new Error('Codex CLI not found. Install Codex CLI first.');
  }

  const args = ['login'];
  if (deviceAuth) args.push('--device-auth');

  await run(codexBin, args);

  const authPath = defaultCodexAuthPath();
  if (!fs.existsSync(authPath)) {
    throw new Error(`Codex login completed but auth cache not found at ${authPath}`);
  }

  const finalPath = resolveEnvPath(envPath);
  setEnvValue(finalPath, 'OPENAI_OAUTH_PROVIDER', 'codex');
  setEnvValue(finalPath, 'OPENAI_CODEX_AUTH_FILE', authPath);

  return { envPath: finalPath, authPath };
}

export async function logoutOpenAIViaCodex({ envPath }) {
  const codexBin = resolveCodexBinary();
  if (codexBin) {
    try { await run(codexBin, ['logout']); } catch {}
  }

  const finalPath = resolveEnvPath(envPath);
  removeEnvValue(finalPath, 'OPENAI_OAUTH_PROVIDER');
  removeEnvValue(finalPath, 'OPENAI_CODEX_AUTH_FILE');
  return { envPath: finalPath };
}

function resolveCodexBinary() {
  const preferred = path.join(os.homedir(), '.nvm/versions/node/v24.11.1/bin/codex');
  if (fs.existsSync(preferred)) return preferred;
  return 'codex';
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} failed with exit code ${code}`));
    });
  });
}
