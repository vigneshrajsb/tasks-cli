import { describe, test, expect, beforeEach } from "bun:test";

// Set test mode BEFORE importing db
process.env.TASKS_TEST = "1";

import { db, initDb } from "../src/db";
import {
  createTask,
  getTaskById,
  updateTask,
  completeTask,
  reopenTask,
  deleteTask,
  moveToDate,
  moveToSoon,
  moveToSomeday,
  moveToInbox,
} from "../src/tasks";
import {
  getAllActive,
  getToday,
  getOverdue,
  getSoon,
  getSomeday,
  getInbox,
  getCompleted,
  getByTag,
  search,
  getStats,
} from "../src/queries";
import { today, tomorrow, daysFromNow } from "../src/utils";

// Initialize db once
initDb();

// Clear before each test
beforeEach(() => {
  db.run("DELETE FROM tasks");
});

describe("createTask", () => {
  test("creates a task with title only", () => {
    const task = createTask({ title: "Test task" });

    expect(task.id).toBeGreaterThan(0);
    expect(task.title).toBe("Test task");
    expect(task.due_date).toBeNull();
    expect(task.priority).toBe(0);
  });

  test("creates a task with due date", () => {
    const task = createTask({ title: "Test", due_date: "2026-02-15" });

    expect(task.due_date).toBe("2026-02-15");
  });

  test("creates a task with tags", () => {
    const task = createTask({ title: "Test", tags: ["work", "urgent"] });

    expect(task.tags).toBe("work,urgent");
  });

  test("creates a task with priority", () => {
    const task = createTask({ title: "Test", priority: 2 });

    expect(task.priority).toBe(2);
  });
});

describe("getTaskById", () => {
  test("gets task by id", () => {
    const created = createTask({ title: "Test" });
    const task = getTaskById(created.id);

    expect(task).not.toBeNull();
    expect(task!.id).toBe(created.id);
    expect(task!.title).toBe("Test");
  });

  test("returns null for non-existent task", () => {
    const task = getTaskById(99999);
    expect(task).toBeNull();
  });
});

describe("updateTask", () => {
  test("updates task title", () => {
    const task = createTask({ title: "Old title" });

    updateTask(task.id, { title: "New title" });

    const updated = getTaskById(task.id);
    expect(updated!.title).toBe("New title");
  });

  test("updates task tags", () => {
    const task = createTask({ title: "Test" });

    updateTask(task.id, { tags: ["work", "code"] });

    const updated = getTaskById(task.id);
    expect(updated!.tags).toBe("work,code");
  });
});

describe("completeTask / reopenTask", () => {
  test("completes a task", () => {
    const task = createTask({ title: "Test" });

    completeTask(task.id);

    const updated = getTaskById(task.id);
    expect(updated!.completed_at).not.toBeNull();
  });

  test("reopens a completed task", () => {
    const task = createTask({ title: "Test" });
    completeTask(task.id);

    reopenTask(task.id);

    const updated = getTaskById(task.id);
    expect(updated!.completed_at).toBeNull();
  });
});

describe("deleteTask", () => {
  test("deletes a task", () => {
    const task = createTask({ title: "Test" });

    deleteTask(task.id);

    const deleted = getTaskById(task.id);
    expect(deleted).toBeNull();
  });
});

describe("move functions", () => {
  test("moveToDate sets due_date", () => {
    const task = createTask({ title: "Test" });

    moveToDate(task.id, "2026-02-20");

    const updated = getTaskById(task.id);
    expect(updated!.due_date).toBe("2026-02-20");
  });

  test("moveToSoon adds soon tag and clears date", () => {
    const task = createTask({ title: "Test", due_date: "2026-02-15" });

    moveToSoon(task.id);

    const updated = getTaskById(task.id);
    expect(updated!.due_date).toBeNull();
    expect(updated!.tags).toContain("soon");
  });

  test("moveToSomeday adds someday tag", () => {
    const task = createTask({ title: "Test" });

    moveToSomeday(task.id);

    const updated = getTaskById(task.id);
    expect(updated!.tags).toContain("someday");
  });

  test("moveToInbox clears date and grouping tags", () => {
    const task = createTask({ title: "Test", due_date: "2026-02-15", tags: ["soon"] });

    moveToInbox(task.id);

    const updated = getTaskById(task.id);
    expect(updated!.due_date).toBeNull();
    expect(updated!.tags).not.toContain("soon");
    expect(updated!.tags).not.toContain("someday");
  });
});

describe("queries", () => {
  test("getAllActive returns incomplete tasks", () => {
    createTask({ title: "Active" });
    const completed = createTask({ title: "Completed" });
    completeTask(completed.id);

    const tasks = getAllActive();

    expect(tasks.length).toBe(1);
    expect(tasks[0].title).toBe("Active");
  });

  test("getToday returns today's tasks", () => {
    createTask({ title: "Today", due_date: today() });
    createTask({ title: "Tomorrow", due_date: tomorrow() });

    const tasks = getToday();

    expect(tasks.length).toBe(1);
    expect(tasks[0].title).toBe("Today");
  });

  test("getOverdue returns past due tasks", () => {
    createTask({ title: "Overdue", due_date: "2020-01-01" });
    createTask({ title: "Today", due_date: today() });

    const tasks = getOverdue();

    expect(tasks.length).toBe(1);
    expect(tasks[0].title).toBe("Overdue");
  });

  test("getByTag filters by tag", () => {
    createTask({ title: "Work task", tags: ["work"] });
    createTask({ title: "Personal task", tags: ["personal"] });

    const tasks = getByTag("work");

    expect(tasks.length).toBe(1);
    expect(tasks[0].title).toBe("Work task");
  });

  test("search finds tasks by title", () => {
    createTask({ title: "Buy groceries" });
    createTask({ title: "Review PR" });

    const tasks = search("groceries");

    expect(tasks.length).toBe(1);
    expect(tasks[0].title).toBe("Buy groceries");
  });

  test("getStats returns correct counts", () => {
    createTask({ title: "Active", due_date: today() });
    createTask({ title: "Overdue", due_date: "2020-01-01" });
    const completed = createTask({ title: "Done" });
    completeTask(completed.id);

    const stats = getStats();

    expect(stats.active).toBe(2);
    expect(stats.completed).toBe(1);
    expect(stats.dueToday).toBe(1);
    expect(stats.overdue).toBe(1);
  });

  test("getSoon returns soon-tagged tasks", () => {
    createTask({ title: "Soon task", tags: ["soon"] });
    createTask({ title: "Regular task" });

    const tasks = getSoon();

    expect(tasks.length).toBe(1);
    expect(tasks[0].title).toBe("Soon task");
  });

  test("getSomeday returns someday-tagged tasks", () => {
    createTask({ title: "Someday task", tags: ["someday"] });
    createTask({ title: "Regular task" });

    const tasks = getSomeday();

    expect(tasks.length).toBe(1);
    expect(tasks[0].title).toBe("Someday task");
  });

  test("getInbox returns undated tasks without grouping tags", () => {
    createTask({ title: "Inbox task" });
    createTask({ title: "Dated task", due_date: today() });
    createTask({ title: "Soon task", tags: ["soon"] });

    const tasks = getInbox();

    expect(tasks.length).toBe(1);
    expect(tasks[0].title).toBe("Inbox task");
  });
});
