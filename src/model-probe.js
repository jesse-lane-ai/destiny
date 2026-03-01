import { loadEnv, resolveEnvPath } from './lib/env.js';

export async function probeModel({ model, envPath }) {
  if (!model) return { ok: false, model, error: 'No model provided' };

  if (model.startsWith('openrouter/')) {
    return probeOpenRouter({ model, envPath });
  }

  if (model.startsWith('openai-codex/') || model.startsWith('openai/')) {
    return probeOpenAI({ model, envPath });
  }

  return {
    ok: false,
    model,
    error: 'No probe adapter for this model provider yet'
  };
}

async function probeOpenRouter({ model, envPath }) {
  const env = loadEnv(resolveEnvPath(envPath));
  const key = env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!key) return { ok: false, model, error: 'Missing OPENROUTER_API_KEY' };

  const apiModel = model.replace('openrouter/', '');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: apiModel,
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      max_tokens: 8,
      temperature: 0
    })
  });

  const payload = await safeJson(res);
  if (!res.ok) return { ok: false, model, error: `HTTP ${res.status}`, detail: payload };

  return {
    ok: true,
    model,
    provider: 'openrouter',
    text: payload?.choices?.[0]?.message?.content || ''
  };
}

async function probeOpenAI({ model, envPath }) {
  const env = loadEnv(resolveEnvPath(envPath));
  const key = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) {
    return {
      ok: false,
      model,
      error: 'Missing OPENAI_API_KEY (OAuth login alone is not yet wired for direct API probing)'
    };
  }

  const apiModel = model
    .replace('openai-codex/', '')
    .replace('openai/', '');

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: apiModel,
      input: 'Reply with exactly: OK',
      max_output_tokens: 16
    })
  });

  const payload = await safeJson(res);
  if (!res.ok) return { ok: false, model, error: `HTTP ${res.status}`, detail: payload };

  return {
    ok: true,
    model,
    provider: 'openai',
    text: payload?.output_text || ''
  };
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return { parse_error: true };
  }
}
