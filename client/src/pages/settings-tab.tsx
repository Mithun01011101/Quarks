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
      <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function Row({
  label,
  caption,
  children,
}: {
  label: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
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

export default function SettingsTab() {
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
                "flex flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-2xl border py-3.5 text-xs font-medium transition-colors",
                theme === key
                  ? "border-primary bg-accent text-foreground"
                  : "border-border/70 bg-card text-muted-foreground hover:bg-accent",
              )}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Feedback">
        <div className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-card">
          <Row label="Completion sound" caption="The little chime when a habit lands.">
            <Switch
              checked={sound}
              onCheckedChange={(v) => {
                setSound(v);
                setSoundEnabled(v);
                if (v) playComplete();
              }}
              aria-label="Completion sound"
            />
          </Row>
          <Row label="Vibration" caption="Haptic taps on your phone.">
            <Switch
              checked={haptics}
              onCheckedChange={(v) => {
                setHaptics(v);
                setHapticsEnabled(v);
              }}
              aria-label="Vibration"
            />
          </Row>
        </div>
      </Section>

      <Section title="Reminders">
        <NotificationSetup />
      </Section>

      <Section title="Data">
        <div className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-card">
          <Row
            label="Export backup"
            caption="Download everything as a JSON file."
          >
            <Button asChild size="sm" variant="secondary">
              <a href="/api/export" download>
                <Download size={15} /> Export
              </a>
            </Button>
          </Row>
          <Row
            label="Sign out"
            caption="Only applies when the password gate is on."
          >
            <Button asChild size="sm" variant="outline">
              <a href="/logout">
                <LogOut size={15} /> Sign out
              </a>
            </Button>
          </Row>
        </div>
      </Section>

      <p className="px-1 pt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
        Quarks — a personal habit tracker inspired by the ideas in Atomic
        Habits. Built for one person, one rep at a time.
      </p>
    </div>
  );
}
