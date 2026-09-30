import { cn } from "@/lib/utils";

/**
 * The top of a screen. Its header sits on a soft yellow wash that hides the
 * dotted graph paper and fades into it just below — the owner's layout
 * (2026-09-30): plain tinted header, dotted paper under the habits. The wash
 * sizes itself to the header, bleeds to the screen edges and the very top,
 * and sits BEHIND the screen's content (-z-10 inside the tab's isolated
 * stacking context in App.tsx), so it can never cover a card or a button.
 *
 * `className` (spacing) goes on an inner wrapper on purpose: a `space-y-*`
 * next to the absolutely positioned wash gives the first real child a top
 * margin that collapses through the parents and pushes the whole screen down
 * (it held the Today header 14px low until 2026-09-30).
 */
export function PaperHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="paper-wash pointer-events-none absolute -inset-x-4 -bottom-10 -z-10"
        style={{ top: "calc(-1 * max(env(safe-area-inset-top), 16px))" }}
      />
      <div className={className}>{children}</div>
    </div>
  );
}
