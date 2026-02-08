import { db } from "./db";
import { Task } from "./tasks";
import { today, tomorrow, daysFromNow, getDateRange, hasTag } from "./utils";

/**
 * Get all active (incomplete) tasks
 */
export function getAllActive(): Task[] {
  const stmt = db.prepare(`
    SELECT * FROM tasks 
    WHERE completed_at IS NULL 
    ORDER BY 
      CASE WHEN due_date IS NOT NULL THEN 0 ELSE 1 END,
      due_date ASC,
      due_time ASC,
      priority DESC,
      created_at ASC
  `);
  return stmt.all() as Task[];
}

/**
 * Get tasks for a specific date
 */
export function getByDate(date: string): Task[] {
  const stmt = db.prepare(`
    SELECT * FROM tasks 
    WHERE due_date = ? AND completed_at IS NULL
    ORDER BY due_time ASC, priority DESC, created_at ASC
  `);
  return stmt.all(date) as Task[];
}

/**
 * Get tasks for today
 */
export function getToday(): Task[] {
  return getByDate(today());
}

/**
 * Get tasks for tomorrow
 */
export function getTomorrow(): Task[] {
  return getByDate(tomorrow());
}

/**
 * Get overdue tasks (due before today, not completed)
 */
export function getOverdue(): Task[] {
  const stmt = db.prepare(`
    SELECT * FROM tasks 
    WHERE due_date < ? AND completed_at IS NULL
    ORDER BY due_date ASC, due_time ASC, priority DESC
  `);
  return stmt.all(today()) as Task[];
}

/**
 * Get tasks due within a date range
 */
export function getByDateRange(startDate: string, endDate: string): Task[] {
  const stmt = db.prepare(`
    SELECT * FROM tasks 
    WHERE due_date >= ? AND due_date <= ? AND completed_at IS NULL
    ORDER BY due_date ASC, due_time ASC, priority DESC
  `);
  return stmt.all(startDate, endDate) as Task[];
}

/**
 * Get tasks due this week (next 7 days including today)
 */
export function getThisWeek(): Task[] {
  const start = today();
  const end = daysFromNow(6);
  return getByDateRange(start, end);
}

/**
 * Get tasks tagged as "soon" (undated)
 */
export function getSoon(): Task[] {
  const stmt = db.prepare(`
    SELECT * FROM tasks 
    WHERE due_date IS NULL 
      AND completed_at IS NULL
      AND tags LIKE '%soon%'
    ORDER BY priority DESC, created_at ASC
  `);
  return stmt.all() as Task[];
}

/**
 * Get tasks tagged as "someday" (undated)
 */
export function getSomeday(): Task[] {
  const stmt = db.prepare(`
    SELECT * FROM tasks 
    WHERE due_date IS NULL 
      AND completed_at IS NULL
      AND tags LIKE '%someday%'
    ORDER BY priority DESC, created_at ASC
  `);
  return stmt.all() as Task[];
}

/**
 * Get inbox tasks (undated, no soon/someday tags)
 */
export function getInbox(): Task[] {
  const stmt = db.prepare(`
    SELECT * FROM tasks 
    WHERE due_date IS NULL 
      AND completed_at IS NULL
      AND (tags IS NULL OR (tags NOT LIKE '%soon%' AND tags NOT LIKE '%someday%'))
    ORDER BY priority DESC, created_at DESC
  `);
  return stmt.all() as Task[];
}

/**
 * Get completed tasks
 */
export function getCompleted(limit: number = 50): Task[] {
  const stmt = db.prepare(`
    SELECT * FROM tasks 
    WHERE completed_at IS NOT NULL
    ORDER BY completed_at DESC
    LIMIT ?
  `);
  return stmt.all(limit) as Task[];
}

/**
 * Get tasks by tag
 */
export function getByTag(tag: string): Task[] {
  const stmt = db.prepare(`
    SELECT * FROM tasks 
    WHERE tags LIKE ? AND completed_at IS NULL
    ORDER BY 
      CASE WHEN due_date IS NOT NULL THEN 0 ELSE 1 END,
      due_date ASC,
      priority DESC
  `);
  return stmt.all(`%${tag.toLowerCase()}%`) as Task[];
}

/**
 * Search tasks by title or description
 */
export function search(query: string): Task[] {
  const stmt = db.prepare(`
    SELECT * FROM tasks 
    WHERE (title LIKE ? OR description LIKE ?) AND completed_at IS NULL
    ORDER BY 
      CASE WHEN due_date IS NOT NULL THEN 0 ELSE 1 END,
      due_date ASC,
      created_at DESC
  `);
  const pattern = `%${query}%`;
  return stmt.all(pattern, pattern) as Task[];
}

/**
 * Get tasks needing reminders (due today or overdue, not reminded today)
 */
export function getNeedingReminder(): Task[] {
  const todayStr = today();
  const stmt = db.prepare(`
    SELECT * FROM tasks 
    WHERE completed_at IS NULL
      AND due_date IS NOT NULL
      AND due_date <= ?
      AND (reminded_at IS NULL OR reminded_at < ?)
    ORDER BY due_date ASC, due_time ASC, priority DESC
  `);
  return stmt.all(todayStr, todayStr) as Task[];
}

/**
 * Get week data for dashboard (grouped by date + undated buckets)
 */
export interface WeekData {
  dates: Record<string, Task[]>;
  overdue: Task[];
  soon: Task[];
  someday: Task[];
  inbox: Task[];
}

export function getWeekData(days: number = 7): WeekData {
  const todayStr = today();
  const dateList = getDateRange(todayStr, days);
  
  const dates: Record<string, Task[]> = {};
  for (const date of dateList) {
    dates[date] = getByDate(date);
  }
  
  return {
    dates,
    overdue: getOverdue(),
    soon: getSoon(),
    someday: getSomeday(),
    inbox: getInbox(),
  };
}

/**
 * Get task stats
 */
export interface TaskStats {
  total: number;
  completed: number;
  active: number;
  overdue: number;
  dueToday: number;
  inbox: number;
  soon: number;
  someday: number;
}

export function getStats(): TaskStats {
  const totalStmt = db.prepare("SELECT COUNT(*) as count FROM tasks");
  const completedStmt = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE completed_at IS NOT NULL");
  const activeStmt = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE completed_at IS NULL");
  const overdueStmt = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE due_date < ? AND completed_at IS NULL");
  const dueTodayStmt = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE due_date = ? AND completed_at IS NULL");
  
  const todayStr = today();
  
  return {
    total: (totalStmt.get() as any).count,
    completed: (completedStmt.get() as any).count,
    active: (activeStmt.get() as any).count,
    overdue: (overdueStmt.get(todayStr) as any).count,
    dueToday: (dueTodayStmt.get(todayStr) as any).count,
    inbox: getInbox().length,
    soon: getSoon().length,
    someday: getSomeday().length,
  };
}
