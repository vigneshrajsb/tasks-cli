# Recurring Tasks Feature

## Overview

Add support for recurring/repeating tasks that automatically generate task instances based on a schedule.

## Test Plan

### Pre-Implementation Baseline
- [x] All 24 existing tests pass
- [ ] Dashboard visual baseline captured

### Phase 1: Schema + CRUD
**Tests:** `tests/recurring.test.ts` - "Phase 1: Recurring Template CRUD"

| Test | Status |
|------|--------|
| creates daily template | ⏳ |
| creates weekly template with specific days | ⏳ |
| creates monthly template with day of month | ⏳ |
| creates yearly template | ⏳ |
| creates template with tags and priority | ⏳ |
| creates template with end date | ⏳ |
| gets template by id | ⏳ |
| returns null for non-existent template | ⏳ |
| updates template title | ⏳ |
| updates template time | ⏳ |
| updates recurrence pattern | ⏳ |
| deletes a template | ⏳ |
| returns false for non-existent template | ⏳ |
| disables a template | ⏳ |
| enables a disabled template | ⏳ |
| getAllTemplates returns all templates | ⏳ |
| getActiveTemplates returns only enabled templates | ⏳ |

**Implementation:**
1. Add `recurring_templates` table to schema
2. Add `recurring_id` column to tasks table
3. Create `src/recurring.ts` with CRUD functions

### Phase 2: Generation
**Tests:** `tests/recurring.test.ts` - "Phase 2: Task Generation"

| Test | Status |
|------|--------|
| generates daily tasks for next 14 days | ⏳ |
| generates weekly tasks only on specified days | ⏳ |
| generates monthly tasks on correct day | ⏳ |
| respects start_date | ⏳ |
| respects end_date | ⏳ |
| does not regenerate existing tasks | ⏳ |
| sets due_time on generated tasks | ⏳ |
| copies tags and priority | ⏳ |
| skips disabled templates | ⏳ |
| generateAllTasks processes all templates | ⏳ |
| getTasksForTemplate returns correct tasks | ⏳ |
| skipTask deletes the task | ⏳ |

**Implementation:**
1. Create `src/generation.ts` with generation logic
2. Add date calculation utilities
3. Track `last_generated` to prevent duplicates

### Phase 3: CLI Commands
**Tests:** `tests/recurring.test.ts` - "Phase 3: CLI Integration"

| Command | Status |
|---------|--------|
| `tasks recur add` | ⏳ |
| `tasks recur list` | ⏳ |
| `tasks recur edit` | ⏳ |
| `tasks recur disable` | ⏳ |
| `tasks recur enable` | ⏳ |
| `tasks recur delete` | ⏳ |
| `tasks recur generate` | ⏳ |
| `tasks skip` | ⏳ |

**Implementation:**
1. Add CLI command handlers in `src/index.ts`
2. Auto-generate on `tasks`, `tasks today`, `tasks week`

### Phase 4: Dashboard Integration
**Visual Tests:** Browser CLI verification

| Feature | Status |
|---------|--------|
| Quick input: `@daily`, `@weekly`, etc. | ⏳ |
| Add modal: Repeat dropdown | ⏳ |
| Add modal: Weekly day checkboxes | ⏳ |
| Add modal: Monthly day picker | ⏳ |
| Recurring indicator on tasks (🔁) | ⏳ |
| API: `/api/recurring/add` | ⏳ |
| API: `/api/recurring/list` | ⏳ |

### Regression Tests
**Tests:** `tests/recurring.test.ts` - "Regression: Existing Functionality"

| Test | Status |
|------|--------|
| regular tasks work without recurring_id | ⏳ |
| completing recurring task doesn't affect template | ⏳ |
| deleting recurring task doesn't affect template | ⏳ |
| moveToDate works on recurring tasks | ⏳ |
| existing 24 tests still pass | ⏳ |

---

## Schema

### recurring_templates
```sql
CREATE TABLE recurring_templates (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  due_time TEXT,
  tags TEXT,
  project TEXT,
  priority INTEGER DEFAULT 0,
  
  recur_type TEXT NOT NULL,        -- daily|weekly|monthly|yearly
  recur_interval INTEGER DEFAULT 1,
  recur_days TEXT,                 -- weekly: "mon,wed,fri"
  recur_day_of_month INTEGER,      -- monthly: 1-31
  
  start_date TEXT NOT NULL,
  end_date TEXT,
  
  last_generated TEXT,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### tasks (addition)
```sql
ALTER TABLE tasks ADD COLUMN recurring_id INTEGER REFERENCES recurring_templates(id);
```

---

## CLI Commands

```bash
# Create
tasks recur add "Title" --every day|week|month|year [options]
  --every <interval>     daily, weekly, monthly, yearly, "2 weeks"
  --days mon,wed,fri     specific weekdays (weekly only)
  --day 15               day of month (monthly only)
  --time 9am             due time
  --start 2026-02-15     start date (default: today)
  --end 2026-12-31       optional end date
  --tag work             tags (repeatable)
  --priority high        priority level

# List
tasks recur                list active templates
tasks recur list --all     include disabled

# Manage
tasks recur edit <id> [options]
tasks recur disable <id>
tasks recur enable <id>
tasks recur delete <id>

# Generate
tasks recur generate           generate for 14 days
tasks recur generate --days 7  custom range

# Skip
tasks skip <id>               delete a recurring task instance
```

---

## ⚠️ Testing Lessons Learned

**Incident (2026-02-15):** All user tasks were accidentally deleted during feature testing.

**Root cause:** Manual CLI commands (`tasks skip`, `tasks recur delete`) during dashboard testing operated on the production database.

**Prevention:**
1. **Always backup first:** `cp ~/.tasks/tasks.db ~/.tasks/tasks.db.bak`
2. **Unit tests are safe** - they use in-memory DB via `TASKS_TEST=1`
3. **Manual CLI testing is NOT safe** - it hits production DB
4. **Dashboard testing is NOT safe** - it calls CLI which hits production DB

**Before any manual testing:**
```bash
cp ~/.tasks/tasks.db ~/.tasks/tasks.db.bak
```

---

## Progress Log

### 2026-02-15
- Created test file with 40+ test cases
- Created this documentation
- Baseline: 24 existing tests pass
- **Phase 1 Complete:** Schema + CRUD (17 tests pass)
- **Phase 2 Complete:** Generation logic (14 tests pass)
- **Phase 3 Complete:** CLI commands implemented
- **Phase 4 Complete:** Dashboard integration
  - Quick input: `@daily`, `@weekly`, `@monthly`, `@yearly`, `@mon,wed,fri`
  - Add modal: Collapsible "Repeat" section with day checkboxes
  - API endpoints: `/api/recurring/*`
- Final: 56 tests pass, 0 fail
- **Incident:** User tasks accidentally deleted during testing (see Lessons Learned above)
