import { useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Bell, Plus, RefreshCw, X, icons } from "lucide-react";
import type { HabitKind } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/segmented-control";
import {
  BREAK_IDENTITY_SUGGESTIONS,
  IDENTITY_SUGGESTIONS,
  LOCATION_SUGGESTIONS,
  WIZARD_ICONS,
} from "@/lib/presets";
import { BREAK_COLORS, QUARK_COLORS } from "@/lib/colors";
import { IDENTITY_PREFIX, daysShort, formatTime12 } from "@/lib/sentence";
import { cn } from "@/lib/utils";
import type { WizardValues } from "./habit-wizard";

type Form = UseFormReturn<WizardValues>;

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function Chip({
  children,
  active = false,
  dashed = false,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  dashed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-11 shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary font-semibold text-primary-foreground"
          : dashed
            ? "border-dashed border-muted-foreground/60 hover:bg-accent/60"
            : "border-input hover:bg-accent/60",
      )}
    >
      {children}
    </button>
  );
}

/** Chips in one row that scrolls sideways, bleeding to the sheet's edges. */
function ChipRow({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="scrollbar-hide -mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5"
    >
      {children}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-[13px] text-destructive">
      {message}
    </p>
  );
}

function Optional() {
  return <span className="font-normal text-muted-foreground"> (optional)</span>;
}

function GroupLabel({
  id,
  htmlFor,
  children,
  aside,
}: {
  id?: string;
  htmlFor?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-6 items-center justify-between gap-3">
      {htmlFor ? (
        <label id={id} htmlFor={htmlFor} className="text-sm font-semibold">
          {children}
        </label>
      ) : (
        <p id={id} className="text-sm font-semibold">
          {children}
        </p>
      )}
      {aside}
    </div>
  );
}

function ExampleButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-my-2.5 flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <RefreshCw size={13} aria-hidden /> Try an example
    </button>
  );
}

/** 01 — Define: name, action, two-minute version. */
export function StepDefine({ form, onShuffle }: { form: Form; onShuffle?: () => void }) {
  const { register, formState } = form;
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <GroupLabel htmlFor="wizard-name" aside={onShuffle && <ExampleButton onClick={onShuffle} />}>
          Name
        </GroupLabel>
        <Input
          id="wizard-name"
          placeholder="Read"
          autoComplete="off"
          enterKeyHint="next"
          {...register("name")}
        />
        <FieldError message={formState.errors.name?.message} />
      </div>
      <div className="space-y-1.5">
        <GroupLabel htmlFor="wizard-action">I will…</GroupLabel>
        <Input
          id="wizard-action"
          placeholder="read one page"
          autoComplete="off"
          enterKeyHint="next"
          {...register("action")}
        />
        <FieldError message={formState.errors.action?.message} />
      </div>
      <div className="space-y-1.5">
        <GroupLabel htmlFor="wizard-tiny">
          Two-minute version
          <Optional />
        </GroupLabel>
        <Input
          id="wizard-tiny"
          placeholder="read one paragraph"
          autoComplete="off"
          enterKeyHint="done"
          {...register("tinyVersion")}
        />
        <p className="text-[13px] text-muted-foreground">
          Shrink it until showing up is easy. Leave empty if it's already tiny.
        </p>
      </div>
    </div>
  );
}

