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

/** "YYYY-MM-DD" as a LOCAL date — built from parts, never Date.parse (UTC). */
export function parseLocal(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function shiftDays(date: string, by: number): string {
  const d = parseLocal(date);
  d.setDate(d.getDate() + by);
  return format(d, "yyyy-MM-dd");
}

/** Title for a viewed day: "Today", "Yesterday", else the weekday ("Wednesday"). */
export function dayTitle(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === shiftDays(today, -1)) return "Yesterday";
  return format(parseLocal(date), "EEEE");
}

/** "Sat 26 Sep" */
export function shortDate(date: string): string {
  return format(parseLocal(date), "EEE d MMM");
}
