import { format as fnsFormat, parse } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

// Default timezone for the app (Dutch time)
export const APP_TIMEZONE = "Europe/Amsterdam";

/**
 * Format a date in DD-MM-YYYY format (European)
 */
export function formatDateEU(date: Date): string {
  const zonedDate = toZonedTime(date, APP_TIMEZONE);
  return fnsFormat(zonedDate, "dd-MM-yyyy");
}

/**
 * Format a date with a custom format, ensuring it's in Amsterdam timezone
 */
export function formatInTimezone(date: Date, formatStr: string): string {
  const zonedDate = toZonedTime(date, APP_TIMEZONE);
  return fnsFormat(zonedDate, formatStr);
}

/**
 * Get today's date in Amsterdam timezone at start of day
 */
export function getTodayInTimezone(): Date {
  const now = new Date();
  const zonedNow = toZonedTime(now, APP_TIMEZONE);
  zonedNow.setHours(0, 0, 0, 0);
  return zonedNow;
}

/**
 * Convert a local Date to YYYY-MM-DD string for database storage
 * This ensures the date is stored correctly without timezone offset issues
 */
export function toDateString(date: Date): string {
  // Get the date components in Amsterdam timezone
  const zonedDate = toZonedTime(date, APP_TIMEZONE);
  const year = zonedDate.getFullYear();
  const month = String(zonedDate.getMonth() + 1).padStart(2, "0");
  const day = String(zonedDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parse a YYYY-MM-DD database string to a Date object in Amsterdam timezone
 */
export function fromDateString(dateStr: string): Date {
  // Parse as local date in Amsterdam timezone
  const [year, month, day] = dateStr.split("-").map(Number);
  const localDate = new Date(year, month - 1, day, 12, 0, 0); // noon to avoid DST issues
  return localDate;
}

/**
 * Format a date for display in various formats
 */
export function formatDate(date: Date, style: "short" | "medium" | "long" | "day" = "medium"): string {
  const zonedDate = toZonedTime(date, APP_TIMEZONE);
  
  switch (style) {
    case "short":
      return fnsFormat(zonedDate, "dd-MM");
    case "medium":
      return fnsFormat(zonedDate, "dd-MM-yyyy");
    case "long":
      return fnsFormat(zonedDate, "EEEE, d MMMM yyyy");
    case "day":
      return fnsFormat(zonedDate, "d");
    default:
      return fnsFormat(zonedDate, "dd-MM-yyyy");
  }
}

/**
 * Format date for display in calendar header
 */
export function formatCalendarHeader(date: Date, view: "week" | "month"): string {
  const zonedDate = toZonedTime(date, APP_TIMEZONE);
  if (view === "week") {
    return fnsFormat(zonedDate, "d MMM yyyy");
  }
  return fnsFormat(zonedDate, "MMMM yyyy");
}

/**
 * Format date range for summary panel
 */
export function formatDateRange(start: Date, end: Date): string {
  const zonedStart = toZonedTime(start, APP_TIMEZONE);
  const zonedEnd = toZonedTime(end, APP_TIMEZONE);
  return `${fnsFormat(zonedStart, "d MMM")} - ${fnsFormat(zonedEnd, "d MMM yyyy")}`;
}
