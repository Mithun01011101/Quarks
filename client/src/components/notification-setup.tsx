import { Bell, BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/use-notifications";

export function NotificationSetup() {
  const { permission, request, supported } = useNotifications();

  if (!supported) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3.5">
        <BellOff size={18} className="mt-0.5 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Reminders unavailable</p>
          <p className="text-xs text-muted-foreground">
            This browser doesn't support notifications. On iPhone, install
            Quarks to the home screen first.
          </p>
        </div>
      </div>
    );
  }

  if (permission === "granted") {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3.5">
        <BellRing size={18} className="mt-0.5 shrink-0 text-q-sage" />
        <div>
          <p className="text-sm font-medium">Reminders are on</p>
          <p className="text-xs text-muted-foreground">
            They ring at each habit's reminder time while Quarks is open. Set
            times when creating or editing a habit.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3.5">
      <Bell size={18} className="mt-0.5 shrink-0 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-sm font-medium">
          {permission === "denied" ? "Reminders are blocked" : "Turn on reminders"}
        </p>
        <p className="text-xs text-muted-foreground">
          {permission === "denied"
            ? "Allow notifications for this site in your browser settings, then come back."
            : "Get a nudge at each habit's reminder time while Quarks is open."}
        </p>
        {permission === "default" && (
          <Button variant="secondary" className="mt-2.5 h-11" onClick={() => request()}>
            Allow notifications
          </Button>
        )}
      </div>
    </div>
  );
}
