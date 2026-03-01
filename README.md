# Destiny

Meta CLI tool for viral simulators + practical dev utilities.

## Install (local dev)

```bash
cd /home/jwhite/dev/destiny
npm install
npm link
```

## Auth commands (local `.env` by default)

```bash
destiny auth list
destiny auth status

# API key providers
destiny auth add openai-key --value sk-...
destiny auth add anthropic-key --value sk-ant-...
destiny auth add google-key --value ...
destiny auth add openrouter-key --value sk-or-...

# OpenAI OAuth (device flow)
destiny auth login openai --client-id <client_id>
destiny auth logout openai

destiny auth test openai-key
destiny auth remove openai-key
```

Supported providers:
- openai-oauth
- openai-key
- anthropic-key
- google-key
- openrouter-key

## OpenAI OAuth notes
- `destiny auth login openai` uses OAuth 2.0 device flow.
- Set client id via `--client-id` or `OPENAI_OAUTH_CLIENT_ID`.
- OAuth tokens are stored in local `.env` as:
  - `OPENAI_OAUTH_ACCESS_TOKEN`
  - `OPENAI_OAUTH_REFRESH_TOKEN` (if returned)
  - `OPENAI_OAUTH_EXPIRES_AT` (if returned)

## Notes
- Credentials are read/written to `./.env` in the current project directory by default.
- You can override with `--env /path/to/.env`.
