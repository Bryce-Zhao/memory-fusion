# MemoryFusion

Cross-session shared memory for AI Coding Agents.

Persistent project memory for Claude Code, Codex, and other AI Coding Agents.

[中文文档 →](./README_zh.md)

---

## The Problem

AI Coding Agents dramatically improve development efficiency, but they share a
common flaw: **they forget.**

- A new Claude Code session doesn't know what you did yesterday.
- Codex doesn't know what Claude Code already built.
- Architecture decisions, implementation details, hard-won lessons, and valuable
  project context — all lost when the session ends.

MemoryFusion solves this by building a **shared project memory layer**.

It continuously indexes historical sessions and fuses context from different AI
Coding Agents, so any supported agent can recall past project experience at any
time.

---

## Why MemoryFusion?

Without long-term memory:

- AI re-analyzes the same problems
- Architecture decisions don't survive sessions
- The same bugs get stepped on twice
- Project knowledge continuously evaporates
- Claude Code & Codex can't share context

**MemoryFusion gives your project a real long-term memory.**

---

## Features

- 🧠 Cross-session memory
- 🤝 Shared memory across Claude Code & Codex
- 🔍 Natural language history queries
- 📂 Project-scoped retrieval
- 📝 Continuously accumulates experience & technical decisions
- ⚡ Local-first
- 🔓 Fully open source

---

## Install

### Via skills CLI (recommended)

```bash
npx skills add Bryce-Zhao/memory-fusion
```

### Manual

```bash
git clone https://github.com/Bryce-Zhao/memory-fusion.git ~/Project/memory-fusion
ln -s ~/Project/memory-fusion ~/.claude/skills/memory-fusion
```

---

## Quick Start

Once installed, just ask in any Claude Code session:

```
"How did I fix that auth bug last time?"
"What have I been working on recently?"
"What changed in login.ts?"
```

The skill activates automatically when you reference past work.

---

## Architecture

```
~/.claude/projects/   ──┐
                        ├── index.mjs ──→ ~/.memory-fusion/
~/.codex/             ──┘                  ├── sessions.json
                                           └── messages/<id>.json
```

| Layer | What | Where |
|---|---|---|
| Source | Claude Code & Codex JSONL | `~/.claude/projects/`, `~/.codex/` |
| Store | Plain JSON | `~/.memory-fusion/` |
| Query | CLI scripts | `scripts/*.mjs` |
| Answer | Agent (SKILL.md) | Natural language |

---

## Commands

```bash
node scripts/index.mjs                           # Incremental index
node scripts/search.mjs "auth bug fix"            # Keyword search
node scripts/recent.mjs 10                        # Recent N sessions
node scripts/session.mjs <session-id>             # Expand one session
node scripts/file-history.mjs "src/login.ts"      # File change history
```

---

## Project Structure

```
memory-fusion/
├── SKILL.md
├── README.md
├── README_zh.md
├── LICENSE
└── scripts/
    ├── index.mjs
    ├── search.mjs
    ├── recent.mjs
    ├── session.mjs
    └── file-history.mjs
```

---

## License

MIT — see [LICENSE](./LICENSE).
