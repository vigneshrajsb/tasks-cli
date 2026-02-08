# CLAUDE.md

Task management CLI with SQLite backend. Deterministic, scriptable, AI-friendly.

## For Agents

Read **AGENTS.md** for complete usage patterns.

## Quick Commands

```bash
tasks                     # show today + overdue
tasks add "Do X" --due tomorrow --tag work
tasks done 42             # complete task
tasks move 42 --date friday
tasks week --json         # dashboard data
tasks stats --json        # counts
```

## Key Points

- Use `--json` for programmatic access
- Data lives in `~/.tasks/tasks.db`
- Dates: `today`, `tomorrow`, `mon`-`sun`, `2026-02-15`
- Times: `2pm`, `14:00`
- Priority: `normal`, `high`, `urgent`
- Tags: `--tag work --tag urgent` (repeatable)
- Groupings via tags: `#soon`, `#someday`
