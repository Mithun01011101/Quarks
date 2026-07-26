import type { UseFormReturn } from "react-hook-form";
import { icons } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  BREAK_IDENTITY_SUGGESTIONS,
  IDENTITY_SUGGESTIONS,
  LOCATION_SUGGESTIONS,
  WIZARD_ICONS,
} from "@/lib/presets";
import { BREAK_COLORS, QUARK_COLORS } from "@/lib/colors";
import { cn } from "@/lib/utils";
import type { WizardValues } from "./habit-wizard";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function Chip({
  children,
  active = false,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-secondary/50 text-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

export function StepHeading({ title, children }: { title: string; children: string }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

/** 01 — Define your habit: name, action, tiny version. */
export function StepDefine({ form }: { form: UseFormReturn<WizardValues> }) {
  const { register, formState } = form;
  return (
    <div className="space-y-5">
      <StepHeading title="Define your habit">
        A habit works best as a small, regular practice — something you could
        finish in two minutes on a hard day. You can always do more.
      </StepHeading>
      <div className="space-y-2">
        <Label htmlFor="wizard-name">Name</Label>
        <Input id="wizard-name" placeholder="Read" autoComplete="off" {...register("name")} />
        <FieldError message={formState.errors.name?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="wizard-action">I will…</Label>
        <Input
          id="wizard-action"
          placeholder="read one page"
          autoComplete="off"
          {...register("action")}
        />
        <FieldError message={formState.errors.action?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="wizard-tiny">Two-minute version (optional)</Label>
        <Input
          id="wizard-tiny"
          placeholder="read one paragraph"
          autoComplete="off"
          {...register("tinyVersion")}
        />
        <p className="text-xs text-muted-foreground">
          Shrink it until showing up is easy. Leave empty if it's already tiny.
        </p>
      </div>
    </div>
  );
}

/** Days-of-week row, shared by the build anchor step and the break days step. */
function DaysPicker({ form }: { form: UseFormReturn<WizardValues> }) {
  const { watch, setValue, formState } = form;
  const scheduleDays = watch("scheduleDays");

  const toggleDay = (day: number) => {
    const d = String(day);
    const next = scheduleDays.includes(d)
      ? scheduleDays.replace(d, "")
      : (scheduleDays + d).split("").sort().join("");
    setValue("scheduleDays", next, { shouldValidate: true });
  };

  return (
    <div className="space-y-2">
      <Label>Days</Label>
      <div className="flex gap-1.5">
        {DAY_LABELS.map((label, day) => {
          const active = scheduleDays.includes(String(day));
          return (
            <button
              key={day}
              type="button"
              aria-label={`Toggle ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day]}`}
              aria-pressed={active}
              onClick={() => toggleDay(day)}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-secondary/50 text-muted-foreground",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      <FieldError message={formState.errors.scheduleDays?.message} />
    </div>
  );
}

/** 02 — Make it obvious: time, place, days, optional nudges. */
export function StepAnchor({ form }: { form: UseFormReturn<WizardValues> }) {
  const { register, watch, setValue, formState } = form;
  const anytime = watch("anytime");
  const location = watch("location");

  return (
    <div className="space-y-5">
      <StepHeading title="Make it obvious">
        Tie the habit to a time and place that already exist in your day — the
        clearer the cue, the less you'll rely on willpower.
      </StepHeading>
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="wizard-anytime">Any time of day</Label>
          <p className="text-xs text-muted-foreground">Or pin it to a moment below.</p>
        </div>
        <Switch
          id="wizard-anytime"
          checked={anytime}
          onCheckedChange={(v) => setValue("anytime", v, { shouldValidate: true })}
        />
      </div>
      {!anytime && (
        <div className="space-y-2">
          <Label htmlFor="wizard-time">At</Label>
          <Input id="wizard-time" type="time" {...register("time")} />
          <FieldError message={formState.errors.time?.message} />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="wizard-location">Where (optional)</Label>
        <Input
          id="wizard-location"
          placeholder="Kitchen"
          autoComplete="off"
          {...register("location")}
        />
        <div className="flex flex-wrap gap-2">
          {LOCATION_SUGGESTIONS.map((l) => (
            <Chip key={l} active={location === l} onClick={() => setValue("location", l)}>
              {l}
            </Chip>
          ))}
        </div>
      </div>
      <DaysPicker form={form} />
      <div className="space-y-2 border-t border-border/70 pt-4">
        <Label>Nudges (optional)</Label>
        <p className="text-xs text-muted-foreground">
          Up to three reminder times. They ring while Quarks is open — turn
          notifications on from Settings.
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Input type="time" aria-label="First reminder" {...register("reminder1")} />
          <Input type="time" aria-label="Second reminder" {...register("reminder2")} />
          <Input type="time" aria-label="Third reminder" {...register("reminder3")} />
        </div>
      </div>
    </div>
  );
}

/** 01 (break) — name the habit to quit; title lands on the card verbatim. */
export function StepDefineBreak({ form }: { form: UseFormReturn<WizardValues> }) {
  const { register, formState } = form;
  return (
    <div className="space-y-5">
      <StepHeading title="Name the habit to break">
        Write it exactly as you want to see it on the card — most people start
        with "No…". Keep it short and concrete.
      </StepHeading>
      <div className="space-y-2">
        <Label htmlFor="wizard-name">Title</Label>
        <Input
          id="wizard-name"
          placeholder="No doomscrolling"
          autoComplete="off"
          {...register("name")}
        />
        <FieldError message={formState.errors.name?.message} />
      </div>
    </div>
  );
}

/** 02 (break) — which days the avoid-it streak counts. */
export function StepDaysBreak({ form }: { form: UseFormReturn<WizardValues> }) {
  return (
    <div className="space-y-5">
      <StepHeading title="Which days count?">
        Most bad habits are every-day battles — leave all days on unless the
        habit truly belongs to certain days.
      </StepHeading>
      <DaysPicker form={form} />
    </div>
  );
}

/** 03 — Identity + style: who it makes you, color, icon. */
export function StepIdentity({
  form,
  kind = "build",
}: {
  form: UseFormReturn<WizardValues>;
  kind?: "build" | "break";
}) {
  const { register, setValue, watch, formState } = form;
  const color = watch("color");
  const icon = watch("icon");
  const isBreak = kind === "break";
  const palette = isBreak ? BREAK_COLORS : QUARK_COLORS;
  const suggestions = isBreak ? BREAK_IDENTITY_SUGGESTIONS : IDENTITY_SUGGESTIONS;

  return (
    <div className="space-y-5">
      <StepHeading title={isBreak ? "Who does quitting make you?" : "Who does it make you?"}>
        {isBreak
          ? "Every day you avoid it is a vote for the person you're becoming. Finish the sentence, then pick a muted tone."
          : "Every rep is a vote for the person you're becoming. Finish the sentence, then give the habit a color of its own."}
      </StepHeading>
      <div className="space-y-2">
        <Label htmlFor="wizard-identity">…the type of person who</Label>
        <Input
          id="wizard-identity"
          placeholder={isBreak ? "puts the phone down" : "reads every day"}
          autoComplete="off"
          {...register("identity")}
        />
        <FieldError message={formState.errors.identity?.message} />
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <Chip key={s} onClick={() => setValue("identity", s, { shouldValidate: true })}>
            {s}
          </Chip>
        ))}
      </div>
      <div className="space-y-2 pt-1">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2.5">
          {palette.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-label={c.label}
              aria-pressed={color === c.key}
              onClick={() => setValue("color", c.key)}
              className={cn(
                "h-9 w-9 rounded-full transition-transform",
                c.bg,
                color === c.key && "scale-110 ring-2 ring-ring ring-offset-2 ring-offset-card",
              )}
            />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Icon (optional)</Label>
        <div className="grid grid-cols-8 gap-1.5">
          {WIZARD_ICONS.map((name) => {
            const IconComp = icons[name as keyof typeof icons];
            if (!IconComp) return null;
            const active = icon === name;
            return (
              <button
                key={name}
                type="button"
                aria-label={name}
                aria-pressed={active}
                onClick={() => setValue("icon", active ? "" : name)}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl border transition-colors",
                  active
                    ? "border-primary bg-accent text-foreground"
                    : "border-border bg-secondary/40 text-muted-foreground hover:bg-accent",
                )}
              >
                <IconComp size={18} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