/** Days-of-week toggles, shared by the build and break flows. */
function DaysPicker({ form }: { form: Form }) {
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
    <div role="group" aria-labelledby="wizard-days" className="space-y-2">
      <GroupLabel
        id="wizard-days"
        aside={
          <span className="text-[13px] text-muted-foreground">
            {scheduleDays ? daysShort(scheduleDays) : "No days"}
          </span>
        }
      >
        Which days?
      </GroupLabel>
      <div className="flex justify-between gap-1">
        {DAY_LABELS.map((label, day) => {
          const active = scheduleDays.includes(String(day));
          return (
            <button
              key={day}
              type="button"
              aria-label={DAY_NAMES[day]}
              aria-pressed={active}
              onClick={() => toggleDay(day)}
              className={cn(
                "flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-primary bg-primary font-semibold text-primary-foreground"
                  : "border-input font-medium text-muted-foreground",
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

const REMINDER_KEYS = ["reminder1", "reminder2", "reminder3"] as const;

function minusMinutes(time: string, by: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (h * 60 + m - by + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Up to three reminder times, added one at a time. */
function Reminders({ form }: { form: Form }) {
  const { watch, setValue } = form;
  const values = REMINDER_KEYS.map((k) => watch(k));
  const count = values.filter(Boolean).length;

  const add = () => {
    const slot = REMINDER_KEYS.findIndex((_, i) => !values[i]);
    if (slot < 0) return;
    const time = watch("time");
    // Default: a quarter of an hour before the habit's own time, else 9 am.
    const fallback =
      !watch("anytime") && /^\d{2}:\d{2}$/.test(time) ? minusMinutes(time, 15) : "09:00";
    setValue(REMINDER_KEYS[slot], fallback, { shouldDirty: true });
  };

  return (
    <div role="group" aria-labelledby="wizard-reminders" className="space-y-2">
      <GroupLabel id="wizard-reminders">
        Reminders
        <Optional />
      </GroupLabel>
      <div className="flex flex-wrap gap-2">
        {REMINDER_KEYS.map((key, i) =>
          values[i] ? (
            <div
              key={key}
              className="flex h-11 items-center gap-1.5 rounded-full bg-secondary pl-3.5"
            >
              <Bell size={15} className="shrink-0 text-muted-foreground" aria-hidden />
              <input
                type="time"
                aria-label={`Reminder ${i + 1}`}
                value={values[i]}
                onChange={(e) => setValue(key, e.target.value, { shouldDirty: true })}
                className="h-11 min-w-0 bg-transparent text-sm font-medium focus-visible:outline-none"
              />
              <button
                type="button"
                aria-label={`Remove the ${formatTime12(values[i])} reminder`}
                onClick={() => setValue(key, "", { shouldDirty: true })}
                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X size={15} />
              </button>
            </div>
          ) : null,
        )}
        {count < 3 && (
          <button
            type="button"
            onClick={add}
            className="flex h-11 cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-muted-foreground/60 pl-3 pr-4 text-sm font-medium transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus size={16} strokeWidth={2.2} aria-hidden /> Add reminder
          </button>
        )}
      </div>
      <p className="text-[13px] text-muted-foreground">
        They ring while Quarks is open — turn notifications on in Settings.
      </p>
    </div>
  );
}

/** 02 — Make it obvious: time, place, days, reminders. */
export function StepAnchor({ form }: { form: Form }) {
  const { register, watch, setValue, formState } = form;
  const anytime = watch("anytime");
  const location = watch("location");
  const isPreset = LOCATION_SUGGESTIONS.some(
    (l) => l.toLowerCase() === location.trim().toLowerCase(),
  );
  const [custom, setCustom] = useState(() => location.trim() !== "" && !isPreset);
  const customInput = useRef<HTMLInputElement | null>(null);
  const { ref: locationRef, ...locationField } = register("location");

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <GroupLabel>When?</GroupLabel>
        <SegmentedControl
          label="When"
          options={[
            { value: "any", label: "Any time" },
            { value: "set", label: "Set a time" },
          ]}
          value={anytime ? "any" : "set"}
          onChange={(v) => setValue("anytime", v === "any", { shouldValidate: true })}
        />
        {!anytime && (
          <div className="space-y-1.5">
            {/* native time field: the phone's own time wheel / dial */}
            <Input id="wizard-time" type="time" aria-label="Time" {...register("time")} />
            <FieldError message={formState.errors.time?.message} />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <GroupLabel>
          Where?
          <Optional />
        </GroupLabel>
        <ChipRow label="Places">
          {LOCATION_SUGGESTIONS.map((l) => {
            const active = !custom && location.trim().toLowerCase() === l.toLowerCase();
            return (
              <Chip
                key={l}
                active={active}
                onClick={() => {
                  setCustom(false);
                  setValue("location", active ? "" : l);
                }}
              >
                {l}
              </Chip>
            );
          })}
          <Chip
            dashed
            active={custom}
            onClick={() => {
              if (!custom && isPreset) setValue("location", "");
              setCustom(true);
              window.setTimeout(() => customInput.current?.focus(), 0);
            }}
          >
            Somewhere else…
          </Chip>
        </ChipRow>
        {custom && (
          <Input
            id="wizard-location"
            aria-label="Where"
            placeholder="the garden"
            autoComplete="off"
            enterKeyHint="done"
            {...locationField}
            ref={(el) => {
              locationRef(el);
              customInput.current = el;
            }}
          />
        )}
      </div>

      <DaysPicker form={form} />
      <Reminders form={form} />
    </div>
  );
}

/** 01 (break) — name the habit to quit; the title lands on the card verbatim. */
export function StepDefineBreak({ form, onShuffle }: { form: Form; onShuffle?: () => void }) {
  const { register, formState } = form;
  return (
    <div className="space-y-1.5">
      <GroupLabel htmlFor="wizard-name" aside={onShuffle && <ExampleButton onClick={onShuffle} />}>
        Title
      </GroupLabel>
      <Input
        id="wizard-name"
        placeholder="No doomscrolling"
        autoComplete="off"
        enterKeyHint="done"
        {...register("name")}
      />
      <FieldError message={formState.errors.name?.message} />
      <p className="text-[13px] text-muted-foreground">
        Write it exactly as you want it on the card — most people start with "No…".
      </p>
    </div>
  );
}

/** 02 (break) — which days the avoid-it streak counts. */
export function StepDaysBreak({ form }: { form: Form }) {
  return (
    <div className="space-y-3">
      <DaysPicker form={form} />
      <p className="text-[13px] text-muted-foreground">
        Most bad habits are every-day battles — leave all days on unless the habit truly
        belongs to certain days.
      </p>
    </div>
  );
}

/** 03 — Identity + style: who it makes you, color, icon. */
export function StepIdentity({ form, kind = "build" }: { form: Form; kind?: HabitKind }) {
  const { register, setValue, watch, formState } = form;
  const identity = watch("identity");
  const color = watch("color");
  const icon = watch("icon");
  const isBreak = kind === "break";
  const palette = isBreak ? BREAK_COLORS : QUARK_COLORS;
  const suggestions = isBreak ? BREAK_IDENTITY_SUGGESTIONS : IDENTITY_SUGGESTIONS;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="space-y-1.5">
          <GroupLabel htmlFor="wizard-identity">…{IDENTITY_PREFIX}</GroupLabel>
          <Input
            id="wizard-identity"
            placeholder={isBreak ? "puts the phone down" : "reads every day"}
            autoComplete="off"
            enterKeyHint="done"
            {...register("identity")}
          />
          <FieldError message={formState.errors.identity?.message} />
        </div>
        <ChipRow label="Suggestions">
          {suggestions.map((s) => (
            <Chip
              key={s}
              active={identity.trim() === s}
              onClick={() => setValue("identity", s, { shouldValidate: true })}
            >
              {s}
            </Chip>
          ))}
        </ChipRow>
      </div>

      <div role="group" aria-labelledby="wizard-color" className="space-y-2">
        <GroupLabel id="wizard-color">Color</GroupLabel>
        <div className={cn("gap-0.5", isBreak ? "flex gap-2" : "grid grid-cols-8")}>
          {palette.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-label={c.label}
              aria-pressed={color === c.key}
              onClick={() => setValue("color", c.key)}
              className="flex aspect-square w-full max-w-11 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={cn(
                  "h-9 w-9 rounded-full transition-transform",
                  c.bg,
                  color === c.key && "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-card",
                )}
              />
            </button>
          ))}
        </div>
      </div>

      <div role="group" aria-labelledby="wizard-icon" className="space-y-2">
        <GroupLabel id="wizard-icon">
          Icon
          <Optional />
        </GroupLabel>
        <div className="grid grid-cols-7 gap-1">
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
                  "flex aspect-square cursor-pointer items-center justify-center rounded-2xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-primary bg-accent text-foreground"
                    : "border-border/80 text-muted-foreground hover:bg-accent/60",
                )}
              >
                <IconComp size={19} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
