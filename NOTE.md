# AI Session Log Export

This document explains where Claude Code stores its session files for this project and how to export them into the `ai-logs/` folder for submission or archival.

## Tool used

**Claude Code** (Anthropic CLI / desktop app)

## Where the session files live

Claude Code writes one `.jsonl` file per conversation session. For this project they are stored at:

```
~/.claude/projects/-Users-Dustin-usgs-earthquake-dashboard/
```

The folder name is derived from the absolute path of the project root (`/Users/Dustin/usgs-earthquake-dashboard` → `-Users-Dustin-usgs-earthquake-dashboard`).

Each session produces:
- `<session-id>.jsonl` — the full conversation transcript (every user message, assistant turn, tool call, and tool result)
- `<session-id>/` — subagent transcripts spawned during that session, if any
- `memory/` — persistent memory files written across sessions (not conversation logs)

## Export workflow

Copy the entire project folder from `~/.claude/projects/` into `ai-logs/claude-code/`:

```bash
# From the repo root
cp -r ~/.claude/projects/-Users-Dustin-usgs-earthquake-dashboard \
      ai-logs/claude-code/-Users-Dustin-usgs-earthquake-dashboard
```

This copies all `.jsonl` session files, any subagent subdirectories, and the `memory/` folder.

To update after a new session (incremental sync):

```bash
rsync -av \
  ~/.claude/projects/-Users-Dustin-usgs-earthquake-dashboard/ \
  ai-logs/claude-code/-Users-Dustin-usgs-earthquake-dashboard/
```

## Current exported sessions

| File | Description |
|---|---|
| `4e8dad06-51eb-4568-ba82-5778541d0e82.jsonl` | First session — USGS API research, area filter / map library / stack decisions, full implementation |
| `079146e6-11cd-4733-8974-2b4d069d8d92.jsonl` | Second session — responsive UI, .gitignore, CLAUDE.md, Git hooks, test suite, tsconfig split |
| `079146e6-11cd-4733-8974-2b4d069d8d92/` | Subagent transcripts from the second session |
| `memory/` | Persistent memory written across both sessions (project context, stack decisions, feedback) |

## ai-logs folder structure

```
ai-logs/
└── claude-code/
    └── -Users-Dustin-usgs-earthquake-dashboard/
        ├── 4e8dad06-51eb-4568-ba82-5778541d0e82.jsonl
        ├── 079146e6-11cd-4733-8974-2b4d069d8d92.jsonl
        ├── 079146e6-11cd-4733-8974-2b4d069d8d92/
        └── memory/
```

## Notes

- `.jsonl` files are newline-delimited JSON. Each line is one event (message turn, tool call, or tool result).
- The files can be large (several MB per session) because every tool call result is stored inline.
- `memory/` contains `.md` files written by Claude during sessions to persist information across conversations — not conversation transcripts. It is included here for completeness.
- If you use a different machine or account, the project folder name will differ (it reflects the absolute path). Adjust the path accordingly.
