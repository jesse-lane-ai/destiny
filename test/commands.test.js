import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const cliPath = path.join(repoRoot, 'bin', 'destiny.js');

function runCli(args) {
  const env = { ...process.env };
  delete env.OPENAI_API_KEY;
  delete env.OPENROUTER_API_KEY;
  delete env.ANTHROPIC_API_KEY;
  delete env.GOOGLE_API_KEY;

  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env
  });
}

test('auth add/status/remove works against custom --env file', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'destiny-test-'));
  const envPath = path.join(dir, '.env');
  writeFileSync(envPath, '', 'utf8');

  const add = runCli(['auth', 'add', 'openrouter-key', '--value', 'sk-or-test-key-123456', '--env', envPath]);
  assert.equal(add.status, 0, add.stderr || add.stdout);

  const status = runCli(['auth', 'status', '--env', envPath, '--json']);
  assert.equal(status.status, 0, status.stderr || status.stdout);
  const parsed = JSON.parse(status.stdout);
  const openrouter = parsed.find((x) => x.provider === 'openrouter-key');
  assert.equal(openrouter?.configured, true);
  assert.equal(openrouter?.source, '.env');
  assert.match(openrouter?.masked || '', /^sk-o\.\.\..+/);

  const remove = runCli(['auth', 'remove', 'openrouter-key', '--env', envPath]);
  assert.equal(remove.status, 0, remove.stderr || remove.stdout);

  const afterText = readFileSync(envPath, 'utf8');
  assert.ok(!afterText.includes('OPENROUTER_API_KEY='), afterText);
});

test('run command returns failure when no inference credentials exist', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'destiny-test-'));
  const envPath = path.join(dir, '.env');
  writeFileSync(envPath, '', 'utf8');

  const run = runCli(['run', 'hello', '--env', envPath]);
  assert.equal(run.status, 1, `status=${run.status}\nstdout=${run.stdout}\nstderr=${run.stderr}`);
  assert.match(run.stdout, /Run failed across all models\./);
  assert.match(run.stdout, /FAIL/);
});

test('founder-judge returns failure when no inference credentials exist', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'destiny-test-'));
  const envPath = path.join(dir, '.env');
  writeFileSync(envPath, '', 'utf8');

  const run = runCli(['founder-judge', 'AI tool for plumbers', '--env', envPath]);
  assert.equal(run.status, 1, `status=${run.status}\nstdout=${run.stdout}\nstderr=${run.stderr}`);
  assert.match(run.stdout, /founder-judge failed across all models\./);
  assert.match(run.stdout, /FAIL/);
});

test('doomscroll returns failure when no inference credentials exist', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'destiny-test-'));
  const envPath = path.join(dir, '.env');
  writeFileSync(envPath, '', 'utf8');

  const run = runCli(['doomscroll', 'AI coding agents', '--env', envPath]);
  assert.equal(run.status, 1, `status=${run.status}\nstdout=${run.stdout}\nstderr=${run.stderr}`);
  assert.match(run.stdout, /doomscroll failed across all models\./);
  assert.match(run.stdout, /FAIL/);
});

test('cia-profiler returns failure when no inference credentials exist', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'destiny-test-'));
  const envPath = path.join(dir, '.env');
  writeFileSync(envPath, '', 'utf8');

  const run = runCli(['cia-profiler', 'Acme competitor', '--env', envPath]);
  assert.equal(run.status, 1, `status=${run.status}\nstdout=${run.stdout}\nstderr=${run.stderr}`);
  assert.match(run.stdout, /cia-profiler failed across all models\./);
  assert.match(run.stdout, /FAIL/);
});
