import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';

const DATA_DIR = join(homedir(), '.memory-fusion');
const SESSIONS_FILE = join(DATA_DIR, 'sessions.json');
const MESSAGES_DIR = join(DATA_DIR, 'messages');

const CLAUDE_PROJECTS_DIR = join(homedir(), '.claude', 'projects');
const CODEX_HISTORY = join(homedir(), '.codex', 'history.jsonl');
const CODEX_ARCHIVED = join(homedir(), '.codex', 'archived_sessions');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureDir(dir) {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
}

async function loadJson(path) {
  if (!existsSync(path)) return null;
  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw);
}

async function saveJson(path, data) {
  await writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
}

/** Read a JSONL file line by line, return parsed objects. */
async function* readJsonl(path) {
  if (!existsSync(path)) return;
  const stream = createInterface({
    input: (await stat(path)).isFile() ? require('node:fs').createReadStream(path) : process.stdin,
    crlfDelay: Infinity,
  });
  // Re-read as a simpler approach: just read the whole file and split
  // (sessions are typically 100-500 lines, this is fine)
}

/** Read a JSONL file, return array of parsed lines. */
async function readJsonlAll(path) {
  if (!existsSync(path)) return [];
  const raw = await readFile(path, 'utf-8');
  const lines = raw.trim().split('\n').filter(Boolean);
  const result = [];
  for (const line of lines) {
    try {
      result.push(JSON.parse(line));
    } catch {
      // Skip malformed lines
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Claude Code indexing
// ---------------------------------------------------------------------------

async function indexClaudeCode(knownIds) {
  if (!existsSync(CLAUDE_PROJECTS_DIR)) return [];

  const projectDirs = await readdir(CLAUDE_PROJECTS_DIR, { withFileTypes: true });
  const newSessions = [];

  for (const entry of projectDirs) {
    if (!entry.isDirectory()) continue;
    const projectPath = join(CLAUDE_PROJECTS_DIR, entry.name);
    // Decode project path from slug
    const project = decodeProjectSlug(entry.name);

    const files = await readdir(projectPath);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

    for (const file of jsonlFiles) {
      const sessionId = basename(file, '.jsonl');
      if (knownIds.has(`claude:${sessionId}`)) continue;

      const filePath = join(projectPath, file);
      const lines = await readJsonlAll(filePath);
      if (lines.length === 0) continue;

      const { messages, title, startedAt } = extractClaudeMessages(lines, sessionId);

      newSessions.push({
        id: sessionId,
        source: 'claude',
        title: title || '(untitled)',
        project,
        started_at: startedAt || null,
        message_count: messages.length,
        indexed_at: new Date().toISOString(),
      });

      // Save messages
      await saveJson(join(MESSAGES_DIR, `${sessionId}.json`), messages);
    }
  }

  return newSessions;
}

/** Decode a Claude Code project directory slug back to a path. */
function decodeProjectSlug(slug) {
  // Slugs look like: -Users-bryce-Project-memory-fusion
  // Each path segment is prefixed with '-'
  return '/' + slug.replace(/^-/, '').replace(/-/g, '/');
}

function extractClaudeMessages(lines, fallbackId) {
  const messages = [];
  let title = null;
  let startedAt = null;

  for (const line of lines) {
    const type = line.type;

    // Capture session metadata
    if (type === 'ai-title' && !title) {
      title = line.aiTitle || line.title || line.content;
    }
    if (!startedAt && line.timestamp) {
      startedAt = line.timestamp;
    }

    // Capture timestamp from any line with one
    const ts = line.timestamp || null;

    if (type === 'user' && line.message) {
      const content = line.message.content;
      if (typeof content === 'string') {
        messages.push({
          uuid: line.uuid || crypto.randomUUID(),
          role: 'user',
          content_type: 'text',
          text: truncate(content),
          timestamp: ts,
          sessionId: line.sessionId || fallbackId,
        });
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (!block) continue;
          if (block.type === 'tool_result') {
            messages.push({
              uuid: line.uuid || crypto.randomUUID(),
              role: 'tool_result',
              content_type: 'tool_result',
              tool_use_id: block.tool_use_id || null,
              text: truncate(typeof block.content === 'string' ? block.content : JSON.stringify(block.content || {})),
              timestamp: ts,
              sessionId: line.sessionId || fallbackId,
            });
          } else {
            const text = block.text || block.content || '';
            if (text) {
              messages.push({
                uuid: line.uuid || crypto.randomUUID(),
                role: 'user',
                content_type: block.type || 'text',
                text: truncate(typeof text === 'string' ? text : JSON.stringify(text)),
                timestamp: ts,
                sessionId: line.sessionId || fallbackId,
              });
            }
          }
        }
      }
    } else if (type === 'assistant' && line.message) {
      const content = Array.isArray(line.message.content)
        ? line.message.content
        : [line.message.content];

      for (const block of content) {
        if (!block) continue;
        const contentType = block.type || 'text';

        if (contentType === 'tool_use') {
          // Index tool calls for file-history queries
          messages.push({
            uuid: line.uuid || crypto.randomUUID(),
            role: 'tool_use',
            content_type: 'tool_use',
            tool: block.name || 'unknown',
            tool_input: block.input || null,
            text: truncate(JSON.stringify(block.input || {})),
            timestamp: ts,
            sessionId: line.sessionId || fallbackId,
          });
        } else if (contentType === 'thinking' && block.thinking) {
          messages.push({
            uuid: line.uuid || crypto.randomUUID(),
            role: 'assistant',
            content_type: 'thinking',
            text: truncate(block.thinking),
            timestamp: ts,
            sessionId: line.sessionId || fallbackId,
          });
        } else {
          const text = block.text || block.content || '';
          if (text) {
            messages.push({
              uuid: line.uuid || crypto.randomUUID(),
              role: 'assistant',
              content_type: contentType,
              text: truncate(typeof text === 'string' ? text : JSON.stringify(text)),
              timestamp: ts,
              sessionId: line.sessionId || fallbackId,
            });
          }
        }
      }
    }
  }

  return { messages, title, startedAt };
}

// ---------------------------------------------------------------------------
// Codex indexing
// ---------------------------------------------------------------------------

async function indexCodex(knownIds) {
  const newSessions = [];

  // 1. Index history.jsonl (user messages, grouped by session)
  if (existsSync(CODEX_HISTORY)) {
    const lines = await readJsonlAll(CODEX_HISTORY);
    const bySession = new Map();

    for (const line of lines) {
      const sid = line.session_id;
      if (!sid) continue;
      if (knownIds.has(`codex:${sid}`)) continue;
      if (!bySession.has(sid)) bySession.set(sid, []);
      bySession.get(sid).push({
        uuid: `codex-history-${bySession.get(sid).length}`,
        role: 'user',
        content_type: 'text',
        text: truncate(line.text || ''),
        timestamp: line.ts ? new Date(line.ts * 1000).toISOString() : null,
        sessionId: sid,
      });
    }

    for (const [sid, msgs] of bySession) {
      newSessions.push({
        id: sid,
        source: 'codex',
        title: extractCodexTitle(msgs),
        project: null,
        started_at: msgs[0]?.timestamp || null,
        message_count: msgs.length,
        indexed_at: new Date().toISOString(),
      });
      await saveJson(join(MESSAGES_DIR, `${sid}.json`), msgs);
    }
  }

  // 2. Index archived_sessions
  if (existsSync(CODEX_ARCHIVED)) {
    const files = await readdir(CODEX_ARCHIVED);

    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;
      // Extract session ID from filename
      const match = file.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      const sid = match ? match[1] : basename(file, '.jsonl');
      const codexId = `codex:${sid}`;
      if (knownIds.has(codexId)) continue;

      const filePath = join(CODEX_ARCHIVED, file);
      const lines = await readJsonlAll(filePath);
      const { messages, title, startedAt } = extractCodexArchivedMessages(lines, sid);

      if (messages.length === 0) continue;

      newSessions.push({
        id: sid,
        source: 'codex',
        title: title || '(untitled)',
        project: null,
        started_at: startedAt || null,
        message_count: messages.length,
        indexed_at: new Date().toISOString(),
      });
      await saveJson(join(MESSAGES_DIR, `${sid}.json`), messages);
    }
  }

  return newSessions;
}

function extractCodexTitle(messages) {
  const first = messages.find(m => m.role === 'user');
  if (!first) return null;
  return truncate(first.text, 100);
}

function extractCodexArchivedMessages(lines, fallbackId) {
  const messages = [];
  let title = null;
  let startedAt = null;

  for (const line of lines) {
    const ts = line.timestamp || null;

    if (line.type === 'session_meta' && line.payload) {
      startedAt = startedAt || line.payload.timestamp || ts;
      continue;
    }

    if (line.type === 'response_item' && line.payload) {
      const p = line.payload;

      if (p.type === 'message' && p.role === 'user') {
        const text = extractCodexContent(p.content);
        if (text) {
          if (!title) title = truncate(text, 100);
          messages.push({
            uuid: `codex-msg-${messages.length}`,
            role: 'user',
            content_type: 'text',
            text: truncate(text),
            timestamp: ts,
            sessionId: fallbackId,
          });
        }
      } else if (p.type === 'message' && p.role === 'assistant') {
        const text = extractCodexContent(p.content);
        if (text) {
          messages.push({
            uuid: `codex-msg-${messages.length}`,
            role: 'assistant',
            content_type: 'text',
            text: truncate(text),
            timestamp: ts,
            sessionId: fallbackId,
          });
        }
      } else if (p.type === 'function_call') {
        messages.push({
          uuid: `codex-msg-${messages.length}`,
          role: 'tool_use',
          content_type: 'tool_use',
          tool: p.name || p.function_name || 'unknown',
          tool_input: p.arguments || p.input || null,
          text: truncate(JSON.stringify(p.arguments || p.input || {})),
          timestamp: ts,
          sessionId: fallbackId,
        });
      }
    }

    // Capture agent reasoning as thinking
    if (line.type === 'agent_reasoning' && line.payload) {
      const text = typeof line.payload === 'string' ? line.payload : line.payload.text;
      if (text) {
        messages.push({
          uuid: `codex-msg-${messages.length}`,
          role: 'assistant',
          content_type: 'thinking',
          text: truncate(text),
          timestamp: ts,
          sessionId: fallbackId,
        });
      }
    }
  }

  return { messages, title, startedAt };
}

function extractCodexContent(content) {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map(c => {
        if (typeof c === 'string') return c;
        if (c.type === 'input_text' || c.type === 'output_text') return c.text || '';
        return c.text || '';
      })
      .join('\n');
  }
  return '';
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function truncate(text, maxLen = 5000) {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) + '...[truncated]' : text;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  await ensureDir(DATA_DIR);
  await ensureDir(MESSAGES_DIR);

  // Load existing index
  const existing = (await loadJson(SESSIONS_FILE)) || [];
  const knownIds = new Set(existing.map(s => `${s.source}:${s.id}`));

  // Index both sources
  const claudeSessions = await indexClaudeCode(knownIds);
  const codexSessions = await indexCodex(knownIds);

  const allNew = [...claudeSessions, ...codexSessions];
  const merged = [...existing, ...allNew];

  // Save updated index
  await saveJson(SESSIONS_FILE, merged);

  // Report
  const result = {
    indexed: allNew.length,
    skipped: existing.length,
    total: merged.length,
    new_claude: claudeSessions.length,
    new_codex: codexSessions.length,
  };

  console.log(JSON.stringify(result));
}

main().catch(err => {
  console.error('index.mjs error:', err.message);
  process.exit(1);
});
