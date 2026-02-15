# AGENTS.md - How to Use tasks-cli

Guide for AI agents to interact with the `tasks` CLI.

## Philosophy

**You are the orchestrator, not the task manager.**

Call CLI commands instead of managing files. The database handles consistency; you handle natural language.

## Quick Reference

```bash
tasks                     # today + overdue
tasks add "X" --due tomorrow --tag work
tasks done 42             # complete
tasks move 42 --date friday
tasks week --json         # dashboard data
```

## Command Patterns

### Adding Tasks

```bash
# Simple
tasks add "Buy groceries"

# With date and time
tasks add "Team meeting" --due tomorrow --time 2pm

# With tags and priority
tasks add "Fix bug" --due today --tag work --tag urgent --priority high

# With description
tasks add "Review PR" --due friday -d "Check the auth changes"
```

### Viewing Tasks

```bash
# For humans (formatted)
tasks                     # today + overdue summary
tasks week                # week view

# For programmatic use (always use --json)
tasks today --json
tasks week --json
tasks stats --json
```

### Completing Tasks

```bash
tasks done 42             # mark complete
tasks undone 42           # reopen
```

### Rescheduling

```bash
tasks move 42 --date tomorrow
tasks move 42 --date friday
tasks move 42 --date 2026-02-20

# Move to undated buckets
tasks move 42 --soon      # for "soon" items
tasks move 42 --someday   # for "someday/maybe"
tasks move 42 --inbox     # unsorted

# Set specific date/time
tasks due 42 monday 2pm
tasks due 42 --clear      # remove due date
```

### Editing

```bash
tasks edit 42 --title "New title"
tasks edit 42 --tag work --tag code
tasks edit 42 --priority urgent
tasks edit 42 -d "Updated description"
```

## Date & Time Formats

### Dates

| Input | Meaning |
|-------|---------|
| `today` | Today |
| `tomorrow` | Tomorrow |
| `monday` - `sunday` | Next occurrence |
| `mon` - `sun` | Short form |
| `2026-02-15` | Specific date |
| `+3d` | 3 days from now |

### Times

| Input | Meaning |
|-------|---------|
| `2pm` | 14:00 |
| `2:30pm` | 14:30 |
| `14:00` | 24h format |
| `9am` | 09:00 |

## Priority Levels

- `normal` (default) - Regular task
- `high` - Important, shows indicator
- `urgent` - Critical, bold/red in UI

```bash
tasks add "Urgent fix" --priority urgent
tasks edit 42 --priority high
```

## Groupings (via Tags)

Tasks without dates go to **Inbox** by default.

Use special tags for grouping:

```bash
tasks move 42 --soon      # adds #soon tag
tasks move 42 --someday   # adds #someday tag
tasks move 42 --inbox     # clears date and grouping tags
```

## JSON Output

Always use `--json` for programmatic access:

```bash
tasks today --json
# Returns: [{ id, title, due_date, due_time, tags, priority, ... }]

tasks stats --json
# Returns: { total, active, completed, overdue, dueToday, inbox, soon, someday }

tasks week --json
# Returns: { dates: { "2026-02-08": [...], ... }, overdue: [...], soon: [...], someday: [...], inbox: [...] }
```

## Example Agent Flows

### User: "remind me to call mom tomorrow at 5pm"

```bash
tasks add "Call mom" --due tomorrow --time 5pm
# Response: "Got it! I'll remind you to call mom tomorrow at 5pm."
```

### User: "what do I have today?"

```bash
tasks today --json
# Parse response, summarize for user
# Response: "You have 3 tasks today: Team meeting at 2pm, Review PR, and Buy groceries."
```

### User: "I finished the review"

```bash
# Search for matching task
tasks search "review" --json
# Find ID, complete it
tasks done 42
# Response: "Nice! Marked 'Review PR' as done."
```

### User: "push the meeting to friday"

```bash
tasks search "meeting" --json
# Find ID
tasks move 42 --date friday
# Response: "Moved 'Team meeting' to Friday."
```

### User: "add something for someday: learn rust"

```bash
tasks add "Learn Rust"
tasks move <id> --someday
# Or shortcut:
tasks add "Learn Rust" --tag someday
# Response: "Added 'Learn Rust' to your someday list."
```

## ⚠️ Data Safety Guardrails

**CRITICAL: Backup before destructive operations!**

```bash
# ALWAYS backup before testing new features or bulk operations
cp ~/.tasks/tasks.db ~/.tasks/tasks.db.bak

# Restore if something goes wrong
cp ~/.tasks/tasks.db.bak ~/.tasks/tasks.db
```

**Destructive commands (use with caution):**

| Command | Risk | Recovery |
|---------|------|----------|
| `tasks delete <id>` | Permanent | None without backup |
| `tasks skip <id>` | Deletes recurring instance | None without backup |
| `tasks recur delete <id>` | Deletes template | Generated tasks remain |

**Testing new features:**

1. **Backup first:** `cp ~/.tasks/tasks.db ~/.tasks/tasks.db.bak`
2. **Use test mode for unit tests:** `TASKS_TEST=1 bun test` (uses in-memory DB)
3. **For manual CLI testing:** Work on a copy, not production
   ```bash
   cp ~/.tasks/tasks.db /tmp/tasks-test.db
   # Then modify code to use /tmp/tasks-test.db
   ```
4. **Verify before bulk deletes:** Use `--json` to inspect what will be affected

**What NOT to do:**
- ❌ Run manual CLI delete commands during feature development
- ❌ Test destructive features on production database
- ❌ Assume "it's just test data" - user data is precious

**Lesson learned (2026-02-15):** All user tasks were accidentally deleted during recurring tasks feature testing. Manual CLI commands (`tasks skip`, `tasks recur delete`) operated on the production database instead of a test copy.

## Best Practices

1. **Use --json** for parsing task data
2. **Search before acting** - find the right task ID
3. **Infer dates** - "tomorrow", "next week", "friday"
4. **Infer priority** - "urgent", "important", "asap" → `--priority urgent`
5. **Keep titles concise** - action-oriented verbs
6. **Use tags** for categorization: `--tag work --tag meeting`
7. **Backup before bulk operations** - always

## Data Location

- **Database**: `~/.tasks/tasks.db`
- **Config**: `~/.tasks/config.json`

```bash
tasks config
# Shows: timezone, db path
```

## First-Time Setup

The CLI auto-creates the database on first run. It will prompt for timezone:

```bash
tasks setup
# or just run any command, it will prompt
```

Set timezone to user's local timezone (e.g., `America/Los_Angeles`).

## Installation

```bash
npm install -g @vigneshrajsb/tasks-cli
# or
bun add -g @vigneshrajsb/tasks-cli
```

Requires Bun runtime.
