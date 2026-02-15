#!/usr/bin/env bun
/**
 * tasks-cli - Deterministic task management with SQLite persistence
 * 
 * Usage:
 *   tasks                          # Show today + overdue
 *   tasks add "Buy groceries"      # Quick add to inbox
 *   tasks add "Review PR" --due today --tag work
 *   tasks today                    # Today's tasks
 *   tasks week --json              # Week data for dashboard
 *   tasks move 42 --date tomorrow  # Move to date
 *   tasks done 42                  # Complete task
 */

import { db, initDb, configExists, getConfig, saveConfig, getDbPath, type Config } from "./db";
import { 
  createTask, getTaskById, updateTask, completeTask, reopenTask, 
  deleteTask, moveToDate, moveToSoon, moveToSomeday, moveToInbox, markReminded 
} from "./tasks";
import { 
  getAllActive, getToday, getTomorrow, getByDate, getOverdue, 
  getThisWeek, getSoon, getSomeday, getInbox, getCompleted,
  getByTag, search, getNeedingReminder, getWeekData, getStats,
  getByDateRange
} from "./queries";
import { 
  parseDate, parseTime, formatDate, formatTime, today, tomorrow,
  parseTagsFromStorage, daysFromNow
} from "./utils";
import type { Task } from "./tasks";
import * as readline from "readline";

// Recurring tasks
import {
  createRecurringTemplate,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  enableTemplate,
  disableTemplate,
  getAllTemplates,
  getActiveTemplates,
  formatRecurrence,
  type RecurringTemplate,
} from "./recurring";
import {
  generateTasksForTemplate,
  generateAllTasks,
  getTasksForTemplate,
  skipTask,
} from "./generation";

// Initialize database
initDb();

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0] || "";

// Flags
const jsonOutput = args.includes("--json");
const showAll = args.includes("--all");

// Helper to get flag value
function getFlagValue(flag: string): string | null {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith("--")) {
    return args[idx + 1];
  }
  return null;
}

// Helper to get all values for a repeatable flag (e.g., --tag)
function getFlagValues(flag: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag && args[i + 1] && !args[i + 1].startsWith("--")) {
      values.push(args[i + 1]);
    }
  }
  return values;
}

// Format task for display
function formatTask(task: Task, showDate: boolean = true): string {
  const checkbox = task.completed_at ? "[x]" : "[ ]";
  const priority = task.priority > 0 ? (task.priority === 2 ? "🔴" : "🟡") : "";
  const tags = parseTagsFromStorage(task.tags).filter(t => t !== "soon" && t !== "someday");
  const tagsStr = tags.length > 0 ? ` #${tags.join(" #")}` : "";
  const projectStr = task.project ? ` @${task.project}` : "";
  
  let dateStr = "";
  if (showDate && task.due_date) {
    dateStr = ` (${formatDate(task.due_date)}`;
    if (task.due_time) dateStr += ` ${formatTime(task.due_time)}`;
    dateStr += ")";
  } else if (task.due_time) {
    dateStr = ` (${formatTime(task.due_time)})`;
  }
  
  return `${checkbox} [${task.id}] ${priority}${task.title}${dateStr}${tagsStr}${projectStr}`;
}

// Print tasks
function printTasks(tasks: Task[], header?: string, showDate: boolean = true): void {
  if (header) console.log(`\n${header}`);
  if (tasks.length === 0) {
    console.log("  (none)");
  } else {
    for (const task of tasks) {
      console.log(`  ${formatTask(task, showDate)}`);
    }
  }
}

// Output as JSON
function outputJson(data: any): void {
  console.log(JSON.stringify(data, null, 2));
}

// First-run setup
async function runSetup(): Promise<void> {
  console.log("\n✨ Welcome to tasks-cli! Let's set up.\n");
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };
  
  const timezone = await question("Timezone (e.g., America/Los_Angeles): ");
  
  const config: Config = {
    timezone: timezone.trim() || "UTC",
  };
  
  saveConfig(config);
  rl.close();
  
  console.log(`\n✓ Config saved to ~/.tasks/config.json`);
  console.log(`  Timezone: ${config.timezone}`);
  console.log(`\nRun 'tasks add \"your first task\"' to get started!\n`);
}

