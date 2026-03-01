export const PROVIDERS = {
  'openai-oauth': {
    label: 'OpenAI OAuth',
    type: 'oauth',
    envKeys: ['OPENAI_OAUTH_ACCESS_TOKEN', 'OPENAI_OAUTH_REFRESH_TOKEN', 'OPENAI_OAUTH_EXPIRES_AT']
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
