import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Ban, Check, ChevronRight, Sprout, X } from "lucide-react";
import { HABIT_KINDS, type Habit, type HabitKind, type InsertHabit } from "@shared/schema";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { api, queryKeys } from "@/lib/api";
import { localToday } from "@/lib/dates";
import { BREAK_PRESETS, HABIT_PRESETS } from "@/lib/presets";
import { cn } from "@/lib/utils";
import { SentenceCard } from "./sentence-card";
import { StepAnchor, StepDaysBreak, StepDefine, StepDefineBreak, StepIdentity } from "./wizard-steps";

const wizardSchema = z
  .object({
    kind: z.enum(HABIT_KINDS),
    name: z.string().trim().min(1, "Give it a short name").max(40, "Keep it under 40 characters"),
    action: z.string().trim().max(80, "Keep it under 80 characters"),
    tinyVersion: z.string().trim().max(80, "Keep it under 80 characters"),
    anytime: z.boolean(),
    time: z.string(),
    location: z.string().trim().max(60, "Keep it under 60 characters"),
    scheduleDays: z.string().regex(/^[0-6]{1,7}$/, "Pick at least one day"),
    identity: z.string().trim().min(1, "Finish the sentence").max(80, "Keep it under 80 characters"),
    color: z.string().min(1),
    icon: z.string(),
    reminder1: z.string(),
    reminder2: z.string(),
    reminder3: z.string(),
  })
  .superRefine((values, ctx) => {
    // Break habits skip action + time entirely — only build habits need them.
    if (values.kind === "build" && !values.action.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["action"],
        message: "Say what you'll do",
      });
    }
    if (values.kind === "build" && !values.anytime && !/^\d{2}:\d{2}$/.test(values.time)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["time"],
        message: "Pick a time, or switch to any time",
      });
    }
  });

export type WizardValues = z.infer<typeof wizardSchema>;

// Three numbered steps for each kind. Build: define / obvious / identity.
// Break: title / days / identity — no action, no time, no reminders.
const STEPS: Record<HabitKind, { label: string; fields: (keyof WizardValues)[] }[]> = {
  build: [
    { label: "Define", fields: ["name", "action", "tinyVersion"] },
    { label: "Obvious", fields: ["time", "scheduleDays"] },
    { label: "Identity", fields: ["identity", "color"] },
  ],
  break: [
    { label: "Name", fields: ["name"] },
    { label: "Days", fields: ["scheduleDays"] },
    { label: "Identity", fields: ["identity", "color"] },
  ],
};

function defaultsFrom(habit: Habit | null): WizardValues {
  if (!habit) {
    return {
      kind: "build",
      name: "",
      action: "",
      tinyVersion: "",
      anytime: true,
      time: "",
      location: "",
      scheduleDays: "0123456",
      identity: "",
      color: "ember",
      icon: "",
      reminder1: "",
      reminder2: "",
      reminder3: "",
    };
  }
  const reminders = (habit.reminderTimes ?? "").split(",").map((s) => s.trim());
  return {
    kind: habit.kind === "break" ? "break" : "build",
    name: habit.name,
    action: habit.action,
    tinyVersion: habit.tinyVersion ?? "",
    anytime: !habit.time,
    time: habit.time ?? "",
    location: habit.location ?? "",
    scheduleDays: habit.scheduleDays,
    identity: habit.identity,
    color: habit.color,
    icon: habit.icon ?? "",
    reminder1: reminders[0] ?? "",
    reminder2: reminders[1] ?? "",
    reminder3: reminders[2] ?? "",
  };
}

function isTextField(el: EventTarget | null): boolean {
  return (
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLInputElement && ["text", "search", "email", "url"].includes(el.type))
  );
}

