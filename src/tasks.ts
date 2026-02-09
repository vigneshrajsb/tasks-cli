import { db } from "./db";
import { today, parseTagsFromStorage, formatTagsForStorage, addTag, removeTag, hasTag } from "./utils";

// Task interface
export interface Task {
  id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  tags: string | null;
  project: string | null;
  priority: number;
  reminded_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

// Input for creating a task
export interface CreateTaskInput {
  title: string;
  description?: string;
  due_date?: string;
  due_time?: string;
  tags?: string[];
  project?: string;
  priority?: number;
}

// Input for updating a task
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  due_date?: string | null;
  due_time?: string | null;
  tags?: string[];
  project?: string | null;
  priority?: number;
}

/**
 * Create a new task
 */
export function createTask(input: CreateTaskInput): Task {
  const tagsStr = input.tags ? formatTagsForStorage(input.tags) : null;
  
  const stmt = db.prepare(`
    INSERT INTO tasks (title, description, due_date, due_time, tags, project, priority, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);
  
  const result = stmt.run(
    input.title,
    input.description || null,
    input.due_date || null,
    input.due_time || null,
    tagsStr,
    input.project || null,
    input.priority || 0
  );
  
  return getTaskById(Number(result.lastInsertRowid))!;
}

/**
 * Get a task by ID
 */
export function getTaskById(id: number): Task | null {
  const stmt = db.prepare("SELECT * FROM tasks WHERE id = ?");
  return stmt.get(id) as Task | null;
}

/**
 * Update a task
 */
export function updateTask(id: number, input: UpdateTaskInput): Task | null {
  const task = getTaskById(id);
  if (!task) return null;
  
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
  
  if (input.due_date !== undefined) {
    updates.push("due_date = ?");
    values.push(input.due_date);
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
  
  if (updates.length === 0) return task;
  
  updates.push("updated_at = datetime('now')");
  values.push(id);
  
  const sql = `UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`;
  db.prepare(sql).run(...values);
  
  return getTaskById(id);
}

/**
 * Complete a task
 */
export function completeTask(id: number): Task | null {
  const stmt = db.prepare(`
    UPDATE tasks 
    SET completed_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ? AND completed_at IS NULL
  `);
  stmt.run(id);
  return getTaskById(id);
}

/**
 * Reopen a completed task
 */
export function reopenTask(id: number): Task | null {
  const stmt = db.prepare(`
    UPDATE tasks 
    SET completed_at = NULL, updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(id);
  return getTaskById(id);
}

/**
 * Delete a task
 */
export function deleteTask(id: number): boolean {
  const stmt = db.prepare("DELETE FROM tasks WHERE id = ?");
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Move a task to a specific date
 * Resets reminded_at and removes soon/someday tags
 */
export function moveToDate(id: number, date: string, time?: string): Task | null {
  const task = getTaskById(id);
  if (!task) return null;
  
  // Remove soon/someday tags when moving to a date
  let tags = parseTagsFromStorage(task.tags);
  tags = tags.filter((t) => t !== "soon" && t !== "someday");
  
  const stmt = db.prepare(`
    UPDATE tasks 
    SET due_date = ?, due_time = ?, tags = ?, reminded_at = NULL, updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(date, time || null, formatTagsForStorage(tags), id);
  
  return getTaskById(id);
}

/**
 * Move a task to "soon" (undated)
 * Removes due_date/due_time, adds "soon" tag, removes "someday" tag
 */
export function moveToSoon(id: number): Task | null {
  const task = getTaskById(id);
  if (!task) return null;
  
  let tags = parseTagsFromStorage(task.tags);
  tags = tags.filter((t) => t !== "someday");
  if (!tags.includes("soon")) tags.push("soon");
  
  const stmt = db.prepare(`
    UPDATE tasks 
    SET due_date = NULL, due_time = NULL, tags = ?, reminded_at = NULL, updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(formatTagsForStorage(tags), id);
  
  return getTaskById(id);
}

/**
 * Move a task to "someday" (undated)
 * Removes due_date/due_time, adds "someday" tag, removes "soon" tag
 */
export function moveToSomeday(id: number): Task | null {
  const task = getTaskById(id);
  if (!task) return null;
  
  let tags = parseTagsFromStorage(task.tags);
  tags = tags.filter((t) => t !== "soon");
  if (!tags.includes("someday")) tags.push("someday");
  
  const stmt = db.prepare(`
    UPDATE tasks 
    SET due_date = NULL, due_time = NULL, tags = ?, reminded_at = NULL, updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(formatTagsForStorage(tags), id);
  
  return getTaskById(id);
}

/**
 * Move a task to inbox (undated, no soon/someday tags)
 */
export function moveToInbox(id: number): Task | null {
  const task = getTaskById(id);
  if (!task) return null;
  
  let tags = parseTagsFromStorage(task.tags);
  tags = tags.filter((t) => t !== "soon" && t !== "someday");
  
  const stmt = db.prepare(`
    UPDATE tasks 
    SET due_date = NULL, due_time = NULL, tags = ?, reminded_at = NULL, updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(formatTagsForStorage(tags), id);
  
  return getTaskById(id);
}

/**
 * Mark a task as reminded (stores full datetime)
 */
export function markReminded(id: number): void {
  const stmt = db.prepare(`
    UPDATE tasks SET reminded_at = datetime('now') WHERE id = ?
  `);
  stmt.run(id);
}

/**
 * Add tags to a task
 */
export function addTagsToTask(id: number, newTags: string[]): Task | null {
  const task = getTaskById(id);
  if (!task) return null;
  
  let tags = parseTagsFromStorage(task.tags);
  for (const t of newTags) {
    const lower = t.toLowerCase();
    if (!tags.includes(lower)) tags.push(lower);
  }
  
  const stmt = db.prepare(`
    UPDATE tasks SET tags = ?, updated_at = datetime('now') WHERE id = ?
  `);
  stmt.run(formatTagsForStorage(tags), id);
  
  return getTaskById(id);
}

/**
 * Remove tags from a task
 */
export function removeTagsFromTask(id: number, tagsToRemove: string[]): Task | null {
  const task = getTaskById(id);
  if (!task) return null;
  
  let tags = parseTagsFromStorage(task.tags);
  const lowerRemove = tagsToRemove.map((t) => t.toLowerCase());
  tags = tags.filter((t) => !lowerRemove.includes(t));
  
  const stmt = db.prepare(`
    UPDATE tasks SET tags = ?, updated_at = datetime('now') WHERE id = ?
  `);
  stmt.run(formatTagsForStorage(tags), id);
  
  return getTaskById(id);
}