// Main command handler
async function main() {
  // Check for first-run setup
  if (!configExists() && command !== "config") {
    await runSetup();
    return;
  }

  switch (command) {
    case "":
    case "list": {
      // Default: today + overdue
      const overdueList = getOverdue();
      const todayList = getToday();
      
      if (jsonOutput) {
        outputJson({ overdue: overdueList, today: todayList });
      } else {
        if (overdueList.length > 0) {
          printTasks(overdueList, "⚠️  OVERDUE");
        }
        printTasks(todayList, "📅 TODAY", false);
        
        const stats = getStats();
        if (stats.inbox > 0 || stats.soon > 0) {
          console.log(`\n(${stats.inbox} inbox, ${stats.soon} soon, ${stats.someday} someday)`);
        }
      }
      break;
    }

    case "add": {
      const title = args[1];
      if (!title) {
        console.error("Usage: tasks add \"task title\" [options]");
        process.exit(1);
      }
      
      const dueStr = getFlagValue("--due");
      const timeStr = getFlagValue("--time");
      const tags = getFlagValues("--tag");
      const project = getFlagValue("--project");
      const description = getFlagValue("-d") || getFlagValue("--description");
      const priorityStr = getFlagValue("--priority");
      
      let priority = 0;
      if (priorityStr === "high") priority = 1;
      if (priorityStr === "urgent") priority = 2;
      
      let dueDate: string | undefined;
      let dueTime: string | undefined;
      
      if (dueStr) {
        dueDate = parseDate(dueStr) || undefined;
        if (!dueDate) {
          console.error(`Could not parse date: ${dueStr}`);
          process.exit(1);
        }
      }
      
      if (timeStr) {
        dueTime = parseTime(timeStr) || undefined;
        if (!dueTime) {
          console.error(`Could not parse time: ${timeStr}`);
          process.exit(1);
        }
      }
      
      const task = createTask({
        title,
        description: description || undefined,
        due_date: dueDate || undefined,
        due_time: dueTime || undefined,
        tags: tags.length > 0 ? tags : undefined,
        project: project || undefined,
        priority,
      });
      
      if (jsonOutput) {
        outputJson(task);
      } else {
        console.log(`✓ Added task [${task.id}]`);
        console.log(`  ${formatTask(task)}`);
      }
      break;
    }

    case "today": {
      const tasks = getToday();
      if (jsonOutput) {
        outputJson(tasks);
      } else {
        printTasks(tasks, "📅 TODAY", false);
      }
      break;
    }

    case "tomorrow": {
      const tasks = getTomorrow();
      if (jsonOutput) {
        outputJson(tasks);
      } else {
        printTasks(tasks, "📅 TOMORROW", false);
      }
      break;
    }

    case "date": {
      const dateArg = args[1];
      if (!dateArg) {
        console.error("Usage: tasks date <date>");
        process.exit(1);
      }
      
      const date = parseDate(dateArg);
      if (!date) {
        console.error(`Could not parse date: ${dateArg}`);
        process.exit(1);
      }
      
      const tasks = getByDate(date);
      if (jsonOutput) {
        outputJson(tasks);
      } else {
        printTasks(tasks, `📅 ${formatDate(date)}`, false);
      }
      break;
    }

    case "range": {
      const startArg = args[1];
      const endArg = args[2];
      if (!startArg || !endArg) {
        console.error("Usage: tasks range <start-date> <end-date>");
        process.exit(1);
      }
      
      const startDate = parseDate(startArg);
      const endDate = parseDate(endArg);
      if (!startDate || !endDate) {
        console.error(`Could not parse dates: ${startArg}, ${endArg}`);
        process.exit(1);
      }
      
      const tasks = getByDateRange(startDate, endDate);
      if (jsonOutput) {
        outputJson(tasks);
      } else {
        printTasks(tasks, `📅 ${formatDate(startDate)} - ${formatDate(endDate)}`);
      }
      break;
    }

    case "week": {
      const data = getWeekData(7);
      if (jsonOutput) {
        outputJson(data);
      } else {
        // Display week view
        const overdue = data.overdue;
        if (overdue.length > 0) {
          printTasks(overdue, "⚠️  OVERDUE");
        }
        
        for (const [date, tasks] of Object.entries(data.dates)) {
          if (tasks.length > 0) {
            printTasks(tasks, `📅 ${formatDate(date)}`, false);
          }
        }
        
        if (data.soon.length > 0) {
          printTasks(data.soon, "🔜 SOON");
        }
        if (data.someday.length > 0) {
          printTasks(data.someday, "💭 SOMEDAY");
        }
        if (data.inbox.length > 0) {
          printTasks(data.inbox, "📥 INBOX");
        }
      }
      break;
    }

    case "overdue": {
      const tasks = getOverdue();
      if (jsonOutput) {
        outputJson(tasks);
      } else {
        printTasks(tasks, "⚠️  OVERDUE");
      }
      break;
    }

    case "soon": {
      const tasks = getSoon();
      if (jsonOutput) {
        outputJson(tasks);
      } else {
        printTasks(tasks, "🔜 SOON");
      }
      break;
    }

    case "someday": {
      const tasks = getSomeday();
      if (jsonOutput) {
        outputJson(tasks);
      } else {
        printTasks(tasks, "💭 SOMEDAY");
      }
      break;
    }

    case "inbox": {
      const tasks = getInbox();
      if (jsonOutput) {
        outputJson(tasks);
      } else {
        printTasks(tasks, "📥 INBOX");
      }
      break;
    }

    case "all": {
      const tasks = getAllActive();
      if (jsonOutput) {
        outputJson(tasks);
      } else {
        printTasks(tasks, "📋 ALL ACTIVE TASKS");
      }
      break;
    }

    case "done": {
      const idArg = args[1];
      // If no ID or ID starts with -- (a flag), show completed tasks
      if (!idArg || idArg.startsWith("--")) {
        // Show completed tasks
        const limit = parseInt(getFlagValue("--limit") || "20", 10);
        const tasks = getCompleted(limit);
        if (jsonOutput) {
          outputJson(tasks);
        } else {
          printTasks(tasks, `✅ COMPLETED (last ${limit})`);
        }
      } else {
        // Mark task as done
        const id = parseInt(idArg, 10);
        const task = completeTask(id);
        if (!task) {
          console.error(`Task not found: ${id}`);
          process.exit(1);
        }
        if (jsonOutput) {
          outputJson(task);
        } else {
          console.log(`✓ Completed [${task.id}]`);
          console.log(`  ${task.title}`);
        }
      }
      break;
    }

    case "undone": {
      const id = parseInt(args[1], 10);
      if (!id) {
        console.error("Usage: tasks undone <id>");
        process.exit(1);
      }
      
      const task = reopenTask(id);
      if (!task) {
        console.error(`Task not found: ${id}`);
        process.exit(1);
      }
      
      if (jsonOutput) {
        outputJson(task);
      } else {
        console.log(`✓ Reopened [${task.id}]`);
        console.log(`  ${task.title}`);
      }
      break;
    }

    case "move": {
      const id = parseInt(args[1], 10);
      if (!id) {
        console.error("Usage: tasks move <id> --date <date> | --soon | --someday | --inbox");
        process.exit(1);
      }
      
      let task: Task | null = null;
      
      if (args.includes("--soon")) {
        task = moveToSoon(id);
      } else if (args.includes("--someday")) {
        task = moveToSomeday(id);
      } else if (args.includes("--inbox")) {
        task = moveToInbox(id);
      } else {
        const dateArg = getFlagValue("--date");
        if (!dateArg) {
          console.error("Usage: tasks move <id> --date <date> | --soon | --someday | --inbox");
          process.exit(1);
        }
        
        const date = parseDate(dateArg);
        if (!date) {
          console.error(`Could not parse date: ${dateArg}`);
          process.exit(1);
        }
        
        const timeArg = getFlagValue("--time");
        const time = timeArg ? parseTime(timeArg) || undefined : undefined;
        
        task = moveToDate(id, date, time);
      }
      
      if (!task) {
        console.error(`Task not found: ${id}`);
        process.exit(1);
      }
      
      if (jsonOutput) {
        outputJson(task);
      } else {
        console.log(`✓ Moved [${task.id}]`);
        console.log(`  ${formatTask(task)}`);
      }
      break;
    }

    case "due": {
      const id = parseInt(args[1], 10);
      if (!id) {
        console.error("Usage: tasks due <id> <date> [time] | tasks due <id> --clear");
        process.exit(1);
      }
      
      if (args.includes("--clear")) {
        const task = moveToInbox(id);
        if (!task) {
          console.error(`Task not found: ${id}`);
          process.exit(1);
        }
        if (jsonOutput) {
          outputJson(task);
        } else {
          console.log(`✓ Cleared due date for [${task.id}]`);
        }
      } else {
        const dateArg = args[2];
        if (!dateArg) {
          console.error("Usage: tasks due <id> <date> [time]");
          process.exit(1);
        }
        
        const date = parseDate(dateArg);
        if (!date) {
          console.error(`Could not parse date: ${dateArg}`);
          process.exit(1);
        }
        
        const timeArg = args[3];
        const time = timeArg ? parseTime(timeArg) || undefined : undefined;
        
        const task = moveToDate(id, date, time);
        if (!task) {
          console.error(`Task not found: ${id}`);
          process.exit(1);
        }
        
        if (jsonOutput) {
          outputJson(task);
        } else {
          console.log(`✓ Set due date for [${task.id}]`);
          console.log(`  ${formatTask(task)}`);
        }
      }
      break;
    }

    case "edit": {
      const id = parseInt(args[1], 10);
      if (!id) {
        console.error("Usage: tasks edit <id> [options]");
        process.exit(1);
      }
      
      const title = getFlagValue("--title");
      const description = getFlagValue("-d") || getFlagValue("--description");
      const tags = getFlagValues("--tag");
      const project = getFlagValue("--project");
      const priorityStr = getFlagValue("--priority");
      const reminded = args.includes("--reminded");
      
      const updates: any = {};
      if (title) updates.title = title;
      if (description) updates.description = description;
      if (tags.length > 0) updates.tags = tags;
      if (project) updates.project = project;
      if (priorityStr) {
        if (priorityStr === "normal") updates.priority = 0;
        if (priorityStr === "high") updates.priority = 1;
        if (priorityStr === "urgent") updates.priority = 2;
      }
      
      // Mark as reminded if flag is set
      if (reminded) {
        markReminded(id);
      }
      
      const task = updateTask(id, updates);
      if (!task) {
        console.error(`Task not found: ${id}`);
        process.exit(1);
      }
      
      if (jsonOutput) {
        outputJson(task);
      } else {
        console.log(`✓ Updated [${task.id}]`);
        console.log(`  ${formatTask(task)}`);
      }
      break;
    }

    case "delete": {
      const id = parseInt(args[1], 10);
      if (!id) {
        console.error("Usage: tasks delete <id> [--force]");
        process.exit(1);
      }
      
      const task = getTaskById(id);
      if (!task) {
        console.error(`Task not found: ${id}`);
        process.exit(1);
      }
      
      // TODO: Add confirmation unless --force
      const deleted = deleteTask(id);
      
      if (jsonOutput) {
        outputJson({ deleted, id });
      } else {
        console.log(`✓ Deleted [${id}]`);
        console.log(`  ${task.title}`);
      }
      break;
    }

    case "tag": {
      const tagArg = args[1];
      if (!tagArg) {
        console.error("Usage: tasks tag <tag>");
        process.exit(1);
      }
      
      const tasks = getByTag(tagArg);
      if (jsonOutput) {
        outputJson(tasks);
      } else {
        printTasks(tasks, `🏷️  #${tagArg}`);
      }
      break;
    }

    case "search": {
      const query = args[1];
      if (!query) {
        console.error("Usage: tasks search <query>");
        process.exit(1);
      }
      
      const tasks = search(query);
      if (jsonOutput) {
        outputJson(tasks);
      } else {
        printTasks(tasks, `🔍 "${query}"`);
      }
      break;
    }

    case "remind": {
      const tasks = getNeedingReminder();
      
      if (jsonOutput) {
        outputJson(tasks);
      } else {
        if (tasks.length === 0) {
          console.log("No tasks need reminders.");
        } else {
          printTasks(tasks, "⏰ TASKS NEEDING REMINDER");
        }
      }
      break;
    }

    case "stats": {
      const stats = getStats();
      if (jsonOutput) {
        outputJson(stats);
      } else {
        console.log("\n📊 TASK STATS");
        console.log(`  Total: ${stats.total}`);
        console.log(`  Active: ${stats.active}`);
        console.log(`  Completed: ${stats.completed}`);
        console.log(`  Due today: ${stats.dueToday}`);
        console.log(`  Overdue: ${stats.overdue}`);
        console.log(`  Inbox: ${stats.inbox}`);
        console.log(`  Soon: ${stats.soon}`);
        console.log(`  Someday: ${stats.someday}`);
      }
      break;
    }

    case "config": {
      const config = getConfig();
      if (jsonOutput) {
        outputJson(config);
      } else {
        console.log("\n⚙️  CONFIG");
        console.log(`  Timezone: ${config.timezone}`);
        console.log(`  Database: ${getDbPath()}`);
      }
      break;
    }

    // ============================================================
    // RECURRING TASKS
    // ============================================================
    
    case "recur": {
      const subCommand = args[1] || "list";
      
      switch (subCommand) {
        case "add": {
          const title = args[2];
          if (!title) {
            console.error("Usage: tasks recur add \"title\" --every day|week|month|year [options]");
            process.exit(1);
          }
          
          const everyStr = getFlagValue("--every");
          if (!everyStr) {
            console.error("Missing --every (day, week, month, year, or '2 weeks')");
            process.exit(1);
          }
          
          // Parse --every value
          let recurType: "daily" | "weekly" | "monthly" | "yearly";
          let recurInterval = 1;
          
          const everyMatch = everyStr.match(/^(\d+)?\s*(day|week|month|year)s?$/i);
          if (!everyMatch) {
            console.error(`Invalid --every value: ${everyStr}`);
            process.exit(1);
          }
          
          if (everyMatch[1]) recurInterval = parseInt(everyMatch[1], 10);
          const unit = everyMatch[2].toLowerCase();
          
          switch (unit) {
            case "day": recurType = "daily"; break;
            case "week": recurType = "weekly"; break;
            case "month": recurType = "monthly"; break;
            case "year": recurType = "yearly"; break;
            default: recurType = "daily";
          }
          
          const daysStr = getFlagValue("--days"); // mon,wed,fri
          const dayOfMonth = getFlagValue("--day"); // 15
          const timeStr = getFlagValue("--time");
          const startStr = getFlagValue("--start") || today();
          const endStr = getFlagValue("--end");
          const tags = getFlagValues("--tag");
          const project = getFlagValue("--project");
          const priorityStr = getFlagValue("--priority");
          
          let priority = 0;
          if (priorityStr === "high") priority = 1;
          if (priorityStr === "urgent") priority = 2;
          
          const startDate = parseDate(startStr);
          if (!startDate) {
            console.error(`Could not parse start date: ${startStr}`);
            process.exit(1);
          }
          
          let endDate: string | undefined;
          if (endStr) {
            endDate = parseDate(endStr) || undefined;
            if (!endDate) {
              console.error(`Could not parse end date: ${endStr}`);
              process.exit(1);
            }
          }
          
          let dueTime: string | undefined;
          if (timeStr) {
            dueTime = parseTime(timeStr) || undefined;
          }
          
          const template = createRecurringTemplate({
            title,
            recur_type: recurType,
            recur_interval: recurInterval,
            recur_days: daysStr || undefined,
            recur_day_of_month: dayOfMonth ? parseInt(dayOfMonth, 10) : undefined,
            start_date: startDate,
            end_date: endDate,
            due_time: dueTime,
            tags: tags.length > 0 ? tags : undefined,
            project: project || undefined,
            priority,
          });
          
          if (jsonOutput) {
            outputJson(template);
          } else {
            console.log(`✓ Created recurring template [${template.id}]`);
            console.log(`  ${template.title} - ${formatRecurrence(template)}`);
            if (template.due_time) console.log(`  Time: ${formatTime(template.due_time)}`);
          }
          break;
        }
        
        case "list": {
          const templates = showAll ? getAllTemplates() : getActiveTemplates();
          
          if (jsonOutput) {
            outputJson(templates);
          } else {
            console.log("\n🔁 RECURRING TEMPLATES");
            if (templates.length === 0) {
              console.log("  (none)");
            } else {
              for (const t of templates) {
                const status = t.enabled ? "" : " [disabled]";
                const time = t.due_time ? ` @ ${formatTime(t.due_time)}` : "";
                console.log(`  [${t.id}] ${t.title} - ${formatRecurrence(t)}${time}${status}`);
              }
            }
          }
          break;
        }
        
        case "edit": {
          const id = parseInt(args[2], 10);
          if (!id) {
            console.error("Usage: tasks recur edit <id> [options]");
            process.exit(1);
          }
          
          const updates: any = {};
          
          const title = getFlagValue("--title");
          if (title) updates.title = title;
          
          const timeStr = getFlagValue("--time");
          if (timeStr) updates.due_time = parseTime(timeStr);
          
          const daysStr = getFlagValue("--days");
          if (daysStr) updates.recur_days = daysStr;
          
          const dayOfMonth = getFlagValue("--day");
          if (dayOfMonth) updates.recur_day_of_month = parseInt(dayOfMonth, 10);
          
          const template = updateTemplate(id, updates);
          if (!template) {
            console.error(`Template not found: ${id}`);
            process.exit(1);
          }
          
          if (jsonOutput) {
            outputJson(template);
          } else {
            console.log(`✓ Updated template [${template.id}]`);
            console.log(`  ${template.title} - ${formatRecurrence(template)}`);
          }
          break;
        }
        
        case "disable": {
          const id = parseInt(args[2], 10);
          if (!id) {
            console.error("Usage: tasks recur disable <id>");
            process.exit(1);
          }
          
          const template = disableTemplate(id);
          if (!template) {
            console.error(`Template not found: ${id}`);
            process.exit(1);
          }
          
          if (jsonOutput) {
            outputJson(template);
          } else {
            console.log(`✓ Disabled template [${template.id}] ${template.title}`);
          }
          break;
        }
        
        case "enable": {
          const id = parseInt(args[2], 10);
          if (!id) {
            console.error("Usage: tasks recur enable <id>");
            process.exit(1);
          }
          
          const template = enableTemplate(id);
          if (!template) {
            console.error(`Template not found: ${id}`);
            process.exit(1);
          }
          
          if (jsonOutput) {
            outputJson(template);
          } else {
            console.log(`✓ Enabled template [${template.id}] ${template.title}`);
          }
          break;
        }
        
        case "delete": {
          const id = parseInt(args[2], 10);
          if (!id) {
            console.error("Usage: tasks recur delete <id>");
            process.exit(1);
          }
          
          const template = getTemplateById(id);
          if (!template) {
            console.error(`Template not found: ${id}`);
            process.exit(1);
          }
          
          deleteTemplate(id);
          
          if (jsonOutput) {
            outputJson({ deleted: true, id });
          } else {
            console.log(`✓ Deleted template [${id}] ${template.title}`);
          }
          break;
        }
        
        case "generate": {
          const days = parseInt(getFlagValue("--days") || "14", 10);
          const result = generateAllTasks(days);
          
          if (jsonOutput) {
            outputJson(result);
          } else {
            console.log(`✓ Generated ${result.tasksCreated} tasks from ${result.templatesProcessed} templates`);
          }
          break;
        }
        
        default:
          console.error(`Unknown recur subcommand: ${subCommand}`);
          console.error("Usage: tasks recur [add|list|edit|disable|enable|delete|generate]");
          process.exit(1);
      }
      break;
    }
    
    case "skip": {
      const id = parseInt(args[1], 10);
      if (!id) {
        console.error("Usage: tasks skip <id>");
        process.exit(1);
      }
      
      const task = getTaskById(id);
      if (!task) {
        console.error(`Task not found: ${id}`);
        process.exit(1);
      }
      
      skipTask(id);
      
      if (jsonOutput) {
        outputJson({ skipped: true, id });
      } else {
        console.log(`✓ Skipped [${id}] ${task.title}`);
      }
      break;
    }

    case "help":
    default: {
      console.log(`
tasks-cli - Deterministic task management

USAGE:
  tasks                           Show today + overdue
  tasks add "title" [options]     Add a task
  tasks today                     Today's tasks
  tasks tomorrow                  Tomorrow's tasks
  tasks date <date>               Tasks for a specific date
  tasks week                      Week view (dashboard)
  tasks soon                      Soon (undated) tasks
  tasks someday                   Someday tasks
  tasks inbox                     Inbox (unsorted) tasks
  tasks all                       All active tasks
  tasks overdue                   Overdue tasks
  
  tasks done <id>                 Complete a task
  tasks done                      Show completed tasks
  tasks undone <id>               Reopen a task
  
  tasks move <id> --date <date>   Move to a date
  tasks move <id> --soon          Move to soon
  tasks move <id> --someday       Move to someday
  tasks move <id> --inbox         Move to inbox
  
  tasks due <id> <date> [time]    Set due date
  tasks due <id> --clear          Clear due date
  
  tasks edit <id> [options]       Edit a task
  tasks delete <id>               Delete a task
  tasks skip <id>                 Skip a recurring task instance
  
  tasks tag <tag>                 Filter by tag
  tasks search <query>            Search tasks
  tasks remind                    Tasks needing reminders
  tasks stats                     Show statistics
  tasks config                    Show config

RECURRING TASKS:
  tasks recur                     List recurring templates
  tasks recur add "title" --every day|week|month|year [options]
  tasks recur edit <id> [options] Edit a template
  tasks recur disable <id>        Disable a template
  tasks recur enable <id>         Enable a template
  tasks recur delete <id>         Delete a template
  tasks recur generate            Generate tasks (14 days)

RECURRING OPTIONS:
  --every <interval>  Frequency: day, week, month, year, "2 weeks"
  --days mon,wed,fri  Specific weekdays (weekly only)
  --day 15            Day of month (monthly only)
  --time 9am          Due time for each occurrence
  --start 2026-02-15  Start date (default: today)
  --end 2026-12-31    End date (optional)

OPTIONS:
  --due <date>      Due date (today, tomorrow, monday, 2026-02-15, +3d)
  --time <time>     Due time (14:00, 2pm, 2:30pm)
  --tag <tag>       Add tag (repeatable)
  --project <name>  Project reference
  --priority <p>    Priority: normal, high, urgent
  -d, --description Description text
  --json            Output as JSON
  --limit <n>       Limit results
  --all             Include disabled (for recur list)

EXAMPLES:
  tasks add "Buy groceries"
  tasks add "Review PR" --due today --tag work
  tasks add "Call dentist" --due tomorrow --time 2pm
  tasks move 42 --date friday
  tasks done 42
  
  tasks recur add "Take vitamins" --every day --time 9am
  tasks recur add "Team standup" --every week --days mon,tue,wed,thu,fri --time 10am
  tasks recur add "Pay rent" --every month --day 1
  tasks recur add "Annual review" --every year --start 2026-12-15
`);
      break;
    }
  }
}

main().catch(console.error);
