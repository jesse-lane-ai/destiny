# Destiny

Meta CLI tool for viral simulators + practical dev utilities.

## Install (local dev)

```bash
cd /home/jwhite/dev/destiny
npm install
npm link
```

## Bootstrap

```bash
destiny init
destiny doctor
destiny status
```

## Auth commands (local `.env` by default)

```bash
destiny auth list
destiny auth status

# API key providers (interactive hidden prompt if --value omitted)
destiny auth add openai-key --value sk-...
destiny auth add openrouter-key

# OpenAI OAuth via Codex auth flow
destiny auth login openai
destiny auth login openai --no-device-auth
destiny auth logout openai

# Verify
destiny auth test openai-key
```

## Model precedence

```bash
destiny model status
destiny model set-primary openai-codex/gpt-5.3-codex
destiny model set-fallbacks openai-codex/gpt-5.2 openrouter/minimax/minimax-m2.5
```

## Health & probes

```bash
# Readiness check (auth + model config)
destiny status

# Probe primary model with a live API call
destiny test

# Probe fallback models with live API calls
destiny test fallbacks

# Environment diagnostics
destiny doctor
```

## Notes
- Credentials are read/written to `./.env` in the current project directory by default.
- OpenAI OAuth is delegated to Codex auth (`codex login`), no custom client-id flow in Destiny.
- Local telemetry is written to `~/.destiny/events.jsonl`.
