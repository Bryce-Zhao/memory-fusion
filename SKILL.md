---
name: memory-fusion
description: >
  Search across Claude Code and Codex session history to answer questions about
  past work. Reactive: when the user asks "之前这个怎么修的", "这个代码改过什么",
  "上次是怎么做的", "find the session where", "what did we do last time",
  "how did I fix". Proactive: when the user references past work you lack context
  for, or when understanding prior decisions would improve your current response.
allowed-tools:
  - Read
  - Bash(node:*)
  - Write
---

# memory-fusion

Search and query Claude Code and Codex session history stored in `~/.claude/`
and `~/.codex/`. Memory Fusion indexes sessions and messages into local JSON
files, then provides CLI commands for keyword search and session browsing.

## Architecture

```
~/.claude/projects/   ──┐
                        ├── index.mjs ──→ ~/.memory-fusion/
~/.codex/             ──┘                  ├── sessions.json    (master index)
                                           └── messages/
                                               ├── <id>.json    (per session)
```

- **Storage**: plain JSON files under `~/.memory-fusion/`. One master index
  (`sessions.json`) plus one messages file per session.
- **Indexing**: incremental. Each run of `index.mjs` scans source directories,
  skips already-indexed sessions, and appends new ones.
- **Query**: fixed CLI commands that read the JSON store and print results to
  stdout. The agent parses the JSON and synthesizes a natural-language answer.

## Quick Start

The skill directory is available as `$SKILL_DIR` at invocation time.

### Step 1 — Index

Always run this first to pick up new sessions:

```bash
node $SKILL_DIR/scripts/index.mjs
```

First run builds the full index. Later runs are incremental (new sessions only).

### Step 2 — Query

Pick the command that matches the user's question:

```bash
# Keyword search across all indexed messages
node $SKILL_DIR/scripts/search.mjs "keyword phrase"

# List recent N sessions (default 10)
node $SKILL_DIR/scripts/recent.mjs 10

# Show all messages from one session
node $SKILL_DIR/scripts/session.mjs <session-id>

# Show file edit history (Read/Edit/Write tool calls)
node $SKILL_DIR/scripts/file-history.mjs "src/foo.ts"
```

### Step 3 — Answer

Parse the JSON output from Step 2. Synthesize a concise natural-language
answer with concrete evidence: session titles, timestamps, file paths, and
relevant message snippets. Link session IDs and file paths so the user can
click through.

## Workflow

When activated, follow this sequence:

1. **Index first.** Run `index.mjs` to ensure the store is current.
2. **Choose the right command.** Keyword search for "how did I fix X" or "find
   the session where Y"; `recent.mjs` for "what did I work on lately";
   `file-history.mjs` for "what changed in this file".
3. **Parse and answer.** Read the JSON from stdout. Keep evidence compact —
   prefer session title + timestamp + a short snippet over dumping entire
   message threads. If the user needs more detail on a specific hit, run
   `session.mjs` to expand.
4. **Offer to go deeper.** If the results point to a specific session or
   message the user might want to explore, offer to pull the full context.

## JSON Store Schema

### sessions.json

```json
[
  {
    "id": "abc123",
    "source": "claude",
    "title": "Fix auth bug in login flow",
    "project": "/Users/bryce/Project/my-app",
    "started_at": "2026-07-01T10:30:00Z",
    "message_count": 42,
    "indexed_at": "2026-07-08T12:00:00Z"
  }
]
```

### messages/<session-id>.json

```json
[
  {
    "uuid": "msg-001",
    "role": "user",
    "content_type": "text",
    "text": "the login page is broken after the refactor...",
    "timestamp": "2026-07-01T10:30:00Z"
  }
]
```

`content_type` is one of: `text`, `thinking`, `tool_use`, `tool_result`.

## Commands Reference

### `index.mjs`

Scan `~/.claude/projects/` and `~/.codex/` for new sessions. Parse JSONL,
extract messages, write to the JSON store. Skip sessions already in
`sessions.json`. Print a summary: `{ indexed: 3, skipped: 12, total: 15 }`.

### `search.mjs <query>`

Case-insensitive substring search across session titles and message text.
Returns matching sessions and messages, ordered by recency:

```json
{
  "query": "auth bug",
  "hits": [
    {
      "session": { "id": "abc123", "title": "...", "started_at": "..." },
      "messages": [
        { "uuid": "msg-001", "role": "user", "snippet": "...contains query...", "timestamp": "..." }
      ]
    }
  ]
}
```

`snippet` is the matching text truncated to 200 chars around the hit.

### `recent.mjs [N]`

Return the N most recent sessions (default 10):

```json
[
  { "id": "abc123", "source": "claude", "title": "...", "started_at": "...", "message_count": 42 }
]
```

### `session.mjs <session-id>`

Return all messages for one session, ordered by timestamp:

```json
{
  "session": { "id": "abc123", "title": "...", "source": "claude", "started_at": "..." },
  "messages": [
    { "uuid": "msg-001", "role": "user", "content_type": "text", "text": "...", "timestamp": "..." }
  ]
}
```

### `file-history.mjs <path>`

Find all tool-call messages that touched a given file path across all indexed
sessions. Returns sessions and the relevant tool calls, newest first:

```json
{
  "file": "src/auth/login.ts",
  "hits": [
    {
      "session": { "id": "abc123", "title": "...", "started_at": "..." },
      "tool_calls": [
        { "uuid": "tc-001", "tool": "Edit", "snippet": "...", "timestamp": "..." }
      ]
    }
  ]
}
```

## Notes

- Data directory: `~/.memory-fusion/`. Created on first `index.mjs` run.
- Source directories scanned: `~/.claude/projects/` (Claude Code) and
  `~/.codex/` (Codex).
- Only `role: "user"` and `role: "assistant"` messages with `content_type: "text"`
  are indexed for search. Tool calls and results are indexed for `file-history.mjs`
  only.
- Text is truncated to 5000 chars per message to keep JSON files manageable.
