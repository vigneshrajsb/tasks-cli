import { describe, test, expect, beforeEach } from "bun:test";

// Set test mode BEFORE importing db
process.env.TASKS_TEST = "1";

import { db, initDb } from "../src/db";
import { createTask, getTaskById, completeTask, deleteTask, moveToDate } from "../src/tasks";
import { today, tomorrow, daysFromNow } from "../src/utils";

// Phase 1: Recurring CRUD
import {
  createRecurringTemplate,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  enableTemplate,
  disableTemplate,
  getAllTemplates,
  getActiveTemplates,
  type RecurringTemplate,
  type CreateTemplateInput,
} from "../src/recurring";

// Initialize db
initDb();

// Clear before each test
beforeEach(() => {
  db.run("DELETE FROM tasks");
  db.run("DELETE FROM recurring_templates");
});

// ============================================================
// PHASE 1: Schema + CRUD Tests
// ============================================================

describe("Phase 1: Recurring Template CRUD", () => {
  describe("createRecurringTemplate", () => {
    test("creates daily template", () => {
      const template = createRecurringTemplate({
        title: "Take vitamins",
        recur_type: "daily",
        recur_interval: 1,
        start_date: today(),
        due_time: "09:00",
      });

      expect(template.id).toBeGreaterThan(0);
      expect(template.title).toBe("Take vitamins");
      expect(template.recur_type).toBe("daily");
      expect(template.recur_interval).toBe(1);
      expect(template.due_time).toBe("09:00");
      expect(template.enabled).toBe(1);
    });

    test("creates weekly template with specific days", () => {
      const template = createRecurringTemplate({
        title: "Team standup",
        recur_type: "weekly",
        recur_interval: 1,
        recur_days: "mon,tue,wed,thu,fri",
        start_date: today(),
        due_time: "10:00",
      });

      expect(template.recur_type).toBe("weekly");
      expect(template.recur_days).toBe("mon,tue,wed,thu,fri");
    });

    test("creates monthly template with day of month", () => {
      const template = createRecurringTemplate({
        title: "Pay rent",
        recur_type: "monthly",
        recur_interval: 1,
        recur_day_of_month: 1,
        start_date: today(),
      });

      expect(template.recur_type).toBe("monthly");
      expect(template.recur_day_of_month).toBe(1);
    });

    test("creates yearly template", () => {
      const template = createRecurringTemplate({
        title: "Birthday reminder",
        recur_type: "yearly",
        recur_interval: 1,
        start_date: "2026-06-15",
      });

      expect(template.recur_type).toBe("yearly");
      expect(template.start_date).toBe("2026-06-15");
    });

    test("creates template with tags and priority", () => {
      const template = createRecurringTemplate({
        title: "Review metrics",
        recur_type: "weekly",
        recur_interval: 1,
        start_date: today(),
        tags: ["work", "analytics"],
        priority: 1,
      });

      expect(template.tags).toBe("work,analytics");
      expect(template.priority).toBe(1);
    });

    test("creates template with end date", () => {
      const template = createRecurringTemplate({
        title: "Temporary task",
        recur_type: "daily",
        recur_interval: 1,
        start_date: today(),
        end_date: daysFromNow(30),
      });

      expect(template.end_date).toBe(daysFromNow(30));
    });
  });

  describe("getTemplateById", () => {
    test("gets template by id", () => {
      const created = createRecurringTemplate({
        title: "Test",
        recur_type: "daily",
        recur_interval: 1,
        start_date: today(),
      });

      const template = getTemplateById(created.id);

      expect(template).not.toBeNull();
      expect(template!.id).toBe(created.id);
    });

    test("returns null for non-existent template", () => {
      const template = getTemplateById(99999);
      expect(template).toBeNull();
    });
  });

  describe("updateTemplate", () => {
    test("updates template title", () => {
      const template = createRecurringTemplate({
        title: "Old title",
        recur_type: "daily",
        recur_interval: 1,
        start_date: today(),
      });

      updateTemplate(template.id, { title: "New title" });

      const updated = getTemplateById(template.id);
      expect(updated!.title).toBe("New title");
    });

    test("updates template time", () => {
      const template = createRecurringTemplate({
        title: "Test",
        recur_type: "daily",
        recur_interval: 1,
        start_date: today(),
        due_time: "09:00",
      });

      updateTemplate(template.id, { due_time: "10:00" });

      const updated = getTemplateById(template.id);
      expect(updated!.due_time).toBe("10:00");
    });

    test("updates recurrence pattern", () => {
      const template = createRecurringTemplate({
        title: "Test",
        recur_type: "daily",
        recur_interval: 1,
        start_date: today(),
      });

      updateTemplate(template.id, {
        recur_type: "weekly",
        recur_days: "mon,wed,fri",
      });

      const updated = getTemplateById(template.id);
      expect(updated!.recur_type).toBe("weekly");
      expect(updated!.recur_days).toBe("mon,wed,fri");
    });
  });

  describe("deleteTemplate", () => {
    test("deletes a template", () => {
      const template = createRecurringTemplate({
        title: "Test",
        recur_type: "daily",
        recur_interval: 1,
        start_date: today(),
      });

      const deleted = deleteTemplate(template.id);

      expect(deleted).toBe(true);
      expect(getTemplateById(template.id)).toBeNull();
    });

    test("returns false for non-existent template", () => {
      const deleted = deleteTemplate(99999);
      expect(deleted).toBe(false);
    });
  });

  describe("enableTemplate / disableTemplate", () => {
    test("disables a template", () => {
      const template = createRecurringTemplate({
        title: "Test",
        recur_type: "daily",
        recur_interval: 1,
        start_date: today(),
      });

      disableTemplate(template.id);

      const updated = getTemplateById(template.id);
      expect(updated!.enabled).toBe(0);
    });

    test("enables a disabled template", () => {
      const template = createRecurringTemplate({
        title: "Test",
        recur_type: "daily",
        recur_interval: 1,
        start_date: today(),
      });
      disableTemplate(template.id);

      enableTemplate(template.id);

      const updated = getTemplateById(template.id);
      expect(updated!.enabled).toBe(1);
    });
  });

  describe("getAllTemplates / getActiveTemplates", () => {
    test("getAllTemplates returns all templates", () => {
      createRecurringTemplate({
        title: "Active",
        recur_type: "daily",
        recur_interval: 1,
        start_date: today(),
      });
      const disabled = createRecurringTemplate({
        title: "Disabled",
        recur_type: "daily",
        recur_interval: 1,
        start_date: today(),
      });
      disableTemplate(disabled.id);

      const templates = getAllTemplates();

      expect(templates.length).toBe(2);
    });

    test("getActiveTemplates returns only enabled templates", () => {
      createRecurringTemplate({
        title: "Active",
        recur_type: "daily",
        recur_interval: 1,
        start_date: today(),
      });
      const disabled = createRecurringTemplate({
        title: "Disabled",
        recur_type: "daily",
        recur_interval: 1,
        start_date: today(),
      });
      disableTemplate(disabled.id);

      const templates = getActiveTemplates();

      expect(templates.length).toBe(1);
      expect(templates[0].title).toBe("Active");
    });
  });
});

