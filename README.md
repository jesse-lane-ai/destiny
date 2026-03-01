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

## Provider shortcuts

```bash
destiny provider list
destiny provider use openai
destiny provider use openrouter
destiny provider use anthropic
destiny provider use google
```

## Run + trace

```bash
# Run prompt through precedence chain (auto-fallback)
destiny run "write a 2-line roast about tech debt"

# Run prompt and show fallback trace details
destiny trace "give me a one-word answer: bananas"

# Judge a startup idea with a structured verdict
# (brutal but actionable)
destiny founder-judge "AI assistant for HVAC technicians"
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
