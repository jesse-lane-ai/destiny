import { getStatus } from './auth/store.js';
import { getModelConfig } from './config-models.js';

export async function runReadinessCheck({ envPath }) {
  const auth = getStatus({ envPath });
  const model = getModelConfig({ envPath });

  const checks = [
    {
      name: 'openai-oauth',
      ok: auth.find((x) => x.provider === 'openai-oauth')?.configured || false,
      hint: 'Run: destiny auth login openai'
    },
    {
      name: 'inference-key-any',
      ok: auth.some((x) => ['openai-key', 'anthropic-key', 'google-key', 'openrouter-key'].includes(x.provider) && x.configured),
      hint: 'Run: destiny auth add <provider> --value <key>'
    },
    {
      name: 'primary-model-set',
      ok: Boolean(model.primary),
      hint: 'Run: destiny model set-primary <model>'
    },
    {
      name: 'fallback-order-valid',
      ok: Array.isArray(model.fallbacks),
      hint: 'Run: destiny model set-fallbacks <model1> <model2>'
    }
  ];

  const failed = checks.filter((c) => !c.ok);

  return {
    ok: failed.length === 0,
    checks,
    auth,
    model,
    failed
  };
}
