# tasks-cli 🦊

A deterministic task management CLI with SQLite persistence, built with Bun.

## Install

```bash
npm install -g @vigneshrajsb/tasks-cli
# or
bun add -g @vigneshrajsb/tasks-cli

# one-shot (no install)
bunx @vigneshrajsb/tasks-cli --help
npx @vigneshrajsb/tasks-cli --help
```

**Requires:** [Bun](https://bun.sh) runtime (`curl -fsSL https://bun.sh/install | bash`)

## Usage

### Quick Add

```bash
tasks add "Buy groceries"
tasks add "Team meeting" --due tomorrow --time 2pm --tag work
tasks add "Review PR" --due friday --tag code --priority high
```

### View Tasks

```bash
tasks                     # today + overdue
tasks today               # today's tasks
tasks tomorrow            # tomorrow's tasks
tasks week                # week view (dashboard)
tasks overdue             # overdue only
tasks all                 # all active tasks
tasks inbox               # undated, unsorted
tasks soon                # tagged #soon
tasks someday             # tagged #someday
```

### Complete & Manage

```bash
tasks done 42             # complete task
tasks done                # list completed
tasks undone 42           # reopen task
tasks delete 42           # delete task
```

### Move & Reschedule

```bash
tasks move 42 --date tomorrow
tasks move 42 --date friday
tasks move 42 --soon       # undated, tagged soon
tasks move 42 --someday    # undated, tagged someday
tasks move 42 --inbox      # clear date, remove soon/someday

tasks due 42 monday 2pm    # set due date/time
tasks due 42 --clear       # clear due date
```

### Edit

```bash
tasks edit 42 --title "New title"
tasks edit 42 --tag work --tag urgent
tasks edit 42 --priority urgent
tasks edit 42 -d "Description text"
```

### Search & Filter

```bash
tasks search "meeting"     # search by title
tasks tag work             # filter by tag
tasks date 2026-02-15      # specific date
tasks range 2026-02-10 2026-02-20
```

### Stats & Reminders

```bash
tasks stats               # overview counts
tasks remind              # tasks needing reminder
tasks config              # show config
```

### Options

```bash
--json                    # JSON output (for scripting)
--due <date>              # today, tomorrow, monday, 2026-02-15, +3d
--time <time>             # 2pm, 14:00, 2:30pm
--tag <tag>               # repeatable: --tag work --tag urgent
--priority <p>            # normal, high, urgent
-d, --description <text>  # description
```

## Date Formats

| Format | Example |
|--------|---------|
| Keywords | `today`, `tomorrow`, `monday`-`sunday` |
| Short | `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun` |
| ISO | `2026-02-15` |
| Relative | `+3d` (3 days from now) |

## Data Storage

Data stored in `~/.tasks/tasks.db` (SQLite).

```bash
tasks config              # show db path
```

## AI Agent Integration

See **AGENTS.md** for detailed agent usage.

## Development

### Local Development

```bash
cd ~/github/vigneshrajsb/tasks-cli
bun run src/index.ts <command>    # run locally
bun test                          # run tests
```

### Release Process

1. **Bump version & tag:**
   ```bash
   npm version patch|minor|major -m "Release %s - description"
   ```

2. **Push to GitHub (triggers npm publish):**
   ```bash
   git push && git push --tags
   ```

3. **Update global install on this machine:**
   ```bash
   npm install -g @vigneshrajsb/tasks-cli@latest
   ```

4. **Verify:**
   ```bash
   npm list -g @vigneshrajsb/tasks-cli
   tasks help | head -20
   ```

> ⚠️ **Don't forget step 3!** The dashboard and heartbeat use the global `tasks` command, not the local repo.

## License

MIT
