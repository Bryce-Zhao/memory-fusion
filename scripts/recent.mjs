import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DATA_DIR = join(homedir(), '.memory-fusion');
const SESSIONS_FILE = join(DATA_DIR, 'sessions.json');

const n = parseInt(process.argv[2], 10) || 10;

async function loadJson(path) {
  if (!existsSync(path)) return [];
  return JSON.parse(await readFile(path, 'utf-8'));
}

async function main() {
  const sessions = await loadJson(SESSIONS_FILE);

  // Newest first
  sessions.sort((a, b) => (b.started_at || '').localeCompare(a.started_at || ''));

  const result = sessions.slice(0, n).map(s => ({
    id: s.id,
    source: s.source,
    title: s.title,
    project: s.project,
    started_at: s.started_at,
    message_count: s.message_count,
  }));

  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error('recent.mjs error:', err.message);
  process.exit(1);
});
