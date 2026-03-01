export const PROVIDERS = {
  'openai-oauth': {
    label: 'OpenAI OAuth (Codex)',
    type: 'oauth',
    envKeys: ['OPENAI_CODEX_AUTH_FILE', 'OPENAI_OAUTH_PROVIDER']
  },
  'openai-key': {
    label: 'OpenAI API Key',
    type: 'apiKey',
    envKeys: ['OPENAI_API_KEY']
  },
  'anthropic-key': {
    label: 'Anthropic API Key',
    type: 'apiKey',
    envKeys: ['ANTHROPIC_API_KEY']
  },
  'google-key': {
    label: 'Google API Key',
    type: 'apiKey',
    envKeys: ['GOOGLE_API_KEY']
  },
  'openrouter-key': {
    label: 'OpenRouter API Key',
    type: 'apiKey',
    envKeys: ['OPENROUTER_API_KEY']
  }
};

export function listProviders() {
  return Object.keys(PROVIDERS);
}

export function getProvider(name) {
  return PROVIDERS[name] || null;
}
