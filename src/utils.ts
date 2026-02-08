import { getConfig } from "./db";

/**
 * Get current date in configured timezone as YYYY-MM-DD
 */
export function today(): string {
  const config = getConfig();
  const now = new Date();
  return now.toLocaleDateString("en-CA", { timeZone: config.timezone }); // en-CA gives YYYY-MM-DD
}

/**
 * Get tomorrow's date in configured timezone as YYYY-MM-DD
 */
export function tomorrow(): string {
  const config = getConfig();
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toLocaleDateString("en-CA", { timeZone: config.timezone });
}

/**
 * Get date N days from now
 */
export function daysFromNow(days: number): string {
  const config = getConfig();
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("en-CA", { timeZone: config.timezone });
}

/**
 * Get the start of the current week (Sunday or Monday based on locale)
 */
export function startOfWeek(): string {
  const config = getConfig();
  const date = new Date();
  const day = date.getDay();
  const diff = date.getDate() - day; // Sunday start
  date.setDate(diff);
  return date.toLocaleDateString("en-CA", { timeZone: config.timezone });
}

/**
 * Get the end of the current week (Saturday)
 */
export function endOfWeek(): string {
  const config = getConfig();
  const date = new Date();
  const day = date.getDay();
  const diff = date.getDate() + (6 - day); // Saturday end
  date.setDate(diff);
  return date.toLocaleDateString("en-CA", { timeZone: config.timezone });
}

/**
 * Parse a date string into YYYY-MM-DD format
 * Supports: today, tomorrow, monday-sunday, +Nd, +Nw, YYYY-MM-DD, MM/DD, etc.
 */
export function parseDate(input: string): string | null {
  const lower = input.toLowerCase().trim();
  
  // Special keywords
  if (lower === "today") return today();
  if (lower === "tomorrow") return tomorrow();
  
  // Relative days: +3d, +1w
  const relativeMatch = lower.match(/^\+(\d+)([dw])$/);
  if (relativeMatch) {
    const num = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2];
    const days = unit === "w" ? num * 7 : num;
    return daysFromNow(days);
  }
  
  // Day names: monday, tuesday, etc.
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayIndex = dayNames.indexOf(lower);
  if (dayIndex !== -1) {
    const date = new Date();
    const currentDay = date.getDay();
    let daysToAdd = dayIndex - currentDay;
    if (daysToAdd <= 0) daysToAdd += 7; // Next week if today or past
    return daysFromNow(daysToAdd);
  }
  
  // "next monday", "next tuesday", etc.
  const nextDayMatch = lower.match(/^next\s+(\w+)$/);
  if (nextDayMatch) {
    const dayName = nextDayMatch[1];
    const dayIdx = dayNames.indexOf(dayName);
    if (dayIdx !== -1) {
      const date = new Date();
      const currentDay = date.getDay();
      let daysToAdd = dayIdx - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7;
      daysToAdd += 7; // Next week
      return daysFromNow(daysToAdd);
    }
  }
  
  // ISO format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }
  
  // US format: MM/DD or MM/DD/YYYY
  const usMatch = input.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (usMatch) {
    const month = usMatch[1].padStart(2, "0");
    const day = usMatch[2].padStart(2, "0");
    const year = usMatch[3] || new Date().getFullYear().toString();
    return `${year}-${month}-${day}`;
  }
  
  // Month name formats: "feb 10", "february 10"
  const monthNames: Record<string, string> = {
    jan: "01", january: "01",
    feb: "02", february: "02",
    mar: "03", march: "03",
    apr: "04", april: "04",
    may: "05",
    jun: "06", june: "06",
    jul: "07", july: "07",
    aug: "08", august: "08",
    sep: "09", september: "09",
    oct: "10", october: "10",
    nov: "11", november: "11",
    dec: "12", december: "12",
  };
  
  const monthMatch = lower.match(/^(\w+)\s+(\d{1,2})(?:\s+(\d{4}))?$/);
  if (monthMatch && monthNames[monthMatch[1]]) {
    const month = monthNames[monthMatch[1]];
    const day = monthMatch[2].padStart(2, "0");
    const year = monthMatch[3] || new Date().getFullYear().toString();
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

/**
 * Parse time string into HH:MM format
 */
export function parseTime(input: string): string | null {
  // HH:MM or H:MM
  const match24 = input.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hour = match24[1].padStart(2, "0");
    const min = match24[2];
    return `${hour}:${min}`;
  }
  
  // 12-hour format: 2pm, 2:30pm, 2:30 pm
  const match12 = input.toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (match12) {
    let hour = parseInt(match12[1], 10);
    const min = match12[2] || "00";
    const period = match12[3];
    
    if (period === "pm" && hour !== 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;
    
    return `${hour.toString().padStart(2, "0")}:${min}`;
  }
  
  return null;
}

/**
 * Format date for display
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const todayStr = today();
  const tomorrowStr = tomorrow();
  
  if (dateStr === todayStr) return "Today";
  if (dateStr === tomorrowStr) return "Tomorrow";
  
  const options: Intl.DateTimeFormatOptions = { 
    weekday: "short", 
    month: "short", 
    day: "numeric" 
  };
  return date.toLocaleDateString("en-US", options);
}

/**
 * Format time for display
 */
export function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const period = hours >= 12 ? "pm" : "am";
  const hour12 = hours % 12 || 12;
  return minutes === 0 ? `${hour12}${period}` : `${hour12}:${minutes.toString().padStart(2, "0")}${period}`;
}

/**
 * Parse tags from comma-separated string
 */
export function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
}

/**
 * Format tags for storage (comma-separated)
 */
export function formatTagsForStorage(tags: string[]): string {
  return tags.join(",");
}

/**
 * Parse tags from storage format
 */
export function parseTagsFromStorage(stored: string | null): string[] {
  if (!stored) return [];
  return stored.split(",").filter((t) => t.length > 0);
}

/**
 * Check if a task has a specific tag
 */
export function hasTag(tags: string | null, tag: string): boolean {
  if (!tags) return false;
  return parseTagsFromStorage(tags).includes(tag.toLowerCase());
}

/**
 * Add a tag to existing tags
 */
export function addTag(existing: string | null, newTag: string): string {
  const tags = parseTagsFromStorage(existing);
  const lower = newTag.toLowerCase();
  if (!tags.includes(lower)) {
    tags.push(lower);
  }
  return formatTagsForStorage(tags);
}

/**
 * Remove a tag from existing tags
 */
export function removeTag(existing: string | null, tagToRemove: string): string {
  const tags = parseTagsFromStorage(existing);
  const lower = tagToRemove.toLowerCase();
  return formatTagsForStorage(tags.filter((t) => t !== lower));
}

/**
 * Get dates for the next N days starting from today
 */
export function getDateRange(startDate: string, days: number): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + "T00:00:00");
  
  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date.toISOString().split("T")[0]);
  }
  
  return dates;
}
