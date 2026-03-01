import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function telemetryFile() {
  const dir = path.join(os.homedir(), '.destiny');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return path.join(dir, 'events.jsonl');
}

export function logEvent(event, data = {}) {
  try {
    const file = telemetryFile();
    const line = JSON.stringify({ ts: new Date().toISOString(), event, ...data }) + '\n';
    fs.appendFileSync(file, line, { mode: 0o600 });
  } catch {
    // best-effort logging only
  }
}
