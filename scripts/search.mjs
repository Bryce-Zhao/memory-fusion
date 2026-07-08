import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';

const DATA_DIR = join(homedir(), '.memory-fusion');
const SESSIONS_FILE = join(DATA_DIR, 'sessions.json');
const MESSAGES_DIR = join(DATA_DIR, 'messages');

const query = process.argv[2];
if (!query) {
  console.log(JSON.stringify({ error: 'Usage: node search.mjs "<query>"' }));
  process.exit(1);
}

async function loadJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(await readFile(path, 'utf-8'));
}

async function main() {
  const sessions = (await loadJson(SESSIONS_FILE)) || [];
  const q = query.toLowerCase();
  const hits = [];

  for (const session of sessions) {
    const msgFile = join(MESSAGES_DIR, `${session.id}.json`);
    const messages = (await loadJson(msgFile)) || [];

    // Search in session title
    const titleMatch = (session.title || '').toLowerCase().includes(q);

    // Search in message text
    const matchedMessages = [];
    for (const msg of messages) {
      if (!msg.text) continue;
      const idx = msg.text.toLowerCase().indexOf(q);
      if (idx === -1) continue;

      // Extract snippet around the match
      const start = Math.max(0, idx - 100);
      const end = Math.min(msg.text.length, idx + q.length + 100);
      let snippet = msg.text.slice(start, end);
      if (start > 0) snippet = '...' + snippet;
      if (end < msg.text.length) snippet = snippet + '...';

      matchedMessages.push({
        uuid: msg.uuid,
        role: msg.role,
        content_type: msg.content_type,
        snippet,
        timestamp: msg.timestamp,
      });
    }

    if (titleMatch || matchedMessages.length > 0) {
      hits.push({
        session: {
          id: session.id,
          source: session.source,
          title: session.title,
          project: session.project,
          started_at: session.started_at,
        },
        title_matched: titleMatch,
        messages: matchedMessages.slice(0, 10), // cap per session
        match_count: matchedMessages.length,
      });
    }
  }

  // Sort: title matches first, then by recency
  hits.sort((a, b) => {
    if (a.title_matched !== b.title_matched) return a.title_matched ? -1 : 1;
    return (b.session.started_at || '').localeCompare(a.session.started_at || '');
  });

  console.log(JSON.stringify({ query, hits }, null, 2));
}

main().catch(err => {
  console.error('search.mjs error:', err.message);
  process.exit(1);
});