/** 01 / 02 / 03 step bar. Earlier steps are one tap away; later ones check the current step first. */
function Stepper({
  labels,
  step,
  onJump,
}: {
  labels: string[];
  step: number;
  onJump: (index: number) => void;
}) {
  return (
    <div role="group" aria-label="Steps" className="flex h-[50px] gap-[3px] rounded-full bg-secondary p-[3px]">
      {labels.map((label, i) => {
        const current = i === step;
        const complete = i < step;
        return (
          <button
            key={label}
            type="button"
            aria-current={current ? "step" : undefined}
            aria-label={`Step ${i + 1}: ${label}${complete ? " (done)" : ""}`}
            onClick={() => onJump(i)}
            className={cn(
              "relative flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-1 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              current ? "font-semibold text-foreground" : "font-medium text-muted-foreground",
            )}
          >
            {current && (
              <motion.span
                layoutId="wizard-step-thumb"
                className="absolute inset-0 rounded-full bg-card shadow-sm dark:bg-accent"
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span
              className={cn(
                "relative flex h-[18px] min-w-[22px] items-center justify-center rounded-md px-1 text-[11px] font-bold",
                current
                  ? "bolt-badge"
                  : complete
                    ? "bg-primary text-primary-foreground"
                    : "bg-foreground/10 text-foreground/70",
              )}
              aria-hidden
            >
              {complete ? <Check size={11} strokeWidth={3.4} /> : `0${i + 1}`}
            </span>
            <span className="relative truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** First screen when creating: pick what kind of habit this is. */
function KindChooser({ onPick }: { onPick: (kind: HabitKind) => void }) {
  const option =
    "flex w-full cursor-pointer items-center gap-4 rounded-[28px] border border-border/80 bg-card p-4 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div className="space-y-3 px-5 pt-3">
      <button type="button" onClick={() => onPick("build")} className={option}>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-q-sage/15 text-q-sage">
          <Sprout size={24} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg">Build a habit</span>
          <span className="block text-sm text-muted-foreground">
            Start a small practice and grow it with daily reps.
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden />
      </button>
      <button type="button" onClick={() => onPick("break")} className={option}>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-q-slate/15 text-q-slate">
          <Ban size={24} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg">Break a bad habit</span>
          <span className="block text-sm text-muted-foreground">
            Name it, then hold the card each day you avoid it.
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden />
      </button>
    </div>
  );
}

export function HabitWizard({
  open,
  onOpenChange,
  editHabit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editHabit: Habit | null;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  // Creating starts on the kind chooser; editing skips it (kind is fixed).
  const [kindChosen, setKindChosen] = useState(false);
  // A text field has focus, i.e. the keyboard is (probably) up.
  const [typing, setTyping] = useState(false);
  const exampleIdx = useRef(0);
  const scroller = useRef<HTMLDivElement | null>(null);
  const today = localToday();

  const form = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    mode: "onBlur",
    defaultValues: defaultsFrom(editHabit),
  });

  // Re-seed the form whenever the wizard opens (create fresh vs edit).
  useEffect(() => {
    if (open) {
      form.reset(defaultsFrom(editHabit));
      setStep(0);
      setKindChosen(editHabit !== null);
      setTyping(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editHabit?.id]);

  // Each step starts at its top.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [step, kindChosen]);

  // As the keyboard slides up the sheet shrinks to the space above it; keep
  // the field being typed in visible inside the step's scroll area.
  const revealFocused = () => {
    const s = scroller.current;
    const el = document.activeElement;
    if (!s || !(el instanceof HTMLElement) || !s.contains(el) || !isTextField(el)) return;
    const r = el.getBoundingClientRect();
    const box = s.getBoundingClientRect();
    const margin = 16;
    if (r.bottom > box.bottom - margin) s.scrollBy({ top: r.bottom - box.bottom + margin, behavior: "smooth" });
    else if (r.top < box.top + margin) s.scrollBy({ top: r.top - box.top - margin, behavior: "smooth" });
  };
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    vv?.addEventListener("resize", revealFocused);
    window.addEventListener("resize", revealFocused);
    return () => {
      vv?.removeEventListener("resize", revealFocused);
      window.removeEventListener("resize", revealFocused);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const values = form.watch();
  const kind = values.kind;
  const steps = STEPS[kind];

  const pickKind = (k: HabitKind) => {
    form.setValue("kind", k);
    // Break habits: greys only, always "anytime". Reset the color default so
    // a build-palette pick never leaks into the break palette (and vice versa).
    form.setValue("color", k === "break" ? "slate" : "ember");
    if (k === "break") form.setValue("anytime", true);
    setKindChosen(true);
  };

  // "Try an example" cycles the presets into the form as a starting point.
  const shuffleExample = () => {
    if (kind === "break") {
      const preset = BREAK_PRESETS[exampleIdx.current % BREAK_PRESETS.length];
      exampleIdx.current += 1;
      form.setValue("name", preset.name, { shouldValidate: true });
      form.setValue("identity", preset.identity);
      form.setValue("icon", preset.icon);
      return;
    }
    const preset = HABIT_PRESETS[exampleIdx.current % HABIT_PRESETS.length];
    exampleIdx.current += 1;
    form.setValue("name", preset.name, { shouldValidate: true });
    form.setValue("action", preset.action, { shouldValidate: true });
    form.setValue("tinyVersion", preset.tiny);
    form.setValue("identity", preset.identity);
    form.setValue("icon", preset.icon);
  };

  const save = useMutation({
    mutationFn: async (v: WizardValues) => {
      const isBreak = v.kind === "break";
      const reminderTimes = isBreak
        ? null
        : [v.reminder1, v.reminder2, v.reminder3]
            .map((s) => s.trim())
            .filter((s) => /^\d{2}:\d{2}$/.test(s))
            .join(",") || null;
      const payload: Partial<InsertHabit> = {
        kind: v.kind,
        name: v.name.trim(),
        // Break habits have no separate action — the title IS the habit.
        action: isBreak ? v.name.trim() : v.action.trim(),
        tinyVersion: isBreak ? null : v.tinyVersion.trim() || null,
        identity: v.identity.trim(),
        time: isBreak || v.anytime ? null : v.time,
        location: isBreak ? null : v.location.trim() || null,
        color: v.color,
        icon: v.icon || null,
        scheduleDays: v.scheduleDays,
        reminderTimes,
      };
      if (editHabit) return api.updateHabit(editHabit.id, payload);
      return api.createHabit({ ...payload, startDate: today } as InsertHabit);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.today(today) });
      queryClient.invalidateQueries({ queryKey: queryKeys.progress(today) });
      queryClient.invalidateQueries({ queryKey: queryKeys.habits() });
      // Any other open day (a backfill view) should pick up the change too.
      queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("/api/today"),
      });
      onOpenChange(false);
    },
  });

  const isLast = step === steps.length - 1;
  const next = async () => {
    const valid = await form.trigger(steps[step].fields);
    if (!valid) return;
    if (isLast) {
      await form.handleSubmit((v) => save.mutate(v))();
    } else {
      setStep((s) => s + 1);
    }
  };

  const jumpTo = async (target: number) => {
    if (target === step) return;
    if (target < step) {
      setStep(target);
      return;
    }
    const fields = steps.slice(step, target).flatMap((s) => s.fields);
    if (await form.trigger(fields)) setStep(target);
  };

  // Return / "next" on the phone keyboard moves to the next field, and from
  // the step's last field acts like Continue.
  const onFieldKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" || !isTextField(e.target)) return;
    e.preventDefault();
    const fields = Array.from(
      scroller.current?.querySelectorAll<HTMLInputElement>("input") ?? [],
    ).filter((el) => isTextField(el));
    const at = fields.indexOf(e.target as HTMLInputElement);
    const following = fields[at + 1];
    if (following) following.focus();
    else {
      (e.target as HTMLInputElement).blur();
      void next();
    }
  };

  // Rebuilt every render on purpose: the steps read values via form.watch(),
  // which re-renders THIS component — a memoised element would go stale
  // (e.g. the time field never appearing after "Set a time").
  const renderStep = () => {
    const shuffle = !editHabit && step === 0 ? shuffleExample : undefined;
    if (kind === "break") {
      switch (step) {
        case 0:
          return <StepDefineBreak form={form} onShuffle={shuffle} />;
        case 1:
          return <StepDaysBreak form={form} />;
        default:
          return <StepIdentity form={form} kind="break" />;
      }
    }
    switch (step) {
      case 0:
        return <StepDefine form={form} onShuffle={shuffle} />;
      case 1:
        return <StepAnchor form={form} />;
      default:
        return <StepIdentity form={form} />;
    }
  };

  const title = editHabit ? "Edit habit" : kindChosen && kind === "break" ? "Break a habit" : "New habit";
  const footerPad = typing ? "12px" : "max(env(safe-area-inset-bottom), 20px)";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent aria-describedby={undefined} className="h-[94dvh]">
        <div className="flex items-center justify-between gap-3 px-5 pt-2">
          <DrawerTitle className="font-sans text-lg font-bold tracking-tight">{title}</DrawerTitle>
          <DrawerClose asChild>
            <button
              type="button"
              aria-label="Close"
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-accent"
            >
              <X size={18} />
            </button>
          </DrawerClose>
        </div>

        {!kindChosen ? (
          <>
            <p className="px-5 pt-1 text-sm text-muted-foreground">What do you want to do?</p>
            <KindChooser onPick={pickKind} />
            <div
              className="mt-auto flex border-t border-border/80 px-5 pt-3"
              style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
            >
              <Button
                type="button"
                variant="outline"
                className="h-[52px] flex-1 text-[15px]"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2.5 px-5 pt-3">
              <Stepper labels={steps.map((s) => s.label)} step={step} onJump={jumpTo} />
              <SentenceCard
                name={values.name}
                kind={kind}
                action={values.action}
                tinyVersion={values.tinyVersion}
                anytime={values.anytime}
                time={values.time}
                location={values.location}
                scheduleDays={values.scheduleDays}
                identity={values.identity}
                color={values.color}
                compact={typing}
              />
            </div>

            <div
              ref={scroller}
              className="flex-1 overflow-y-auto px-5 pb-5 pt-4"
              onFocusCapture={(e) => {
                setTyping(isTextField(e.target));
                // again once the keyboard has finished sliding in
                window.setTimeout(revealFocused, 350);
              }}
              onBlurCapture={(e) => {
                // Hopping field to field keeps the keyboard up — don't flicker.
                if (!isTextField(e.relatedTarget)) setTyping(false);
              }}
              onKeyDown={onFieldKeyDown}
            >
              {renderStep()}
              {save.isError && (
                <p role="alert" className="pt-4 text-sm text-destructive">
                  Couldn't save the habit — try again.
                </p>
              )}
            </div>

            <div
              className="flex gap-2 border-t border-border/80 px-5 pt-3"
              style={{ paddingBottom: footerPad }}
            >
              <Button
                type="button"
                variant="outline"
                className="h-[52px] flex-1 text-[15px]"
                disabled={save.isPending}
                onClick={() => {
                  if (step > 0) setStep((s) => s - 1);
                  else if (editHabit) onOpenChange(false);
                  else setKindChosen(false);
                }}
              >
                {step === 0 && editHabit ? "Cancel" : "Back"}
              </Button>
              <Button
                type="button"
                className="h-[52px] flex-[1.4] text-[15px] font-semibold"
                disabled={save.isPending}
                onClick={next}
              >
                {isLast ? (editHabit ? "Save changes" : "Create habit") : "Continue"}
              </Button>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
