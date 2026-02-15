# CLAUDE.md

Task management CLI with SQLite backend. Deterministic, scriptable, AI-friendly.

## ⚠️ CRITICAL: Data Safety

**ALWAYS backup before testing features that modify/delete data:**

```bash
cp ~/.tasks/tasks.db ~/.tasks/tasks.db.bak
```

**For development/testing, use a test database:**

```bash
TASKS_TEST=1 bun run src/index.ts <command>  # Uses in-memory DB
# OR copy to temp location for manual testing
cp ~/.tasks/tasks.db /tmp/tasks-test.db
```

**Destructive operations (be careful):**
- `tasks delete <id>` - Permanently deletes task
- `tasks skip <id>` - Deletes recurring task instance
- `tasks recur delete <id>` - Deletes recurring template

**Lesson learned:** On 2026-02-15, all user tasks were accidentally deleted during feature testing because manual CLI commands hit the production database. Always backup first!

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
