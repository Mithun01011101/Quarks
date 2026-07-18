import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import type { Habit, InsertHabit } from "@shared/schema";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { api, queryKeys } from "@/lib/api";
import { localToday } from "@/lib/dates";
import { HABIT_PRESETS } from "@/lib/presets";
import { cn } from "@/lib/utils";
import { SentenceCard } from "./sentence-card";
import { StepAnchor, StepDefine, StepIdentity } from "./wizard-steps";

const wizardSchema = z
  .object({
    name: z.string().trim().min(1, "Give it a short name").max(40, "Keep it under 40 characters"),
    action: z.string().trim().min(1, "Say what you'll do").max(80, "Keep it under 80 characters"),
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
    if (!values.anytime && !/^\d{2}:\d{2}$/.test(values.time)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["time"],
        message: "Pick a time, or switch to any time",
      });
    }
  });

export type WizardValues = z.infer<typeof wizardSchema>;

// Three numbered steps, like the reference flow: define / obvious / identity.
const STEPS: { fields: (keyof WizardValues)[] }[] = [
  { fields: ["name", "action", "tinyVersion"] },
  { fields: ["time", "scheduleDays"] },
  { fields: ["identity", "color"] },
];

function defaultsFrom(habit: Habit | null): WizardValues {
  if (!habit) {
    return {
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editHabit?.id]);

  const values = form.watch();

  // "Different example" cycles the presets into the form as a starting point.
  const shuffleExample = () => {
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
      const reminderTimes =
        [v.reminder1, v.reminder2, v.reminder3]
          .map((s) => s.trim())
          .filter((s) => /^\d{2}:\d{2}$/.test(s))
          .join(",") || null;
      const payload: Partial<InsertHabit> = {
        name: v.name.trim(),
        action: v.action.trim(),
        tinyVersion: v.tinyVersion.trim() || null,
        identity: v.identity.trim(),
        time: v.anytime ? null : v.time,
        location: v.location.trim() || null,
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

  const isLast = step === STEPS.length - 1;
  const next = async () => {
    const valid = await form.trigger(STEPS[step].fields);
    if (!valid) return;
    if (isLast) {
      await form.handleSubmit((v) => save.mutate(v))();
    } else {
      setStep((s) => s + 1);
    }
  };

  const stepBody = useMemo(() => {
    switch (step) {
      case 0:
        return <StepDefine form={form} />;
      case 1:
        return <StepAnchor form={form} />;
      default:
        return <StepIdentity form={form} />;
    }
  }, [step, form]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent aria-describedby={undefined} className="h-[94dvh]">
        <div className="flex items-center justify-between px-5 pb-1 pt-3">
          <DrawerTitle className="font-sans text-lg font-bold tracking-tight">
            {editHabit ? "Edit your habit" : "How to create your habit"}
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

        <div className="px-5 pt-2">
          <SentenceCard
            action={values.action}
            tinyVersion={values.tinyVersion}
            anytime={values.anytime}
            time={values.time}
            location={values.location}
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
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          )}
          <Button type="button" className="flex-1" disabled={save.isPending} onClick={next}>
            {isLast ? (editHabit ? "Save changes" : "Create habit") : "Continue"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
