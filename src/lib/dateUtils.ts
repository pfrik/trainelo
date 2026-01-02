import { format } from "date-fns";

/**
 * Get today's date in the user's timezone
 * @returns Today's date at midnight in the local timezone
 */
export function getTodayInTimezone(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

/**
 * Convert a Date to a string for database storage (YYYY-MM-DD format)
 * @param date The date to convert
 * @returns The date as a string in YYYY-MM-DD format
 */
export function toDateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Convert a date string back to a Date object
 * @param dateString The date string in YYYY-MM-DD format
 * @returns The Date object
 */
export function fromDateString(dateString: string): Date {
  return new Date(dateString + "T00:00:00");
}

/**
 * Format a date for display in long format
 * @param date The date to format
 * @returns The formatted date string (e.g., "Thursday, January 2, 2026")
 */
export function formatDisplayDateLong(date: Date): string {
  return format(date, "EEEE, MMMM d, yyyy");
}