export function providerForModel(model) {
  if (!model) return 'unknown';
  if (model.startsWith('openrouter/')) return 'openrouter-key';
  if (model.startsWith('openai-codex/') || model.startsWith('openai/')) return 'openai-key';
  if (model.startsWith('anthropic/')) return 'anthropic-key';
  if (model.startsWith('google/')) return 'google-key';
  return 'unknown';
}

export function missingProvidersForOrder(order, authStatus) {
  const configured = new Set(authStatus.filter((a) => a.configured).map((a) => a.provider));
  return order
    .map((m) => ({ model: m, provider: providerForModel(m) }))
    .filter((x) => x.provider !== 'unknown' && !configured.has(x.provider));
}
