import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';

const DATA_DIR = join(homedir(), '.memory-fusion');
const SESSIONS_FILE = join(DATA_DIR, 'sessions.json');
const MESSAGES_DIR = join(DATA_DIR, 'messages');

const filePath = process.argv[2];
if (!filePath) {
  console.log(JSON.stringify({ error: 'Usage: node file-history.mjs "<file-path>"' }));
  process.exit(1);
}

async function loadJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(await readFile(path, 'utf-8'));
}

async function main() {
  const sessions = (await loadJson(SESSIONS_FILE)) || [];
  const hits = [];

  for (const session of sessions) {
    const msgFile = join(MESSAGES_DIR, `${session.id}.json`);
    const messages = (await loadJson(msgFile)) || [];

    // Find tool_use messages that reference this file
    const toolCalls = [];
    for (const msg of messages) {
      if (msg.role !== 'tool_use') continue;
      const text = (msg.text || '').toLowerCase();
      const input = msg.tool_input || {};

      // Check if the file path appears in tool input or the serialized text
      const matchesFile =
        text.includes(filePath.toLowerCase()) ||
        (input.file_path || '').includes(filePath) ||
        (input.path || '').includes(filePath) ||
        (input.target || '').includes(filePath) ||
        // MultiWrite/Edit file paths
        JSON.stringify(Object.values(input)).toLowerCase().includes(filePath.toLowerCase());

      if (matchesFile) {
        toolCalls.push({
          uuid: msg.uuid,
          tool: msg.tool,
          tool_input: msg.tool_input,
          timestamp: msg.timestamp,
          snippet: (msg.text || '').slice(0, 300),
        });
      }
    }

    if (toolCalls.length > 0) {
      hits.push({
        session: {
          id: session.id,
          source: session.source,
          title: session.title,
          project: session.project,
          started_at: session.started_at,
        },
        tool_calls: toolCalls,
      });
    }
  }

  // Newest sessions first
  hits.sort((a, b) => (b.session.started_at || '').localeCompare(a.session.started_at || ''));

  console.log(JSON.stringify({ file: filePath, hits }, null, 2));
}

main().catch(err => {
  console.error('file-history.mjs error:', err.message);
  process.exit(1);
});
