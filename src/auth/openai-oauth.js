import { resolveEnvPath, setEnvValue, removeEnvValue } from '../lib/env.js';

const DEFAULT_AUTH_BASE = 'https://auth.openai.com/oauth';

export async function loginOpenAIDeviceFlow({
  envPath,
  clientId,
  scope = 'openid profile offline_access',
  audience,
  authBase = process.env.OPENAI_OAUTH_BASE_URL || DEFAULT_AUTH_BASE
}) {
  if (!clientId) {
    throw new Error('Missing client id. Pass --client-id or set OPENAI_OAUTH_CLIENT_ID.');
  }

  const deviceCodeRes = await fetch(`${authBase}/device/code`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, scope, ...(audience ? { audience } : {}) })
  });

  if (!deviceCodeRes.ok) {
    const text = await safeText(deviceCodeRes);
    throw new Error(`Failed to start device flow (${deviceCodeRes.status}): ${text}`);
  }

  const device = await deviceCodeRes.json();

  const token = await pollForToken({
    authBase,
    clientId,
    deviceCode: device.device_code,
    intervalSec: device.interval || 5,
    expiresInSec: device.expires_in || 900
  });

  const finalPath = resolveEnvPath(envPath);
  const expiresAt = token.expires_in
    ? new Date(Date.now() + token.expires_in * 1000).toISOString()
    : '';

  setEnvValue(finalPath, 'OPENAI_OAUTH_ACCESS_TOKEN', token.access_token || '');
  if (token.refresh_token) setEnvValue(finalPath, 'OPENAI_OAUTH_REFRESH_TOKEN', token.refresh_token);
  if (token.id_token) setEnvValue(finalPath, 'OPENAI_OAUTH_ID_TOKEN', token.id_token);
  if (expiresAt) setEnvValue(finalPath, 'OPENAI_OAUTH_EXPIRES_AT', expiresAt);
  setEnvValue(finalPath, 'OPENAI_OAUTH_CLIENT_ID', clientId);

  return {
    envPath: finalPath,
    verificationUri: device.verification_uri,
    verificationUriComplete: device.verification_uri_complete,
    userCode: device.user_code,
    expiresIn: device.expires_in,
    saved: {
      accessToken: Boolean(token.access_token),
      refreshToken: Boolean(token.refresh_token),
      expiresAt
    }
  };
}

export function logoutOpenAI({ envPath }) {
  const finalPath = resolveEnvPath(envPath);
  for (const key of [
    'OPENAI_OAUTH_ACCESS_TOKEN',
    'OPENAI_OAUTH_REFRESH_TOKEN',
    'OPENAI_OAUTH_ID_TOKEN',
    'OPENAI_OAUTH_EXPIRES_AT'
  ]) {
    removeEnvValue(finalPath, key);
  }

  return { envPath: finalPath };
}

async function pollForToken({ authBase, clientId, deviceCode, intervalSec, expiresInSec }) {
  const startedAt = Date.now();
  const deadline = startedAt + expiresInSec * 1000;
  let intervalMs = Math.max(1, intervalSec) * 1000;

  while (Date.now() < deadline) {
    await sleep(intervalMs);

    const res = await fetch(`${authBase}/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: clientId,
        device_code: deviceCode
      })
    });

    const payload = await safeJson(res);

    if (res.ok && payload?.access_token) return payload;

    const err = payload?.error;
    if (err === 'authorization_pending') continue;
    if (err === 'slow_down') {
      intervalMs += 5000;
      continue;
    }

    throw new Error(`Token exchange failed: ${JSON.stringify(payload)}`);
  }

  throw new Error('OAuth device flow timed out before authorization completed.');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return { error: 'invalid_json' };
  }
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return 'no response body';
  }
}
