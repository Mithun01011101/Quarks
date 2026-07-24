import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, Sprout, X } from "lucide-react";
import type { Habit, InsertHabit } from "@shared/schema";
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
    kind: z.enum(["build", "break"]),
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
const STEPS: Record<"build" | "break", { fields: (keyof WizardValues)[] }[]> = {
  build: [
    { fields: ["name", "action", "tinyVersion"] },
    { fields: ["time", "scheduleDays"] },
    { fields: ["identity", "color"] },
  ],
  break: [
    { fields: ["name"] },
    { fields: ["scheduleDays"] },
    { fields: ["identity", "color"] },
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

function StepChips({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-between px-5 pt-4">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-label={`Step ${i + 1}${i === step ? " (current)" : ""}`}
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold transition-colors",
            i === step
              ? "bolt-badge text-white"
              : i < step
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground",
          )}
        >
          {`0${i + 1}`}
        </span>
      ))}
    </div>
  );
}

/** First screen when creating: pick what kind of habit this is. */
function KindChooser({ onPick }: { onPick: (kind: "build" | "break") => void }) {
  return (
    <div className="space-y-3 px-5 pt-4">
      <button
        type="button"
        onClick={() => onPick("build")}
        className="flex w-full cursor-pointer items-center gap-4 rounded-3xl border border-border/70 bg-card p-5 text-left shadow-sm transition-colors hover:bg-accent"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-q-sage/15 text-q-sage">
          <Sprout size={24} />
        </span>
        <span>
          <span className="block font-display text-lg">Build a habit</span>
          <span className="block text-sm text-muted-foreground">
            Start a small practice and grow it with daily reps.
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => onPick("break")}
        className="flex w-full cursor-pointer items-center gap-4 rounded-3xl border border-border/70 bg-card p-5 text-left shadow-sm transition-colors hover:bg-accent"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-q-slate/15 text-q-slate">
          <Ban size={24} />
        </span>
        <span>
          <span className="block font-display text-lg">Break a bad habit</span>
          <span className="block text-sm text-muted-foreground">
            Name it, then hold the card each day you avoid it.
          </span>
        </span>
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
  const exampleIdx = useRef(0);
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editHabit?.id]);

  const values = form.watch();
  const kind = values.kind;
  const steps = STEPS[kind];

  const pickKind = (k: "build" | "break") => {
    form.setValue("kind", k);
    // Break habits: greys only, always "anytime". Reset the color default so
    // a build-palette pick never leaks into the break palette (and vice versa).
    form.setValue("color", k === "break" ? "slate" : "ember");
    if (k === "break") form.setValue("anytime", true);
    setKindChosen(true);
  };

  // "Different example" cycles the presets into the form as a starting point.
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

  const stepBody = useMemo(() => {
    if (kind === "break") {
      switch (step) {
        case 0:
          return <StepDefineBreak form={form} />;
        case 1:
          return <StepDaysBreak form={form} />;
        default:
          return <StepIdentity form={form} kind="break" />;
      }
    }
    switch (step) {
      case 0:
        return <StepDefine form={form} />;
      case 1:
        return <StepAnchor form={form} />;
      default:
        return <StepIdentity form={form} />;
    }
  }, [step, form, kind]);

  const title = !kindChosen
    ? "What do you want to do?"
    : editHabit
      ? "Edit your habit"
      : kind === "break"
        ? "How to break your habit"
        : "How to create your habit";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent aria-describedby={undefined} className="h-[94dvh]">
        <div className="flex items-center justify-between px-5 pb-1 pt-3">
          <DrawerTitle className="font-sans text-lg font-bold tracking-tight">
            {title}
          </DrawerTitle>
          <DrawerClose asChild>
            <button
              type="button"
              aria-label="Close"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-accent"
            >
              <X size={16} />
            </button>
          </DrawerClose>
        </div>

        {!kindChosen ? (
          <>
            <KindChooser onPick={pickKind} />
            <div
              className="mt-auto flex gap-2 border-t border-border/70 p-5"
              style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
            >
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="px-5 pt-2">
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
                onShuffle={!editHabit && step === 0 ? shuffleExample : undefined}
              />
            </div>

            <StepChips step={step} />

            <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-4 pt-4">
              {stepBody}
              {save.isError && (
                <p className="text-sm text-destructive">Couldn't save the habit — try again.</p>
              )}
            </div>

            <div
              className="flex gap-2 border-t border-border/70 p-5"
              style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
            >
              {step > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={save.isPending}
                  onClick={() => setStep((s) => s - 1)}
                >
                  Back
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() =>
                    editHabit ? onOpenChange(false) : setKindChosen(false)
                  }
                >
                  {editHabit ? "Cancel" : "Back"}
                </Button>
              )}
              <Button type="button" className="flex-1" disabled={save.isPending} onClick={next}>
                {isLast ? (editHabit ? "Save changes" : "Create habit") : "Continue"}
              </Button>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
