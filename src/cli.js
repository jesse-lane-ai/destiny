import { Command } from 'commander';
import { addCredential, getStatus, removeCredential, testCredential } from './auth/store.js';
import { listProviders } from './auth/providers.js';
import { loginOpenAIDeviceFlow, logoutOpenAI } from './auth/openai-oauth.js';

export function createCli() {
  const program = new Command();

  program
    .name('destiny')
    .description('Destiny meta CLI tool')
    .version('0.1.0');

  const auth = program.command('auth').description('Manage inference credentials in local .env');

  auth
    .command('list')
    .description('List supported auth providers')
    .action(() => {
      console.log(listProviders().join('\n'));
    });

  auth
    .command('status')
    .description('Show credential status for each provider')
    .option('--env <path>', 'Path to .env file (default: ./.env)')
    .action((opts) => {
      const status = getStatus({ envPath: opts.env });
      for (const item of status) {
        const state = item.configured ? 'configured' : 'missing';
        const detail = item.configured ? `${item.masked} (${item.source})` : '-';
        console.log(`${item.provider.padEnd(16)} ${state.padEnd(10)} ${detail}`);
      }
    });

  auth
    .command('add <provider>')
    .description('Add/update a provider credential in local .env')
    .requiredOption('--value <secret>', 'Credential value (API key/token)')
    .option('--env <path>', 'Path to .env file (default: ./.env)')
    .action((provider, opts) => {
      const out = addCredential({ providerName: provider, value: opts.value, envPath: opts.env });
      console.log(`Saved ${out.key} for ${out.providerName} in ${out.envPath}`);
    });

  auth
    .command('remove <provider>')
    .description('Remove a provider credential from local .env')
    .option('--env <path>', 'Path to .env file (default: ./.env)')
    .action((provider, opts) => {
      const out = removeCredential({ providerName: provider, envPath: opts.env });
      console.log(`Removed ${out.key} for ${out.providerName} from ${out.envPath}`);
    });

  auth
    .command('test <provider>')
    .description('Test whether credential exists for provider')
    .option('--env <path>', 'Path to .env file (default: ./.env)')
    .action((provider, opts) => {
      const out = testCredential({ providerName: provider, envPath: opts.env });
      if (out.ok) {
        console.log(`OK: ${provider} credential found`);
        process.exitCode = 0;
      } else {
        console.log(`FAIL: ${out.reason}`);
        process.exitCode = 1;
      }
    });

  auth
    .command('login <provider>')
    .description('Start provider OAuth login flow and save token(s) to local .env')
    .option('--client-id <id>', 'OAuth client id (or set OPENAI_OAUTH_CLIENT_ID)')
    .option('--scope <scope>', 'OAuth scopes', 'openid profile offline_access')
    .option('--audience <audience>', 'OAuth audience (optional)')
    .option('--env <path>', 'Path to .env file (default: ./.env)')
    .action(async (provider, opts) => {
      if (provider !== 'openai') {
        throw new Error("Only 'openai' is supported for OAuth login right now.");
      }

      const clientId = opts.clientId || process.env.OPENAI_OAUTH_CLIENT_ID;

      const result = await loginOpenAIDeviceFlow({
        envPath: opts.env,
        clientId,
        scope: opts.scope,
        audience: opts.audience
      });

      console.log('OpenAI OAuth complete.');
      if (result.verificationUriComplete) {
        console.log(`Verification URL: ${result.verificationUriComplete}`);
      } else {
        console.log(`Verification URL: ${result.verificationUri}`);
        console.log(`User code: ${result.userCode}`);
      }
      console.log(`Saved OAuth credential(s) in ${result.envPath}`);
    });

  auth
    .command('logout <provider>')
    .description('Remove provider OAuth tokens from local .env')
    .option('--env <path>', 'Path to .env file (default: ./.env)')
    .action((provider, opts) => {
      if (provider !== 'openai') {
        throw new Error("Only 'openai' is supported for OAuth logout right now.");
      }

      const result = logoutOpenAI({ envPath: opts.env });
      console.log(`Removed OpenAI OAuth tokens from ${result.envPath}`);
    });

  program.showHelpAfterError();
  return program;
}
