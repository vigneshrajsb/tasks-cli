import { db } from "./db";
import { formatTagsForStorage, parseTagsFromStorage } from "./utils";

// Recurring template interface
export interface RecurringTemplate {
  id: number;
  title: string;
  description: string | null;
  due_time: string | null;
  tags: string | null;
  project: string | null;
  priority: number;
  recur_type: "daily" | "weekly" | "monthly" | "yearly";
  recur_interval: number;
  recur_days: string | null; // "mon,tue,wed" etc.
  recur_day_of_month: number | null;
  start_date: string;
  end_date: string | null;
  last_generated: string | null;
  enabled: number; // 0 or 1
  created_at: string;
  updated_at: string;
}

// Input for creating a template
export interface CreateTemplateInput {
  title: string;
  description?: string;
  due_time?: string;
  tags?: string[];
  project?: string;
  priority?: number;
  recur_type: "daily" | "weekly" | "monthly" | "yearly";
  recur_interval?: number;
  recur_days?: string; // "mon,tue,wed"
  recur_day_of_month?: number;
  start_date: string;
  end_date?: string;
}

// Input for updating a template
export interface UpdateTemplateInput {
  title?: string;
  description?: string;
  due_time?: string | null;
  tags?: string[];
  project?: string | null;
  priority?: number;
  recur_type?: "daily" | "weekly" | "monthly" | "yearly";
  recur_interval?: number;
  recur_days?: string | null;
  recur_day_of_month?: number | null;
  start_date?: string;
  end_date?: string | null;
}

/**
 * Create a new recurring template
 */
export function createRecurringTemplate(input: CreateTemplateInput): RecurringTemplate {
  const tagsStr = input.tags ? formatTagsForStorage(input.tags) : null;

  const stmt = db.prepare(`
    INSERT INTO recurring_templates (
      title, description, due_time, tags, project, priority,
      recur_type, recur_interval, recur_days, recur_day_of_month,
      start_date, end_date, enabled, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
  `);

  const result = stmt.run(
    input.title,
    input.description || null,
    input.due_time || null,
    tagsStr,
    input.project || null,
    input.priority || 0,
    input.recur_type,
    input.recur_interval || 1,
    input.recur_days || null,
    input.recur_day_of_month || null,
    input.start_date,
    input.end_date || null
  );

  return getTemplateById(Number(result.lastInsertRowid))!;
}

/**
 * Get a template by ID
 */
export function getTemplateById(id: number): RecurringTemplate | null {
  const stmt = db.prepare("SELECT * FROM recurring_templates WHERE id = ?");
  return stmt.get(id) as RecurringTemplate | null;
}

/**
 * Update a template
 */
export function updateTemplate(id: number, input: UpdateTemplateInput): RecurringTemplate | null {
  const template = getTemplateById(id);
  if (!template) return null;

  const updates: string[] = [];
  const values: any[] = [];

  if (input.title !== undefined) {
    updates.push("title = ?");
    values.push(input.title);
  }

  if (input.description !== undefined) {
    updates.push("description = ?");
    values.push(input.description);
  }

  if (input.due_time !== undefined) {
    updates.push("due_time = ?");
    values.push(input.due_time);
  }

  if (input.tags !== undefined) {
    updates.push("tags = ?");
    values.push(formatTagsForStorage(input.tags));
  }

  if (input.project !== undefined) {
    updates.push("project = ?");
    values.push(input.project);
  }

  if (input.priority !== undefined) {
    updates.push("priority = ?");
    values.push(input.priority);
  }

  if (input.recur_type !== undefined) {
    updates.push("recur_type = ?");
    values.push(input.recur_type);
  }

  if (input.recur_interval !== undefined) {
    updates.push("recur_interval = ?");
    values.push(input.recur_interval);
  }

  if (input.recur_days !== undefined) {
    updates.push("recur_days = ?");
    values.push(input.recur_days);
  }

  if (input.recur_day_of_month !== undefined) {
    updates.push("recur_day_of_month = ?");
    values.push(input.recur_day_of_month);
  }

  if (input.start_date !== undefined) {
    updates.push("start_date = ?");
    values.push(input.start_date);
  }

  if (input.end_date !== undefined) {
    updates.push("end_date = ?");
    values.push(input.end_date);
  }

  if (updates.length === 0) return template;

  updates.push("updated_at = datetime('now')");
  values.push(id);

  const sql = `UPDATE recurring_templates SET ${updates.join(", ")} WHERE id = ?`;
  db.prepare(sql).run(...values);

  return getTemplateById(id);
}

/**
 * Delete a template
 */
export function deleteTemplate(id: number): boolean {
  const stmt = db.prepare("DELETE FROM recurring_templates WHERE id = ?");
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Enable a template
 */
export function enableTemplate(id: number): RecurringTemplate | null {
  const stmt = db.prepare(`
    UPDATE recurring_templates 
    SET enabled = 1, updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(id);
  return getTemplateById(id);
}

/**
 * Disable a template
 */
export function disableTemplate(id: number): RecurringTemplate | null {
  const stmt = db.prepare(`
    UPDATE recurring_templates 
    SET enabled = 0, updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(id);
  return getTemplateById(id);
}

/**
 * Get all templates (including disabled)
 */
export function getAllTemplates(): RecurringTemplate[] {
  const stmt = db.prepare(`
    SELECT * FROM recurring_templates 
    ORDER BY title ASC
  `);
  return stmt.all() as RecurringTemplate[];
}

/**
 * Get only active (enabled) templates
 */
export function getActiveTemplates(): RecurringTemplate[] {
  const stmt = db.prepare(`
    SELECT * FROM recurring_templates 
    WHERE enabled = 1
    ORDER BY title ASC
  `);
  return stmt.all() as RecurringTemplate[];
}

/**
 * Update last_generated date for a template
 */
export function updateLastGenerated(id: number, date: string): void {
  const stmt = db.prepare(`
    UPDATE recurring_templates 
    SET last_generated = ?, updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(date, id);
}

/**
 * Format template recurrence for display
 */
export function formatRecurrence(template: RecurringTemplate): string {
  const interval = template.recur_interval > 1 ? `${template.recur_interval} ` : "";
  
  switch (template.recur_type) {
    case "daily":
      return interval ? `Every ${interval}days` : "Daily";
    case "weekly":
      if (template.recur_days) {
        const days = template.recur_days.split(",").map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(", ");
        return interval ? `Every ${interval}weeks (${days})` : `Weekly (${days})`;
      }
      return interval ? `Every ${interval}weeks` : "Weekly";
    case "monthly":
      const day = template.recur_day_of_month || "same day";
      return interval ? `Every ${interval}months (${day})` : `Monthly (${day})`;
    case "yearly":
      return interval ? `Every ${interval}years` : "Yearly";
    default:
      return template.recur_type;
  }
}
