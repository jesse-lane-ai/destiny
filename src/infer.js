import { loadEnv, resolveEnvPath } from './lib/env.js';

export async function inferWithFallback({ prompt, models, envPath, maxOutputTokens = 220 }) {
  const attempts = [];

  for (const model of models) {
    const t0 = Date.now();
    const result = await inferOnce({ prompt, model, envPath, maxOutputTokens });
    attempts.push({ ...result, ms: Date.now() - t0 });
    if (result.ok) {
      return {
        ok: true,
        model,
        provider: result.provider,
        text: result.text,
        attempts
      };
    }
  }

  return {
    ok: false,
    error: 'All models failed',
    attempts
  };
}

async function inferOnce({ prompt, model, envPath, maxOutputTokens }) {
  if (model.startsWith('openrouter/')) return inferOpenRouter({ prompt, model, envPath, maxOutputTokens });
  if (model.startsWith('openai-codex/') || model.startsWith('openai/')) return inferOpenAI({ prompt, model, envPath, maxOutputTokens });
  return { ok: false, model, error: 'No inference adapter for this model provider yet' };
}

async function inferOpenRouter({ prompt, model, envPath, maxOutputTokens }) {
  const env = loadEnv(resolveEnvPath(envPath));
  const key = env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!key) return { ok: false, model, provider: 'openrouter', error: 'Missing OPENROUTER_API_KEY' };

  const apiModel = model.replace('openrouter/', '');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: apiModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxOutputTokens,
      temperature: 0.4
    })
  });

  const payload = await safeJson(res);
  if (!res.ok) return { ok: false, model, provider: 'openrouter', error: `HTTP ${res.status}`, detail: payload };

  return {
    ok: true,
    model,
    provider: 'openrouter',
    text: payload?.choices?.[0]?.message?.content || ''
  };
}

async function inferOpenAI({ prompt, model, envPath, maxOutputTokens }) {
  const env = loadEnv(resolveEnvPath(envPath));
  const key = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, model, provider: 'openai', error: 'Missing OPENAI_API_KEY' };

  const apiModel = model.replace('openai-codex/', '').replace('openai/', '');
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: apiModel,
      input: prompt,
      max_output_tokens: maxOutputTokens
    })
  });

  const payload = await safeJson(res);
  if (!res.ok) return { ok: false, model, provider: 'openai', error: `HTTP ${res.status}`, detail: payload };

  return {
    ok: true,
    model,
    provider: 'openai',
    text: payload?.output_text || extractFallbackText(payload)
  };
}

function extractFallbackText(payload) {
  const out = payload?.output;
  if (!Array.isArray(out)) return '';
  return out
    .flatMap((x) => x?.content || [])
    .map((c) => c?.text)
    .filter(Boolean)
    .join('\n');
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return { parse_error: true };
  }
}
