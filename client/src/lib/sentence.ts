/**
 * The implementation-intention sentence every habit is built around:
 * "I will [action] at [time] in [location], so I can become the type of
 * person that [identity]."
 */
export function formatTime12(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = Number(hStr);
  const suffix = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return mStr === "00" ? `${hour12} ${suffix}` : `${hour12}:${mStr} ${suffix}`;
}

export function habitSentence(h: {
  action: string;
  tinyVersion?: string | null;
  time?: string | null;
  location?: string | null;
  identity: string;
}): string {
  const what = h.tinyVersion?.trim() || h.action;
  const when = h.time ? `at ${formatTime12(h.time)}` : "at any time";
  const where = h.location?.trim() ? ` in ${h.location.trim().toLowerCase()}` : "";
  return `I will ${what} ${when}${where}, so I can become the type of person that ${h.identity}.`;
}
