import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// Support test database via environment variable
const isTest = process.env.TASKS_TEST === "1";
const DATA_DIR = isTest ? "/tmp/tasks-test" : join(homedir(), ".tasks");
const DB_PATH = isTest ? ":memory:" : join(DATA_DIR, "tasks.db");
const CONFIG_PATH = join(DATA_DIR, "config.json");

// Config interface
export interface Config {
  timezone: string;
}

const DEFAULT_CONFIG: Config = {
  timezone: "UTC",
};

// Ensure data directory exists (skip for in-memory)
if (DB_PATH !== ":memory:" && !existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Load config from file
export function loadConfig(): Config {
  try {
    if (existsSync(CONFIG_PATH)) {
      const data = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
      return { ...DEFAULT_CONFIG, ...data };
    }
  } catch {
    // Ignore parse errors, return default
  }
  return DEFAULT_CONFIG;
}

// Save config to file
export function saveConfig(config: Config): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// Check if config exists (first run check)
export function configExists(): boolean {
  if (isTest) return true; // Skip setup in test mode
  return existsSync(CONFIG_PATH);
}

// Get current config (cached)
let _config: Config | null = null;
export function getConfig(): Config {
  if (_config === null) {
    _config = loadConfig();
  }
  return _config;
}

// Update config and clear cache
export function updateConfig(updates: Partial<Config>): Config {
  const config = { ...loadConfig(), ...updates };
  saveConfig(config);
  _config = config;
  return config;
}

// Database instance
export const db = new Database(DB_PATH);

// Initialize schema
export function initDb() {
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      due_date TEXT,
      due_time TEXT,
      tags TEXT,
      project TEXT,
      priority INTEGER DEFAULT 0,
      reminded_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      recurring_id INTEGER
    )
  `);

  // Create indexes for base columns
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed_at)`);

  // Recurring templates table
  db.run(`
    CREATE TABLE IF NOT EXISTS recurring_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      due_time TEXT,
      tags TEXT,
      project TEXT,
      priority INTEGER DEFAULT 0,
      
      recur_type TEXT NOT NULL,
      recur_interval INTEGER DEFAULT 1,
      recur_days TEXT,
      recur_day_of_month INTEGER,
      
      start_date TEXT NOT NULL,
      end_date TEXT,
      
      last_generated TEXT,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: add recurring_id to existing tasks table if missing
  // Check if column exists first
  const tableInfo = db.prepare("PRAGMA table_info(tasks)").all() as Array<{name: string}>;
  const hasRecurringId = tableInfo.some(col => col.name === "recurring_id");
  
  if (!hasRecurringId) {
    db.run(`ALTER TABLE tasks ADD COLUMN recurring_id INTEGER`);
  }
  
  // Create index for recurring_id (after ensuring column exists)
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_recurring ON tasks(recurring_id)`);
}

export function getDbPath(): string {
  return DB_PATH;
}

export function getDataDir(): string {
  return DATA_DIR;
}
