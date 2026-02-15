import { db } from "./db";
import { 
  getTemplateById, 
  getActiveTemplates, 
  updateLastGenerated,
  type RecurringTemplate 
} from "./recurring";
import { today, daysFromNow } from "./utils";
import type { Task } from "./tasks";

// Day name to number mapping (0 = Sunday)
const DAY_MAP: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

/**
 * Get all dates between start and end (inclusive)
 */
function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  
  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

/**
 * Check if a date matches the template's recurrence pattern
 */
function dateMatchesPattern(date: string, template: RecurringTemplate): boolean {
  const d = new Date(date + "T00:00:00");
  const startDate = new Date(template.start_date + "T00:00:00");
  
  // Must be on or after start date
  if (d < startDate) return false;
  
  // Must be on or before end date (if set)
  if (template.end_date) {
    const endDate = new Date(template.end_date + "T00:00:00");
    if (d > endDate) return false;
  }
  
  switch (template.recur_type) {
    case "daily": {
      // Check interval (e.g., every 2 days)
      const daysDiff = Math.floor((d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff % template.recur_interval === 0;
    }
    
    case "weekly": {
      // Check if day of week matches
      const dayOfWeek = d.getDay();
      
      if (template.recur_days) {
        // Specific days like "mon,wed,fri"
        const allowedDays = template.recur_days.split(",").map(day => DAY_MAP[day.toLowerCase().trim()]);
        if (!allowedDays.includes(dayOfWeek)) return false;
      }
      
      // Check interval (e.g., every 2 weeks)
      if (template.recur_interval > 1) {
        const weeksDiff = Math.floor((d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
        if (weeksDiff % template.recur_interval !== 0) return false;
      }
      
      return true;
    }
    
    case "monthly": {
      // Check day of month
      const dayOfMonth = d.getDate();
      const targetDay = template.recur_day_of_month || startDate.getDate();
      
      if (dayOfMonth !== targetDay) return false;
      
      // Check interval (e.g., every 2 months)
      if (template.recur_interval > 1) {
        const monthsDiff = (d.getFullYear() - startDate.getFullYear()) * 12 + (d.getMonth() - startDate.getMonth());
        if (monthsDiff % template.recur_interval !== 0) return false;
      }
      
      return true;
    }
    
    case "yearly": {
      // Check month and day match start date
      const targetMonth = startDate.getMonth();
      const targetDay = startDate.getDate();
      
      if (d.getMonth() !== targetMonth || d.getDate() !== targetDay) return false;
      
      // Check interval (e.g., every 2 years)
      if (template.recur_interval > 1) {
        const yearsDiff = d.getFullYear() - startDate.getFullYear();
        if (yearsDiff % template.recur_interval !== 0) return false;
      }
      
      return true;
    }
    
    default:
      return false;
  }
}

/**
 * Check if a task already exists for this template on this date
 */
function taskExistsForDate(templateId: number, date: string): boolean {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM tasks 
    WHERE recurring_id = ? AND due_date = ?
  `);
  const result = stmt.get(templateId, date) as { count: number };
  return result.count > 0;
}

/**
 * Create a task instance from a template for a specific date
 */
function createTaskFromTemplate(template: RecurringTemplate, date: string): Task {
  const stmt = db.prepare(`
    INSERT INTO tasks (
      title, description, due_date, due_time, tags, project, priority,
      recurring_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);
  
  const result = stmt.run(
    template.title,
    template.description,
    date,
    template.due_time,
    template.tags,
    template.project,
    template.priority,
    template.id
  );
  
  const taskStmt = db.prepare("SELECT * FROM tasks WHERE id = ?");
  return taskStmt.get(Number(result.lastInsertRowid)) as Task;
}

/**
 * Generate tasks for a specific template within the date range
 * Returns array of created tasks
 */
export function generateTasksForTemplate(templateId: number, days: number = 14): Task[] {
  const template = getTemplateById(templateId);
  if (!template || template.enabled === 0) return [];
  
  const startDate = today();
  const endDate = daysFromNow(days - 1);
  const dates = getDateRange(startDate, endDate);
  
  const createdTasks: Task[] = [];
  let lastDate: string | null = null;
  
  for (const date of dates) {
    if (dateMatchesPattern(date, template) && !taskExistsForDate(templateId, date)) {
      const task = createTaskFromTemplate(template, date);
      createdTasks.push(task);
      lastDate = date;
    }
  }
  
  // Update last_generated
  if (lastDate) {
    updateLastGenerated(templateId, lastDate);
  }
  
  return createdTasks;
}

/**
 * Generate tasks for all active templates
 * Returns summary of generation
 */
export function generateAllTasks(days: number = 14): { templatesProcessed: number; tasksCreated: number } {
  const templates = getActiveTemplates();
  let tasksCreated = 0;
  
  for (const template of templates) {
    const tasks = generateTasksForTemplate(template.id, days);
    tasksCreated += tasks.length;
  }
  
  return {
    templatesProcessed: templates.length,
    tasksCreated,
  };
}

/**
 * Get all tasks for a specific template
 */
export function getTasksForTemplate(templateId: number, includeCompleted: boolean = true): Task[] {
  const whereClause = includeCompleted 
    ? "WHERE recurring_id = ?"
    : "WHERE recurring_id = ? AND completed_at IS NULL";
  
  const stmt = db.prepare(`
    SELECT * FROM tasks ${whereClause}
    ORDER BY due_date ASC, due_time ASC
  `);
  
  return stmt.all(templateId) as Task[];
}

/**
 * Skip (delete) a recurring task instance
 * Returns true if deleted
 */
export function skipTask(taskId: number): boolean {
  const stmt = db.prepare("DELETE FROM tasks WHERE id = ?");
  const result = stmt.run(taskId);
  return result.changes > 0;
}

/**
 * Get upcoming tasks from recurring templates (for display)
 */
export function getUpcomingRecurringTasks(days: number = 7): Task[] {
  const startDate = today();
  const endDate = daysFromNow(days - 1);
  
  const stmt = db.prepare(`
    SELECT * FROM tasks 
    WHERE recurring_id IS NOT NULL 
      AND due_date >= ? 
      AND due_date <= ?
      AND completed_at IS NULL
    ORDER BY due_date ASC, due_time ASC
  `);
  
  return stmt.all(startDate, endDate) as Task[];
}
