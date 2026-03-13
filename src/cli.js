import { Command } from 'commander';
import { addCredential, getStatus, removeCredential, testCredential } from './auth/store.js';
import { listProviders } from './auth/providers.js';
import { loginOpenAIViaCodex, logoutOpenAIViaCodex } from './auth/codex-auth.js';
import { getModelConfig, listProviderProfiles, setFallbackModels, setPrimaryModel, useProviderProfile } from './config-models.js';
import { runReadinessCheck } from './test-command.js';
import { probeModel } from './model-probe.js';
import { runDoctor } from './doctor.js';
import { runInit } from './init.js';
import { missingProvidersForOrder } from './compat.js';
import { promptSecret } from './lib/prompt-secret.js';
import { logEvent } from './lib/telemetry.js';
import { inferWithFallback } from './infer.js';

export function createCli() {
  const program = new Command();
  program.name('destiny').description('Destiny meta CLI tool').version('0.1.0');

  const auth = program.command('auth').description('Manage inference credentials in local .env');

  auth.command('list').description('List supported auth providers').action(() => {
    console.log(listProviders().join('\n'));
  });

  auth.command('status').description('Show credential status for each provider').option('--env <path>', 'Path to .env file (default: ./.env)').option('--json', 'JSON output').action(safe(async (opts) => {
    const status = getStatus({ envPath: opts.env });
    if (opts.json) return console.log(JSON.stringify(status, null, 2));
    for (const item of status) {
      const state = item.configured ? 'configured' : 'missing';
      const detail = item.configured ? `${item.masked} (${item.source})` : '-';
      console.log(`${item.provider.padEnd(16)} ${state.padEnd(10)} ${detail}`);
    }
  }));

  auth.command('add <provider>').description('Add/update a provider credential in local .env').option('--value <secret>', 'Credential value (API key/token)').option('--env <path>', 'Path to .env file (default: ./.env)').action(safe(async (provider, opts) => {
    const value = opts.value || await promptSecret(`Enter ${provider} secret: `);
    if (!value) throw new Error('No credential value provided.');
    const out = addCredential({ providerName: provider, value, envPath: opts.env });
    console.log(`Saved ${out.key} for ${out.providerName} in ${out.envPath}`);
  }));

  auth.command('remove <provider>').description('Remove a provider credential from local .env').option('--env <path>', 'Path to .env file (default: ./.env)').action(safe(async (provider, opts) => {
    const out = removeCredential({ providerName: provider, envPath: opts.env });
    console.log(`Removed ${out.key} for ${out.providerName} from ${out.envPath}`);
  }));

  auth.command('test <provider>').description('Test whether credential exists for provider').option('--env <path>', 'Path to .env file (default: ./.env)').action(safe(async (provider, opts) => {
    const out = testCredential({ providerName: provider, envPath: opts.env });
    if (out.ok) {
      console.log(`OK: ${provider} credential found`);
      process.exitCode = 0;
    } else {
      console.log(`FAIL: ${out.reason}`);
      process.exitCode = 1;
    }
  }));

  auth.command('login <provider>').description('Start provider auth login flow and persist local references in .env').option('--env <path>', 'Path to .env file (default: ./.env)').option('--no-device-auth', 'Use browser callback flow instead of device-auth').action(safe(async (provider, opts) => {
    if (provider !== 'openai') throw new Error("Only 'openai' is supported for OAuth login right now.");

    console.log('Starting OpenAI login via Codex auth flow...\n');
    console.log('INFO: You may see TWO different code prompts during login:');
    console.log('- Device code (example: ABCD-EFGH) -> enter this on the OpenAI device-link page.');
    console.log('- 6-digit numeric code -> this is your normal MFA/2FA authenticator verification code.\n');
    console.log('If you get "Device code authorization is not enabled":');
    console.log('- Enable device-code auth in ChatGPT account/workspace security settings.');
    console.log('- Or bypass with browser callback mode: destiny auth login openai --no-device-auth\n');

    const result = await loginOpenAIViaCodex({ envPath: opts.env, deviceAuth: opts.deviceAuth });
    logEvent('auth.login.openai', { ok: true });
    console.log('OpenAI OAuth complete.');
    console.log(`Codex auth cache: ${result.authPath}`);
    console.log(`Saved auth references in ${result.envPath}`);
  }));

  auth.command('logout <provider>').description('Remove provider OAuth session references from local .env').option('--env <path>', 'Path to .env file (default: ./.env)').action(safe(async (provider, opts) => {
    if (provider !== 'openai') throw new Error("Only 'openai' is supported for OAuth logout right now.");
    const result = await logoutOpenAIViaCodex({ envPath: opts.env });
    logEvent('auth.logout.openai', { ok: true });
    console.log(`Removed OpenAI OAuth references from ${result.envPath}`);
  }));

  const model = program.command('model').description('Configure primary model and fallback precedence');

  model.command('status').description('Show primary model, fallback list, and effective precedence order').option('--env <path>', 'Path to .env file (default: ./.env)').option('--json', 'JSON output').action(safe(async (opts) => {
    const cfg = getModelConfig({ envPath: opts.env });
    if (opts.json) return console.log(JSON.stringify(cfg, null, 2));
    console.log(`Primary:   ${cfg.primary}`);
    console.log(`Fallbacks: ${cfg.fallbacks.length ? cfg.fallbacks.join(', ') : '(none)'}`);
    console.log('Order:');
    cfg.resolvedOrder.forEach((m, i) => console.log(`  ${i + 1}. ${m}`));
  }));

  model.command('set-primary <modelName>').description('Set primary model').option('--env <path>', 'Path to .env file (default: ./.env)').action(safe(async (modelName, opts) => {
    const cfg = setPrimaryModel({ envPath: opts.env, model: modelName });
    warnMissingProviders(cfg, opts.env);
    console.log(`Primary model set to: ${cfg.primary}`);
  }));

  model.command('set-fallbacks [models...]').description('Set fallback models in order (space-separated)').option('--env <path>', 'Path to .env file (default: ./.env)').action(safe(async (models, opts) => {
    const cfg = setFallbackModels({ envPath: opts.env, models: models || [] });
    warnMissingProviders(cfg, opts.env);
    console.log(`Fallback order updated: ${cfg.fallbacks.length ? cfg.fallbacks.join(', ') : '(none)'}`);
  }));

  const provider = program.command('provider').description('Provider profile shortcuts');
  provider.command('list').description('List provider profiles').action(() => {
    console.log(listProviderProfiles().join('\n'));
  });
  provider.command('use <providerName>').description('Set primary/fallback model order for a provider profile').option('--env <path>', 'Path to .env file (default: ./.env)').action(safe(async (providerName, opts) => {
    const cfg = useProviderProfile({ envPath: opts.env, provider: providerName });
    warnMissingProviders(cfg, opts.env);
    console.log(`Provider profile applied: ${cfg.provider}`);
    console.log(`Primary: ${cfg.primary}`);
    console.log(`Fallbacks: ${cfg.fallbacks.join(', ')}`);
  }));

  program.command('run <prompt...>').description('Run a prompt through model precedence with automatic fallback').option('--env <path>', 'Path to .env file (default: ./.env)').option('--json', 'JSON output').option('--max-output-tokens <n>', 'Max output tokens', '220').action(safe(async (promptParts, opts) => {
    const prompt = promptParts.join(' ').trim();
    if (!prompt) throw new Error('Prompt is required.');
    const cfg = getModelConfig({ envPath: opts.env });
    const res = await inferWithFallback({ prompt, models: cfg.resolvedOrder, envPath: opts.env, maxOutputTokens: Number(opts.maxOutputTokens) || 220 });

    logEvent('run', { ok: res.ok, attempts: res.attempts?.length || 0, model: res.model || null });

    if (opts.json) return console.log(JSON.stringify(res, null, 2));
    if (!res.ok) {
      console.log('Run failed across all models.');
      for (const a of res.attempts || []) console.log(`- ${a.model}: FAIL (${a.error || 'unknown'})`);
      process.exitCode = 1;
      return;
    }

    console.log(`[${res.provider}] ${res.model}`);
    console.log(res.text || '(empty response)');
  }));

  program.command('trace <prompt...>').description('Run prompt and print model selection + fallback trace').option('--env <path>', 'Path to .env file (default: ./.env)').option('--max-output-tokens <n>', 'Max output tokens', '220').option('--json', 'JSON output').action(safe(async (promptParts, opts) => {
    const prompt = promptParts.join(' ').trim();
    if (!prompt) throw new Error('Prompt is required.');
    const cfg = getModelConfig({ envPath: opts.env });
    const res = await inferWithFallback({ prompt, models: cfg.resolvedOrder, envPath: opts.env, maxOutputTokens: Number(opts.maxOutputTokens) || 220 });

    if (opts.json) return console.log(JSON.stringify(res, null, 2));

    console.log('Trace:');
    for (const [i, a] of (res.attempts || []).entries()) {
      console.log(`${i + 1}. ${a.model} -> ${a.ok ? 'PASS' : 'FAIL'} (${a.ms}ms${a.error ? `, ${a.error}` : ''})`);
    }
    if (res.ok) {
      console.log(`\nSelected: ${res.model} (${res.provider})`);
      console.log(res.text || '(empty response)');
    } else {
      console.log('\nAll model attempts failed.');
      process.exitCode = 1;
    }
  }));


  program.command('founder-judge <idea...>').description('Judge a startup idea brutally and return actionable verdict').option('--env <path>', 'Path to .env file (default: ./.env)').option('--max-output-tokens <n>', 'Max output tokens', '420').option('--json', 'JSON output').action(safe(async (ideaParts, opts) => {
    const idea = ideaParts.join(' ').trim();
    if (!idea) throw new Error('Idea is required.');

    const prompt = [
      'You are founder-judge, a ruthless but constructive startup evaluator.',
      'Evaluate the idea and respond using EXACTLY these sections:',
      '1) Verdict (one line)',
      '2) Why this might fail (3 bullets)',
      '3) Why this might win (3 bullets)',
      '4) 48-hour validation plan (5 concrete steps)',
      '5) Scorecard with 1-10 scores for: market pain, distribution, moat potential, speed to revenue, founder unfair advantage',
      '',
      `Idea: ${idea}`
    ].join('\n');

    const cfg = getModelConfig({ envPath: opts.env });
    const res = await inferWithFallback({ prompt, models: cfg.resolvedOrder, envPath: opts.env, maxOutputTokens: Number(opts.maxOutputTokens) || 420 });
    logEvent('founder-judge', { ok: res.ok, attempts: res.attempts?.length || 0, model: res.model || null });

    if (opts.json) return console.log(JSON.stringify(res, null, 2));

    if (!res.ok) {
      console.log('founder-judge failed across all models.');
      for (const a of res.attempts || []) console.log(`- ${a.model}: FAIL (${a.error || 'unknown'})`);
      process.exitCode = 1;
      return;
    }

    console.log(`[${res.provider}] ${res.model}`);
    console.log(res.text || '(empty response)');
  }));

  program.command('timeline-split <scenario...>').description('Model best/base/worst-case timelines and force immediate execution choices').option('--env <path>', 'Path to .env file (default: ./.env)').option('--max-output-tokens <n>', 'Max output tokens', '460').option('--json', 'JSON output').action(safe(async (scenarioParts, opts) => {
    const scenario = scenarioParts.join(' ').trim();
    if (!scenario) throw new Error('Scenario is required.');

    const prompt = [
      'You are timeline-split, a strategic planning analyst for founders.',
      'Produce a three-path timeline and force concrete execution decisions.',
      'Respond using EXACTLY these sections:',
      '1) Baseline assumptions (3 bullets)',
      '2) Best-case timeline (30/90/180 day milestones)',
      '3) Base-case timeline (30/90/180 day milestones)',
      '4) Worst-case timeline (30/90/180 day milestones)',
      '5) Trigger thresholds (3 quantitative signals that indicate path changes)',
      '6) Next 72 hours (5 concrete moves)',
      '',
      `Scenario: ${scenario}`
    ].join('\n');

    const cfg = getModelConfig({ envPath: opts.env });
    const res = await inferWithFallback({ prompt, models: cfg.resolvedOrder, envPath: opts.env, maxOutputTokens: Number(opts.maxOutputTokens) || 460 });
    logEvent('timeline-split', { ok: res.ok, attempts: res.attempts?.length || 0, model: res.model || null });

    if (opts.json) return console.log(JSON.stringify(res, null, 2));

    if (!res.ok) {
      console.log('timeline-split failed across all models.');
      for (const a of res.attempts || []) console.log(`- ${a.model}: FAIL (${a.error || 'unknown'})`);
      process.exitCode = 1;
      return;
    }

    console.log(`[${res.provider}] ${res.model}`);
    console.log(res.text || '(empty response)');
  }));


  program.command('debt-punch <situation...>').description('Expose high-interest debt traps and force an aggressive payoff sequence').option('--env <path>', 'Path to .env file (default: ./.env)').option('--max-output-tokens <n>', 'Max output tokens', '420').option('--json', 'JSON output').action(safe(async (situationParts, opts) => {
    const situation = situationParts.join(' ').trim();
    if (!situation) throw new Error('Situation is required.');

    const prompt = [
      'You are debt-punch, a ruthless personal finance operator.',
      'Given the debt situation, force a realistic, high-leverage payoff plan.',
      'Respond using EXACTLY these sections:',
      '1) Debt triage (rank from most dangerous to least dangerous, with reason)',
      '2) Interest bleed estimate (one-line monthly estimate with assumptions)',
      '3) 30-day punch plan (5 concrete actions)',
      '4) Payment order strategy (next 6 payments in order)',
      '5) Failure modes (3 bullets) + countermeasures (3 bullets)',
      '',
      `Situation: ${situation}`
    ].join('\n');

    const cfg = getModelConfig({ envPath: opts.env });
    const res = await inferWithFallback({ prompt, models: cfg.resolvedOrder, envPath: opts.env, maxOutputTokens: Number(opts.maxOutputTokens) || 420 });
    logEvent('debt-punch', { ok: res.ok, attempts: res.attempts?.length || 0, model: res.model || null });

    if (opts.json) return console.log(JSON.stringify(res, null, 2));

    if (!res.ok) {
      console.log('debt-punch failed across all models.');
      for (const a of res.attempts || []) console.log(`- ${a.model}: FAIL (${a.error || 'unknown'})`);
      process.exitCode = 1;
      return;
    }

    console.log(`[${res.provider}] ${res.model}`);
    console.log(res.text || '(empty response)');
  }));

  program.command('cia-profiler <target...>').description('Profile a competitor/market actor and generate a strategic dossier').option('--env <path>', 'Path to .env file (default: ./.env)').option('--max-output-tokens <n>', 'Max output tokens', '520').option('--json', 'JSON output').action(safe(async (targetParts, opts) => {
    const target = targetParts.join(' ').trim();
    if (!target) throw new Error('Target is required.');

    const prompt = [
      'You are cia-profiler, an intelligence analyst for founders.',
      'Build a concise profile with strategic recommendations.',
      'Respond using EXACTLY these sections:',
      '1) Target profile (who/what they are, current positioning)',
      '2) Capability map (distribution, product speed, moat indicators, capital access)',
      '3) Vulnerabilities (3 bullets)',
      '4) Interview flow (8 sharp questions a founder should ask users/prospects to validate attacks against this target)',
      '5) 14-day infiltration plan (5 legal/ethical actions)',
      '6) Risk flags (3 bullets: legal, reputational, execution)',
      '',
      `Target: ${target}`
    ].join('\n');

    const cfg = getModelConfig({ envPath: opts.env });
    const res = await inferWithFallback({ prompt, models: cfg.resolvedOrder, envPath: opts.env, maxOutputTokens: Number(opts.maxOutputTokens) || 520 });
    logEvent('cia-profiler', { ok: res.ok, attempts: res.attempts?.length || 0, model: res.model || null });

    if (opts.json) return console.log(JSON.stringify(res, null, 2));

    if (!res.ok) {
      console.log('cia-profiler failed across all models.');
      for (const a of res.attempts || []) console.log(`- ${a.model}: FAIL (${a.error || 'unknown'})`);
      process.exitCode = 1;
      return;
    }

    console.log(`[${res.provider}] ${res.model}`);
    console.log(res.text || '(empty response)');
  }));

  program.command('doomscroll <topic...>').description('Simulate a chaotic doomscroll feed and extract strategic signal').option('--env <path>', 'Path to .env file (default: ./.env)').option('--max-output-tokens <n>', 'Max output tokens', '420').option('--json', 'JSON output').action(safe(async (topicParts, opts) => {
    const topic = topicParts.join(' ').trim();
    if (!topic) throw new Error('Topic is required.');

    const prompt = [
      'You are doomscroll, a cynical trend analyst that distills online noise into action.',
      'Respond using EXACTLY these sections:',
      '1) Feed snapshot (5 bullets of what appears to be happening)',
      '2) What is signal vs noise (2 bullets each)',
      '3) Contrarian take (2 bullets)',
      '4) 7-day founder move (5 concrete actions)',
      '',
      `Topic: ${topic}`
    ].join('\n');

    const cfg = getModelConfig({ envPath: opts.env });
    const res = await inferWithFallback({ prompt, models: cfg.resolvedOrder, envPath: opts.env, maxOutputTokens: Number(opts.maxOutputTokens) || 420 });
    logEvent('doomscroll', { ok: res.ok, attempts: res.attempts?.length || 0, model: res.model || null });

    if (opts.json) return console.log(JSON.stringify(res, null, 2));

    if (!res.ok) {
      console.log('doomscroll failed across all models.');
      for (const a of res.attempts || []) console.log(`- ${a.model}: FAIL (${a.error || 'unknown'})`);
      process.exitCode = 1;
      return;
    }

    console.log(`[${res.provider}] ${res.model}`);
    console.log(res.text || '(empty response)');
  }));

  program.command('ai-billing-speedometer <window...>').description('Estimate AI spend velocity and provide budget controls').option('--env <path>', 'Path to .env file (default: ./.env)').option('--max-output-tokens <n>', 'Max output tokens', '420').option('--json', 'JSON output').action(safe(async (windowParts, opts) => {
    const windowText = windowParts.join(' ').trim();
    if (!windowText) throw new Error('Time window or usage context is required.');

    const prompt = [
      'You are ai-billing-speedometer, a finance-minded AI ops analyst.',
      'Given the usage context, estimate spend velocity and suggest immediate controls.',
      'Respond using EXACTLY these sections:',
      '1) Spend velocity estimate (one line with explicit assumptions)',
      '2) Burn drivers (3 bullets)',
      '3) 7-day containment plan (5 concrete actions)',
      '4) KPI dashboard (5 metrics to track daily)',
      '',
      `Usage context/time window: ${windowText}`
    ].join('\n');

    const cfg = getModelConfig({ envPath: opts.env });
    const res = await inferWithFallback({ prompt, models: cfg.resolvedOrder, envPath: opts.env, maxOutputTokens: Number(opts.maxOutputTokens) || 420 });
    logEvent('ai-billing-speedometer', { ok: res.ok, attempts: res.attempts?.length || 0, model: res.model || null });

    if (opts.json) return console.log(JSON.stringify(res, null, 2));

    if (!res.ok) {
      console.log('ai-billing-speedometer failed across all models.');
      for (const a of res.attempts || []) console.log(`- ${a.model}: FAIL (${a.error || 'unknown'})`);
      process.exitCode = 1;
      return;
    }

    console.log(`[${res.provider}] ${res.model}`);
    console.log(res.text || '(empty response)');
  }));

  program.command('init').description('Initialize local Destiny project config in .env').option('--env <path>', 'Path to .env file (default: ./.env)').action(safe(async (opts) => {
    const out = runInit({ envPath: opts.env });
    console.log(`Initialized Destiny config in ${out.envPath}`);
  }));

  program.command('doctor').description('Run environment diagnostics').option('--env <path>', 'Path to .env file (default: ./.env)').option('--json', 'JSON output').action(safe(async (opts) => {
    const result = runDoctor({ envPath: opts.env });
    if (opts.json) return console.log(JSON.stringify(result, null, 2));
    console.log(`Destiny doctor: ${result.ok ? 'HEALTHY' : 'ISSUES FOUND'}`);
    for (const c of result.checks) console.log(`- [${c.ok ? 'PASS' : 'FAIL'}] ${c.name}: ${c.detail}`);
    process.exitCode = result.ok ? 0 : 1;
  }));

  program.command('status').description('Run readiness check (auth + model precedence)').option('--env <path>', 'Path to .env file (default: ./.env)').option('--json', 'Output machine-readable JSON').action(safe(async (opts) => {
    const result = await runReadinessCheck({ envPath: opts.env });
    if (opts.json) return console.log(JSON.stringify(result, null, 2));
    console.log(`Destiny status: ${result.ok ? 'READY' : 'NOT READY'}`);
    for (const check of result.checks) {
      console.log(`- [${check.ok ? 'PASS' : 'FAIL'}] ${check.name}`);
      if (!check.ok) console.log(`    hint: ${check.hint}`);
    }
    console.log(`\nPrimary model: ${result.model.primary}`);
    console.log(`Fallbacks: ${result.model.fallbacks.length ? result.model.fallbacks.join(', ') : '(none)'}`);
    process.exitCode = result.ok ? 0 : 1;
  }));

  program.command('test [target]').description('Run live model probe. Default target=primary; use "fallbacks" to probe fallback list.').option('--env <path>', 'Path to .env file (default: ./.env)').option('--json', 'Output machine-readable JSON').action(safe(async (target, opts) => {
    const cfg = getModelConfig({ envPath: opts.env });
    const models = target === 'fallbacks' ? cfg.fallbacks : [cfg.primary];
    if (!models.length) throw new Error('No models available for this test target.');

    const results = [];
    for (const modelName of models) {
      const t0 = Date.now();
      const result = await probeModel({ model: modelName, envPath: opts.env });
      logEvent('model.probe', { model: modelName, ok: result.ok, ms: Date.now() - t0 });
      results.push(result);
    }

    const ok = results.every((r) => r.ok);
    if (opts.json) return console.log(JSON.stringify({ ok, target: target || 'primary', results }, null, 2));

    console.log(`Destiny test (${target === 'fallbacks' ? 'fallbacks' : 'primary'}): ${ok ? 'PASS' : 'FAIL'}`);
    for (const r of results) {
      console.log(`- ${r.model}: ${r.ok ? 'PASS' : 'FAIL'}`);
      if (r.ok && r.text) console.log(`    reply: ${String(r.text).slice(0, 120)}`);
      if (!r.ok && r.error) console.log(`    error: ${r.error}`);
    }
    process.exitCode = ok ? 0 : 1;
  }));

  program.showHelpAfterError();
  return program;
}

function safe(fn) {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (err) {
      const msg = err?.message || String(err);
      console.error(`ERROR: ${msg}`);
      process.exitCode = 1;
    }
  };
}

function warnMissingProviders(cfg, envPath) {
  const missing = missingProvidersForOrder(cfg.resolvedOrder, getStatus({ envPath }));
  if (!missing.length) return;
  console.log('Warning: some models in precedence order have no matching provider credentials:');
  for (const m of missing) console.log(`- ${m.model} needs ${m.provider}`);
}
