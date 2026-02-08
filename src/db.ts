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
      completed_at TEXT
    )
  `);

  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed_at)`);
}

export function getDbPath(): string {
  return DB_PATH;
}

export function getDataDir(): string {
  return DATA_DIR;
}
