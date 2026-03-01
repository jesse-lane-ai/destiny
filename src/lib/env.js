import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

export function resolveEnvPath(customPath) {
  return customPath ? path.resolve(customPath) : path.resolve(process.cwd(), '.env');
}

export function ensureEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, '', { mode: 0o600 });
  }
}

export function loadEnv(envPath) {
  ensureEnvFile(envPath);
  const raw = fs.readFileSync(envPath, 'utf8');
  return dotenv.parse(raw);
}

export function setEnvValue(envPath, key, value) {
  ensureEnvFile(envPath);
  const current = loadEnv(envPath);
  current[key] = value;
  const out = Object.entries(current)
    .map(([k, v]) => `${k}=${escapeEnvValue(v)}`)
    .join('\n') + '\n';
  fs.writeFileSync(envPath, out, { mode: 0o600 });
}

export function removeEnvValue(envPath, key) {
  ensureEnvFile(envPath);
  const current = loadEnv(envPath);
  delete current[key];
  const entries = Object.entries(current);
  const out = entries.length
    ? entries.map(([k, v]) => `${k}=${escapeEnvValue(v)}`).join('\n') + '\n'
    : '';
  fs.writeFileSync(envPath, out, { mode: 0o600 });
}

function escapeEnvValue(value) {
  if (/\s|#|"|'/.test(value)) {
    return JSON.stringify(value);
  }
  return value;
}
