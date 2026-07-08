# memory-fusion

Shared cross-session memory for Claude Code and Codex.  
跨 session 共享记忆，支持 Claude Code 和 Codex。

---

## What it does / 它是做什么的

When you ask "how did I fix that bug last time?", memory-fusion searches
your Claude Code and Codex session histories and answers in plain language.

当你问"上次那个 bug 怎么修的"，memory-fusion 会搜索你的 Claude Code 和 Codex
历史记录，用自然语言回答。

```
用户: "冒泡排序之前改过什么？"
       │
       ▼
  index.mjs ──→ ~/.memory-fusion/   (JSON store)
       │
       ▼
  search.mjs ──→ JSON hits
       │
       ▼
  Agent: "你在 3 个 session 里改过 bubble sort：
          - 重命名冒泡排序变量（7月7日）：把 j 改成 k
          - 创建小型JS项目（7月7日）：首次实现……"
```

## Architecture / 架构

```
~/.claude/projects/   ──┐
                        ├── index.mjs ──→ ~/.memory-fusion/
~/.codex/             ──┘                  ├── sessions.json
                                           └── messages/<id>.json
```

| Layer | What | Where |
|---|---|---|
| Source / 数据源 | Claude Code & Codex JSONL | `~/.claude/projects/`, `~/.codex/` |
| Store / 存储 | Plain JSON | `~/.memory-fusion/` |
| Query / 查询 | CLI scripts | `scripts/*.mjs` |
| Answer / 回答 | Agent (SKILL.md) | Natural language / 自然语言 |

## Install / 安装

```bash
# Clone and symlink as a user skill
git clone https://github.com/<your-username>/memory-fusion.git ~/Project/memory-fusion
ln -s ~/Project/memory-fusion ~/.claude/skills/memory-fusion
```

Or install via skills CLI (once published):

```bash
npx skills add <your-username>/memory-fusion
```

## Usage / 使用

Just ask in a Claude Code session. The skill activates automatically.

在 Claude Code 中直接问，skill 会自动激活：

| You say / 你说 | What happens |
|---|---|
| "之前那个 auth bug 怎么修的？" | Keyword search across sessions |
| "我最近在做什么？" | Lists recent sessions |
| "login.ts 这个文件改过什么？" | File edit history |
| "展开看看那个 session" | Full session dump |

## Commands / 命令

```bash
# Index new sessions (incremental)
# 增量索引新 session
node scripts/index.mjs

# Keyword search
# 关键词搜索
node scripts/search.mjs "auth bug fix"

# Recent N sessions
# 最近 N 个 session
node scripts/recent.mjs 10

# One session's full messages
# 单个 session 全部消息
node scripts/session.mjs <session-id>

# File edit history
# 文件修改历史
node scripts/file-history.mjs "src/login.ts"
```

## Project structure / 项目结构

```
memory-fusion/
├── SKILL.md              # Skill definition / 技能定义
├── README.md             # This file / 本文件
├── LICENSE
└── scripts/
    ├── index.mjs         # Incremental indexer / 增量索引器
    ├── search.mjs        # Keyword search / 关键词搜索
    ├── recent.mjs        # Recent sessions / 最近会话
    ├── session.mjs       # Session detail / 会话详情
    └── file-history.mjs  # File change history / 文件修改历史
```

## Data store / 数据存储

All data lives under `~/.memory-fusion/`:

- `sessions.json` — master index: id, title, project, source, timestamps
- `messages/<session-id>.json` — per-session messages with role, content, timestamps

Rebuild from scratch anytime:

```bash
rm -rf ~/.memory-fusion && node scripts/index.mjs
```

## License

MIT — see [LICENSE](./LICENSE).
