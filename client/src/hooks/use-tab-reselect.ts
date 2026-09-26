import { useEffect, useRef } from "react";

/**
 * Tapping the tab you're already on sends the page back to its main screen
 * (e.g. closes a habit's history page), like a phone tab bar.
 *
 * Delivered as a window event rather than a prop on purpose: re-rendering the
 * App's AnimatePresence tab wrapper while a page swaps its content left the
 * page's exit animation unfinished on the next tab switch — an invisible old
 * tab stayed mounted and swallowed taps.
 */
const TAB_RESELECT = "quarks:tab-reselect";

export function announceTabReselect(tab: string) {
  window.dispatchEvent(new CustomEvent(TAB_RESELECT, { detail: tab }));
}

export function useTabReselect(tab: string, onReselect: () => void) {
  const handler = useRef(onReselect);
  handler.current = onReselect;
  useEffect(() => {
    const listener = (e: Event) => {
      if ((e as CustomEvent<string>).detail === tab) handler.current();
    };
    window.addEventListener(TAB_RESELECT, listener);
    return () => window.removeEventListener(TAB_RESELECT, listener);
  }, [tab]);
}
