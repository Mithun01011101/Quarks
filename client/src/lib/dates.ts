import { format } from "date-fns";

/** The client's local calendar date — the single source of "today" app-wide. */
export function localToday(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** "Wednesday, July 16" style header date. */
export function displayDate(date = new Date()): string {
  return format(date, "EEEE, MMMM d");
}

/** Current "YYYY-MM" for the calendar view. */
export function currentMonth(): string {
  return format(new Date(), "yyyy-MM");
}