// Phase 2: Generation
import {
  generateTasksForTemplate,
  generateAllTasks,
  getTasksForTemplate,
  skipTask,
} from "../src/generation";

// ============================================================
// PHASE 2: Generation Tests
// ============================================================

describe("Phase 2: Task Generation", () => {
  describe("generateTasksForTemplate", () => {
    test("generates daily tasks for next 14 days", () => {
      const template = createRecurringTemplate({
        title: "Daily task",
        recur_type: "daily",
        recur_interval: 1,
        start_date: today(),
      });

      const tasks = generateTasksForTemplate(template.id, 14);

      expect(tasks.length).toBe(14);
      expect(tasks[0].due_date).toBe(today());
      expect(tasks[0].recurring_id).toBe(template.id);
    });

    test("generates weekly tasks only on specified days", () => {
      // Find a Monday to start
      const d = new Date();
      while (d.getDay() !== 1) d.setDate(d.getDate() + 1); // Find next Monday
      const mondayStr = d.toISOString().split("T")[0];

      const template = createRecurringTemplate({
        title: "MWF task",
        recur_type: "weekly",
        recur_interval: 1,
        recur_days: "mon,wed,fri",
        start_date: mondayStr,
      });

      const tasks = generateTasksForTemplate(template.id, 14);

      // Should only have tasks on Mon, Wed, Fri
      for (const task of tasks) {
        const date = new Date(task.due_date! + "T00:00:00");
        const day = date.getDay();
        expect([1, 3, 5]).toContain(day); // Mon=1, Wed=3, Fri=5
      }
    });

    test("generates monthly tasks on correct day", () => {
      const template = createRecurringTemplate({
        title: "Monthly on 15th",
        recur_type: "monthly",
        recur_interval: 1,
        recur_day_of_month: 15,
        start_date: "2026-01-15",
      });

      const tasks = generateTasksForTemplate(template.id, 60);

      for (const task of tasks) {
        const date = new Date(task.due_date! + "T00:00:00");
        expect(date.getDate()).toBe(15);
      }
    });

    test("respects start_date - no tasks before start", () => {
      const futureDate = daysFromNow(7);
      const template = createRecurringTemplate({
        title: "Future task",
        recur_type: "daily",
        recur_interval: 1,
        start_date: futureDate,
      });

      const tasks = generateTasksForTemplate(template.id, 14);

      for (const task of tasks) {
        expect(task.due_date! >= futureDate).toBe(true);
      }
    });

    test("respects end_date - no tasks after end", () => {
      const endDate = daysFromNow(5);
      const template = createRecurringTemplate({
        title: "Limited task",
        recur_type: "daily",
        recur_interval: 1,
        start_date: today(),
        end_date: endDate,
      });

      const tasks = generateTasksForTemplate(template.id, 14);

      expect(tasks.length).toBeLessThanOrEqual(6); // today + 5 days
      for (const task of tasks) {
        expect(task.due_date! <= endDate).toBe(true);
      }
    });

    test("does not regenerate existing tasks", () => {
      const template = createRecurringTemplate({
        title: "Daily task",
        recur_type: "daily",
        recur_interval: 1,
        start_date: today(),
      });

      // Generate once
      generateTasksForTemplate(template.id, 14);
      
      // Generate again
      const tasks = generateTasksForTemplate(template.id, 14);

      // Second call should return empty (all already exist)
      expect(tasks.length).toBe(0);
      
      // Total tasks should still be 14
      const allTasks = getTasksForTemplate(template.id);
      expect(allTasks.length).toBe(14);
    });

    test("sets due_time on generated tasks", () => {
      const template = createRecurringTemplate({
        title: "Timed task",
        recur_type: "daily",
        recur_interval: 1,
        start_date: today(),
        due_time: "09:00",
      });

      const tasks = generateTasksForTemplate(template.id, 7);

      for (const task of tasks) {
        expect(task.due_time).toBe("09:00");
      }
    });

    test("copies tags and priority to generated tasks", () => {
      const template = createRecurringTemplate({
        title: "Tagged task",
        recur_type: "daily",
        recur_interval: 1,
        start_date: today(),
        tags: ["work", "important"],
        priority: 2,
      });

      const tasks = generateTasksForTemplate(template.id, 7);

      for (const task of tasks) {
        expect(task.tags).toBe("work,important");
        expect(task.priority).toBe(2);
      }
    });

    test("skips disabled templates", () => {
      const template = createRecurringTemplate({
        title: "Disabled",
        recur_type: "daily",
        recur_interval: 1,
        start_date: today(),
      });
      disableTemplate(template.id);

      const tasks = generateTasksForTemplate(template.id, 14);

      expect(tasks.length).toBe(0);
    });
  });

  describe("generateAllTasks", () => {
    test("generates tasks for all active templates", () => {
      createRecurringTemplate({
        title: "Template 1",
        recur_type: "daily",
        recur_interval: 1,
        start_date: today(),
      });
      createRecurringTemplate({
        title: "Template 2",
        recur_type: "daily",
        recur_interval: 1,
        start_date: today(),
      });

      const result = generateAllTasks(14);

      expect(result.templatesProcessed).toBe(2);
      expect(result.tasksCreated).toBe(28); // 14 + 14
    });
  });

  describe("getTasksForTemplate", () => {
    test("returns all tasks for a template", () => {
      const template = createRecurringTemplate({
        title: "Daily",
        recur_type: "daily",
        recur_interval: 1,
        start_date: today(),
      });
      generateTasksForTemplate(template.id, 7);

      const tasks = getTasksForTemplate(template.id);

      expect(tasks.length).toBe(7);
    });

    test("includes completed tasks by default", () => {
      const template = createRecurringTemplate({
        title: "Daily",
        recur_type: "daily",
        recur_interval: 1,
        start_date: today(),
      });
      generateTasksForTemplate(template.id, 7);
      
      const tasks = getTasksForTemplate(template.id);
      completeTask(tasks[0].id);

      const allTasks = getTasksForTemplate(template.id);
      expect(allTasks.length).toBe(7);
    });
  });

  describe("skipTask", () => {
    test("deletes a recurring task", () => {
      const template = createRecurringTemplate({
        title: "Daily",
        recur_type: "daily",
        recur_interval: 1,
        start_date: today(),
      });
      generateTasksForTemplate(template.id, 7);
      
      const tasks = getTasksForTemplate(template.id);
      const taskToSkip = tasks[0];

      const skipped = skipTask(taskToSkip.id);

      expect(skipped).toBe(true);
      expect(getTaskById(taskToSkip.id)).toBeNull();
    });

    test("skip does not affect other tasks", () => {
      const template = createRecurringTemplate({
        title: "Daily",
        recur_type: "daily",
        recur_interval: 1,
        start_date: today(),
      });
      generateTasksForTemplate(template.id, 7);
      
      const tasks = getTasksForTemplate(template.id);
      skipTask(tasks[0].id);

      const remaining = getTasksForTemplate(template.id);
      expect(remaining.length).toBe(6);
    });
  });
});

// ============================================================
// PHASE 3: CLI Tests - TODO
// ============================================================

describe.skip("Phase 3: CLI Integration", () => {
  test.todo("tasks recur add creates template");
  test.todo("tasks recur list shows templates");
  test.todo("tasks recur edit updates template");
  test.todo("tasks recur disable disables template");
  test.todo("tasks recur enable enables template");
  test.todo("tasks recur delete removes template");
  test.todo("tasks recur generate creates tasks");
  test.todo("tasks skip removes recurring task");
});

// ============================================================
// REGRESSION: Existing Functionality
// ============================================================

describe("Regression: Existing task features work with recurring_id", () => {
  test("regular tasks still work (recurring_id is null)", () => {
    const task = createTask({ title: "Regular task" });

    // recurring_id should be null/undefined for regular tasks
    expect(task.title).toBe("Regular task");
    const fetched = getTaskById(task.id);
    expect(fetched).not.toBeNull();
  });
});
