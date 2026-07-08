# MemoryFusion

面向 AI Coding Agent 的跨 Session 共享记忆。  
Cross-session shared memory for AI Coding Agents.

为 Claude Code、Codex 以及其他 AI Coding Agent 提供持久化的项目记忆。  
Persistent project memory for Claude Code, Codex, and other AI Coding Agents.

---

## 问题 / The Problem

AI Coding Agent 极大提升了开发效率，但它们都有一个共同的问题：**会失忆。**

AI Coding Agents dramatically improve development efficiency, but they share a
common flaw: **they forget.**

- 新的 Claude Code Session 不知道昨天做了什么。
- Codex 不知道 Claude Code 已经完成了哪些工作。
- 架构决策、实现细节、踩坑经验，以及宝贵的项目上下文，都会随着 Session 结束而丢失。

- A new Claude Code session doesn't know what you did yesterday.
- Codex doesn't know what Claude Code already built.
- Architecture decisions, implementation details, hard-won lessons, and valuable
  project context — all lost when the session ends.

MemoryFusion 通过构建一层**共享项目记忆**，解决这一问题。

MemoryFusion solves this by building a **shared project memory layer**.

它会持续索引历史 Session，并融合来自不同 AI Coding Agent 的上下文，让任何
支持的 Agent 都能够随时回忆过去的项目经验。

It continuously indexes historical sessions and fuses context from different AI
Coding Agents, so any supported agent can recall past project experience at any
time.

---

## 为什么选择 MemoryFusion？ / Why MemoryFusion?

没有长期记忆时 / Without long-term memory:

- AI 会重复分析同一个问题 / AI re-analyzes the same problems
- 架构决策无法跨 Session 保留 / Architecture decisions don't survive sessions
- Bug 会被重复踩 / The same bugs get stepped on twice
- 项目经验不断流失 / Project knowledge continuously evaporates
- Claude Code 与 Codex 无法共享上下文 / Claude Code & Codex can't share context

**MemoryFusion 为你的项目提供真正的长期记忆。**  
**MemoryFusion gives your project a real long-term memory.**

---

## 特性 / Features

- 🧠 **跨 Session 记忆** / Cross-session memory
- 🤝 **Claude Code 与 Codex 共享项目记忆** / Shared memory across agents
- 🔍 **自然语言查询历史** / Natural language history queries
- 📂 **基于项目上下文进行检索** / Project-scoped retrieval
- 📝 **持续积累实现经验与技术决策** / Continuously accumulates experience & decisions
- ⚡ **Local-first，本地优先** / Local-first
- 🔓 **完全开源** / Fully open source

---

## 快速开始 / Quick Start

```bash
# Clone and install as a user skill
git clone https://github.com/Bryce-Zhao/memory-fusion.git ~/Project/memory-fusion
ln -s ~/Project/memory-fusion ~/.claude/skills/memory-fusion
```

Or via skills CLI:

```bash
npx skills add Bryce-Zhao/memory-fusion
```

Then just ask in any Claude Code session:

```
"之前那个 auth bug 怎么修的？"
"最近我在做什么？"
"login.ts 这个文件改过什么？"
```

---

## 架构 / Architecture

```
~/.claude/projects/   ──┐
                        ├── index.mjs ──→ ~/.memory-fusion/
~/.codex/             ──┘                  ├── sessions.json
                                           └── messages/<id>.json
```

| 层 / Layer | 说明 / What | 位置 / Where |
|---|---|---|
| 数据源 / Source | Claude Code & Codex JSONL | `~/.claude/projects/`, `~/.codex/` |
| 存储 / Store | Plain JSON | `~/.memory-fusion/` |
| 查询 / Query | CLI scripts | `scripts/*.mjs` |
| 回答 / Answer | Agent (SKILL.md) | Natural language |

---

## 命令 / Commands

```bash
node scripts/index.mjs                           # 增量索引
node scripts/search.mjs "auth bug fix"            # 关键词搜索
node scripts/recent.mjs 10                        # 最近 N 个 session
node scripts/session.mjs <session-id>             # 展开单个 session
node scripts/file-history.mjs "src/login.ts"      # 文件修改历史
```

---

## 项目结构 / Project Structure

```
memory-fusion/
├── SKILL.md
├── README.md
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
