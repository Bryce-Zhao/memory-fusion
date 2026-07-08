import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DATA_DIR = join(homedir(), '.memory-fusion');
const SESSIONS_FILE = join(DATA_DIR, 'sessions.json');
const MESSAGES_DIR = join(DATA_DIR, 'messages');

const sessionId = process.argv[2];
if (!sessionId) {
  console.log(JSON.stringify({ error: 'Usage: node session.mjs <session-id>' }));
  process.exit(1);
}

async function loadJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(await readFile(path, 'utf-8'));
}

async function main() {
  const sessions = (await loadJson(SESSIONS_FILE)) || [];
  const session = sessions.find(s => s.id === sessionId);

  if (!session) {
    console.log(JSON.stringify({ error: `Session not found: ${sessionId}`, hint: 'Run recent.mjs to see available session IDs.' }));
    process.exit(1);
  }

  const msgFile = join(MESSAGES_DIR, `${sessionId}.json`);
  const messages = (await loadJson(msgFile)) || [];

  console.log(JSON.stringify({ session, messages }, null, 2));
}

main().catch(err => {
  console.error('session.mjs error:', err.message);
  process.exit(1);
});
