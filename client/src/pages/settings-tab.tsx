import { useState } from "react";
import { Download, LogOut, Moon, Smartphone, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { NotificationSetup } from "@/components/notification-setup";
import { useTheme } from "@/components/theme-provider";
import {
  hapticsEnabled,
  setHapticsEnabled,
  setSoundEnabled,
  soundEnabled,
} from "@/lib/settings";
import { playComplete } from "@/lib/audio";
import { cn } from "@/lib/utils";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="px-1 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function Row({
  label,
  caption,
  htmlFor,
  children,
}: {
  label: string;
  caption?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[60px] items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-[15px] font-medium">
          {label}
        </label>
        {caption && <p className="text-[13px] leading-[18px] text-muted-foreground">{caption}</p>}
      </div>
      {children}
    </div>
  );
}

const THEME_OPTIONS = [
  { key: "light", label: "Light", icon: Sun },
  { key: "dark", label: "Dark", icon: Moon },
  { key: "system", label: "Auto", icon: Smartphone },
] as const;

export default function SettingsTab({
  compact,
  onCompactChange,
}: {
  compact: boolean;
  onCompactChange: (compact: boolean) => void;
}) {
  const { theme, setTheme } = useTheme();
  const [sound, setSound] = useState(soundEnabled);
  const [haptics, setHaptics] = useState(hapticsEnabled);

  return (
    <div className="space-y-6 py-2">
      <Section title="Appearance">
        <div className="flex gap-2">
          {THEME_OPTIONS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              aria-pressed={theme === key}
              onClick={() => setTheme(key)}
              className={cn(
                "flex min-h-[68px] flex-1 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                theme === key
                  ? "border-primary bg-accent text-foreground"
                  : "border-border/80 bg-card text-muted-foreground hover:bg-accent",
              )}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-card">
          <Row
            label="Compact habit list"
            caption="Slim rows instead of big pebbles on Today."
            htmlFor="settings-compact"
          >
            <Switch id="settings-compact" checked={compact} onCheckedChange={onCompactChange} />
          </Row>
        </div>
      </Section>

      <Section title="Feedback">
        <div className="divide-y divide-border/80 overflow-hidden rounded-2xl border border-border/80 bg-card">
          <Row
            label="Completion sound"
            caption="The little chime when a habit lands."
            htmlFor="settings-sound"
          >
            <Switch
              id="settings-sound"
              checked={sound}
              onCheckedChange={(v) => {
                setSound(v);
                setSoundEnabled(v);
                if (v) playComplete();
              }}
            />
          </Row>
          <Row label="Vibration" caption="Haptic taps on your phone." htmlFor="settings-haptics">
            <Switch
              id="settings-haptics"
              checked={haptics}
              onCheckedChange={(v) => {
                setHaptics(v);
                setHapticsEnabled(v);
              }}
            />
          </Row>
        </div>
      </Section>

      <Section title="Reminders">
        <NotificationSetup />
      </Section>

      <Section title="Data">
        <div className="divide-y divide-border/80 overflow-hidden rounded-2xl border border-border/80 bg-card">
          <Row label="Export backup" caption="Download everything as a JSON file.">
            <Button asChild variant="secondary" className="h-11 shrink-0">
              <a href="/api/export" download>
                <Download size={15} /> Export
              </a>
            </Button>
          </Row>
          <Row label="Sign out" caption="Only applies when the password gate is on.">
            <Button asChild variant="outline" className="h-11 shrink-0">
              <a href="/logout">
                <LogOut size={15} /> Sign out
              </a>
            </Button>
          </Row>
        </div>
      </Section>

      <p className="px-1 pt-2 text-center text-xs leading-relaxed text-muted-foreground">
        Quarks — a personal habit tracker inspired by the ideas in Atomic
        Habits. Built for one person, one rep at a time.
      </p>
    </div>
  );
}
